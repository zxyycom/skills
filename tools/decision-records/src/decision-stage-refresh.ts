import {
  loadRefreshContext,
  loadRefreshBaseline,
  type RefreshContext,
  type RefreshOptions
} from "./decision-stage-refresh-context.ts";
import { collectRefreshSourceUpdates } from "./decision-stage-refresh-sources.ts";
import {
  displayIndexRelativePath,
  displayRepositoryRelativePath
} from "./decision-stage-paths.ts";
import { relatedPublishedDecisionIds } from "./decision-source-dependencies.ts";
import {
  stageRecordSelection,
  RecordStageError,
  RecordStagePublicationError,
  type RecordStageResult
} from "../../index-runtime/src/record-staging.ts";
import {
  readPendingSnapshot,
  samePendingSnapshots,
  type PendingFileUpdate,
  type PendingSnapshot
} from "../../shared/src/version-control/pending-snapshot.ts";
import {
  buildDecisionIndexFromSnapshot,
  serializeDecisionIndex
} from "./decision-state-index.ts";
import { decisionSourceRevision } from "./decision-source-revision.ts";
import { stageSourceFromFile } from "./decision-stage-sources.ts";
import {
  DecisionStageConflictError,
  repositoryPath
} from "./decision-stage-support.ts";
import type {
  DecisionId,
  DecisionIndex,
  DecisionIndexState,
  DecisionIndexMetadata
} from "./types.ts";
import type { DecisionStageSuccess } from "./decision-stage-service.ts";

/** Domain source discovery adapts to the shared record-stage transaction. */
export async function refreshDecisionStage(
  options: RefreshOptions
): Promise<DecisionStageSuccess> {
  const fixed = await loadRefreshBaseline(options);
  let staged;
  try {
    staged = await stageRecordSelection<
      DecisionIndexState,
      DecisionIndexMetadata,
      DecisionIndex,
      RefreshContext
    >({
      repository: options.opened.repository,
      revision: fixed.revision,
      scope: options.scope,
      indexPath: repositoryPath(
        options.opened.decisionScope,
        "decision-index.json"
      ),
      acquire: async (_stage, previous) => {
        const context = await loadRefreshContext(
          options,
          fixed,
          previous?.context
        );
        return {
          baseline: context.head,
          workspace: context.workspace,
          pendingIndex: context.pending,
          pending: context.snapshot,
          selectedIds: context.selectedIds,
          workspaceEvidence: context.workspaceText,
          workspaceBytes: context.workspaceBytes,
          context
        };
      },
      build: buildDecisionIndexFromSnapshot,
      serialize: serializeDecisionIndex,
      prepareDomain: async (phase, projection) => {
        const updates = await collectRefreshSourceUpdates(
          options,
          phase.context
        );
        const pending = await protectRefreshPendingDependencies(
          options,
          phase.context,
          updates,
          projection
        );
        return { pending, updates: [...updates.values()], sourceFiles: [] };
      }
    });
  } catch (error) {
    if (error instanceof RecordStagePublicationError) throw error.cause;
    if (error instanceof RecordStageError) {
      if (error.kind === "pending-conflict" || error.kind === "source-drift")
        throw new DecisionStageConflictError(
          error.kind === "pending-conflict" ? "pending" : "source",
          error.message
        );
      throw new Error(
        error.message +
          "; " +
          error.diagnostics.map((item) => item.message).join("; ")
      );
    }
    throw error;
  }
  return decisionStageSuccess(options, staged);
}

function decisionStageSuccess(
  options: RefreshOptions,
  staged: RecordStageResult<DecisionIndex, RefreshContext>
): DecisionStageSuccess {
  const before = staged.phase.context;
  const result = staged.replacement;
  const updates = staged.updates;
  const callerOwnedPaths =
    options.scope === "domain"
      ? [before.indexPath]
      : options.scope === "index"
        ? before.selectedIds.flatMap((id) => {
            const entry = before.workspace.entries[id];
            return entry === undefined
              ? []
              : [
                  repositoryPath(options.opened.decisionScope, entry.sourcePath)
                ];
          })
        : [];
  const display = (file: string) =>
    displayRepositoryRelativePath(options, options.opened.decisionScope, file);
  const updated = new Set(updates.map((file) => file.path));
  return {
    status: "ok",
    command: "stage",
    scope: options.scope,
    selectedIds: before.selectedIds,
    indexRelativePath: displayIndexRelativePath(options),
    pendingFileCount: result.pendingPaths.length,
    writtenPaths: result.changedPaths.map(display),
    preservedPendingPaths: before.snapshot.members
      .filter((file) => !updated.has(file.path))
      .map((file) => display(file.path)),
    callerOwnedPaths: callerOwnedPaths.map(display)
  };
}

/** The final acquisition retains selected/dependency bytes and protects the complete pending identity. */
async function protectRefreshPendingDependencies(
  options: RefreshOptions,
  context: RefreshContext,
  updates: ReadonlyMap<string, PendingFileUpdate>,
  projection: DecisionIndex | null
): Promise<PendingSnapshot> {
  const { repository, decisionScope } = options.opened;
  const { selectedIds, snapshot } = context;
  const dependencyIds =
    options.scope === "all" && projection !== null
      ? [
          ...relatedPublishedDecisionIds(projection, new Set(selectedIds))
        ].filter((id) => projection.entries[id] !== undefined)
      : [];
  const dependencyPaths =
    projection === null
      ? []
      : dependencyIds.map((id) =>
          repositoryPath(decisionScope, projection.entries[id]!.sourcePath)
        );
  const retained = new Set(snapshot.files.map((file) => file.path));
  const members = new Set(snapshot.members.map((file) => file.path));
  // Complete payload validation already happened. Only missing dependency bytes
  // need another acquisition; update payloads come from the validated workspace.
  const needsDependencyContent = dependencyPaths.some(
    (file) => members.has(file) && !retained.has(file) && !updates.has(file)
  );
  const complete = needsDependencyContent
    ? await readPendingSnapshot(repository, {
        pathScope: decisionScope,
        contentPaths: [...retained, ...dependencyPaths]
      })
    : snapshot;
  if (!samePendingSnapshots(snapshot, complete))
    throw new DecisionStageConflictError(
      "pending",
      "pending-conflict: Pending decision snapshot changed during source preparation."
    );
  verifyRefreshDependencySources(
    projection,
    dependencyIds,
    decisionScope,
    updates,
    complete
  );
  return complete;
}

function verifyRefreshDependencySources(
  projection: DecisionIndex | null,
  dependencyIds: readonly DecisionId[],
  decisionScope: string,
  updates: ReadonlyMap<string, PendingFileUpdate>,
  complete: PendingSnapshot
): void {
  if (projection === null) {
    return;
  }
  for (const id of dependencyIds) {
    const entry = projection.entries[id]!;
    const sourcePath = repositoryPath(decisionScope, entry.sourcePath);
    const update = updates.get(sourcePath);
    const file =
      update === undefined
        ? complete.files.find((item) => item.path === sourcePath)
        : update.data === null
          ? undefined
          : update;
    if (file === undefined || file.kind !== "regular") {
      throw new Error(
        "Selected stage requires the source of related Decision " +
          id +
          "; select that ID as well."
      );
    }
    const source = stageSourceFromFile(file, entry.sourcePath);
    if (
      source.source.decisionId !== id ||
      decisionSourceRevision([source.source]).entries[id] !==
        projection.sourceRevision.entries[id]
    ) {
      throw new Error(
        "Related pending Decision source differs from its index projection: " +
          id +
          "; select that ID as well."
      );
    }
  }
}
