import type { InvestigationPreparation } from "../../transactions/strict-preparation.ts";
import path from "node:path";
import {
  createInvestigationStateSnapshot,
  inspectInvestigationCollectionLayout,
  type InvestigationCollectionLayout
} from "../../index/investigation-index-source.ts";
import { readCandidateAuthoringResourceReferences } from "../../candidates/candidate.ts";
import { investigationIndexFileName } from "../../index/investigation-state-index.ts";
import { parseInvestigationReport } from "../markdown.ts";
import { validateInvestigationRelationGraph } from "../../relations/relation-validation.ts";
import {
  createInvestigationRelationContext,
  type InvestigationRelationContext
} from "../../relations/relation-context.ts";
import { buildInvestigationReportState } from "../report-validation.ts";
import {
  validateFullInvestigationResources,
  type InvestigationResourceReferencesByReport
} from "../../resources/resources.ts";
import type {
  InvestigationIndexMetadata,
  InvestigationIndexState,
  InvestigationSource
} from "../../types.ts";
import type { StateSnapshot } from "../../../../index-runtime/src/index.ts";

export type InvestigationSnapshot = StateSnapshot<
  InvestigationIndexState,
  InvestigationIndexMetadata
>;

export type ValidatedInvestigationCollection = Readonly<{
  errors: string[];
  indexPath: string;
  reportCount: number;
  relations: InvestigationRelationContext;
  snapshot: InvestigationSnapshot | null;
  sources: InvestigationSource[];
  states: Map<string, InvestigationIndexState>;
  warnings: string[];
}>;

type CollectionValidationOptions = Readonly<{
  allowEmptyCollection?: boolean;
  layout?: InvestigationCollectionLayout;
  preparation?: InvestigationPreparation;
}>;

export async function collectValidatedInvestigationCollection(
  investigationRoot: string,
  options: CollectionValidationOptions = {}
): Promise<ValidatedInvestigationCollection> {
  const layout =
    options.layout ??
    (await inspectInvestigationCollectionLayout(investigationRoot, {
      preparation: options.preparation
    }));
  const errors = [...layout.errors];
  if (layout.reportIds.length === 0 && !options.allowEmptyCollection) {
    errors.push("investigation collection must contain at least one report");
  }
  const sources = layout.errors.length > 0 ? [] : layout.formalSources;
  const states = collectionStates(sources, errors, options.preparation);
  const relations = createInvestigationRelationContext(states);
  if (errors.length === 0)
    errors.push(...validateInvestigationRelationGraph(relations));
  const referencesByReport: InvestigationResourceReferencesByReport = new Map(
    [...states.entries()].map(([id, state]) => [id, new Set(state.resourceIds)])
  );
  const resources = await validateFullInvestigationResources(
    investigationRoot,
    referencesByReport,
    {
      authoringReferencesByReport:
        await readCandidateAuthoringResourceReferences(investigationRoot, {
          layout,
          preparation: options.preparation,
          formalReferences: referencesByReport
        })
    }
  );
  errors.push(...resources.errors);
  const sortedErrors = uniqueSorted(errors);
  return {
    errors: sortedErrors,
    indexPath: path.join(investigationRoot, investigationIndexFileName),
    reportCount: layout.reportIds.length,
    relations,
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
  errors: string[],
  preparation?: InvestigationPreparation
): Map<string, InvestigationIndexState> {
  const states = new Map<string, InvestigationIndexState>();
  for (const source of sources) {
    const built = buildInvestigationReportState(
      source.id,
      preparation?.parsed(source) ??
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
