import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import test from "node:test";
import { createCliProgram } from "../../src/cli-args.ts";
import {
  archivedDecisionId,
  archivedSourcePath,
  candidateDecisionBody,
  commitWorkspace,
  currentDecisionId,
  currentSourcePath,
  decisionFilePath,
  withTemporaryWorkspace,
  initializeGitRepository,
  runGit,
  runSourceCli,
  withGitFixtureWorkspace,
  writeDecision
} from "../support.ts";

export {
  archivedDecisionId,
  archivedSourcePath,
  assert,
  candidateDecisionBody,
  commitWorkspace,
  createCliProgram,
  currentDecisionId,
  currentSourcePath,
  decisionFilePath,
  execFileSync,
  fs,
  initializeGitRepository,
  os,
  path,
  process,
  runGit,
  runSourceCli,
  test,
  withGitFixtureWorkspace,
  withTemporaryWorkspace,
  writeDecision
};

export async function createStageScaleFixture(
  workspaceRoot: string,
  decisionCount: number
): Promise<string[]> {
  const decisionIds = Array.from(
    { length: decisionCount },
    (_, index) => `use-scale-${String(index).padStart(3, "0")}`
  );
  await Promise.all(
    decisionIds.map(async (decisionId, index) => {
      await writeDecision(
        workspaceRoot,
        decisionId,
        candidateDecisionBody({ title: `规模化决策 ${index}` })
          .replace("status: candidate", "status: active")
          .replace("alignment: null", "alignment: aligned")
          .replace("createdAt: null", "createdAt: 2026-08-15T00:00:00Z")
      );
    })
  );
  return decisionIds;
}

export async function countGitInvocations<T>(
  operation: () => Promise<T>
): Promise<{ callCount: number; result: T }> {
  const wrapperDirectory = await fs.mkdtemp(
    path.join(os.tmpdir(), "decision-stage-git-")
  );
  const wrapperPath = path.join(wrapperDirectory, "git");
  const countPath = path.join(wrapperDirectory, "calls.log");
  const gitExecutable = execFileSync("sh", ["-c", "command -v git"], {
    encoding: "utf8"
  }).trim();
  const previousPath = process.env.PATH;
  const previousCountPath = process.env.DECISION_STAGE_GIT_COUNT_PATH;
  const previousGitExecutable = process.env.DECISION_STAGE_REAL_GIT;
  await fs.writeFile(
    wrapperPath,
    "#!/bin/sh\n" +
      'printf "1\\n" >> "$DECISION_STAGE_GIT_COUNT_PATH" || exit 1\n' +
      'exec "$DECISION_STAGE_REAL_GIT" "$@"\n',
    "utf8"
  );
  await fs.chmod(wrapperPath, 0o755);
  process.env.DECISION_STAGE_GIT_COUNT_PATH = countPath;
  process.env.DECISION_STAGE_REAL_GIT = gitExecutable;
  process.env.PATH = `${wrapperDirectory}${path.delimiter}${previousPath ?? ""}`;
  try {
    const result = await operation();
    let calls = "";
    try {
      calls = await fs.readFile(countPath, "utf8");
    } catch (error) {
      if (
        !(error instanceof Error && "code" in error && error.code === "ENOENT")
      ) {
        throw error;
      }
    }
    return {
      callCount:
        calls.trim().length === 0 ? 0 : calls.trim().split("\n").length,
      result
    };
  } finally {
    if (previousPath === undefined) {
      delete process.env.PATH;
    } else {
      process.env.PATH = previousPath;
    }
    if (previousCountPath === undefined) {
      delete process.env.DECISION_STAGE_GIT_COUNT_PATH;
    } else {
      process.env.DECISION_STAGE_GIT_COUNT_PATH = previousCountPath;
    }
    if (previousGitExecutable === undefined) {
      delete process.env.DECISION_STAGE_REAL_GIT;
    } else {
      process.env.DECISION_STAGE_REAL_GIT = previousGitExecutable;
    }
    await fs.rm(wrapperDirectory, { force: true, recursive: true });
  }
}
