import assert from "node:assert/strict";
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

export const currentRelativePath = "project-tooling/use-generated-cli.md";
export const archivedRelativePath = "decision-records/260710-use-source-cli.md";
export const testDomainId = "decision-records";

export type CliExecution = {
  exitCode: number;
  stderr: string;
  stdout: string;
};

export async function writeTestDomainCatalog(
  decisionsDirectory: string
): Promise<void> {
  await fs.mkdir(decisionsDirectory, { recursive: true });
  await fs.writeFile(
    path.join(decisionsDirectory, "decision-domains.json"),
    JSON.stringify({
      schemaVersion: 1,
      domains: [{
        id: testDomainId,
        description: "维护长期决策的记录契约、生命周期、索引、查询与演进关系。"
      }]
    }, null, 2) + "\n",
    "utf8"
  );
}

export async function createFixtureWorkspace(): Promise<string> {
  const workspaceRoot = await fs.mkdtemp(
    path.join(os.tmpdir(), "decision-records-query-")
  );
  await fs.cp(fixtureRoot, workspaceRoot, { recursive: true });
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
