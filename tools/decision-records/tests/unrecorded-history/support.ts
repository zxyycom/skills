import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { validateDecisionRecords } from "../../src/index.ts";
import {
  archivedRelativePath,
  candidateDecisionBody,
  commitWorkspace,
  currentRelativePath,
  decisionFilePath,
  fileExists,
  findIndexEntry,
  initializeGitRepository,
  readIndex,
  runSourceCli,
  runSuccessfulSourceCli,
  withFixtureWorkspace,
  withGitFixtureWorkspace
} from "../support.ts";

export {
  archivedRelativePath,
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
  runSourceCli,
  runSuccessfulSourceCli,
  test,
  validateDecisionRecords,
  withFixtureWorkspace,
  withGitFixtureWorkspace
};

export async function establishUnrecordedIntermediate(
  workspaceRoot: string
): Promise<{ indexPath: string; intermediatePath: string }> {
  const decisionsDirectory = path.join(workspaceRoot, "docs", "decisions");
  const intermediatePath = decisionFilePath(
    workspaceRoot,
    unrecordedIntermediateRelativePath
  );
  await fs.writeFile(intermediatePath, candidateDecisionBody(), "utf8");
  await runSuccessfulSourceCli([
    "evolve",
    "--successor",
    "aligned=" + unrecordedIntermediateRelativePath,
    "--relation",
    "修订=" + currentRelativePath,
    "--root",
    workspaceRoot
  ]);
  return {
    indexPath: path.join(decisionsDirectory, "decision-index.json"),
    intermediatePath
  };
}

export const unrecordedIntermediateRelativePath = "use-unrecorded-intermediate";
