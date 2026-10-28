import {
  consumePreparedStateIndex,
  consumePreparedSelectedBaseline,
  prepareSelectedStateIndexBaseline,
  type PreparedStateIndex,
  type PreparedSelectedStateIndexBaseline
} from "./prepared.ts";
import { sameStateSourceRevision } from "./canonicalization.ts";
import { diagnostic, failure, filesystemDiagnostic } from "./diagnostics.ts";
import {
  type ResolvedIndexPath,
  verifyWrittenText,
  writeTextAtomically
} from "./index-path.ts";
import {
  selectedStateIndexChanges,
  type SelectedStateIndexChanges
} from "./selection.ts";
import { buildStateIndex } from "./snapshot-builder.ts";
import {
  hasStableOwnFieldOrder,
  serializeCanonicalStateIndex,
  serializeStateIndex
} from "./snapshot-parser.ts";
import { readSourceRevision, failedSync } from "./storage-shared.ts";
import type {
  JsonObject,
  StateIndex,
  StateIndexContext,
  StateIndexDefinition,
  StateIndexDiagnostic,
  StateIndexResult,
  StateIndexSyncMode,
  StateIndexSyncResult
} from "./types.ts";

type SelectedSyncOptions<State extends object, Metadata extends JsonObject> = {
  context: StateIndexContext;
  definition: StateIndexDefinition<State, Metadata>;
  indexPath: string;
  mode: StateIndexSyncMode;
  resolved: ResolvedIndexPath;
  selectedIds: string[];
  prepared?: PreparedStateIndex<State, Metadata>;
  baseline?: PreparedSelectedStateIndexBaseline<State, Metadata>;
};

type SelectedSyncFailureState = Extract<
  StateIndexSyncResult,
  { status: "error"; mode: StateIndexSyncMode }
>["state"];

export async function syncSelectedStateIndex<
  State extends object,
  Metadata extends JsonObject
>(
  options: SelectedSyncOptions<State, Metadata>
): Promise<StateIndexSyncResult> {
  const stableFieldOrder = hasStableOwnFieldOrder(options.definition);
  const baseline = await selectedBaseline(options);
  if (baseline.status === "error")
    return selectedFailure(
      options,
      "selected-baseline-invalid",
      selectedBaselineDiagnostics(baseline.diagnostics, options.indexPath)
    );
  const candidate = await selectedCandidate(options);
  if (candidate.status === "error")
    return selectedFailure(options, "source-invalid", candidate.diagnostics);
  const fresh = await verifySelectedSourceRevision(options, candidate.value);
  if (fresh.status === "error")
    return selectedFailure(options, "source-invalid", fresh.diagnostics);
  const changes = selectedStateIndexChanges(
    baseline.value,
    candidate.value,
    options.selectedIds
  );
  if (changes.kind !== "accepted")
    return selectedFailure(
      options,
      changes.kind,
      selectedChangeDiagnostics(changes, options.indexPath),
      changes.changedIds
    );
  return await finishSelectedSync(
    options,
    candidate.value,
    changes.changedIds,
    stableFieldOrder
  );
}

async function selectedBaseline<
  State extends object,
  Metadata extends JsonObject
>(
  options: SelectedSyncOptions<State, Metadata>
): Promise<StateIndexResult<StateIndex<State, Metadata>>> {
  const baseline =
    options.baseline === undefined
      ? await prepareSelectedStateIndexBaseline(options)
      : { diagnostics: [], status: "ok" as const, value: options.baseline };
  return baseline.status === "error"
    ? baseline
    : consumePreparedSelectedBaseline({ ...options, baseline: baseline.value });
}

async function selectedCandidate<
  State extends object,
  Metadata extends JsonObject
>(
  options: SelectedSyncOptions<State, Metadata>
): Promise<StateIndexResult<StateIndex<State, Metadata>>> {
  const prepared = options.prepared;
  if (prepared === undefined)
    return await buildStateIndex(options.definition, options.context);
  const proof = consumePreparedStateIndex({ ...options, prepared });
  return proof.status === "error"
    ? proof
    : { diagnostics: [], status: "ok", value: prepared.index };
}

async function verifySelectedSourceRevision<
  State extends object,
  Metadata extends JsonObject
>(
  options: SelectedSyncOptions<State, Metadata>,
  candidate: StateIndex<State, Metadata>
): Promise<StateIndexResult<null>> {
  const current = await readSourceRevision(
    options.definition,
    options.context,
    options.indexPath
  );
  if (current.status === "error") return current;
  return sameStateSourceRevision(current.value, candidate.sourceRevision)
    ? { diagnostics: [], status: "ok", value: null }
    : failure(
        "state-index.source-changed",
        "source revision changed while building the state projection; retry after " +
          "the source is stable",
        { path: options.indexPath }
      );
}

async function finishSelectedSync<
  State extends object,
  Metadata extends JsonObject
>(
  options: SelectedSyncOptions<State, Metadata>,
  candidate: StateIndex<State, Metadata>,
  changedIds: string[],
  stableFieldOrder: boolean
): Promise<StateIndexSyncResult> {
  if (changedIds.length === 0)
    return selectedSuccess(
      options,
      options.mode === "check" ? "current" : "unchanged",
      changedIds
    );
  if (options.mode === "check")
    return selectedFailure(
      options,
      "scoped-stale",
      scopedStaleDiagnostics(changedIds, options.indexPath),
      changedIds
    );
  if (options.mode === "preview")
    return selectedSuccess(options, "previewed", changedIds);
  return await publishSelectedSync(
    options,
    candidate,
    changedIds,
    stableFieldOrder
  );
}

async function publishSelectedSync<
  State extends object,
  Metadata extends JsonObject
>(
  options: SelectedSyncOptions<State, Metadata>,
  candidate: StateIndex<State, Metadata>,
  changedIds: string[],
  stableFieldOrder: boolean
): Promise<StateIndexSyncResult> {
  const expectedText = stableFieldOrder
    ? serializeCanonicalStateIndex(candidate)
    : serializeStateIndex(candidate, options.definition);
  let writtenPath: string;
  try {
    writtenPath = await writeTextAtomically(options.resolved, expectedText);
  } catch (error) {
    return selectedWriteFailure(options, error, "write", changedIds);
  }
  try {
    await verifyWrittenText(writtenPath, expectedText);
    return selectedSuccess(options, "written", changedIds);
  } catch (error) {
    return selectedWriteFailure(options, error, "verify", changedIds);
  }
}

function selectedWriteFailure<
  State extends object,
  Metadata extends JsonObject
>(
  options: SelectedSyncOptions<State, Metadata>,
  error: unknown,
  operation: "write" | "verify",
  changedIds: string[]
): StateIndexSyncResult {
  return selectedFailure(
    options,
    "index-write-failed",
    [
      diagnostic({
        code: "state-index.index-write-failed",
        filesystem: filesystemDiagnostic(error, {
          operation: `${operation} a state-index file`,
          target: options.indexPath
        }),
        message: `failed to ${operation === "write" ? "write the state-index file" : "verify the written state-index file"}; inspect index availability and access, then retry`,
        path: options.indexPath
      })
    ],
    changedIds
  );
}

function selectedSuccess<State extends object, Metadata extends JsonObject>(
  options: SelectedSyncOptions<State, Metadata>,
  state: "current" | "unchanged" | "previewed" | "written",
  changedIds: string[]
): StateIndexSyncResult {
  const base = {
    changedIds,
    diagnostics: [],
    indexPath: options.indexPath,
    mode: options.mode,
    namespace: options.definition.namespace,
    scope: "selected" as const,
    selectedIds: options.selectedIds,
    status: "ok" as const
  };
  return state === "written"
    ? { ...base, changed: true, state }
    : { ...base, changed: false, state };
}

function selectedFailure<State extends object, Metadata extends JsonObject>(
  options: SelectedSyncOptions<State, Metadata>,
  state: SelectedSyncFailureState,
  diagnostics: StateIndexDiagnostic[],
  changedIds: string[] = []
): StateIndexSyncResult {
  return failedSync(
    options,
    state,
    diagnostics,
    "selected",
    options.selectedIds,
    changedIds
  );
}

function selectedChangeDiagnostics(
  changes: Exclude<SelectedStateIndexChanges, { kind: "accepted" }>,
  indexPath: string
): StateIndexDiagnostic[] {
  if (changes.kind === "collection-changed")
    return [
      diagnostic({
        code: "state-index.collection-changed",
        message:
          "collection metadata or its source revision changed; run a full sync instead",
        path: indexPath
      })
    ];
  if (changes.kind === "selected-id-missing")
    return [
      diagnostic({
        code: "state-index.selected-id-missing",
        message: `selected state id ${JSON.stringify(changes.stateId)} is absent from both indexes`,
        path: indexPath,
        stateId: changes.stateId
      })
    ];
  return changes.unselectedIds.map((stateId) =>
    diagnostic({
      code: "state-index.unselected-changes",
      message:
        "this source change is outside the selected sync scope; add the ID " +
        "to --select or run a full sync",
      path: indexPath,
      stateId
    })
  );
}

function scopedStaleDiagnostics(
  changedIds: string[],
  indexPath: string
): StateIndexDiagnostic[] {
  return changedIds.map((stateId) =>
    diagnostic({
      code: "state-index.scoped-stale",
      message:
        "the selected source change is not present in the current index; rerun " +
        "the selected sync to publish the complete projection",
      path: indexPath,
      stateId
    })
  );
}

export function selectedBaselineDiagnostics(
  diagnostics: readonly StateIndexDiagnostic[],
  indexPath: string
): StateIndexDiagnostic[] {
  return diagnostics.map((entry) =>
    diagnostic({
      ...entry,
      code: "state-index.selected-baseline-invalid",
      message: `selected sync requires a valid baseline; ${entry.message}`,
      path: entry.path ?? indexPath
    })
  );
}
