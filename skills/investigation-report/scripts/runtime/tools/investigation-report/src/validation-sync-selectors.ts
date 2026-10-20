/*
 * Synced TypeScript runtime; repository maintenance edits tools/investigation-report/src/validation-sync-selectors.ts.
 * Installed skill copies may be edited directly; updates overwrite matching files.
 * Repository: https://github.com/zxyycom/skills
 * Source path: tools/investigation-report/src/validation-sync-selectors.ts
 * Maintained source: https://github.com/zxyycom/skills/blob/main/tools/investigation-report/src/validation-sync-selectors.ts
 * Skill source directory: https://github.com/zxyycom/skills/tree/main/skills/investigation-report
 * Rebuild: bun run sync:investigation-report-check
 */
import {
  genericInvestigationDiagnostic,
  type InvestigationDiagnostic
} from "./diagnostics.ts";
import type { InvestigationSnapshot } from "./validation-collection.ts";

export type InvestigationSelectorContext = Readonly<{
  idsByName: Map<string, Set<string>>;
  knownIds: Set<string>;
}>;

export function investigationSelectorContext(
  baseline: Record<string, { name: string }>,
  snapshot: InvestigationSnapshot
): InvestigationSelectorContext {
  const idsByName = new Map<string, Set<string>>();
  for (const [id, state] of Object.entries(baseline))
    addIdForInvestigationName(idsByName, state.name, id);
  for (const [id, state] of Object.entries(snapshot.states))
    addIdForInvestigationName(idsByName, state.name, id);
  return {
    idsByName,
    knownIds: new Set([
      ...Object.keys(baseline),
      ...Object.keys(snapshot.states)
    ])
  };
}

export function duplicateResolvedSelectorDiagnostic(
  indexPath: string
): InvestigationDiagnostic {
  return genericInvestigationDiagnostic({
    code: "investigation-report.selector-duplicate",
    reason:
      "Selected Investigation selectors resolve to the same Investigation ID.",
    recovery:
      "Select every Investigation ID at most once, then retry the selected sync.",
    target: indexPath
  });
}

function addIdForInvestigationName(
  idsByName: Map<string, Set<string>>,
  name: string,
  id: string
): void {
  const ids = idsByName.get(name) ?? new Set<string>();
  ids.add(id);
  idsByName.set(name, ids);
}
