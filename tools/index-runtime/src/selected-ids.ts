import { diagnostic } from "./diagnostics.ts";
import { compareIndexText } from "./ordering.ts";
import { isStateIndexText } from "./schemas.ts";
import type { StateIndexDiagnostic } from "./types.ts";

export function selectedIdsInputError(
  indexPath: string
): StateIndexDiagnostic[] {
  return [
    diagnostic({
      code: "state-index.selected-ids-invalid",
      message: "selectedIds must be a non-empty array of unique state ids",
      path: indexPath
    })
  ];
}

export function canonicalSelectedIds(
  input: readonly string[],
  indexPath: string
): { diagnostics: StateIndexDiagnostic[]; selectedIds: string[] | null } {
  const selectedIds: string[] = [];
  const seen = new Set<string>();
  for (const id of input) {
    const diagnosticEntry = selectedIdDiagnostic(id, indexPath, seen);
    if (diagnosticEntry !== null) {
      return { diagnostics: [diagnosticEntry], selectedIds: null };
    }
    seen.add(id);
    selectedIds.push(id);
  }
  return { diagnostics: [], selectedIds: selectedIds.sort(compareIndexText) };
}

function selectedIdDiagnostic(
  id: unknown,
  indexPath: string,
  seen: ReadonlySet<string>
): StateIndexDiagnostic | null {
  if (typeof id !== "string" || !isStateIndexText(id)) {
    return diagnostic({
      code: "state-index.selected-id-invalid",
      message:
        "selected state ids must be non-empty text without surrounding " +
        "whitespace or control characters",
      path: indexPath,
      stateId: typeof id === "string" ? id : null
    });
  }
  if (!seen.has(id)) return null;
  return diagnostic({
    code: "state-index.selected-id-duplicate",
    message: `selected state id ${JSON.stringify(id)} appears more than once`,
    path: indexPath,
    stateId: id
  });
}
