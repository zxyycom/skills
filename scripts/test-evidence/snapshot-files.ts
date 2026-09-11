import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import type { CommandResult } from "./snapshot-types.ts";
import { repositoryAstGrepVersion } from "./snapshot-types.ts";

const commandOutputByteLimit = 67_108_864;

export function snapshotFailure(message: string): Error {
  return new Error(`test-evidence snapshot: ${message}`);
}

export function isWithin(root: string, candidate: string): boolean {
  const relative = path.relative(root, candidate);
  return (
    relative === "" ||
    (!relative.startsWith("..") && !path.isAbsolute(relative))
  );
}

export async function requireRegularProjectFile(
  workspaceRoot: string,
  relativePath: string,
  description: string
): Promise<string> {
  if (
    relativePath.length === 0 ||
    path.isAbsolute(relativePath) ||
    relativePath.includes("\0")
  ) {
    throw snapshotFailure(`${description} must be a non-empty relative path`);
  }
  const resolved = path.resolve(workspaceRoot, relativePath);
  if (!isWithin(workspaceRoot, resolved)) {
    throw snapshotFailure(
      `${description} must remain inside the workspace: ${relativePath}`
    );
  }
  let stat: Awaited<ReturnType<typeof fs.lstat>>;
  try {
    stat = await fs.lstat(resolved);
  } catch (error) {
    throw snapshotFailure(
      `${description} is unavailable: ${relativePath} (${error instanceof Error ? error.message : String(error)})`
    );
  }
  if (stat.isSymbolicLink() || !stat.isFile()) {
    throw snapshotFailure(
      `${description} must be a regular file: ${relativePath}`
    );
  }
  return resolved;
}

export function posixRelative(workspaceRoot: string, filePath: string): string {
  const relative = path.relative(workspaceRoot, filePath);
  if (!isWithin(workspaceRoot, filePath) || relative.length === 0) {
    throw snapshotFailure(
      `could not create a project-relative path for ${filePath}`
    );
  }
  return relative.split(path.sep).join("/");
}

export async function runSnapshotCommand(
  executable: string,
  args: readonly string[],
  workspaceRoot: string
): Promise<CommandResult> {
  return await new Promise((resolve, reject) => {
    const child = spawn(executable, args, {
      cwd: workspaceRoot,
      env: { ...process.env, NO_COLOR: "1" },
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true
    });
    let output = "";
    let outputBytes = 0;
    let outputExceededLimit = false;
    const appendOutput = (chunk: string): void => {
      if (outputExceededLimit) return;
      outputBytes += Buffer.byteLength(chunk);
      if (outputBytes > commandOutputByteLimit) {
        outputExceededLimit = true;
        child.kill();
        return;
      }
      output += chunk;
    };
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", appendOutput);
    child.stderr.on("data", appendOutput);
    child.once("error", reject);
    child.once("close", (exitCode) => {
      if (outputExceededLimit) {
        reject(
          snapshotFailure("subprocess output exceeded its 64 MiB safety limit")
        );
        return;
      }
      resolve({ exitCode, output });
    });
  });
}

export async function resolveAstGrep(workspaceRoot: string): Promise<string> {
  const executable = path.join(
    workspaceRoot,
    "node_modules",
    ".bin",
    process.platform === "win32" ? "ast-grep.cmd" : "ast-grep"
  );
  await requireRegularProjectFile(
    workspaceRoot,
    path.relative(workspaceRoot, executable),
    "project-local ast-grep executable"
  );
  const version = await runSnapshotCommand(
    executable,
    ["--version"],
    workspaceRoot
  );
  if (
    version.exitCode !== 0 ||
    version.output.trim() !== `ast-grep ${repositoryAstGrepVersion}`
  ) {
    throw snapshotFailure(
      `project-local ast-grep must be ${repositoryAstGrepVersion}; received ${version.output.trim() || `exit ${version.exitCode}`}`
    );
  }
  return executable;
}
