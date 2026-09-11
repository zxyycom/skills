import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { validateDecisionRecords } from "../../src/index.ts";
import { executeDecisionQuery } from "../../src/decision-query-service.ts";
import {
  normalizeDecisionSelectorInput,
  parseDatedDecisionId,
  utcDecisionDate
} from "../../src/decision-path.ts";
import {
  archivedDecisionId,
  candidateDecisionBody,
  currentDecisionId,
  currentSourcePath,
  decisionFilePath,
  runSourceCli,
  runSuccessfulSourceCli,
  withFixtureWorkspace,
  withTemporaryWorkspace,
  writeDecision
} from "../support.ts";

export {
  archivedDecisionId,
  assert,
  candidateDecisionBody,
  currentDecisionId,
  currentSourcePath,
  decisionFilePath,
  execFileSync,
  executeDecisionQuery,
  fs,
  normalizeDecisionSelectorInput,
  parseDatedDecisionId,
  path,
  runSourceCli,
  runSuccessfulSourceCli,
  test,
  utcDecisionDate,
  validateDecisionRecords,
  withFixtureWorkspace,
  withTemporaryWorkspace,
  writeDecision
};

export function decisionMatchLines(output: string): string {
  return output.split("Latest matches:\n")[1]?.split("Showing ")[0] ?? "";
}
