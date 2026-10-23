/*
 * Synced TypeScript runtime; repository maintenance edits tools/investigation-report/src/validation-sync-flow.ts.
 * Installed skill copies may be edited directly; updates overwrite matching files.
 * Repository: https://github.com/zxyycom/skills
 * Source path: tools/investigation-report/src/validation-sync-flow.ts
 * Maintained source: https://github.com/zxyycom/skills/blob/main/tools/investigation-report/src/validation-sync-flow.ts
 * Skill source directory: https://github.com/zxyycom/skills/tree/main/skills/investigation-report
 * Rebuild: bun run sync:investigation-report-check
 */
import type { InvestigationDiagnostic } from "./diagnostics.ts";
import path from "node:path";
import type { StateIndexSyncMode } from "../../index-runtime/src/index.ts";
import { synchronizeRecordIndex } from "../../record-operations/src/synchronize.ts";
import { createInvestigationStateIndexDefinition } from "./investigation-index-definition.ts";
import { withInvestigationCollectionMutationLock } from "./collection-mutation-lock.ts";
import {
  investigationIndexDiagnosticMessages,
  investigationIndexFileName,
  syncInvestigationStateIndex
} from "./investigation-state-index.ts";
import {
  investigationNameFromId,
  normalizeInvestigationSelectorInput,
  parseDatedInvestigationId
} from "./report-path.ts";
import {
  collectValidatedInvestigationCollection,
  type InvestigationSnapshot,
  type ValidatedInvestigationCollection
} from "./validation-collection.ts";
import type { InvestigationIndexSyncResult } from "./types.ts";
import {
  lstatOrNull,
  stateIndexSyncDiagnostics,
  syncMutation,
  syncResult
} from "./validation-results.ts";

export async function synchronizeFullCollection(
  investigationRoot: string,
  mode: StateIndexSyncMode,
  selectors: readonly string[] | undefined
): Promise<InvestigationIndexSyncResult> {
  const collection = await collectValidatedInvestigationCollection(
    investigationRoot,
    { allowEmptyCollection: true }
  );
  if (collection.errors.length > 0 || collection.snapshot === null) {
    return syncResult({
      changed: false,
      errors: collection.errors,
      indexPath: collection.indexPath,
      reportCount: collection.reportCount,
      selectors: selectors ?? [],
      warnings: collection.warnings
    });
  }
  const snapshot = collection.snapshot;
  if (
    collection.reportCount === 0 &&
    (await lstatOrNull(collection.indexPath)) === null
  ) {
    return syncResult({
      changed: false,
      errors: ["investigation collection must contain at least one report"],
      indexPath: collection.indexPath,
      reportCount: 0,
      selectors: selectors ?? [],
      warnings: collection.warnings
    });
  }
  return await synchronizeValidatedCollection(
    investigationRoot,
    collection,
    snapshot,
    mode,
    selectors
  );
}

async function synchronizeValidatedCollection(
  investigationRoot: string,
  collection: ValidatedInvestigationCollection,
  snapshot: InvestigationSnapshot,
  mode: StateIndexSyncMode,
  selectors: readonly string[] | undefined
): Promise<InvestigationIndexSyncResult> {
  const synchronized = await synchronizeRecordIndex({
    context: { root: investigationRoot },
    definition: createInvestigationStateIndexDefinition(),
    indexPath: investigationIndexFileName,
    mode,
    snapshot,
    ...(selectors === undefined ? {} : { selectors }),
    selectorPolicy: {
      label: "Investigation",
      codePrefix: "investigation-report",
      normalize: normalizeInvestigationSelectorInput,
      datedId: (selector) => parseDatedInvestigationId(selector)?.id ?? null,
      nameFromId: investigationNameFromId
    }
  });
  return synchronizedSyncResult(collection, selectors, synchronized);
}

function synchronizedSyncResult(
  collection: ValidatedInvestigationCollection,
  selectors: readonly string[] | undefined,
  synchronized: Awaited<ReturnType<typeof syncInvestigationStateIndex>>
): InvestigationIndexSyncResult {
  const failure = synchronized.status === "error" ? synchronized : null;
  const diagnostics =
    failure === null
      ? []
      : stateIndexSyncDiagnostics(failure, collection.indexPath);
  const errors =
    failure === null
      ? []
      : investigationIndexDiagnosticMessages(
          failure.diagnostics,
          collection.indexPath
        );
  const mutation = syncFailureMutation(failure, diagnostics);
  return syncResult({
    changed: synchronized.changed,
    changedIds: synchronized.changedIds,
    diagnostics,
    errors,
    indexPath: collection.indexPath,
    mutation,
    reportCount: collection.reportCount,
    scope: synchronized.scope,
    selectedIds: synchronized.selectedIds,
    selectors: selectors ?? [],
    state: synchronized.state,
    warnings: collection.warnings
  });
}

function syncFailureMutation(
  failure: Extract<
    Awaited<ReturnType<typeof syncInvestigationStateIndex>>,
    { status: "error" }
  > | null,
  diagnostics: readonly InvestigationDiagnostic[]
) {
  if (diagnostics.length === 0) return undefined;
  return syncMutation(
    failure?.state === "index-write-failed" ? "partial-or-unknown" : "no-change"
  );
}

export async function synchronizeFullCollectionWithMutationLock(
  investigationRoot: string,
  mode: StateIndexSyncMode,
  selectors: readonly string[] | undefined
): Promise<InvestigationIndexSyncResult> {
  if (mode !== "write")
    return await synchronizeFullCollection(investigationRoot, mode, selectors);
  return await withInvestigationCollectionMutationLock(
    path.join(investigationRoot, investigationIndexFileName),
    async () =>
      await synchronizeFullCollection(investigationRoot, mode, selectors)
  );
}
