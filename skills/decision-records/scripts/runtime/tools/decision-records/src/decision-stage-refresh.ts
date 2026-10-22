/*
 * Synced TypeScript runtime; repository maintenance edits tools/decision-records/src/decision-stage-refresh.ts.
 * Installed skill copies may be edited directly; updates overwrite matching files.
 * Repository: https://github.com/zxyycom/skills
 * Source path: tools/decision-records/src/decision-stage-refresh.ts
 * Maintained source: https://github.com/zxyycom/skills/blob/main/tools/decision-records/src/decision-stage-refresh.ts
 * Skill source directory: https://github.com/zxyycom/skills/tree/main/skills/decision-records
 * Rebuild: bun run sync:decision-records-cli
 */
import {
  loadRefreshContext,
  type RefreshContext,
  type RefreshOptions
} from "./decision-stage-refresh-context.ts";
import { collectRefreshSourceUpdates } from "./decision-stage-refresh-sources.ts";
import {
  displayIndexRelativePath,
  displayRepositoryRelativePath
} from "./decision-stage-paths.ts";
import { relatedPublishedDecisionIds } from "./decision-source-dependencies.ts";
import { Buffer } from "node:buffer";
import { isDeepStrictEqual } from "node:util";
import { selectTargetSnapshot } from "../../index-runtime/src/staging-selection.ts";
import {
  readPendingSnapshot,
  replacePendingSnapshot,
  samePendingSnapshots,
  type PendingFileUpdate,
  type PendingSnapshot
} from "../../shared/src/version-control/pending-snapshot.ts";
import type { RevisionId } from "../../shared/src/version-control/index.ts";
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
import type { DecisionId, DecisionIndex } from "./types.ts";
import type { DecisionStageSuccess } from "./decision-stage-service.ts";

type RefreshPreparation = Readonly<{
  revision: RevisionId | null;
  snapshot: PendingSnapshot;
  workspaceText: string;
  selectedIds: readonly DecisionId[];
  updates: readonly PendingFileUpdate[];
  callerOwnedPaths: readonly string[];
}>;

/** Two independent preparations protect sources, published projection and all pending bytes. */
export async function refreshDecisionStage(
  options: RefreshOptions
): Promise<DecisionStageSuccess> {
  const before = await prepareRefresh(options);
  const after = await prepareRefresh(options);
  if (
    before.revision !== after.revision ||
    before.workspaceText !== after.workspaceText ||
    !samePendingSnapshots(before.snapshot, after.snapshot) ||
    !isDeepStrictEqual(before.updates, after.updates) ||
    !isDeepStrictEqual(before.selectedIds, after.selectedIds)
  )
    throw new DecisionStageConflictError(
      "pending",
      "pending-conflict: Decision stage inputs changed during preparation; no pending files were written."
    );
  const result = await replacePendingSnapshot(options.opened.repository, {
    expectedRevision: before.revision,
    expectedSnapshot: before.snapshot,
    updates: before.updates
  });
  const display = (file: string) =>
    displayRepositoryRelativePath(options, options.opened.decisionScope, file);
  const updated = new Set(before.updates.map((file) => file.path));
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
    callerOwnedPaths: before.callerOwnedPaths.map(display)
  };
}

async function prepareRefresh(
  options: RefreshOptions
): Promise<RefreshPreparation> {
  const context = await loadRefreshContext(options);
  const { indexPath, revision, workspaceText, selectedIds } = context;
  const { updates, callerOwnedPaths } = await collectRefreshSourceUpdates(
    options,
    context
  );
  const projection = await refreshIndexProjection(options, context, updates);
  if (options.scope === "domain") callerOwnedPaths.push(indexPath);
  const complete = await protectRefreshPendingDependencies(
    options,
    context,
    updates,
    projection
  );
  return {
    revision,
    snapshot: complete,
    workspaceText,
    selectedIds,
    updates: [...updates.values()].sort((a, b) => a.path.localeCompare(b.path)),
    callerOwnedPaths
  };
}

/** Compose selected projections over P and validate the resulting complete published graph. */
async function refreshIndexProjection(
  options: RefreshOptions,
  context: RefreshContext,
  updates: Map<string, PendingFileUpdate>
): Promise<DecisionIndex | null> {
  const { workspace, pending, selectedIds, indexPath } = context;
  let projection: DecisionIndex | null = null;
  if (options.scope !== "domain") {
    const built = await buildDecisionIndexFromSnapshot(
      selectTargetSnapshot(pending, workspace, new Set(selectedIds))
    );
    if (built.status === "error")
      throw new Error(
        "Selected stage dependencies are incomplete; select the required related IDs: " +
          built.diagnostics.map((item) => item.message).join("; ")
      );
    projection = built.value;
    updates.set(indexPath, {
      path: indexPath,
      kind: "regular",
      data: Buffer.from(serializeDecisionIndex(built.value), "utf8")
    });
  }
  return projection;
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
  const composedIndex = projection;
  const dependencyIds =
    options.scope === "all" && composedIndex !== null
      ? [
          ...relatedPublishedDecisionIds(composedIndex, new Set(selectedIds))
        ].filter((id) => composedIndex.entries[id] !== undefined)
      : [];
  const dependencyPaths = dependencyIds.map((id) =>
    repositoryPath(decisionScope, projection!.entries[id]!.sourcePath)
  );
  // Re-capture with update content retained; snapshot identity still covers all unselected payloads.
  const complete = await readPendingSnapshot(repository, {
    pathScope: decisionScope,
    contentPaths: [
      ...new Set([
        ...snapshot.files.map((file) => file.path),
        ...updates.keys(),
        ...dependencyPaths
      ])
    ]
  });
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
