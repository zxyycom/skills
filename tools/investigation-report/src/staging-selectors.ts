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
    selectedIds: readonly string[];
    workspace: StateIndex<InvestigationIndexState, InvestigationIndexMetadata>;
  }>
): StateIndexResult<string[]> {
  const entries = stateEntriesById(options.baseline, options.workspace);
  const diagnostics: StateIndexDiagnostic[] = [];
  const resolved = options.selectedIds.flatMap((selector) =>
    resolveStageSelector(selector, entries, diagnostics)
  );
  return diagnostics.length === 0
    ? { diagnostics: [], status: "ok", value: resolved }
    : { diagnostics, status: "error", value: null };
}

function stateEntriesById(
  baseline: StateIndex<
    InvestigationIndexState,
    InvestigationIndexMetadata
  > | null,
  workspace: StateIndex<InvestigationIndexState, InvestigationIndexMetadata>
): Map<string, string> {
  const entries = new Map<string, string>();
  for (const index of [baseline, workspace]) {
    if (index === null) continue;
    for (const [id, state] of Object.entries(index.entries))
      entries.set(id, state.name);
  }
  return entries;
}

function resolveStageSelector(
  selector: string,
  entries: ReadonlyMap<string, string>,
  diagnostics: StateIndexDiagnostic[]
): string[] {
  const dated = parseDatedInvestigationId(selector);
  if (dated !== null) return [dated.id];
  const matches = [...entries]
    .filter(([, name]) => name === selector)
    .map(([id]) => id)
    .sort(compareText);
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
