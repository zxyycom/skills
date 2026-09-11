import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { applyDecisionChanges } from "../../src/decision-transaction.ts";
import { validateDecisionRecords } from "../../src/index.ts";
import { scanDecisionRecords } from "../../src/scan.ts";
import {
  archivedDecisionId,
  currentDecisionId,
  currentSourcePath,
  decisionFilePath,
  fileExists,
  findIndexEntry,
  readIndex,
  runSourceCli,
  runSourceLifecycleCli,
  withFixtureWorkspace
} from "../support.ts";

export {
  applyDecisionChanges,
  archivedDecisionId,
  assert,
  currentDecisionId,
  currentSourcePath,
  decisionFilePath,
  fileExists,
  findIndexEntry,
  fs,
  path,
  readIndex,
  runSourceCli,
  runSourceLifecycleCli,
  scanDecisionRecords,
  test,
  validateDecisionRecords,
  withFixtureWorkspace
};
