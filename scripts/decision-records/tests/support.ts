import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  runDecisionRecordsCli
} from "../../../skills/decision-records/scripts/decision-records.mjs";
import type { DecisionIndex } from "../src/types.ts";

const testsDirectory = path.dirname(fileURLToPath(import.meta.url));
const rootDirectory = path.resolve(testsDirectory, "../../..");

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
    { encoding: "utf8", windowsHide: true }
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

export async function runBundledCli(
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
      exitCode: await runDecisionRecordsCli(args),
      stderr: stderr.join(""),
      stdout: stdout.join("")
    };
  } finally {
    console.log = originalLog;
    console.error = originalError;
  }
}

export async function runSuccessfulCli(
  args: readonly string[]
): Promise<string> {
  const result = await runBundledCli(args);
  assert.equal(result.exitCode, 0);
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
): DecisionIndex["records"][number] {
  const entry = index.records.find((candidate) => candidate.path === decisionPath);
  assert.ok(entry, "Expected indexed decision " + decisionPath);
  return entry;
}
