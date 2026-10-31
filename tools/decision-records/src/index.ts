import {
  validateScannedDecisionRecords,
  selectEstablishedDecisionIds as selectValidatedDecisionIds
} from "./records/decision-validation.ts";
import { syncDecisionIndex } from "./index/decision-state-index.ts";
import { scanDecisionRecords } from "./scan/scan.ts";
import { checkScannedDecisionIndex } from "./scan/scan-index-check.ts";
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
