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

export async function createFixtureWorkspace(
  label = "query"
): Promise<string> {
  const workspaceRoot = await fs.mkdtemp(
    path.join(os.tmpdir(), `decision-records-${label}-`)
  );
  await fs.cp(fixtureRoot, workspaceRoot, { recursive: true });
  return workspaceRoot;
}

export function initializeGitRepository(workspaceRoot: string): void {
  runGit(workspaceRoot, ["init", "--quiet"]);
  runGit(workspaceRoot, ["config", "core.autocrlf", "false"]);
  runGit(workspaceRoot, [
    "config",
    "user.email",
    "decision-records@example.invalid"
  ]);
  runGit(workspaceRoot, [
    "config",
    "user.name",
    "Decision Records Test"
  ]);
}

export function commitWorkspace(
  workspaceRoot: string,
  message = "decision baseline"
): void {
  runGit(workspaceRoot, ["add", "."]);
  runGit(workspaceRoot, ["commit", "--quiet", "--message", message]);
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

export function decisionFilePath(
  workspaceRoot: string,
  relativePath: string
): string {
  return path.join(
    workspaceRoot,
    "docs",
    "decisions",
    ...relativePath.split("/")
  );
}

export function candidateDecisionBody(options: {
  relationTarget?: string;
} = {}): string {
  const relations = options.relationTarget === undefined
    ? ["relations: []"]
    : [
        "relations:",
        "  - type: 修订",
        "    target: " + options.relationTarget
      ];
  return [
    "---",
    "title: 使用 Markdown 建立状态",
    "status: candidate",
    "alignment: null",
    "createdAt: null",
    "purpose: 验证 Markdown 生命周期独立定义候选和已建立状态。",
    "background: 索引和版本历史不应共同承担决策成员身份。",
    "decision: 使用显式 candidate 状态区分候选与已建立决策。",
    ...relations,
    "---",
    "",
    "## 目的",
    "- 验证 Markdown 生命周期独立定义候选和已建立状态。",
    "",
    "## 背景",
    "- 索引和版本历史不应共同承担决策成员身份。",
    "",
    "## 决策",
    "- 采用: 使用显式 candidate 状态区分候选与已建立决策。",
    ""
  ].join("\n");
}

export async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
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
  const entry = index.entries[decisionPath];
  assert.ok(entry, "Expected indexed decision " + decisionPath);
  return entry.state;
}

function runGit(workingDirectory: string, args: readonly string[]): string {
  return execFileSync("git", ["-C", workingDirectory, ...args], {
    encoding: "utf8",
    windowsHide: true
  });
}
