import {
  decisionFilePath,
  decisionIdForTest,
  sourcePathForTest
} from "./support-record-fixture.ts";
export {
  archivedDecisionId,
  archivedSourcePath,
  candidateDecisionBody,
  currentDecisionId,
  currentSourcePath,
  currentRelativePath,
  archivedRelativePath,
  decisionFilePath,
  decisionIdForTest,
  sourcePathForTest
} from "./support-record-fixture.ts";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  syncDecisionIndex,
  parseDecisionIndex
} from "../src/decision-state-index.ts";
import type { DecisionIndex, DecisionIndexState } from "../src/types.ts";

const testsDirectory = path.dirname(fileURLToPath(import.meta.url));
const rootDirectory = path.resolve(testsDirectory, "../../..");

export const fixtureRoot = path.join(testsDirectory, "fixtures", "valid");
export const generatedCliPath = path.join(
  rootDirectory,
  "skills",
  "decision-records",
  "scripts",
  "decision-records.ts"
);
export const generatedDeclarationPath = path.join(
  rootDirectory,
  "skills",
  "decision-records",
  "scripts",
  "decision-records.d.mts"
);
export const generatedDeclarationDirectory = path.join(
  rootDirectory,
  "skills",
  "decision-records",
  "scripts",
  "decision-records-sdk"
);
export const generatedSchemaPath = path.join(
  rootDirectory,
  "skills",
  "decision-records",
  "references",
  "decision-index.schema.json"
);
let fixtureIndexText: Promise<string> | null = null;

export type CliExecution = {
  exitCode: number;
  stderr: string;
  stdout: string;
};

export async function createFixtureWorkspace(label: string): Promise<string> {
  const workspaceRoot = await fs.mkdtemp(
    path.join(os.tmpdir(), `decision-records-${label}-`)
  );
  try {
    await fs.cp(fixtureRoot, workspaceRoot, { recursive: true });
    await fs.writeFile(
      path.join(workspaceRoot, "docs/decisions/decision-index.json"),
      await preparedFixtureIndexText(),
      "utf8"
    );
    return workspaceRoot;
  } catch (error) {
    await fs
      .rm(workspaceRoot, { force: true, recursive: true })
      .catch((cleanupError: unknown) => {
        throw new AggregateError(
          [error, cleanupError],
          "Fixture creation and workspace cleanup failed"
        );
      });
    throw error;
  }
}

async function preparedFixtureIndexText(): Promise<string> {
  fixtureIndexText ??= createFixtureIndexText();
  try {
    return await fixtureIndexText;
  } catch (error) {
    fixtureIndexText = null;
    throw error;
  }
}

async function createFixtureIndexText(): Promise<string> {
  const templatePath = await fs.mkdtemp(
    path.join(os.tmpdir(), "decision-records-fixture-template-")
  );
  let preparationFailure: { readonly error: unknown } | undefined;
  try {
    await fs.cp(fixtureRoot, templatePath, { recursive: true });
    const synced = await syncDecisionIndex({
      decisionsDirectory: path.join(templatePath, "docs/decisions"),
      mode: "write"
    });
    assert.equal(synced.status, "ok", JSON.stringify(synced));
    return await fs.readFile(
      path.join(templatePath, "docs/decisions/decision-index.json"),
      "utf8"
    );
  } catch (error) {
    preparationFailure = { error };
    throw error;
  } finally {
    await fs
      .rm(templatePath, { force: true, recursive: true })
      .catch((cleanupError: unknown) => {
        if (preparationFailure)
          throw new AggregateError(
            [preparationFailure.error, cleanupError],
            "Fixture index preparation and template cleanup failed"
          );
        throw cleanupError;
      });
  }
}

export async function withFixtureWorkspace<T>(
  label: string,
  operation: (workspaceRoot: string) => Promise<T>
): Promise<T> {
  const workspaceRoot = await createFixtureWorkspace(label);
  try {
    return await operation(workspaceRoot);
  } finally {
    await fs.rm(workspaceRoot, { force: true, recursive: true });
  }
}

/** 为不需要既有记录或 Git 历史的测试创建并清理独立空工作区。 */
export async function withTemporaryWorkspace<T>(
  label: string,
  operation: (workspaceRoot: string) => Promise<T>
): Promise<T> {
  const workspaceRoot = await fs.mkdtemp(
    path.join(os.tmpdir(), `decision-records-${label}-`)
  );
  try {
    return await operation(workspaceRoot);
  } finally {
    await fs.rm(workspaceRoot, { force: true, recursive: true });
  }
}

type CliRunner = (
  args: readonly string[],
  options: {
    io: {
      stderr: (text: string) => void;
      stdout: (text: string) => void;
    };
  }
) => Promise<number>;

async function captureCliExecution(
  runner: CliRunner,
  args: readonly string[]
): Promise<CliExecution> {
  const stdout: string[] = [];
  const stderr: string[] = [];
  const exitCode = await runner(args, {
    io: {
      stderr: (text) => stderr.push(text),
      stdout: (text) => stdout.push(text)
    }
  });
  return { exitCode, stderr: stderr.join(""), stdout: stdout.join("") };
}

export async function runSourceCli(
  args: readonly string[]
): Promise<CliExecution> {
  const { runDecisionRecordsCli } = await import("../src/cli.ts");
  return await captureCliExecution(runDecisionRecordsCli, args);
}

/**
 * Exercises lifecycle and relation processing without making a Git-history
 * assertion. History-specific cases use runSourceCli with their own Git
 * fixture; filesystem and graph cases explicitly acknowledge unrecorded
 * history instead of probing the host Git executable.
 */
export async function runSourceLifecycleCli(
  args: readonly string[]
): Promise<CliExecution> {
  const keepUnrecordedHistory = /^(reactivate|set-relations)$/u.test(
    args[0] ?? ""
  )
    ? []
    : ["--keep-unrecorded-history"];
  return await runSourceCli([...args, ...keepUnrecordedHistory]);
}

export async function runBundledCli(
  args: readonly string[]
): Promise<CliExecution> {
  const { runDecisionRecordsCli } =
    await import("../../../skills/decision-records/scripts/decision-records.ts");
  return await captureCliExecution(runDecisionRecordsCli, args);
}

export async function runSuccessfulSourceCli(
  args: readonly string[]
): Promise<string> {
  const result = await runSourceCli(args);
  assert.equal(result.exitCode, 0, result.stderr);
  assert.equal(result.stderr, "");
  return result.stdout;
}

export async function runSuccessfulSourceLifecycleCli(
  args: readonly string[]
): Promise<string> {
  const result = await runSourceLifecycleCli(args);
  assert.equal(result.exitCode, 0, result.stderr);
  assert.equal(result.stderr, "");
  return result.stdout;
}

export async function runSuccessfulCli(
  args: readonly string[]
): Promise<string> {
  const result = await runBundledCli(args);
  assert.equal(result.exitCode, 0, result.stderr);
  assert.equal(result.stderr, "");
  return result.stdout;
}

export async function traceDecision(
  decisionId: string,
  options: string[] = [],
  workspaceRoot = fixtureRoot
): Promise<string> {
  return await runSuccessfulCli([
    "trace",
    decisionId,
    ...options,
    "--root",
    workspaceRoot
  ]);
}

export async function writeDecision(
  workspaceRoot: string,
  sourcePath: string,
  markdown: string
): Promise<void> {
  const normalizedSourcePath = sourcePathForTest(sourcePath);
  const targetPath = decisionFilePath(workspaceRoot, normalizedSourcePath);
  await fs.mkdir(path.dirname(targetPath), { recursive: true });
  const id = normalizedSourcePath
    .replace(/^archive\//u, "")
    .replace(/\.md$/iu, "");
  const normalized = markdown.includes("\nid: ")
    ? markdown.replace(/^id: .+$/mu, `id: ${id}`)
    : markdown.replace(/^title: .+$/mu, (title) => `${title}\nid: ${id}`);
  await fs.writeFile(targetPath, normalized, "utf8");
}

export async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function readIndex(
  workspaceRootOrIndexPath: string
): Promise<DecisionIndex> {
  const indexPath = workspaceRootOrIndexPath.endsWith(".json")
    ? workspaceRootOrIndexPath
    : path.join(
        workspaceRootOrIndexPath,
        "docs",
        "decisions",
        "decision-index.json"
      );
  const parsed = parseDecisionIndex(
    await fs.readFile(indexPath, "utf8"),
    indexPath
  );
  if (parsed.status === "error") {
    throw new Error(
      `Expected a valid decision index at ${indexPath}: ${parsed.diagnostics
        .map((diagnostic) => diagnostic.message)
        .join("; ")}`
    );
  }
  return parsed.value;
}

export async function writeIndex(
  indexPath: string,
  index: unknown
): Promise<void> {
  await fs.writeFile(indexPath, JSON.stringify(index, null, 2) + "\n", "utf8");
}

export function findIndexEntry(
  index: DecisionIndex,
  decisionId: string
): DecisionIndexState {
  const entry = index.entries[decisionIdForTest(decisionId)];
  assert.ok(entry, `Expected indexed decision ${decisionId}`);
  return entry;
}

export function initializeGitRepository(workspaceRoot: string): void {
  runGit(workspaceRoot, ["init", "--quiet"]);
  runGit(workspaceRoot, ["config", "core.autocrlf", "false"]);
  runGit(workspaceRoot, [
    "config",
    "user.email",
    "decision-records@example.invalid"
  ]);
  runGit(workspaceRoot, ["config", "user.name", "Decision Records Test"]);
}

export function commitWorkspace(
  workspaceRoot: string,
  message = "baseline"
): void {
  runGit(workspaceRoot, ["add", "."]);
  runGit(workspaceRoot, ["commit", "--quiet", "--message", message]);
}

export function runGit(workspaceRoot: string, args: readonly string[]): string {
  return execFileSync("git", ["-C", workspaceRoot, ...args], {
    encoding: "utf8",
    windowsHide: true
  });
}
