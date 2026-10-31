import type {
  StateIndex,
  StateIndexDiagnostic,
  StateIndexResult
} from "../../../index-runtime/src/index.ts";
import { parseDatedInvestigationId } from "../collection/report-path.ts";
import { investigationStageDiagnosticCodes } from "./staging-options.ts";
import type {
  InvestigationIndexMetadata,
  InvestigationIndexState
} from "../types.ts";

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
