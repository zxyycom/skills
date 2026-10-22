/*
 * Synced TypeScript runtime; repository maintenance edits tools/investigation-report/src/staging-selectors.ts.
 * Installed skill copies may be edited directly; updates overwrite matching files.
 * Repository: https://github.com/zxyycom/skills
 * Source path: tools/investigation-report/src/staging-selectors.ts
 * Maintained source: https://github.com/zxyycom/skills/blob/main/tools/investigation-report/src/staging-selectors.ts
 * Skill source directory: https://github.com/zxyycom/skills/tree/main/skills/investigation-report
 * Rebuild: bun run sync:investigation-report-check
 */
import type {
  StateIndex,
  StateIndexDiagnostic,
  StateIndexResult
} from "../../index-runtime/src/index.ts";
import { parseDatedInvestigationId } from "./report-path.ts";
import { investigationStageDiagnosticCodes } from "./staging-options.ts";
import type {
  InvestigationIndexMetadata,
  InvestigationIndexState
} from "./types.ts";

export function resolveInvestigationStageSelectors(
  options: Readonly<{
    baseline: StateIndex<
      InvestigationIndexState,
      InvestigationIndexMetadata
    > | null;
    pending?: StateIndex<
      InvestigationIndexState,
      InvestigationIndexMetadata
    > | null;
    pendingIds?: readonly string[];
    selectedIds: readonly string[];
    workspace: StateIndex<InvestigationIndexState, InvestigationIndexMetadata>;
  }>
): StateIndexResult<string[]> {
  const idsByName = stateIdsByName(
    options.baseline,
    options.workspace,
    options.pending,
    options.pendingIds
  );
  const diagnostics: StateIndexDiagnostic[] = [];
  const resolved = options.selectedIds.flatMap((selector) =>
    resolveStageSelector(selector, idsByName, diagnostics)
  );
  return diagnostics.length === 0
    ? { diagnostics: [], status: "ok", value: resolved }
    : { diagnostics, status: "error", value: null };
}

function stateIdsByName(
  baseline: StateIndex<
    InvestigationIndexState,
    InvestigationIndexMetadata
  > | null,
  workspace: StateIndex<InvestigationIndexState, InvestigationIndexMetadata>,
  pending?: StateIndex<
    InvestigationIndexState,
    InvestigationIndexMetadata
  > | null,
  pendingIds: readonly string[] = []
): ReadonlyMap<string, readonly string[]> {
  const namesById = new Map<string, string>();
  const entries = [baseline, pending, workspace].flatMap((index) =>
    Object.entries(index?.entries ?? {})
  );
  for (const [id, state] of entries) namesById.set(id, state.name);
  for (const id of pendingIds)
    namesById.set(id, parseDatedInvestigationId(id)?.name ?? id);
  const idsByName = new Map<string, string[]>();
  for (const [id, name] of namesById) {
    const ids = idsByName.get(name);
    if (ids === undefined) idsByName.set(name, [id]);
    else ids.push(id);
  }
  for (const ids of idsByName.values()) ids.sort(compareText);
  return idsByName;
}

function resolveStageSelector(
  selector: string,
  idsByName: ReadonlyMap<string, readonly string[]>,
  diagnostics: StateIndexDiagnostic[]
): string[] {
  const dated = parseDatedInvestigationId(selector);
  if (dated !== null) return [dated.id];
  const matches = idsByName.get(selector) ?? [];
  if (matches.length === 1) return [matches[0]!];
  diagnostics.push(stageSelectorDiagnostic(selector, matches));
  return [];
}

function stageSelectorDiagnostic(
  selector: string,
  matches: readonly string[]
): StateIndexDiagnostic {
  const message =
    matches.length === 0
      ? `report name ${JSON.stringify(selector)} is absent from both indexes`
      : `report name ${JSON.stringify(selector)} is ambiguous; choose one standard ID: ${matches.join(", ")}`;
  return {
    code: investigationStageDiagnosticCodes.reportIdInvalid,
    message,
    path: null,
    stateId: selector
  };
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
