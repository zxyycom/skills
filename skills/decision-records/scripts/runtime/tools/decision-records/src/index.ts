/*
 * Synced TypeScript runtime; repository maintenance edits tools/decision-records/src/index.ts.
 * Installed skill copies may be edited directly; updates overwrite matching files.
 * Repository: https://github.com/zxyycom/skills
 * Source path: tools/decision-records/src/index.ts
 * Maintained source: https://github.com/zxyycom/skills/blob/main/tools/decision-records/src/index.ts
 * Skill source directory: https://github.com/zxyycom/skills/tree/main/skills/decision-records
 * Rebuild: bun run sync:decision-records-cli
 */
import {
  validateScannedDecisionRecords,
  selectEstablishedDecisionIds as selectValidatedDecisionIds
} from "./decision-validation.ts";
import { syncDecisionIndex } from "./decision-state-index.ts";
import { scanDecisionRecords } from "./scan.ts";
import { checkScannedDecisionIndex } from "./scan-index-check.ts";
import {
  type DecisionId,
  type DecisionScan,
  type DecisionScanOptions,
  type DecisionValidationResult
} from "./types.ts";

export type DecisionValidationContext = {
  result: DecisionValidationResult;
};

export type DecisionValidationOptions = {
  allowEmptyDecisionSet?: boolean;
  checkIndexText?: boolean;
  scanErrorPolicy?: "omit" | "source-only";
};

export type EstablishedDecisionIdSelection = {
  decisionIds: DecisionId[];
  errors: string[];
};

export function selectEstablishedDecisionIds(
  scan: DecisionScan
): EstablishedDecisionIdSelection {
  return selectValidatedDecisionIds(scan);
}

export async function validateDecisionRecords(
  options: DecisionScanOptions = {}
): Promise<DecisionValidationResult> {
  return (
    await loadDecisionValidationContext(options, {
      allowEmptyDecisionSet: true
    })
  ).result;
}

export async function loadDecisionValidationContext(
  options: DecisionScanOptions = {},
  validationOptions: DecisionValidationOptions = {}
): Promise<DecisionValidationContext> {
  const scan = await scanDecisionRecords(options);
  return {
    result: await validateScannedDecisionRecords(scan, validationOptions, () =>
      checkScannedDecisionIndex(scan)
    )
  };
}

export async function validateDecisionScan(
  scan: DecisionScan,
  options: DecisionValidationOptions = {}
): Promise<DecisionValidationResult> {
  return await validateScannedDecisionRecords(scan, options, () =>
    syncDecisionIndex({
      decisionsDirectory: scan.decisionsDirectory,
      mode: "check"
    })
  );
}
