import { diagnostic } from "./diagnostics.ts";
import { compareIndexText } from "./ordering.ts";
import { isStateIndexText } from "./schemas.ts";
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
