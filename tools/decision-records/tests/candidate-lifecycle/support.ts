import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { validateDecisionRecords } from "../../src/index.ts";
import {
  archivedSourcePath,
  candidateDecisionBody,
  commitWorkspace,
  currentRelativePath,
  decisionFilePath,
  fileExists,
  findIndexEntry,
  initializeGitRepository,
  readIndex,
  runGit,
  runSourceCli,
  runSuccessfulSourceCli,
  runSuccessfulSourceLifecycleCli,
  withFixtureWorkspace,
  withGitFixtureWorkspace,
  withTemporaryWorkspace,
  writeDecision,
  writeIndex
} from "../support.ts";

export function unindexedBody(id: string): string {
  return [
    "---",
    "title: 验证未登记成员",
    `id: ${id}`,
    "status: candidate",
    "alignment: null",
    "createdAt: null",
    "purpose: 验证多条预写候选可以按显式目标逐条激活。",
    "background: 其他完整候选需要明确提醒，但不应阻断当前目标。",
    "decision: 单次只激活目标，索引排除其他候选并允许等待审核。",
    "tags:",
    "  - decision-records",
    "relations: []",
    "---",
    "",
    "## 目的",
    "- 验证多条预写候选可以按显式目标逐条激活。",
    "",
    "## 背景",
    "- 其他完整候选需要明确提醒，但不应阻断当前目标。",
    "",
    "## 决策",
    "- 采用: 单次只激活目标，索引排除其他候选并允许等待审核。",
    ""
  ].join("\n");
}

export {
  archivedSourcePath,
  assert,
  candidateDecisionBody,
  commitWorkspace,
  currentRelativePath,
  decisionFilePath,
  fileExists,
  findIndexEntry,
  fs,
  initializeGitRepository,
  path,
  readIndex,
  runGit,
  runSourceCli,
  runSuccessfulSourceCli,
  runSuccessfulSourceLifecycleCli,
  test,
  validateDecisionRecords,
  withFixtureWorkspace,
  withGitFixtureWorkspace,
  withTemporaryWorkspace,
  writeDecision,
  writeIndex
};

export async function assertRejectedDiscardPreserves(options: {
  decisionPath: string;
  expectedError: RegExp;
  indexPath: string;
  relativePath: string;
  workspaceRoot: string;
}): Promise<void> {
  const decisionText = await fs.readFile(options.decisionPath, "utf8");
  const indexText = await fs.readFile(options.indexPath, "utf8");
  const result = await runSourceCli([
    "discard",
    options.relativePath,
    "--root",
    options.workspaceRoot
  ]);
  assert.equal(result.exitCode, 1);
  assert.equal(result.stdout, "");
  assert.match(result.stderr, options.expectedError);
  assert.equal(await fs.readFile(options.decisionPath, "utf8"), decisionText);
  assert.equal(await fs.readFile(options.indexPath, "utf8"), indexText);
}
