import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { after } from "node:test";
import { fileURLToPath } from "node:url";
import { runDecisionRecordsCli as runSourceDecisionRecordsCli } from "../src/cli.ts";
import { parseDecisionIndex } from "../src/decision-state-index.ts";
import { isDecisionId } from "../src/decision-path.ts";
import type {
  DecisionId,
  DecisionIndex,
  DecisionIndexState
} from "../src/types.ts";
import { runDecisionRecordsCli as runBundledDecisionRecordsCli } from "../../../skills/decision-records/scripts/decision-records.mjs";
import { createGitRepositoryFixture } from "../../shared/tests/git-fixture.ts";

const testsDirectory = path.dirname(fileURLToPath(import.meta.url));
const rootDirectory = path.resolve(testsDirectory, "../../..");

export const fixtureRoot = path.join(testsDirectory, "fixtures", "valid");
const gitFixtureRoot = path.join(testsDirectory, "fixtures", "git-repository");
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
export const currentDecisionId = decisionIdForTest("use-generated-cli.md");
export const archivedDecisionId = decisionIdForTest("260710-use-source-cli.md");
export const currentSourcePath = currentDecisionId;
export const archivedSourcePath = `archive/${archivedDecisionId}`;
// Compatibility aliases keep still-being-migrated test files type-checkable while
// their test intents are rewritten around stable IDs.
export const currentRelativePath = currentDecisionId;
export const archivedRelativePath = archivedDecisionId;

let fixtureTemplate: Promise<string> | null = null;
let fixtureTemplatePath: string | null = null;
let gitFixtureTemplate: Promise<string> | null = null;
let gitFixtureTemplatePath: string | null = null;

after(async () => {
  if (fixtureTemplatePath !== null) {
    await fs.rm(fixtureTemplatePath, { force: true, recursive: true });
    fixtureTemplatePath = null;
  }
  if (gitFixtureTemplatePath !== null) {
    await fs.rm(gitFixtureTemplatePath, { force: true, recursive: true });
    gitFixtureTemplatePath = null;
  }
});

export type CliExecution = {
  exitCode: number;
  stderr: string;
  stdout: string;
};

export function decisionFilePath(
  workspaceRoot: string,
  sourcePath: string
): string {
  return path.join(
    workspaceRoot,
    "docs",
    "decisions",
    ...sourcePath.split("/")
  );
}

export function candidateDecisionBody(
  options: {
    relations?: readonly { target: string; type: string }[];
    tags?: readonly string[];
    title?: string;
  } = {}
): string {
  const relations = options.relations ?? [];
  return [
    "---",
    `title: ${options.title ?? "使用 Markdown 建立状态"}`,
    "status: candidate",
    "alignment: null",
    "createdAt: null",
    "purpose: 验证 Markdown 生命周期独立定义候选和已建立状态。",
    "background: 索引和版本历史不应共同承担决策成员身份。",
    "decision: 使用显式 candidate 状态区分候选与已建立决策。",
    "tags:",
    ...(options.tags ?? ["decision-records"]).map((tag) => `  - ${tag}`),
    relations.length === 0 ? "relations: []" : "relations:",
    ...relations.flatMap((relation) => [
      `  - type: ${relation.type}`,
      `    target: ${relation.target}`
    ]),
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

export async function createFixtureWorkspace(label: string): Promise<string> {
  const workspaceRoot = await fs.mkdtemp(
    path.join(os.tmpdir(), `decision-records-${label}-`)
  );
  try {
    await fs.cp(await fixtureTemplateRoot(), workspaceRoot, {
      recursive: true
    });
    return workspaceRoot;
  } catch (error) {
    await fs.rm(workspaceRoot, { force: true, recursive: true });
    throw error;
  }
}

async function fixtureTemplateRoot(): Promise<string> {
  fixtureTemplate ??= createFixtureTemplate();
  try {
    return await fixtureTemplate;
  } catch (error) {
    fixtureTemplate = null;
    throw error;
  }
}

async function createFixtureTemplate(): Promise<string> {
  const templatePath = await fs.mkdtemp(
    path.join(os.tmpdir(), "decision-records-fixture-template-")
  );
  fixtureTemplatePath = templatePath;
  try {
    await fs.cp(fixtureRoot, templatePath, { recursive: true });
    const synced = await runSourceCli(["sync-index", "--root", templatePath]);
    assert.equal(synced.exitCode, 0, synced.stderr);
    return templatePath;
  } catch (error) {
    await fs.rm(templatePath, { force: true, recursive: true });
    fixtureTemplatePath = null;
    throw error;
  }
}

async function gitFixtureTemplateRoot(): Promise<string> {
  gitFixtureTemplate ??= createGitFixtureTemplate();
  try {
    return await gitFixtureTemplate;
  } catch (error) {
    gitFixtureTemplate = null;
    throw error;
  }
}

async function createGitFixtureTemplate(): Promise<string> {
  const templateParent = await fs.mkdtemp(
    path.join(os.tmpdir(), "decision-records-git-fixture-template-")
  );
  gitFixtureTemplatePath = templateParent;
  try {
    const fixture = await createGitRepositoryFixture({
      fixtureRoot: gitFixtureRoot,
      parentDirectory: templateParent,
      repositoryName: "repository",
      userEmail: "decision-records@example.invalid",
      userName: "Decision Records Test"
    });
    return fixture.repositoryRoot;
  } catch (error) {
    await fs.rm(templateParent, { force: true, recursive: true });
    gitFixtureTemplatePath = null;
    throw error;
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

/**
 * Gives a case a fully private copy of a runner-local Git template. The
 * template is initialized once from the checked-in ordinary fixture, while
 * each case receives independent objects, index, worktree, refs, and config.
 */
export async function withGitFixtureWorkspace<T>(
  label: string,
  operation: (workspaceRoot: string) => Promise<T>
): Promise<T> {
  const workspaceParent = await fs.mkdtemp(
    path.join(os.tmpdir(), `decision-records-${label}-`)
  );
  const workspaceRoot = path.join(workspaceParent, "workspace");
  try {
    await fs.cp(await gitFixtureTemplateRoot(), workspaceRoot, {
      recursive: true
    });
    return await operation(workspaceRoot);
  } finally {
    await fs.rm(workspaceParent, { force: true, recursive: true });
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
  return await captureCliExecution(runSourceDecisionRecordsCli, args);
}

export async function runBundledCli(
  args: readonly string[]
): Promise<CliExecution> {
  return await captureCliExecution(runBundledDecisionRecordsCli, args);
}

export async function runSuccessfulSourceCli(
  args: readonly string[]
): Promise<string> {
  const result = await runSourceCli(args);
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
  const targetPath = decisionFilePath(workspaceRoot, sourcePath);
  await fs.mkdir(path.dirname(targetPath), { recursive: true });
  await fs.writeFile(targetPath, markdown, "utf8");
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
  return entry.state;
}

export function decisionIdForTest(value: string): DecisionId {
  assert.ok(isDecisionId(value), `Expected Decision ID ${value}`);
  return value;
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
