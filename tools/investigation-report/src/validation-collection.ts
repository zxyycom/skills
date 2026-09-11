import path from "node:path";
import {
  createInvestigationStateSnapshot,
  inspectInvestigationCollectionLayout,
  readInvestigationSources
} from "./investigation-index-source.ts";
import { readCandidateAuthoringResourceReferences } from "./candidate.ts";
import { investigationIndexFileName } from "./investigation-state-index.ts";
import { parseInvestigationReport } from "./markdown.ts";
import { validateInvestigationRelationGraph } from "./relation-validation.ts";
import { buildInvestigationReportState } from "./report-validation.ts";
import {
  validateFullInvestigationResources,
  type InvestigationResourceReferencesByReport
} from "./resources.ts";
import type {
  InvestigationIndexMetadata,
  InvestigationIndexState,
  InvestigationSource
} from "./types.ts";
import type { StateSnapshot } from "../../index-runtime/src/index.ts";

export type InvestigationSnapshot = StateSnapshot<
  InvestigationIndexState,
  InvestigationIndexMetadata
>;

export type ValidatedInvestigationCollection = Readonly<{
  errors: string[];
  indexPath: string;
  reportCount: number;
  snapshot: InvestigationSnapshot | null;
  sources: InvestigationSource[];
  states: Map<string, InvestigationIndexState>;
  warnings: string[];
}>;

export async function collectValidatedInvestigationCollection(
  investigationRoot: string,
  options: { allowEmptyCollection?: boolean } = {}
): Promise<ValidatedInvestigationCollection> {
  const indexPath = path.join(investigationRoot, investigationIndexFileName);
  const layout = await inspectInvestigationCollectionLayout(investigationRoot);
  const errors = [...layout.errors];
  if (layout.reportIds.length === 0 && !options.allowEmptyCollection) {
    errors.push("investigation collection must contain at least one report");
  }
  const sources =
    layout.errors.length > 0
      ? []
      : await readInvestigationSources(investigationRoot, layout.reportIds);
  const states = collectionStates(sources, errors);
  if (errors.length === 0)
    errors.push(...validateInvestigationRelationGraph(states));
  const referencesByReport: InvestigationResourceReferencesByReport = new Map(
    [...states.entries()].map(([id, state]) => [id, new Set(state.resourceIds)])
  );
  const resources = await validateFullInvestigationResources(
    investigationRoot,
    referencesByReport,
    {
      authoringReferencesByReport:
        await readCandidateAuthoringResourceReferences(investigationRoot)
    }
  );
  errors.push(...resources.errors);
  const sortedErrors = uniqueSorted(errors);
  return {
    errors: sortedErrors,
    indexPath,
    reportCount: layout.reportIds.length,
    snapshot:
      sortedErrors.length === 0
        ? createInvestigationStateSnapshot(sources, [...states.values()])
        : null,
    sources,
    states,
    warnings: resources.warnings
  };
}

function collectionStates(
  sources: readonly InvestigationSource[],
  errors: string[]
): Map<string, InvestigationIndexState> {
  const states = new Map<string, InvestigationIndexState>();
  for (const source of sources) {
    const built = buildInvestigationReportState(
      source.id,
      parseInvestigationReport(source.text, source.id),
      source.sourcePath
    );
    if (built.status === "invalid") errors.push(...built.errors);
    else states.set(source.id, built.state);
  }
  return states;
}

function uniqueSorted(values: readonly string[]): string[] {
  return [...new Set(values)].sort(compareText);
}
function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
