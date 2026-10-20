/*
 * Synced TypeScript runtime; repository maintenance edits tools/index-runtime/src/selection.ts.
 * Installed skill copies may be edited directly; updates overwrite matching files.
 * Repository: https://github.com/zxyycom/skills
 * Source path: tools/index-runtime/src/selection.ts
 * Maintained source: https://github.com/zxyycom/skills/blob/main/tools/index-runtime/src/selection.ts
 * Skill source directory: https://github.com/zxyycom/skills/tree/main/skills/novel-cards
 * Rebuild: bun run sync:novel-cards-cli
 */
import { canonicalSelectedIds, selectedIdsInputError } from "./selected-ids.ts";
import type { JsonObject, StateIndex, StateIndexDiagnostic } from "./types.ts";

export type StateIndexSelectedIdsResult =
  | Readonly<{ diagnostics: StateIndexDiagnostic[]; status: "error" }>
  | Readonly<{ selectedIds: string[]; status: "ok" }>;

/** Validates the canonical ID set used by scoped index operations. */
export function validateStateIndexSelectedIds(
  input: readonly string[],
  indexPath: string
): StateIndexSelectedIdsResult {
  if (!Array.isArray(input) || input.length === 0) {
    return { diagnostics: selectedIdsInputError(indexPath), status: "error" };
  }
  const validated = canonicalSelectedIds(input, indexPath);
  return validated.selectedIds === null
    ? { diagnostics: validated.diagnostics, status: "error" }
    : { selectedIds: validated.selectedIds, status: "ok" };
}

/** Compares the collection-level fields that cannot be assigned to one ID. */
export function sameStateIndexCollectionMetadata<
  State extends object,
  Metadata extends JsonObject
>(
  left: StateIndex<State, Metadata>,
  right: StateIndex<State, Metadata>
): boolean {
  return (
    JSON.stringify(left.metadata) === JSON.stringify(right.metadata) &&
    left.sourceRevision.metadata === right.sourceRevision.metadata
  );
}
