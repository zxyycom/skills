import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { validateDecisionRecords } from "../../src/index.ts";
import { syncDecisionIndex } from "../../src/decision-state-index.ts";
import {
  currentRelativePath,
  archivedDecisionId,
  currentDecisionId,
  decisionIdForTest,
  decisionFilePath,
  findIndexEntry,
  readIndex,
  runSourceCli,
  runSuccessfulSourceCli,
  withFixtureWorkspace,
  writeIndex
} from "../support.ts";

export {
  archivedDecisionId,
  assert,
  currentDecisionId,
  currentRelativePath,
  decisionFilePath,
  decisionIdForTest,
  findIndexEntry,
  fs,
  path,
  readIndex,
  runSourceCli,
  runSuccessfulSourceCli,
  syncDecisionIndex,
  test,
  validateDecisionRecords,
  withFixtureWorkspace,
  writeIndex
};
