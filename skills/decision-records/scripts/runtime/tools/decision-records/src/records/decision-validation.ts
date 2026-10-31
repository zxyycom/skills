/*
 * Synced TypeScript runtime; repository maintenance edits tools/decision-records/src/records/decision-validation.ts.
 * Installed skill copies may be edited directly; updates overwrite matching files.
 * Repository: https://github.com/zxyycom/skills
 * Source path: tools/decision-records/src/records/decision-validation.ts
 * Maintained source: https://github.com/zxyycom/skills/blob/main/tools/decision-records/src/records/decision-validation.ts
 * Skill source directory: https://github.com/zxyycom/skills/tree/main/skills/decision-records
 * Rebuild: bun run sync:decision-records-cli
 */
import {
  decisionIndexDiagnosticMessages,
  syncDecisionIndex
} from "../index/decision-state-index.ts";
import {
  isEstablishedDecisionRecord,
  type DecisionId,
  type DecisionScan,
  type DecisionValidationResult
} from "../types.ts";
import type {
  DecisionValidationOptions,
  EstablishedDecisionIdSelection
} from "../index.ts";

export function selectEstablishedDecisionIds(
  scan: DecisionScan
): EstablishedDecisionIdSelection {
  const errors: string[] = [];
  const decisionIds = scan.records
    .filter(isEstablishedDecisionRecord)
    .map((record) => record.decisionId);

  if (decisionIds.length === 0) {
    errors.push("Cannot generate an empty decision index");
  }

  return { decisionIds, errors };
}

type DecisionIndexCheck = () => ReturnType<typeof syncDecisionIndex>;

export async function validateScannedDecisionRecords(
  scan: DecisionScan,
  options: DecisionValidationOptions,
  checkIndex: DecisionIndexCheck
): Promise<DecisionValidationResult> {
  const errors =
    options.scanErrorPolicy === "omit"
      ? []
      : options.scanErrorPolicy === "source-only"
        ? [...scan.sourceErrors]
        : [...scan.errors];
  const hasEstablishedDecision = scan.records.some(isEstablishedDecisionRecord);
  const selection =
    options.allowEmptyDecisionSet && !hasEstablishedDecision
      ? { decisionIds: [], errors: [] }
      : selectEstablishedDecisionIds(scan);
  errors.push(...selection.errors);
  await validateDecisionIndexText({
    scan,
    decisionIds: selection.decisionIds,
    options,
    errors,
    checkIndex
  });

  const establishedRecords = scan.records.filter(
    (record) => record.document !== null
  );

  return decisionValidationSummary(scan, establishedRecords, errors);
}

async function validateDecisionIndexText(context: {
  scan: DecisionScan;
  decisionIds: readonly DecisionId[];
  options: DecisionValidationOptions;
  errors: string[];
  checkIndex: DecisionIndexCheck;
}): Promise<void> {
  const { scan, decisionIds, options, errors, checkIndex } = context;
  if (
    options.checkIndexText === false ||
    decisionIds.length === 0 ||
    scan.sourceErrors.length > 0
  ) {
    return;
  }
  const checked = await checkIndex();
  if (checked.status !== "error") return;
  if (
    checked.state === "index-invalid" ||
    checked.state === "index-missing" ||
    checked.state === "index-stale"
  ) {
    errors.push(scan.indexRelativePath + " is out of sync; run sync-index");
    return;
  }
  errors.push(
    ...decisionIndexDiagnosticMessages(
      checked.diagnostics,
      scan.indexRelativePath
    )
  );
}

function decisionValidationSummary(
  scan: DecisionScan,
  establishedRecords: readonly DecisionScan["records"][number][],
  errors: string[]
): DecisionValidationResult {
  return {
    activationCandidateCount: scan.records.filter(
      (record) => record.activationCandidate
    ).length,
    bodyReadyCandidateCount: scan.records.filter(
      (record) => record.scaffoldValid && record.bodyReady
    ).length,
    activeCount: establishedRecords.filter(
      (record) => record.status === "active"
    ).length,
    alignedCount: establishedRecords.filter(
      (record) => record.status === "active" && record.alignment === "aligned"
    ).length,
    archivedCount: establishedRecords.filter(
      (record) => record.status === "archived"
    ).length,
    decisionCount: establishedRecords.length,
    errors,
    scan,
    scaffoldCandidateCount: scan.records.filter(
      (record) => record.scaffoldValid
    ).length,
    unalignedCount: establishedRecords.filter(
      (record) => record.status === "active" && record.alignment === "unaligned"
    ).length
  };
}
