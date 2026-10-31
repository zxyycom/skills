/*
 * Synced TypeScript runtime; repository maintenance edits tools/index-runtime/src/staging/selection.ts.
 * Installed skill copies may be edited directly; updates overwrite matching files.
 * Repository: https://github.com/zxyycom/skills
 * Source path: tools/index-runtime/src/staging/selection.ts
 * Maintained source: https://github.com/zxyycom/skills/blob/main/tools/index-runtime/src/staging/selection.ts
 * Skill source directory: https://github.com/zxyycom/skills/tree/main/skills/decision-records
 * Rebuild: bun run sync:decision-records-cli
 */
import { canonicalSelectedIds, selectedIdsInputError } from "./selected-ids.ts";
import { failure } from "../diagnostics.ts";
import type {
  JsonObject,
  StateIndex,
  StateIndexDiagnostic,
  StateIndexResult,
  StateIndexSyncScope
} from "../types.ts";

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

type ResolvedSyncScope =
  | Readonly<{ kind: "all" }>
  | Readonly<{ kind: "selected"; selectedIds: string[] }>;

export function resolveSyncScope(
  input: StateIndexSyncScope | undefined,
  indexPath: string
): StateIndexResult<ResolvedSyncScope> {
  if (
    input === undefined ||
    (typeof input === "object" && input !== null && input.kind === "all")
  ) {
    return { diagnostics: [], status: "ok", value: { kind: "all" } };
  }
  if (
    typeof input !== "object" ||
    input === null ||
    input.kind !== "selected"
  ) {
    return failure(
      "state-index.selection-invalid",
      "sync scope must be all or a non-empty selected ID set",
      { path: indexPath }
    );
  }
  const selected = validateStateIndexSelectedIds(input.selectedIds, indexPath);
  return selected.status === "error"
    ? { ...selected, value: null }
    : {
        diagnostics: [],
        status: "ok",
        value: { kind: "selected", selectedIds: selected.selectedIds }
      };
}

export type SelectedStateIndexChanges =
  | { kind: "accepted"; changedIds: string[] }
  | { kind: "collection-changed"; changedIds: [] }
  | { kind: "selected-id-missing"; changedIds: []; stateId: string }
  | {
      kind: "unselected-changes";
      changedIds: string[];
      unselectedIds: string[];
    };

/** Selected scope limits accepted changes without narrowing either complete projection. */
export function selectedStateIndexChanges<
  State extends object,
  Metadata extends JsonObject
>(
  baseline: StateIndex<State, Metadata>,
  candidate: StateIndex<State, Metadata>,
  selectedIds: readonly string[]
): SelectedStateIndexChanges {
  if (!sameStateIndexCollectionMetadata(baseline, candidate))
    return { kind: "collection-changed", changedIds: [] };
  const missingId = selectedIds.find(
    (id) =>
      !Object.hasOwn(baseline.entries, id) &&
      !Object.hasOwn(candidate.entries, id)
  );
  if (missingId !== undefined)
    return { kind: "selected-id-missing", changedIds: [], stateId: missingId };
  const changedIds = changedStateIds(baseline, candidate);
  const selected = new Set(selectedIds);
  const unselectedIds = changedIds.filter((id) => !selected.has(id));
  return unselectedIds.length === 0
    ? { kind: "accepted", changedIds }
    : { kind: "unselected-changes", changedIds, unselectedIds };
}

function changedStateIds<State extends object, Metadata extends JsonObject>(
  baseline: StateIndex<State, Metadata>,
  candidate: StateIndex<State, Metadata>
): string[] {
  const ids = new Set([
    ...Object.keys(baseline.entries),
    ...Object.keys(candidate.entries),
    ...Object.keys(baseline.sourceRevision.entries),
    ...Object.keys(candidate.sourceRevision.entries)
  ]);
  return [...ids]
    .filter(
      (id) =>
        baseline.sourceRevision.entries[id] !==
          candidate.sourceRevision.entries[id] ||
        JSON.stringify(baseline.entries[id]) !==
          JSON.stringify(candidate.entries[id])
    )
    .sort((left, right) => (left < right ? -1 : left > right ? 1 : 0));
}
