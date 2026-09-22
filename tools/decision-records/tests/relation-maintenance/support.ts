import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import {
  archivedDecisionId,
  candidateDecisionBody,
  currentDecisionId,
  currentRelativePath,
  decisionFilePath,
  findIndexEntry,
  readIndex,
  runSourceCli,
  runSourceLifecycleCli,
  runSuccessfulSourceLifecycleCli,
  withFixtureWorkspace
} from "../support.ts";
import { applyDecisionChanges } from "../../src/decision-transaction.ts";
import { validateDecisionRecords } from "../../src/index.ts";
import { scanDecisionRecords } from "../../src/scan.ts";

const maintenanceRelativePath = "use-relation-maintenance";

export async function establishMaintenanceDecision(
  workspaceRoot: string,
  relations: readonly { target: string; type: string }[] = []
): Promise<string> {
  await fs.writeFile(
    decisionFilePath(workspaceRoot, maintenanceRelativePath),
    candidateDecisionBody({ relations }),
    "utf8"
  );
  await runSuccessfulSourceLifecycleCli([
    "publish",
    maintenanceRelativePath,
    "--alignment",
    "aligned",
    "--root",
    workspaceRoot
  ]);
  return maintenanceRelativePath;
}

export {
  applyDecisionChanges,
  archivedDecisionId,
  assert,
  candidateDecisionBody,
  currentDecisionId,
  currentRelativePath,
  decisionFilePath,
  findIndexEntry,
  fs,
  maintenanceRelativePath,
  path,
  readIndex,
  runSourceCli,
  runSourceLifecycleCli,
  runSuccessfulSourceLifecycleCli,
  scanDecisionRecords,
  test,
  validateDecisionRecords,
  withFixtureWorkspace
};

export function indexPathFor(workspaceRoot: string): string {
  return path.join(workspaceRoot, "docs", "decisions", "decision-index.json");
}
