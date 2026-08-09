import {
  openVersionControl,
  VersionControlError,
  type VersionControlFile
} from "../../shared/src/version-control/index.ts";
import {
  repositoryRelativePathFromFileSystemPath
} from "../../shared/src/version-control/repository-relative-path.ts";
import {
  defineStateIndexDefinition,
  expectationOf,
  validateStateIndexDefinition
} from "./definition.ts";
import { diagnostic } from "./diagnostics.ts";
import { compareIndexText } from "./ordering.ts";
import { isStateIndexText } from "./schemas.ts";
import { buildStateIndexFromSnapshot } from "./snapshot-builder.ts";
import {
  parseStateIndex,
  serializeStateIndex
} from "./snapshot-parser.ts";
import {
  loadStateIndex,
  resolveIndexPath
} from "./storage.ts";
import type {
  JsonObject,
  StateIndex,
  StateIndexContext,
  StateIndexDefinition,
  StateIndexDiagnostic,
  StateIndexEntryStageResult,
  StateIndexResult,
  StateRecord,
  StateSourceRevision
} from "./types.ts";

type EntryStageErrorState = Exclude<Extract<
  StateIndexEntryStageResult,
  { status: "error" }
>["state"], "pending-recovery-failed">;

type SelectedIdValidation =
  | { diagnostics: StateIndexDiagnostic[]; status: "error" }
  | { selectedIds: string[]; status: "ok" };

export async function stageSelectedIndexEntries<
  State extends object,
  Metadata extends JsonObject
>(options: Readonly<{
  context: StateIndexContext;
  definition: StateIndexDefinition<State, Metadata>;
  indexPath: string;
  selectedIds: readonly string[];
}>): Promise<StateIndexEntryStageResult> {
  const definitionErrors = validateStateIndexDefinition(options.definition);
  if (definitionErrors.length > 0) {
    return failedStage(options, "definition-invalid", [diagnostic({
      code: "state-index.definition-invalid",
      message: definitionErrors.join("; "),
      path: options.indexPath
    })]);
  }
  const definition = defineStateIndexDefinition(options.definition);
  const selected = validateSelectedIds(options.selectedIds, options.indexPath);
  if (selected.status === "error") {
    return failedStage(options, "selection-invalid", selected.diagnostics);
  }
  if (isOperationAborted(options.context)) {
    return failedStage(options, "operation-aborted", [diagnostic({
      code: "state-index.operation-aborted",
      message: "index entry staging was aborted",
      path: options.indexPath
    })], selected.selectedIds);
  }

  const absoluteIndexPath = resolveIndexPath(
    options.indexPath,
    options.context.root
  );
  if (absoluteIndexPath.status === "error") {
    return failedStage(
      options,
      "index-path-invalid",
      absoluteIndexPath.diagnostics,
      selected.selectedIds
    );
  }

  let repository: Awaited<ReturnType<typeof openVersionControl>>;
  let revision: string | null;
  let revisionFile: VersionControlFile | null;
  let repositoryIndexPath: string;
  try {
    repository = await openVersionControl(options.context.root);
    repositoryIndexPath = repositoryRelativePathFromFileSystemPath(
      repository.rootDirectory,
      absoluteIndexPath.value
    );
    revision = await repository.getCurrentRevision();
    revisionFile = revision === null
      ? null
      : await repository.readRevisionFile(revision, repositoryIndexPath);
  } catch (error) {
    return revisionReadFailure(options, error, selected.selectedIds);
  }

  let revisionIndex: StateIndexResult<StateIndex<State, Metadata>> | null = null;
  if (revisionFile !== null) {
    let revisionText: string;
    try {
      revisionText = new TextDecoder("utf-8", { fatal: true }).decode(
        revisionFile.data
      );
    } catch {
      return failedStage(options, "revision-index-invalid", [diagnostic({
        code: "state-index.revision-index-encoding-invalid",
        message: "the revision index is not valid UTF-8 text",
        path: options.indexPath
      })], selected.selectedIds);
    }
    revisionIndex = parseStateIndex({
      definition,
      expectation: expectationOf(definition),
      sourcePath: options.indexPath,
      text: revisionText
    });
  }
  if (revisionIndex?.status === "error") {
    return failedStage(
      options,
      "revision-index-invalid",
      revisionIndex.diagnostics,
      selected.selectedIds
    );
  }

  const baseline = revisionIndex?.value ?? null;
  const workspaceIndex = await loadStateIndex({
    context: options.context,
    definition,
    expectation: expectationOf(definition),
    indexPath: options.indexPath
  });
  if (workspaceIndex.status === "error") {
    return failedStage(
      options,
      "workspace-index-invalid",
      workspaceIndex.diagnostics,
      selected.selectedIds
    );
  }
  if (
    baseline !== null
    && !sameCollectionContract(baseline, workspaceIndex.value)
  ) {
    return failedStage(options, "collection-changed", [diagnostic({
      code: "state-index.stage-collection-changed",
      message: "metadata or its source revision changed; stage the complete index instead",
      path: options.indexPath
    })], selected.selectedIds);
  }

  const selectedIds = new Set(selected.selectedIds);
  const missingId = selected.selectedIds.find((id) => (
    !hasEntry(baseline, id) && !hasEntry(workspaceIndex.value, id)
  ));
  if (missingId !== undefined) {
    return failedStage(options, "selection-invalid", [diagnostic({
      code: "state-index.selected-id-missing",
      message: `selected state id ${JSON.stringify(missingId)} is absent from both indexes`,
      path: options.indexPath,
      stateId: missingId
    })], selected.selectedIds);
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
      options,
      "target-invalid",
      target.diagnostics,
      selected.selectedIds
    );
  }
  if (isOperationAborted(options.context)) {
    return failedStage(options, "operation-aborted", [diagnostic({
      code: "state-index.operation-aborted",
      message: "index entry staging was aborted",
      path: options.indexPath
    })], selected.selectedIds);
  }

  const targetText = serializeStateIndex(target.value, definition);
  const targetData = Buffer.from(targetText, "utf8");
  const changed = revisionFile === null
    || !targetData.equals(Buffer.from(revisionFile.data));
  try {
    await repository.replacePendingFiles({
      expectedFiles: revisionFile === null ? [] : [revisionFile],
      expectedRevision: revision,
      files: [{ data: targetData, path: repositoryIndexPath }],
      pathScope: repositoryIndexPath
    });
  } catch (error) {
    return pendingFailure(options, error, selected.selectedIds);
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
      diagnostics: [diagnostic({
        code: "state-index.selected-ids-invalid",
        message: "selectedIds must be a non-empty array of unique state ids",
        path: indexPath
      })],
      status: "error"
    };
  }
  const ids: string[] = [];
  const seen = new Set<string>();
  for (const id of input) {
    if (typeof id !== "string" || !isStateIndexText(id)) {
      return {
        diagnostics: [diagnostic({
          code: "state-index.selected-id-invalid",
          message: "selected state ids must be non-empty text without surrounding "
            + "whitespace or control characters",
          path: indexPath,
          stateId: typeof id === "string" ? id : null
        })],
        status: "error"
      };
    }
    if (seen.has(id)) {
      return {
        diagnostics: [diagnostic({
          code: "state-index.selected-id-duplicate",
          message: `selected state id ${JSON.stringify(id)} appears more than once`,
          path: indexPath,
          stateId: id
        })],
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
  return JSON.stringify(revision.metadata) === JSON.stringify(workspace.metadata)
    && revision.sourceRevision.metadata === workspace.sourceRevision.metadata;
}

function selectTargetSnapshot<
  State extends object,
  Metadata extends JsonObject
>(
  revision: StateIndex<State, Metadata> | null,
  workspace: StateIndex<State, Metadata>,
  selectedIds: ReadonlySet<string>
): {
  metadata: Metadata;
  sourceRevision: StateSourceRevision;
  states: StateRecord<State>;
} {
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
      metadata: revision?.sourceRevision.metadata
        ?? workspace.sourceRevision.metadata
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

function pendingFailure<
  State extends object,
  Metadata extends JsonObject
>(
  options: Readonly<{
    definition: StateIndexDefinition<State, Metadata>;
    indexPath: string;
  }>,
  error: unknown,
  selectedIds: string[]
): StateIndexEntryStageResult {
  if (
    error instanceof VersionControlError
    && error.code === "pending-conflict"
  ) {
    return failedStage(options, "pending-conflict", [diagnostic({
      code: "state-index.pending-conflict",
      message: "the pending index no longer matches the revision; clear or commit its "
        + "existing change before retrying",
      path: options.indexPath
    })], selectedIds);
  }
  if (
    error instanceof VersionControlError
    && error.code === "pending-recovery-failed"
  ) {
    return failedRecoveryStage(options, [diagnostic({
      code: "state-index.pending-recovery-failed",
      message: "pending index recovery was incomplete; inspect the pending index before "
        + "retrying",
      path: options.indexPath
    })], selectedIds);
  }
  return failedStage(options, "pending-write-failed", [diagnostic({
    code: "state-index.pending-write-failed",
    message: "failed to replace the pending index; the previous pending range was preserved",
    path: options.indexPath
  })], selectedIds);
}

function revisionReadFailure<
  State extends object,
  Metadata extends JsonObject
>(
  options: Readonly<{
    definition: StateIndexDefinition<State, Metadata>;
    indexPath: string;
  }>,
  error: unknown,
  selectedIds: string[]
): StateIndexEntryStageResult {
  const repositoryUnavailable = error instanceof VersionControlError
    && error.code === "not-repository";
  const invalidPath = error instanceof VersionControlError
    && error.code === "invalid-path";
  return failedStage(
    options,
    invalidPath ? "index-path-invalid" : "revision-read-failed",
    [diagnostic({
      code: invalidPath
        ? "state-index.index-path-invalid"
        : repositoryUnavailable
          ? "state-index.repository-unavailable"
          : "state-index.revision-index-read-failed",
      message: invalidPath
        ? "the index path is not a repository file path"
        : repositoryUnavailable
          ? "the configured root is not inside a version-control repository"
          : "failed to read the revision index from version control",
      path: options.indexPath
    })],
    selectedIds
  );
}

function failedRecoveryStage<
  State extends object,
  Metadata extends JsonObject
>(
  options: Readonly<{
    definition: StateIndexDefinition<State, Metadata>;
    indexPath: string;
  }>,
  diagnostics: StateIndexDiagnostic[],
  selectedIds: string[]
): StateIndexEntryStageResult {
  return {
    changed: null,
    diagnostics,
    indexPath: options.indexPath,
    namespace: options.definition.namespace,
    selectedIds,
    state: "pending-recovery-failed",
    status: "error"
  };
}

function failedStage<
  State extends object,
  Metadata extends JsonObject
>(
  options: Readonly<{
    definition: StateIndexDefinition<State, Metadata>;
    indexPath: string;
  }>,
  state: EntryStageErrorState,
  diagnostics: StateIndexDiagnostic[],
  selectedIds: string[] = []
): StateIndexEntryStageResult {
  return {
    changed: false,
    diagnostics,
    indexPath: options.indexPath,
    namespace: options.definition.namespace,
    selectedIds,
    state,
    status: "error"
  };
}
