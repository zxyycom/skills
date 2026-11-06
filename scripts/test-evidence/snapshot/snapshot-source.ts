import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import * as v from "valibot";
import type { RepositoryTestSource } from "./snapshot-types.ts";
import {
  isWithin,
  posixRelative,
  requireRegularProjectFile,
  resolveAstGrep,
  runSnapshotCommand,
  snapshotFailure
} from "./snapshot-files.ts";
import {
  repositoryTestProjectId,
  repositoryTestScopeId
} from "./snapshot-types.ts";

async function trackedSourceFiles(
  workspaceRoot: string,
  excludedSourcePaths: ReadonlySet<string>
): Promise<readonly string[]> {
  const result = await runSnapshotCommand(
    "git",
    [
      "ls-files",
      "-z",
      "--cached",
      "--others",
      "--exclude-standard",
      "--",
      "scripts",
      "tools",
      "skills",
      ".cargo"
    ],
    workspaceRoot
  );
  if (result.exitCode !== 0) {
    throw snapshotFailure(
      `git ls-files failed while fingerprinting source inputs: ${result.output.trim()}`
    );
  }
  return result.output
    .split("\0")
    .filter((entry) => entry.length > 0)
    .filter((entry) => !excludedSourcePaths.has(entry.replaceAll("\\", "/")))
    .filter(
      (entry) =>
        entry.startsWith("tools/record-cli/") ||
        entry ===
          "tools/investigation-report/tests/fixtures/rename-noop/docs/investigations/same.md" ||
        /\.(?:[cm]?[jt]s|json|rs|toml|lock)$/u.test(entry)
    )
    .sort();
}

function outputSourcePath(
  workspaceRoot: string,
  outputPath: string | undefined
): string | null {
  if (outputPath === undefined) return null;
  const resolved = path.resolve(workspaceRoot, outputPath);
  return isWithin(workspaceRoot, resolved)
    ? posixRelative(workspaceRoot, resolved)
    : null;
}

async function digestSourceFile(
  digest: ReturnType<typeof createHash>,
  workspaceRoot: string,
  relativePath: string,
  fixedInputs: ReadonlySet<string>
): Promise<void> {
  digest.update(relativePath.replaceAll("\\", "/"));
  digest.update("\0");
  try {
    const filePath = await requireRegularProjectFile(
      workspaceRoot,
      relativePath,
      "source fingerprint input"
    );
    digest.update(await fs.readFile(filePath));
  } catch (error) {
    if (fixedInputs.has(relativePath)) throw error;
    const candidate = path.resolve(workspaceRoot, relativePath);
    try {
      await fs.lstat(candidate);
    } catch {
      digest.update("<missing-from-worktree>");
      digest.update("\0");
      return;
    }
    throw error;
  }
  digest.update("\0");
}

export async function sourceFingerprint(
  workspaceRoot: string,
  excludedSourcePaths: ReadonlySet<string> = new Set()
): Promise<RepositoryTestSource> {
  const fixedInputs = new Set([
    "package.json",
    "pnpm-lock.yaml",
    "pnpm-workspace.yaml",
    "tsconfig.json"
  ]);
  const sources = [
    ...new Set([
      ...fixedInputs,
      ...(await trackedSourceFiles(workspaceRoot, excludedSourcePaths))
    ])
  ].sort();
  const digest = createHash("sha256");
  for (const relativePath of sources) {
    await digestSourceFile(digest, workspaceRoot, relativePath, fixedInputs);
  }
  const astGrep = await resolveAstGrep(workspaceRoot);
  const astVersion = await runSnapshotCommand(
    astGrep,
    ["--version"],
    workspaceRoot
  );
  const bunVersion = await runSnapshotCommand(
    "bun",
    ["--version"],
    workspaceRoot
  );
  const nodeVersion = await runSnapshotCommand(
    "node",
    ["--version"],
    workspaceRoot
  );
  if (
    astVersion.exitCode !== 0 ||
    bunVersion.exitCode !== 0 ||
    nodeVersion.exitCode !== 0
  ) {
    throw snapshotFailure(
      "could not fingerprint required Bun, Node, and ast-grep versions"
    );
  }
  const manifest = v.parse(
    v.object({ scripts: v.optional(v.record(v.string(), v.unknown())) }),
    JSON.parse(
      await fs.readFile(path.join(workspaceRoot, "package.json"), "utf8")
    )
  );
  const cargoEnabled = manifest.scripts?.["test:record-rust"] !== undefined;
  let cargoVersion = "";
  let rustVersion = "";
  if (cargoEnabled) {
    const cargo = await runSnapshotCommand(
      "cargo",
      ["--version"],
      path.join(workspaceRoot, "tools/record-cli")
    );
    const rust = await runSnapshotCommand(
      "rustc",
      ["-Vv"],
      path.join(workspaceRoot, "tools/record-cli")
    );
    if (cargo.exitCode !== 0 || rust.exitCode !== 0)
      throw snapshotFailure("could not fingerprint Rust toolchain");
    cargoVersion = cargo.output.trim();
    rustVersion = rust.output.trim();
  }
  digest.update(
    JSON.stringify({
      cargo: cargoVersion,
      rust: rustVersion,
      rustEnvironment: cargoEnabled
        ? Object.fromEntries(
            [
              "RUSTFLAGS",
              "CARGO_ENCODED_RUSTFLAGS",
              "CARGO_BUILD_TARGET",
              "RUSTC_WRAPPER",
              "RUSTC_WORKSPACE_WRAPPER"
            ].map((key) => [key, process.env[key] ?? null])
          )
        : null,
      arch: process.arch,
      astGrep: astVersion.output.trim(),
      bun: bunVersion.output.trim(),
      node: nodeVersion.output.trim(),
      platform: process.platform
    })
  );
  return {
    projectId: repositoryTestProjectId,
    revision: digest.digest("hex"),
    scopeId: repositoryTestScopeId
  };
}

export async function repositoryTestEvidenceSource(
  workspaceRoot: string,
  options: Readonly<{ outputPath?: string }> = {}
): Promise<RepositoryTestSource> {
  const root = path.resolve(workspaceRoot);
  const output = outputSourcePath(root, options.outputPath);
  return await sourceFingerprint(
    root,
    output === null ? new Set<string>() : new Set<string>([output])
  );
}

export function excludedSnapshotOutput(
  workspaceRoot: string,
  outputPath: string | undefined
): ReadonlySet<string> {
  const output = outputSourcePath(workspaceRoot, outputPath);
  return output === null ? new Set<string>() : new Set<string>([output]);
}
