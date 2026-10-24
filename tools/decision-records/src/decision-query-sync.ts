import { synchronizeSelectedDecisionIndex } from "./decision-selected-sync.ts";
import path from "node:path";
import type { StateIndexDiagnostic } from "../../index-runtime/src/index.ts";
import type { DecisionScan } from "./types.ts";
import { synchronizeRecordIndex } from "../../record-operations/src/synchronize.ts";
import { decisionSnapshotFromScan } from "./scan-index-check.ts";
import { createDecisionStateIndexDefinition } from "./decision-index-definition.ts";
import {
  decisionDiagnostic,
  decisionDiagnosticFromReason,
  decisionFailure,
  type DecisionApplicationFailure
} from "./application-result.ts";
import { withDecisionCollectionMutationLock } from "./decision-collection-mutation-lock.ts";
import {
  decisionIndexDiagnostics,
  decisionIndexFileName,
  syncDecisionIndex
} from "./decision-state-index.ts";
import {
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
  sourceFailure,
  syncIndexNoChange
} from "./decision-query-records.ts";

export async function synchronizeDecisionIndex(
  request: Extract<DecisionQueryRequest, { command: "sync-index" }>
): Promise<DecisionQueryResult> {
  const { decisionsDirectory } = resolveDecisionLocation(request.location);
  if (request.preflight) return await synchronizeLockedDecisionIndex(request);
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
  if (request.selectors !== undefined)
    return await synchronizeSelectedDecisionRequest({
      ...request,
      selectors: request.selectors
    });
  const validation = await syncIndexValidation(request);
  if (validation.status === "error")
    return syncIndexNoChange(validation.failure);
  const synchronized = await synchronizeRecordIndex({
    context: { root: validation.scan.decisionsDirectory },
    definition: createDecisionStateIndexDefinition(),
    indexPath: decisionIndexFileName,
    mode: request.preflight ? "preview" : "write",
    snapshot: decisionSnapshotFromScan(validation.scan),
    ...(request.selectors === undefined
      ? {}
      : {
          selectors: request.selectors,
          ...(validation.scan.index === null &&
          validation.scan.indexErrors.length > 0
            ? { baselineFailure: scannedBaselineFailure(validation.scan) }
            : {})
        }),
    selectorPolicy: {
      label: "Decision",
      codePrefix: "decision-records",
      normalize: normalizeDecisionSelectorInput,
      datedId: (selector) => parseDatedDecisionId(selector)?.id ?? null,
      nameFromId: (id) => parseDatedDecisionId(id)?.name ?? id
    }
  });
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
async function synchronizeSelectedDecisionRequest(
  request: Extract<DecisionQueryRequest, { command: "sync-index" }> & {
    selectors: readonly string[];
  }
): Promise<DecisionQueryResult> {
  const location = resolveDecisionLocation(request.location);
  const result = await synchronizeSelectedDecisionIndex(
    location.decisionsDirectory,
    location.workspaceRoot,
    request.selectors,
    request.preflight
  );
  const synchronized = result.synchronized;
  const indexRelativePath = path
    .relative(
      location.workspaceRoot,
      path.join(location.decisionsDirectory, decisionIndexFileName)
    )
    .split(path.sep)
    .join("/");
  if (synchronized.status === "error")
    return syncIndexNoChange(
      syncIndexRuntimeFailure(synchronized, indexRelativePath)
    );
  return {
    command: "sync-index",
    changedIds: synchronized.changedIds,
    indexRelativePath,
    scope: "selected",
    selectedIds: synchronized.selectedIds,
    selectors: [...request.selectors],
    state: synchronized.state,
    status: "ok",
    unactivatedPaths: [],
    warnings: [],
    coverage: result.coverage
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
function syncIndexRuntimeFailure(
  result: Exclude<
    Awaited<ReturnType<typeof syncDecisionIndex>>,
    { status: "ok" }
  >,
  indexRelativePath: string
): DecisionApplicationFailure {
  const failure = decisionFailure(
    result.diagnostics.flatMap((entry) =>
      entry.code.startsWith("decision-records.selector-")
        ? [
            decisionDiagnostic({
              code: entry.code,
              reason: entry.message,
              recovery:
                "Use an existing Decision ID or a unique name, selecting each ID at most once.",
              target: entry.path ?? indexRelativePath
            })
          ]
        : decisionIndexDiagnostics([entry], {
            code: "decision-records.sync-index-failed",
            recovery:
              "Inspect the decision collection and derived index, then retry the command.",
            target: indexRelativePath
          })
    )
  );
  return result.state === "index-write-failed"
    ? {
        ...failure,
        diagnostics: failure.diagnostics.map((diagnostic) => ({
          ...diagnostic,
          outcome: "partial-or-unknown",
          recovery:
            "The index publication may already have occurred; inspect actual index bytes and reconcile before another mutation, rather than retrying blindly."
        }))
      }
    : failure;
}

/** Only a failed acquired index is handed off; valid index membership drift is not a baseline read failure. */
function scannedBaselineFailure(scan: DecisionScan): StateIndexDiagnostic[] {
  return scan.indexErrors.map((message) => {
    const diagnostic = decisionDiagnosticFromReason(
      {
        code: "decision-records.sync-index-failed",
        recovery:
          "Restore the required Decision index or explicitly run a full sync after verifying its sources.",
        target: scan.indexRelativePath
      },
      message
    );
    const cause = diagnostic.causeCategory;
    return {
      code: "state-index.index-read-failed",
      message: diagnostic.reason,
      path: scan.indexRelativePath,
      stateId: null,
      ...(cause === "access-denied" ||
      cause === "not-found" ||
      cause === "unknown"
        ? {
            filesystem: {
              causeCategory: cause,
              detail: diagnostic.detail ?? null,
              operation: "read",
              target: scan.indexRelativePath
            }
          }
        : {})
    };
  });
}
