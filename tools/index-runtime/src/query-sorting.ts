import { diagnostic } from "./diagnostics.ts";
import { compareIndexText, compareStateIndexKeyScalars } from "./ordering.ts";
import type { MaterializedStateIndexEntry } from "./query-fields.ts";
import type {
  StateIndexDiagnostic,
  StateIndexKeyScalar,
  StateIndexQueryValue,
  StateIndexSort
} from "./types.ts";

export function effectiveSort(query: StateIndexQueryValue): StateIndexSort[] {
  return query.sort === undefined
    ? [{ direction: "asc", key: "id" }]
    : [...query.sort];
}
export function validateSortCardinality(
  entries: readonly MaterializedStateIndexEntry<object>[],
  sorts: readonly StateIndexSort[]
): StateIndexDiagnostic[] {
  for (const sort of sorts) {
    if (sort.key === "id") continue;
    const multivalued = entries.find(
      (entry) => (entry.queryValues[sort.key]?.length ?? 0) > 1
    );
    if (multivalued !== undefined) {
      return [
        diagnostic({
          code: "state-index.sort-key-multivalued",
          message: `key ${sort.key} has multiple values for state ${multivalued.id}`,
          stateId: multivalued.id
        })
      ];
    }
  }
  return [];
}
export function compareEntries(
  left: MaterializedStateIndexEntry<object>,
  right: MaterializedStateIndexEntry<object>,
  sorts: readonly StateIndexSort[]
): number {
  for (const sort of sorts) {
    const leftValue =
      sort.key === "id" ? left.id : left.queryValues[sort.key]?.[0];
    const rightValue =
      sort.key === "id" ? right.id : right.queryValues[sort.key]?.[0];
    const comparison = compareOptionalScalars(
      leftValue,
      rightValue,
      sort.direction
    );
    if (comparison !== 0) return comparison;
  }
  return compareIndexText(left.id, right.id);
}
function compareOptionalScalars(
  left: StateIndexKeyScalar | undefined,
  right: StateIndexKeyScalar | undefined,
  direction: "asc" | "desc"
): number {
  if (left === undefined) return right === undefined ? 0 : 1;
  if (right === undefined) return -1;
  const comparison = compareStateIndexKeyScalars(left, right);
  return direction === "desc" ? -comparison : comparison;
}
