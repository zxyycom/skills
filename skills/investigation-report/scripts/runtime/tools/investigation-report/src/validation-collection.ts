/*
 * Synced TypeScript runtime; repository maintenance edits tools/investigation-report/src/validation-collection.ts.
 * Installed skill copies may be edited directly; updates overwrite matching files.
 * Repository: https://github.com/zxyycom/skills
 * Source path: tools/investigation-report/src/validation-collection.ts
 * Maintained source: https://github.com/zxyycom/skills/blob/main/tools/investigation-report/src/validation-collection.ts
 * Skill source directory: https://github.com/zxyycom/skills/tree/main/skills/investigation-report
 * Rebuild: bun run sync:investigation-report-check
 */
import type { InvestigationPreparation } from "./strict-preparation.ts";
import path from "node:path";
import {
  createInvestigationStateSnapshot,
  inspectInvestigationCollectionLayout,
  type InvestigationCollectionLayout
} from "./investigation-index-source.ts";
import { readCandidateAuthoringResourceReferences } from "./candidate.ts";
import { investigationIndexFileName } from "./investigation-state-index.ts";
import { parseInvestigationReport } from "./markdown.ts";
import { validateInvestigationRelationGraph } from "./relation-validation.ts";
import {
  createInvestigationRelationContext,
  type InvestigationRelationContext
} from "./relation-context.ts";
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
