/*
 * Synced TypeScript runtime; repository maintenance edits tools/record-operations/src/check.ts.
 * Installed skill copies may be edited directly; updates overwrite matching files.
 * Repository: https://github.com/zxyycom/skills
 * Source path: tools/record-operations/src/check.ts
 * Maintained source: https://github.com/zxyycom/skills/blob/main/tools/record-operations/src/check.ts
 * Skill source directory: https://github.com/zxyycom/skills/tree/main/skills/investigation-report
 * Rebuild: bun run sync:investigation-report-check
 */
import {
  prepareStateIndexFromSnapshot,
  syncStateIndexPrepared
} from "../../index-runtime/src/prepared.ts";
import type {
  JsonObject,
  StateIndexContext,
  StateIndexDefinition,
  StateIndexSyncResult,
  StateSnapshot
} from "../../index-runtime/src/types.ts";

/** Read-only collection audit: validate the first acquisition, never re-read it as a final fresh proof. */
export async function checkCollectedRecordIndex<
  State extends object,
  Metadata extends JsonObject
>(
  options: Readonly<{
    context: StateIndexContext;
    definition: StateIndexDefinition<State, Metadata>;
    indexPath: string;
    snapshot: StateSnapshot<State, Metadata>;
  }>
): Promise<StateIndexSyncResult> {
  const definition: StateIndexDefinition<State, Metadata> = {
    ...options.definition,
    read: async () => options.snapshot,
    readRevision: async () => options.snapshot.sourceRevision
  };
  const prepared = prepareStateIndexFromSnapshot({ ...options, definition });
  if (prepared.status === "error")
    return {
      status: "error",
      changed: false,
      changedIds: [],
      diagnostics: prepared.diagnostics,
      mode: "check",
      indexPath: options.indexPath,
      namespace: definition.namespace,
      scope: "all",
      selectedIds: [],
      state: "source-invalid"
    };
  return await syncStateIndexPrepared({
    ...options,
    definition,
    prepared: prepared.value,
    mode: "check"
  });
}
