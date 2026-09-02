import {
  openVersionControl,
  VersionControlError,
  type VersionControlFile,
  type VersionControlRepository
} from "../../shared/src/version-control/index.ts";
import { repositoryRelativePathFromFileSystemPath } from "../../shared/src/version-control/repository-relative-path.ts";
import {
  defineStateIndexDefinition,
  expectationOf,
  validateStateIndexDefinition
} from "./definition.ts";
import { diagnostic } from "./diagnostics.ts";
import { compareIndexText } from "./ordering.ts";
import { isStateIndexText } from "./schemas.ts";
import { buildStateIndexFromSnapshot } from "./snapshot-builder.ts";
import { parseStateIndex, serializeStateIndex } from "./snapshot-parser.ts";
import { loadStateIndexAtResolvedPath, resolveIndexPath } from "./storage.ts";
import type {
  JsonObject,
  StateIndex,
  StateIndexContext,
  StateIndexDefinition,
  StateIndexDiagnostic,
  StateIndexEntryStageResult,
  StateIndexPendingMutation,
  StateIndexResult,
  StateIndexVersionControlDiagnostic,
  StateSnapshot
} from "./types.ts";

type EntryStageErrorState = Exclude<
  Extract<StateIndexEntryStageResult, { status: "error" }>["state"],
  "pending-recovery-failed"
>;

type EntryStageResultContext = Readonly<{
  indexPath: string;
  namespace: string;
  pendingScope?: string;
}>;

type SelectedIdValidation =
  | { diagnostics: StateIndexDiagnostic[]; status: "error" }
  | { selectedIds: string[]; status: "ok" };

type StagingRepository = Pick<
  VersionControlRepository,
  | "getCurrentRevision"
  | "readRevisionFile"
  | "replacePendingFiles"
  | "rootDirectory"
>;

export async function stageSelectedIndexEntries<
  State extends object,
  Metadata extends JsonObject
>(
  options: Readonly<{
    context: StateIndexContext;
    definition: StateIndexDefinition<State, Metadata>;
    indexPath: string;
    selectedIds: readonly string[];
  }>
): Promise<StateIndexEntryStageResult> {
  return await stageSelectedIndexEntriesWithRepository(
    options,
    async (rootDirectory) => await openVersionControl(rootDirectory)
  );
}

/**
 * @internal Source-module test seam for the staging transaction. The public
 * entry point above is the sole production repository opener.
 */
export async function stageSelectedIndexEntriesWithRepository<
  State extends object,
  Metadata extends JsonObject
>(
  options: Readonly<{
    context: StateIndexContext;
    definition: StateIndexDefinition<State, Metadata>;
    indexPath: string;
    selectedIds: readonly string[];
  }>,
  openRepository: (rootDirectory: string) => Promise<StagingRepository>
): Promise<StateIndexEntryStageResult> {
  const resultContext: EntryStageResultContext = {
    indexPath: options.indexPath,
    namespace: options.definition.namespace
  };
  const definitionErrors = validateStateIndexDefinition(options.definition);
  if (definitionErrors.length > 0) {
    return failedStage(resultContext, "definition-invalid", [
      diagnostic({
        code: "state-index.definition-invalid",
        message: definitionErrors.join("; "),
        path: options.indexPath
      })
    ]);
  }
  const definition = defineStateIndexDefinition(options.definition);
  const expectation = expectationOf(definition);
  const selected = validateSelectedIds(options.selectedIds, options.indexPath);
  if (selected.status === "error") {
    return failedStage(
      resultContext,
      "selection-invalid",
      selected.diagnostics
    );
  }
  if (isOperationAborted(options.context)) {
    return abortedStage(resultContext, selected.selectedIds);
  }

  const resolvedIndexPath = await resolveIndexPath(
    options.indexPath,
    options.context.root
  );
  if (resolvedIndexPath.status === "error") {
    return failedStage(
      resultContext,
      "index-path-invalid",
      resolvedIndexPath.diagnostics,
      selected.selectedIds
    );
  }

  let repository: StagingRepository;
  try {
    repository = await openRepository(options.context.root);
  } catch (error) {
    return repositoryOpenFailure(resultContext, error, selected.selectedIds);
  }

  let repositoryIndexPath: string;
  try {
    repositoryIndexPath = repositoryRelativePathFromFileSystemPath(
      repository.rootDirectory,
      resolvedIndexPath.value.targetPath
    );
  } catch {
    return failedStage(
      resultContext,
      "index-path-invalid",
      [
        diagnostic({
          code: "state-index.repository-path-invalid",
          message:
            "the resolved index path is not a file in the discovered repository; check " +
            "context.root and indexPath, then retry",
          path: options.indexPath
        })
      ],
      selected.selectedIds
    );
  }

  let revision: string | null;
  try {
    revision = await repository.getCurrentRevision();
  } catch (error) {
    return revisionReadFailure(resultContext, selected.selectedIds, error);
  }

  let revisionFile: VersionControlFile | null = null;
  if (revision !== null) {
    try {
      revisionFile = await repository.readRevisionFile(
        revision,
        repositoryIndexPath
      );
    } catch (error) {
      return revisionReadFailure(resultContext, selected.selectedIds, error);
    }
  }

  let revisionIndex: StateIndexResult<StateIndex<State, Metadata>> | null =
    null;
  if (revisionFile !== null) {
    let revisionText: string;
    try {
      revisionText = new TextDecoder("utf-8", { fatal: true }).decode(
        revisionFile.data
      );
    } catch {
      return failedStage(
        resultContext,
        "revision-index-invalid",
        [
          diagnostic({
            code: "state-index.revision-index-encoding-invalid",
            message: "the revision index is not valid UTF-8 text",
            path: options.indexPath
          })
        ],
        selected.selectedIds
      );
    }
    revisionIndex = parseStateIndex({
      definition,
      expectation,
      sourcePath: options.indexPath,
      text: revisionText
    });
  }
  if (revisionIndex?.status === "error") {
    return failedStage(
      resultContext,
      "revision-index-invalid",
      revisionIndex.diagnostics,
      selected.selectedIds
    );
  }

  const baseline = revisionIndex?.value ?? null;
  const workspaceIndex = await loadStateIndexAtResolvedPath({
    definition,
    expectation,
    indexPath: options.indexPath,
    resolved: resolvedIndexPath.value
  });
  if (workspaceIndex.status === "error") {
    return failedStage(
      resultContext,
      "workspace-index-invalid",
      workspaceIndex.diagnostics,
      selected.selectedIds
    );
  }
  if (
    baseline !== null &&
    !sameCollectionContract(baseline, workspaceIndex.value)
  ) {
    return failedStage(
      resultContext,
      "collection-changed",
      [
        diagnostic({
          code: "state-index.stage-collection-changed",
          message:
            "metadata or its source revision changed; stage the complete index instead",
          path: options.indexPath
        })
      ],
      selected.selectedIds
    );
  }

  const selectedIds = new Set(selected.selectedIds);
  const missingId = selected.selectedIds.find(
    (id) => !hasEntry(baseline, id) && !hasEntry(workspaceIndex.value, id)
  );
  if (missingId !== undefined) {
    return failedStage(
      resultContext,
      "selection-invalid",
      [
        diagnostic({
          code: "state-index.selected-id-missing",
          message: `selected state id ${JSON.stringify(missingId)} is absent from both indexes`,
          path: options.indexPath,
          stateId: missingId
        })
      ],
      selected.selectedIds
    );
  }

  const targetSnapshot = selectTargetSnapshot(
    baseline,
    workspaceIndex.value,
    selectedIds
  );
  const target = buildStateIndexFromSnapshot(
    definition,
    targetSnapshot,
    options.indexPath
  );
  if (target.status === "error") {
    return failedStage(
      resultContext,
      "target-invalid",
      target.diagnostics,
      selected.selectedIds
    );
  }
  if (isOperationAborted(options.context)) {
    return abortedStage(resultContext, selected.selectedIds);
  }

  const targetText = serializeStateIndex(target.value, definition);
  const targetData = Buffer.from(targetText, "utf8");
  const changed =
    revisionFile === null || !targetData.equals(Buffer.from(revisionFile.data));
  try {
    await repository.replacePendingFiles({
      expectedFiles: revisionFile === null ? [] : [revisionFile],
      expectedRevision: revision,
      files: [{ data: targetData, path: repositoryIndexPath }],
      pathScope: repositoryIndexPath
    });
  } catch (error) {
    return pendingFailure(
      { ...resultContext, pendingScope: repositoryIndexPath },
      error,
      selected.selectedIds
    );
  }

  const success = {
    diagnostics: [],
    indexPath: options.indexPath,
    namespace: definition.namespace,
    selectedIds: selected.selectedIds,
    status: "ok" as const
  };
  return changed
    ? { ...success, changed: true, state: "staged" }
    : { ...success, changed: false, state: "unchanged" };
}

function validateSelectedIds(
  input: readonly string[],
  indexPath: string
): SelectedIdValidation {
  if (!Array.isArray(input) || input.length === 0) {
    return {
      diagnostics: [
        diagnostic({
          code: "state-index.selected-ids-invalid",
          message: "selectedIds must be a non-empty array of unique state ids",
          path: indexPath
        })
      ],
      status: "error"
    };
  }
  const ids: string[] = [];
  const seen = new Set<string>();
  for (const id of input) {
    if (typeof id !== "string" || !isStateIndexText(id)) {
      return {
        diagnostics: [
          diagnostic({
            code: "state-index.selected-id-invalid",
            message:
              "selected state ids must be non-empty text without surrounding " +
              "whitespace or control characters",
            path: indexPath,
            stateId: typeof id === "string" ? id : null
          })
        ],
        status: "error"
      };
    }
    if (seen.has(id)) {
      return {
        diagnostics: [
          diagnostic({
            code: "state-index.selected-id-duplicate",
            message: `selected state id ${JSON.stringify(id)} appears more than once`,
            path: indexPath,
            stateId: id
          })
        ],
        status: "error"
      };
    }
    seen.add(id);
    ids.push(id);
  }
  return { selectedIds: ids.sort(compareIndexText), status: "ok" };
}

function sameCollectionContract<
  State extends object,
  Metadata extends JsonObject
>(
  revision: StateIndex<State, Metadata>,
  workspace: StateIndex<State, Metadata>
): boolean {
  return (
    JSON.stringify(revision.metadata) === JSON.stringify(workspace.metadata) &&
    revision.sourceRevision.metadata === workspace.sourceRevision.metadata
  );
}

function selectTargetSnapshot<
  State extends object,
  Metadata extends JsonObject
>(
  revision: StateIndex<State, Metadata> | null,
  workspace: StateIndex<State, Metadata>,
  selectedIds: ReadonlySet<string>
): StateSnapshot<State, Metadata> {
  const states: Array<[string, State]> = [];
  const revisions: Array<[string, string]> = [];
  const allIds = new Set([
    ...Object.keys(revision?.entries ?? {}),
    ...Object.keys(workspace.entries)
  ]);
  for (const id of [...allIds].sort(compareIndexText)) {
    const source = selectedIds.has(id) ? workspace : revision;
    if (source === null || !hasEntry(source, id)) {
      continue;
    }
    states.push([id, source.entries[id].state]);
    revisions.push([id, source.sourceRevision.entries[id]]);
  }
  return {
    metadata: revision?.metadata ?? workspace.metadata,
    sourceRevision: {
      entries: Object.fromEntries(revisions),
      metadata:
        revision?.sourceRevision.metadata ?? workspace.sourceRevision.metadata
    },
    states: Object.fromEntries(states)
  };
}

function hasEntry<State extends object, Metadata extends JsonObject>(
  index: StateIndex<State, Metadata> | null,
  id: string
): index is StateIndex<State, Metadata> {
  return index !== null && Object.hasOwn(index.entries, id);
}

function isOperationAborted(context: StateIndexContext): boolean {
  return context.signal?.aborted === true;
}

function pendingFailure(
  context: EntryStageResultContext,
  error: unknown,
  selectedIds: string[]
): StateIndexEntryStageResult {
  const versionControl = versionControlDiagnostic(error);
  if (
    error instanceof VersionControlError &&
    error.code === "pending-conflict"
  ) {
    return pendingConflictFailure(context, error, selectedIds, versionControl);
  }
  if (
    error instanceof VersionControlError &&
    error.code === "pending-recovery-failed"
  ) {
    return pendingRecoveryFailure(context, selectedIds, versionControl);
  }
  return failedPendingStage(
    context,
    "pending-write-failed",
    [
      diagnostic({
        ...pendingWriteFailureDiagnostic(error),
        path: context.indexPath,
        versionControl
      })
    ],
    selectedIds,
    "no-change"
  );
}

function pendingConflictFailure(
  context: EntryStageResultContext,
  error: VersionControlError,
  selectedIds: string[],
  versionControl: StateIndexVersionControlDiagnostic | undefined
): StateIndexEntryStageResult {
  const busy = error.causeCategory === "busy";
  return failedPendingStage(
    context,
    "pending-conflict",
    [
      diagnostic({
        code: "state-index.pending-conflict",
        message: busy
          ? "the pending write boundary is busy; wait for any known concurrent operation " +
            "to finish, then confirm a remaining lock is not stale before retrying"
          : "the current revision or target pending content changed; reread the current " +
            "revision and target pending content, resolve any existing pending change for " +
            "this index, then retry",
        path: context.indexPath,
        versionControl
      })
    ],
    selectedIds,
    "no-change"
  );
}

function pendingRecoveryFailure(
  context: EntryStageResultContext,
  selectedIds: string[],
  versionControl: StateIndexVersionControlDiagnostic | undefined
): StateIndexEntryStageResult {
  return failedRecoveryStage(
    context,
    [
      diagnostic({
        code: "state-index.pending-recovery-failed",
        message:
          "pending recovery was incomplete; read and reconcile the target range through " +
          "the version-control API before retrying; if it cannot be uniquely read or " +
          "attributed, stop and ask the range owner",
        path: context.indexPath,
        versionControl
      })
    ],
    selectedIds
  );
}

function repositoryOpenFailure(
  context: EntryStageResultContext,
  error: unknown,
  selectedIds: string[]
): StateIndexEntryStageResult {
  if (error instanceof VersionControlError && error.code === "not-repository") {
    return failedStage(
      context,
      "revision-read-failed",
      [
        diagnostic({
          code: "state-index.repository-unavailable",
          message:
            "the configured root is not inside a version-control repository; choose a " +
            "repository-backed root, then retry",
          path: context.indexPath,
          versionControl: versionControlDiagnostic(error)
        })
      ],
      selectedIds
    );
  }
  return revisionReadFailure(context, selectedIds, error);
}

function revisionReadFailure(
  context: EntryStageResultContext,
  selectedIds: string[],
  error?: unknown
): StateIndexEntryStageResult {
  return failedStage(
    context,
    "revision-read-failed",
    [
      diagnostic({
        ...revisionReadFailureDiagnostic(error),
        path: context.indexPath,
        versionControl: versionControlDiagnostic(error)
      })
    ],
    selectedIds
  );
}

function abortedStage(
  context: EntryStageResultContext,
  selectedIds: string[]
): StateIndexEntryStageResult {
  return failedStage(
    context,
    "operation-aborted",
    [
      diagnostic({
        code: "state-index.operation-aborted",
        message: "index entry staging was aborted",
        path: context.indexPath
      })
    ],
    selectedIds
  );
}

function failedRecoveryStage(
  context: EntryStageResultContext,
  diagnostics: StateIndexDiagnostic[],
  selectedIds: string[]
): StateIndexEntryStageResult {
  return {
    changed: null,
    diagnostics,
    indexPath: context.indexPath,
    namespace: context.namespace,
    pending: pendingMutation(context, "partial-or-unknown"),
    selectedIds,
    state: "pending-recovery-failed",
    status: "error"
  };
}

function failedPendingStage(
  context: EntryStageResultContext,
  state: "pending-conflict" | "pending-write-failed",
  diagnostics: StateIndexDiagnostic[],
  selectedIds: string[],
  outcome: Extract<StateIndexPendingMutation["outcome"], "no-change">
): StateIndexEntryStageResult {
  return {
    changed: false,
    diagnostics,
    indexPath: context.indexPath,
    namespace: context.namespace,
    pending: pendingMutation(context, outcome),
    selectedIds,
    state,
    status: "error"
  };
}

function failedStage(
  context: EntryStageResultContext,
  state: EntryStageErrorState,
  diagnostics: StateIndexDiagnostic[],
  selectedIds: string[] = []
): StateIndexEntryStageResult {
  return {
    changed: false,
    diagnostics,
    indexPath: context.indexPath,
    namespace: context.namespace,
    selectedIds,
    state,
    status: "error"
  };
}

function pendingMutation(
  context: EntryStageResultContext,
  outcome: StateIndexPendingMutation["outcome"]
): StateIndexPendingMutation {
  return {
    outcome,
    scope: context.pendingScope ?? context.indexPath
  };
}

function versionControlDiagnostic(
  error: unknown
): StateIndexVersionControlDiagnostic | undefined {
  if (!(error instanceof VersionControlError)) {
    return undefined;
  }
  return {
    causeCategory: error.causeCategory,
    detail: error.detail,
    operation: error.operation,
    target: error.target
  };
}

function pendingWriteFailureDiagnostic(error: unknown): {
  code: string;
  message: string;
} {
  if (error instanceof VersionControlError) {
    switch (error.causeCategory) {
      case "access-denied":
        return {
          code: "state-index.pending-access-denied",
          message:
            "the current process was denied access while replacing the pending index; " +
            "grant this process the required repository write access, then retry"
        };
      case "tool-unavailable":
        return {
          code: "state-index.pending-tool-unavailable",
          message:
            "the version-control tool was unavailable while replacing the pending index; " +
            "restore the configured tool, then retry"
        };
    }
  }
  return {
    code: "state-index.pending-write-failed",
    message:
      "failed to replace the pending index; the previous pending range was preserved; " +
      "inspect the target pending content and repository access, then retry"
  };
}

function revisionReadFailureDiagnostic(error: unknown): {
  code: string;
  message: string;
} {
  if (error instanceof VersionControlError) {
    switch (error.causeCategory) {
      case "access-denied":
        return {
          code: "state-index.repository-access-denied",
          message:
            "the current process was denied access while reading the repository; grant " +
            "this process the required repository read access, then retry"
        };
      case "tool-unavailable":
        return {
          code: "state-index.repository-tool-unavailable",
          message:
            "the version-control tool was unavailable while reading the repository; " +
            "restore the configured tool, then retry"
        };
      case "revision-unavailable":
        return {
          code: "state-index.revision-unavailable",
          message:
            "the current revision is unavailable; restore repository revision integrity, " +
            "then retry"
        };
    }
  }
  return {
    code: "state-index.revision-read-failed",
    message:
      "failed to read the current revision or its index file; check repository " +
      "access and revision integrity, then retry"
  };
}
