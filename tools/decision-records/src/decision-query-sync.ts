import path from "node:path";
import {
  isStateIndexText,
  type StateIndexSyncScope
} from "../../index-runtime/src/index.ts";
import {
  decisionDiagnostic,
  decisionFailure,
  type DecisionApplicationFailure
} from "./application-result.ts";
import { withDecisionCollectionMutationLock } from "./decision-collection-mutation-lock.ts";
import {
  decisionIndexDiagnostics,
  decisionIndexFileName,
  loadDecisionIndex,
  syncDecisionIndex
} from "./decision-state-index.ts";
import {
  decisionNameFromId,
  isDecisionId,
  normalizeDecisionSelectorInput,
  parseDatedDecisionId
} from "./decision-path.ts";
import {
  decisionScanOptions,
  resolveDecisionLocation
} from "./decision-query-context.ts";
import {
  loadDecisionValidationContext,
  selectEstablishedDecisionIds,
  validateDecisionScan
} from "./index.ts";
import type {
  DecisionQueryRequest,
  DecisionQueryResult
} from "./decision-query-contract.ts";
import { collectionLockFailure } from "./decision-query-sync-lock.ts";
import {
  activationCandidates,
  mergeDecisionFailures,
  sourceFailure,
  syncIndexNoChange
} from "./decision-query-records.ts";

export async function synchronizeDecisionIndex(
  request: Extract<DecisionQueryRequest, { command: "sync-index" }>
): Promise<DecisionQueryResult> {
  const { decisionsDirectory } = resolveDecisionLocation(request.location);
  try {
    return await withDecisionCollectionMutationLock(
      path.join(decisionsDirectory, decisionIndexFileName),
      async () => await synchronizeLockedDecisionIndex(request)
    );
  } catch (error) {
    return collectionLockFailure(error);
  }
}

async function synchronizeLockedDecisionIndex(
  request: Extract<DecisionQueryRequest, { command: "sync-index" }>
): Promise<DecisionQueryResult> {
  const validation = await syncIndexValidation(request);
  if (validation.status === "error")
    return syncIndexNoChange(validation.failure);
  const scope = await selectedDecisionSyncScope({
    candidateIds: validation.selection.decisionIds,
    decisionsDirectory: validation.scan.decisionsDirectory,
    indexPath: validation.scan.indexRelativePath,
    selectors: request.selectors
  });
  if (scope.status === "error") return syncIndexNoChange(scope.failure);
  const synchronized = await synchronizeIndexScope(
    validation.scan.decisionsDirectory,
    request,
    scope.value
  );
  if (synchronized.status === "error")
    return syncIndexNoChange(
      syncIndexRuntimeFailure(synchronized, validation.scan.indexRelativePath)
    );
  return {
    command: "sync-index",
    changedIds: synchronized.changedIds,
    indexRelativePath: validation.scan.indexRelativePath,
    scope: synchronized.scope,
    selectedIds: synchronized.selectedIds,
    selectors: request.selectors === undefined ? [] : [...request.selectors],
    state: synchronized.state,
    status: "ok",
    unactivatedPaths: activationCandidates(validation.scan).map(
      (record) => record.sourcePath
    ),
    warnings: []
  };
}
type SyncValidation =
  | {
      scan: Awaited<
        ReturnType<typeof loadDecisionValidationContext>
      >["result"]["scan"];
      selection: ReturnType<typeof selectEstablishedDecisionIds>;
      status: "ok";
    }
  | { failure: DecisionApplicationFailure; status: "error" };
async function syncIndexValidation(
  request: Extract<DecisionQueryRequest, { command: "sync-index" }>
): Promise<SyncValidation> {
  const { result } = await loadDecisionValidationContext(
    decisionScanOptions(request.location),
    { checkIndexText: false }
  );
  const source = await validateDecisionScan(result.scan, {
    checkIndexText: false,
    scanErrorPolicy: "source-only"
  });
  if (source.errors.length > 0)
    return {
      failure: sourceFailure(source.errors, "Decision source collection"),
      status: "error"
    };
  const selection = selectEstablishedDecisionIds(result.scan);
  return selection.errors.length === 0
    ? { scan: result.scan, selection, status: "ok" }
    : { failure: decisionFailure(selection.errors), status: "error" };
}
async function synchronizeIndexScope(
  decisionsDirectory: string,
  request: Extract<DecisionQueryRequest, { command: "sync-index" }>,
  scope: StateIndexSyncScope | undefined
) {
  return await syncDecisionIndex({
    decisionsDirectory,
    mode: request.selectors !== undefined && !request.write ? "check" : "write",
    ...(scope === undefined ? {} : { scope })
  });
}
function syncIndexRuntimeFailure(
  result: Exclude<
    Awaited<ReturnType<typeof syncDecisionIndex>>,
    { status: "ok" }
  >,
  indexRelativePath: string
): DecisionApplicationFailure {
  return decisionFailure(
    decisionIndexDiagnostics(result.diagnostics, {
      code: "decision-records.sync-index-failed",
      recovery:
        "Inspect the decision collection and derived index, then retry the command.",
      target: indexRelativePath
    })
  );
}

async function selectedDecisionSyncScope(options: {
  candidateIds: readonly string[];
  decisionsDirectory: string;
  indexPath: string;
  selectors: readonly string[] | undefined;
}): Promise<
  | Readonly<{ status: "ok"; value: StateIndexSyncScope | undefined }>
  | Readonly<{ failure: DecisionApplicationFailure; status: "error" }>
> {
  if (options.selectors === undefined)
    return { status: "ok", value: undefined };
  const rawValidation = validateDecisionSyncSelectors(options.selectors);
  if (rawValidation.status === "error") return rawValidation;
  const baseline = await loadDecisionIndex({
    decisionsDirectory: options.decisionsDirectory,
    indexPath: decisionIndexFileName
  });
  if (baseline.status === "error")
    return {
      status: "ok",
      value: { kind: "selected", selectedIds: rawValidation.selectors }
    };
  const ids = new Set([
    ...Object.keys(baseline.value.entries),
    ...options.candidateIds
  ]);
  const selectedIds: string[] = [];
  const failures: DecisionApplicationFailure[] = [];
  for (const selector of rawValidation.selectors)
    resolveSelectedDecisionId(selector, ids, selectedIds, failures);
  if (failures.length > 0)
    return { failure: mergeDecisionFailures(failures), status: "error" };
  if (new Set(selectedIds).size !== selectedIds.length)
    return selectedSyncDuplicateFailure(options.indexPath);
  return {
    status: "ok",
    value: { kind: "selected", selectedIds: selectedIds.sort(compareText) }
  };
}

function resolveSelectedDecisionId(
  selector: string,
  ids: ReadonlySet<string>,
  selectedIds: string[],
  failures: DecisionApplicationFailure[]
): void {
  const normalized = normalizeDecisionSelectorInput(selector);
  const dated = parseDatedDecisionId(normalized);
  const matches =
    dated === null
      ? [...ids]
          .filter(
            (id) => isDecisionId(id) && decisionNameFromId(id) === normalized
          )
          .sort(compareText)
      : ids.has(dated.id)
        ? [dated.id]
        : [];
  if (matches.length === 1) {
    selectedIds.push(matches[0]!);
    return;
  }
  failures.push(
    decisionFailure([
      decisionDiagnostic({
        code:
          matches.length === 0
            ? "decision-records.selector-not-found"
            : "decision-records.selector-ambiguous",
        reason:
          matches.length === 0
            ? `Decision selector does not resolve in the baseline or current collection: ${normalized}`
            : `Decision name is ambiguous: ${normalized}; choose one standard ID: ${matches.join(", ")}`,
        recovery:
          matches.length === 0
            ? "Use an existing Decision ID or a unique name, then retry the selected sync."
            : "Retry with one listed calendar-valid YYMMDD-name Decision ID.",
        target: normalized
      })
    ])
  );
}

function selectedSyncDuplicateFailure(
  indexPath: string
): Readonly<{ failure: DecisionApplicationFailure; status: "error" }> {
  return {
    failure: decisionFailure([
      decisionDiagnostic({
        code: "decision-records.selector-duplicate",
        reason: "Selected Decision selectors resolve to the same Decision ID.",
        recovery:
          "Select every Decision ID at most once, then retry the selected sync.",
        target: indexPath
      })
    ]),
    status: "error"
  };
}

function validateDecisionSyncSelectors(
  selectors: readonly string[]
):
  | Readonly<{ selectors: string[]; status: "ok" }>
  | Readonly<{ failure: DecisionApplicationFailure; status: "error" }> {
  const seen = new Set<string>();
  const failures: DecisionApplicationFailure[] = [];
  for (const selector of selectors) {
    if (typeof selector !== "string" || !isStateIndexText(selector)) {
      failures.push(invalidSelectorFailure(selector));
      continue;
    }
    if (seen.has(selector)) {
      failures.push(duplicateSelectorFailure(selector));
      continue;
    }
    seen.add(selector);
  }
  return failures.length === 0
    ? { selectors: [...selectors], status: "ok" }
    : { failure: mergeDecisionFailures(failures), status: "error" };
}

function invalidSelectorFailure(selector: unknown): DecisionApplicationFailure {
  return decisionFailure([
    decisionDiagnostic({
      code: "decision-records.selector-invalid",
      reason:
        "Selected Decision selectors must be non-empty text without surrounding whitespace or control characters.",
      recovery: "Provide a standard Decision ID or unique name, then retry.",
      target: typeof selector === "string" ? selector : "<invalid-selector>"
    })
  ]);
}
function duplicateSelectorFailure(
  selector: string
): DecisionApplicationFailure {
  return decisionFailure([
    decisionDiagnostic({
      code: "decision-records.selector-duplicate",
      reason: `Selected Decision selector appears more than once: ${selector}`,
      recovery: "Select every raw selector at most once, then retry.",
      target: selector
    })
  ]);
}
function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
