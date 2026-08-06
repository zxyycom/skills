import {
  decisionIndexDiagnosticMessages,
  syncDecisionIndex
} from "./decision-state-index.ts";
import { scanDecisionRecords } from "./scan.ts";
import {
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
  scanErrorPolicy?:
    | "omit"
    | "source-only";
};

export type DecisionIndexSourceSelection = {
  errors: string[];
  relativePaths: string[];
};

export function selectDecisionIndexSourcePaths(
  scan: DecisionScan
): DecisionIndexSourceSelection {
  const errors: string[] = [];
  const relativePaths = scan.records
    .filter((record) => record.markdownExists && record.document !== null)
    .map((record) => record.relativePath);

  if (relativePaths.length === 0) {
    errors.push("Cannot generate an empty decision index");
  }

  return { errors, relativePaths };
}

export async function validateDecisionRecords(
  options: DecisionScanOptions = {}
): Promise<DecisionValidationResult> {
  return (await loadDecisionValidationContext(options)).result;
}

export async function loadDecisionValidationContext(
  options: DecisionScanOptions = {},
  validationOptions: DecisionValidationOptions = {}
): Promise<DecisionValidationContext> {
  const scan = await scanDecisionRecords(options);
  return {
    result: await validateDecisionScan(scan, validationOptions)
  };
}

export async function validateDecisionScan(
  scan: DecisionScan,
  options: DecisionValidationOptions = {}
): Promise<DecisionValidationResult> {
  const errors = options.scanErrorPolicy === "omit"
    ? []
    : options.scanErrorPolicy === "source-only"
      ? [...scan.sourceErrors]
      : [...scan.errors];
  const hasEstablishedDecision = scan.records.some(
    (record) => record.markdownExists && record.document !== null
  );
  const selection = options.allowEmptyDecisionSet && !hasEstablishedDecision
    ? { errors: [], relativePaths: [] }
    : selectDecisionIndexSourcePaths(scan);
  errors.push(...selection.errors);

  if (
    options.checkIndexText !== false
    && selection.relativePaths.length > 0
    && scan.sourceErrors.length === 0
  ) {
    const checked = await syncDecisionIndex({
      decisionsDirectory: scan.decisionsDirectory,
      mode: "check",
      relativePaths: selection.relativePaths
    });
    if (checked.status === "error") {
      if (
        checked.state === "index-invalid"
        || checked.state === "index-missing"
        || checked.state === "index-stale"
      ) {
        errors.push(
          scan.indexRelativePath
          + " is out of sync; run sync-index --write"
        );
      } else {
        errors.push(...decisionIndexDiagnosticMessages(
          checked.diagnostics,
          scan.indexRelativePath
        ));
      }
    }
  }

  const establishedRecords = scan.records.filter((record) => record.document !== null);

  return {
    activationCandidateCount: scan.records.filter(
      (record) => record.activationCandidate
    ).length,
    activeCount: establishedRecords.filter((record) => record.status === "active").length,
    alignedCount: establishedRecords.filter((record) => (
      record.status === "active" && record.alignment === "aligned"
    )).length,
    archivedCount: establishedRecords.filter(
      (record) => record.status === "archived"
    ).length,
    decisionCount: establishedRecords.length,
    domainCount: scan.domainIds.size,
    errors,
    scan,
    unalignedCount: establishedRecords.filter((record) => (
      record.status === "active" && record.alignment === "unaligned"
    )).length
  };
}
