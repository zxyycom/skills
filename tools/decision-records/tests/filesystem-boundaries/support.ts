import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { readDecisionStateSnapshot } from "../../src/decision-index-source.ts";
import { isDecisionId } from "../../src/decision-path.ts";
import { executeDecisionQuery } from "../../src/decision-query-service.ts";
import { scanDecisionRecords } from "../../src/scan.ts";
import { stageDecisionRecords } from "../../src/decision-stage-service.ts";
import { applyDecisionChanges } from "../../src/decision-transaction.ts";
import {
  currentDecisionId,
  currentSourcePath,
  decisionFilePath,
  runSourceCli,
  withFixtureWorkspace,
  withGitFixtureWorkspace
} from "../support.ts";

export type UnsafeEntry = "directory" | "symlink";

export const unsafeEntries: readonly UnsafeEntry[] = ["directory", "symlink"];

export async function replaceWithUnsafeEntry(options: {
  entry: UnsafeEntry;
  outsidePath: string;
  sourcePath: string;
}): Promise<boolean> {
  await fs.rm(options.sourcePath);
  if (options.entry === "directory") {
    await fs.mkdir(options.sourcePath);
    return true;
  }
  try {
    await fs.symlink(options.outsidePath, options.sourcePath);
    return true;
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "EPERM") {
      return false;
    }
    throw error;
  }
}

export {
  applyDecisionChanges,
  assert,
  currentDecisionId,
  currentSourcePath,
  decisionFilePath,
  executeDecisionQuery,
  fs,
  isDecisionId,
  path,
  readDecisionStateSnapshot,
  runSourceCli,
  scanDecisionRecords,
  stageDecisionRecords,
  test,
  withFixtureWorkspace,
  withGitFixtureWorkspace
};

export function accessDeniedFileSystemError(): Error {
  return Object.assign(
    new Error(
      `EACCES password=${filesystemDiagnosticSecret} at ${filesystemDiagnosticPath}`
    ),
    { code: "EACCES" }
  );
}

export function assertRedactedAccessDeniedDiagnostic(options: {
  detail: string | null | undefined;
  reason: string;
  expectedReason: string;
}): void {
  assert.equal(options.reason, options.expectedReason);
  assert.match(options.detail ?? "", /password=\[redacted\]/);
  assert.doesNotMatch(
    options.detail ?? "",
    new RegExp(filesystemDiagnosticSecret)
  );
  assert.doesNotMatch(
    options.detail ?? "",
    new RegExp(filesystemDiagnosticPath)
  );
}

export function isTargetPath(value: unknown, targetPath: string): boolean {
  return typeof value === "string" && path.resolve(value) === targetPath;
}

export const filesystemDiagnosticSecret = "top-secret-decision-token";

export const filesystemDiagnosticPath = "/tmp/private-decision-records-path";
