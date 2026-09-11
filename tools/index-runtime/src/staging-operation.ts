import {
  openVersionControl,
  type VersionControlFile
} from "../../shared/src/version-control/index.ts";
import { repositoryRelativePathFromFileSystemPath } from "../../shared/src/version-control/repository-relative-path.ts";
import {
  defineStateIndexDefinition,
  expectationOf,
  validateStateIndexDefinition
} from "./definition.ts";
import { diagnostic } from "./diagnostics.ts";
import {
  sameStateIndexCollectionMetadata,
  validateStateIndexSelectedIds
} from "./selection.ts";
import { buildStateIndexFromSnapshot } from "./snapshot-builder.ts";
import { parseStateIndex, serializeStateIndex } from "./snapshot-parser.ts";
import { loadStateIndexAtResolvedPath, resolveIndexPath } from "./storage.ts";
import {
  abortedStage,
  failedStage,
  isOperationAborted,
  pendingFailure,
  repositoryOpenFailure,
  revisionReadFailure
} from "./staging-failures.ts";
import { hasEntry, selectTargetSnapshot } from "./staging-selection.ts";
import type {
  EntryStageResultContext,
  StagingRepository
} from "./staging-contracts.ts";
import type {
  JsonObject,
  StateIndex,
  StateIndexContext,
  StateIndexDefinition,
  StateIndexEntryStageResult,
  StateIndexResult
} from "./types.ts";

/*
 * Resolves caller-facing selectors only after both index snapshots have passed
 * the staging transaction's collection-contract checks.
 */
export type StateIndexEntrySelectionResolver<
  State extends object,
  Metadata extends JsonObject
> = (
  options: Readonly<{
    baseline: StateIndex<State, Metadata> | null;
    selectedIds: readonly string[];
    workspace: StateIndex<State, Metadata>;
  }>
) => StateIndexResult<string[]>;

export async function stageSelectedIndexEntries<
  State extends object,
  Metadata extends JsonObject
>(
  options: Readonly<{
    context: StateIndexContext;
    definition: StateIndexDefinition<State, Metadata>;
    indexPath: string;
    resolveSelectedIds?: StateIndexEntrySelectionResolver<State, Metadata>;
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
    resolveSelectedIds?: StateIndexEntrySelectionResolver<State, Metadata>;
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
  const selected = validateStateIndexSelectedIds(
    options.selectedIds,
    options.indexPath
  );
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
    !sameStateIndexCollectionMetadata(baseline, workspaceIndex.value)
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

  const resolved: StateIndexResult<string[]> =
    options.resolveSelectedIds === undefined
      ? { diagnostics: [], status: "ok", value: selected.selectedIds }
      : options.resolveSelectedIds({
          baseline,
          selectedIds: selected.selectedIds,
          workspace: workspaceIndex.value
        });
  if (resolved.status === "error") {
    return failedStage(
      resultContext,
      "selection-invalid",
      resolved.diagnostics,
      selected.selectedIds
    );
  }
  const resolvedSelectedIds = validateStateIndexSelectedIds(
    resolved.value,
    options.indexPath
  );
  if (resolvedSelectedIds.status === "error") {
    return failedStage(
      resultContext,
      "selection-invalid",
      resolvedSelectedIds.diagnostics,
      selected.selectedIds
    );
  }

  const selectedIds = new Set(resolvedSelectedIds.selectedIds);
  const missingId = resolvedSelectedIds.selectedIds.find(
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
      resolvedSelectedIds.selectedIds
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
      resolvedSelectedIds.selectedIds
    );
  }
  if (isOperationAborted(options.context)) {
    return abortedStage(resultContext, resolvedSelectedIds.selectedIds);
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
      resolvedSelectedIds.selectedIds
    );
  }

  const success = {
    diagnostics: [],
    indexPath: options.indexPath,
    namespace: definition.namespace,
    selectedIds: resolvedSelectedIds.selectedIds,
    status: "ok" as const
  };
  return changed
    ? { ...success, changed: true, state: "staged" }
    : { ...success, changed: false, state: "unchanged" };
}
