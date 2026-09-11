import {
  decisionFailure,
  type DecisionApplicationFailure
} from "./application-result.ts";
import { decisionScanOptions } from "./decision-query-context.ts";
import {
  loadDecisionValidationContext,
  selectEstablishedDecisionIds
} from "./index.ts";
import { scanDecisionRecords } from "./scan.ts";
import { syncDecisionIndex } from "./decision-state-index.ts";
import type { DecisionLocation } from "./decision-query-context.ts";
import type { DecisionQueryResult } from "./decision-query-contract.ts";
import {
  candidateRecords,
  indexFailure,
  sourceFailure
} from "./decision-query-records.ts";
import type { DecisionScan } from "./types.ts";

export async function listDecisionCandidates(
  location: DecisionLocation
): Promise<DecisionQueryResult> {
  const context = await loadCandidateQueryContext(location);
  if (context.status === "error") return context;
  return {
    command: "candidates",
    records: candidateRecords(context.scan),
    status: "ok",
    warnings: context.warnings
  };
}

export async function checkDecisionRecords(
  location: DecisionLocation
): Promise<DecisionQueryResult> {
  const { result } = await loadDecisionValidationContext(
    decisionScanOptions(location),
    { allowEmptyDecisionSet: true }
  );
  if (result.errors.length > 0) return decisionFailure(result.errors);
  return {
    command: "check",
    status: "ok",
    summary: {
      activeCount: result.activeCount,
      activationCandidateCount: result.activationCandidateCount,
      bodyReadyCandidateCount: result.bodyReadyCandidateCount,
      alignedCount: result.alignedCount,
      archivedCount: result.archivedCount,
      decisionCount: result.decisionCount,
      scaffoldCandidateCount: result.scaffoldCandidateCount,
      unalignedCount: result.unalignedCount
    },
    warnings: []
  };
}

export async function loadCandidateQueryContext(
  location: DecisionLocation
): Promise<
  | DecisionApplicationFailure
  | { scan: DecisionScan; status: "ok"; warnings: string[] }
> {
  const scan = await scanDecisionRecords(decisionScanOptions(location));
  if (!scan.decisionsDirectoryAvailable)
    return sourceFailure(scan.sourceErrors, "Decision collection");
  if (scan.collectionErrors.length > 0)
    return sourceFailure(scan.collectionErrors, "Decision collection");
  const hasEstablishedRecord = scan.records.some(
    (record) => record.source.kind === "established"
  );
  const indexProblem = await candidateQueryIndexFailure(
    scan,
    hasEstablishedRecord
  );
  if (indexProblem !== null) return indexProblem;
  return {
    scan,
    status: "ok",
    warnings: scan.sourceErrors.filter(
      (error) => !scan.collectionErrors.includes(error)
    )
  };
}

async function candidateQueryIndexFailure(
  scan: DecisionScan,
  hasEstablishedRecord: boolean
): Promise<DecisionApplicationFailure | null> {
  const scanFailure = candidateIndexScanFailure(scan, hasEstablishedRecord);
  if (scanFailure !== null) return scanFailure;
  return hasEstablishedRecord ? await currentCandidateIndexFailure(scan) : null;
}
function candidateIndexScanFailure(
  scan: DecisionScan,
  hasEstablishedRecord: boolean
): DecisionApplicationFailure | null {
  if (
    scan.indexErrors.length > 0 &&
    indexRequired(hasEstablishedRecord, scan.indexExists)
  )
    return indexFailure(
      { diagnostics: [] },
      scan.indexRelativePath,
      scan.indexErrors
    );
  if (!hasEstablishedRecord && scan.indexExists)
    return indexFailure({ diagnostics: [] }, scan.indexRelativePath, [
      scan.indexRelativePath +
        " must be absent until the first established decision is indexed"
    ]);
  return null;
}
function indexRequired(
  hasEstablishedRecord: boolean,
  indexExists: boolean
): boolean {
  return hasEstablishedRecord || indexExists;
}
async function currentCandidateIndexFailure(
  scan: DecisionScan
): Promise<DecisionApplicationFailure | null> {
  const selection = selectEstablishedDecisionIds(scan);
  if (selection.errors.length > 0)
    return sourceFailure(selection.errors, "Established decision selection");
  const checked = await syncDecisionIndex({
    decisionsDirectory: scan.decisionsDirectory,
    mode: "check"
  });
  return checked.status === "ok"
    ? null
    : checkedCandidateIndexFailure(scan, checked);
}
function checkedCandidateIndexFailure(
  scan: DecisionScan,
  checked: Exclude<
    Awaited<ReturnType<typeof syncDecisionIndex>>,
    { status: "ok" }
  >
): DecisionApplicationFailure {
  return indexFailure(
    checked,
    scan.indexRelativePath,
    staleIndexReasons(scan, checked.state)
  );
}
function staleIndexReasons(scan: DecisionScan, state: string): string[] {
  return ["index-invalid", "index-missing", "index-stale"].includes(state)
    ? [scan.indexRelativePath + " is out of sync; run sync-index"]
    : [];
}
