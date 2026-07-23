import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  runDecisionRecordsCli
} from "../../../skills/decision-records/scripts/decision-records.mjs";
import {
  runDecisionRecordsCli as runSourceDecisionRecordsCli
} from "../src/cli.ts";
import type {
  DecisionIndex,
  DecisionIndexState
} from "../src/types.ts";

const testsDirectory = path.dirname(fileURLToPath(import.meta.url));
const rootDirectory = path.resolve(testsDirectory, "../../..");
const fixtureGitEnvironment: NodeJS.ProcessEnv = { ...process.env };
// Fixture repositories own their indexes; a caller's alternate index belongs elsewhere.
delete fixtureGitEnvironment.GIT_INDEX_FILE;

export const fixtureRoot = path.join(testsDirectory, "fixtures", "valid");
export const generatedCliPath = path.join(
  rootDirectory,
  "skills",
  "decision-records",
  "scripts",
  "decision-records.mjs"
);
export const generatedDeclarationPath = path.join(
  rootDirectory,
  "skills",
  "decision-records",
  "scripts",
  "decision-records.d.mts"
);
export const generatedSchemaPath = path.join(
  rootDirectory,
  "skills",
  "decision-records",
  "references",
  "decision-index.schema.json"
);
export const generatedUpdaterPath = path.join(
  rootDirectory,
  "skills",
  "decision-records",
  "scripts",
  "update-skill.mjs"
);

export const currentRelativePath = "tooling/use-generated-cli.md";
export const archivedRelativePath = "tooling/260710-use-source-cli.md";

export type CliExecution = {
  exitCode: number;
  stderr: string;
  stdout: string;
};

export function runGit(
  workspaceRoot: string,
  args: readonly string[]
): string {
  return execFileSync(
    "git",
    ["-C", workspaceRoot, ...args],
    { encoding: "utf8", env: fixtureGitEnvironment, windowsHide: true }
  );
}

export function initializeGitRepository(
  workspaceRoot: string,
  options: { commit?: boolean } = {}
): void {
  runGit(workspaceRoot, ["init", "--quiet"]);
  runGit(workspaceRoot, ["config", "user.name", "Decision Records Tests"]);
  runGit(workspaceRoot, ["config", "user.email", "decision-records@example.invalid"]);
  runGit(workspaceRoot, ["config", "commit.gpgSign", "false"]);
  runGit(workspaceRoot, ["config", "core.autocrlf", "false"]);
  runGit(workspaceRoot, ["config", "core.safecrlf", "false"]);
  runGit(workspaceRoot, ["config", "core.hooksPath", ".git/no-hooks"]);
  if (options.commit !== false) {
    runGit(workspaceRoot, ["add", "."]);
    runGit(workspaceRoot, [
      "commit",
      "--quiet",
      "--no-gpg-sign",
      "-m",
      "Create decision fixture"
    ]);
  }
}

export async function createFixtureRepository(): Promise<string> {
  const workspaceRoot = await fs.mkdtemp(
    path.join(os.tmpdir(), "decision-records-query-")
  );
  await fs.cp(fixtureRoot, workspaceRoot, { recursive: true });
  initializeGitRepository(workspaceRoot);
  return workspaceRoot;
}

async function captureCliExecution(
  runner: (args: readonly string[]) => Promise<number>,
  args: readonly string[]
): Promise<CliExecution> {
  const stdout: string[] = [];
  const stderr: string[] = [];
  const originalLog = console.log;
  const originalError = console.error;
  console.log = (...values: unknown[]) => {
    stdout.push(`${values.map(String).join(" ")}\n`);
  };
  console.error = (...values: unknown[]) => {
    stderr.push(`${values.map(String).join(" ")}\n`);
  };

  try {
    return {
      exitCode: await runner(args),
      stderr: stderr.join(""),
      stdout: stdout.join("")
    };
  } finally {
    console.log = originalLog;
    console.error = originalError;
  }
}

export async function runBundledCli(
  args: readonly string[]
): Promise<CliExecution> {
  return await captureCliExecution(runDecisionRecordsCli, args);
}

export async function runSourceCli(
  args: readonly string[]
): Promise<CliExecution> {
  return await captureCliExecution(runSourceDecisionRecordsCli, args);
}

export async function runSuccessfulCli(
  args: readonly string[]
): Promise<string> {
  const result = await runBundledCli(args);
  assert.equal(result.exitCode, 0, result.stderr);
  assert.equal(result.stderr, "");
  return result.stdout;
}

export async function runSuccessfulSourceCli(
  args: readonly string[]
): Promise<string> {
  const result = await runSourceCli(args);
  assert.equal(result.exitCode, 0, result.stderr);
  assert.equal(result.stderr, "");
  return result.stdout;
}

export async function traceDecision(
  decisionPath: string,
  options: string[] = [],
  workspaceRoot = fixtureRoot
): Promise<string> {
  return await runSuccessfulCli([
    "trace",
    decisionPath,
    ...options,
    "--root",
    workspaceRoot
  ]);
}

export async function readIndex(indexPath: string): Promise<DecisionIndex> {
  return JSON.parse(await fs.readFile(indexPath, "utf8")) as DecisionIndex;
}

export async function writeIndex(
  indexPath: string,
  index: DecisionIndex
): Promise<void> {
  await fs.writeFile(indexPath, JSON.stringify(index, null, 2) + "\n", "utf8");
}

export function findIndexEntry(
  index: DecisionIndex,
  decisionPath: string
): DecisionIndexState {
  const entry = index.entries.find((candidate) => candidate.id === decisionPath);
  assert.ok(entry, "Expected indexed decision " + decisionPath);
  return entry.state;
}
