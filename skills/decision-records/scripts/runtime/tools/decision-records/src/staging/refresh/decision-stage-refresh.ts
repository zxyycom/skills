/*
 * Synced TypeScript runtime; repository maintenance edits tools/decision-records/src/staging/refresh/decision-stage-refresh.ts.
 * Installed skill copies may be edited directly; updates overwrite matching files.
 * Repository: https://github.com/zxyycom/skills
 * Source path: tools/decision-records/src/staging/refresh/decision-stage-refresh.ts
 * Maintained source: https://github.com/zxyycom/skills/blob/main/tools/decision-records/src/staging/refresh/decision-stage-refresh.ts
 * Skill source directory: https://github.com/zxyycom/skills/tree/main/skills/decision-records
 * Rebuild: bun run sync:decision-records-cli
 */
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
} from "../decision-stage-paths.ts";
import {
  stageRecordSelection,
  RecordStageError,
  RecordStagePublicationError,
  type RecordStageResult
} from "../../../../index-runtime/src/staging/record-staging.ts";
import {
  buildDecisionIndexFromSnapshot,
  serializeDecisionIndex
} from "../../index/decision-state-index.ts";
import {
  DecisionStageConflictError,
  repositoryPath
} from "../decision-stage-support.ts";
import type {
  DecisionIndex,
  DecisionIndexState,
  DecisionIndexMetadata
} from "../../types.ts";
import type { DecisionStageSuccess } from "../decision-stage-service.ts";

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
      prepareDomain: async (phase) => {
        const updates = await collectRefreshSourceUpdates(
          options,
          phase.context
        );
        return {
          pending: phase.context.snapshot,
          updates: [...updates.values()],
          sourceFiles: []
        };
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
