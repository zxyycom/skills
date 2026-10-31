/*
 * Synced TypeScript runtime; repository maintenance edits tools/investigation-report/src/candidates/candidate-resource-references.ts.
 * Installed skill copies may be edited directly; updates overwrite matching files.
 * Repository: https://github.com/zxyycom/skills
 * Source path: tools/investigation-report/src/candidates/candidate-resource-references.ts
 * Maintained source: https://github.com/zxyycom/skills/blob/main/tools/investigation-report/src/candidates/candidate-resource-references.ts
 * Skill source directory: https://github.com/zxyycom/skills/tree/main/skills/investigation-report
 * Rebuild: bun run sync:investigation-report-check
 */
import type { InvestigationSource } from "../types.ts";
import type { InvestigationPreparation } from "../transactions/strict-preparation.ts";
import {
  inspectInvestigationCollectionLayout,
  type InvestigationCollectionLayout
} from "../index/investigation-index-source.ts";
import { parseInvestigationReport } from "../records/markdown.ts";
import { buildInvestigationReportState } from "../records/report-validation.ts";
import type { InvestigationResourceReferencesByReport } from "../resources/resources.ts";

type AuthoringReferenceOptions = Readonly<{
  failOnInvalidSources?: boolean;
  layout?: InvestigationCollectionLayout;
  formalReferences?: InvestigationResourceReferencesByReport;
  preparation?: InvestigationPreparation;
}>;

export async function readCandidateAuthoringResourceReferences(
  investigationsDirectory: string,
  options: AuthoringReferenceOptions = {}
): Promise<InvestigationResourceReferencesByReport> {
  const layout =
    options.layout ??
    (await inspectInvestigationCollectionLayout(investigationsDirectory));
  const references = new Map<string, ReadonlySet<string>>(
    options.formalReferences
  );
  if (layout.errors.length > 0) return references;
  if (options.formalReferences === undefined) {
    for (const source of layout.formalSources) {
      appendAuthoringReference(
        references,
        source.id,
        formalAuthoringResources(source, options.preparation),
        options.failOnInvalidSources
      );
    }
  }
  for (const source of layout.candidateSources) {
    appendAuthoringReference(
      references,
      source.id,
      candidateAuthoringResources(source, options.preparation),
      options.failOnInvalidSources
    );
  }
  return references;
}

function appendAuthoringReference(
  references: Map<string, ReadonlySet<string>>,
  id: string,
  resources: readonly string[] | null,
  failOnInvalidSources: boolean | undefined
): void {
  if (resources !== null) references.set(id, new Set(resources));
  else if (failOnInvalidSources)
    throw new Error(
      `${id} authoring resource references could not be safely read`
    );
}

function formalAuthoringResources(
  source: InvestigationSource,
  preparation?: InvestigationPreparation
): readonly string[] | null {
  const built = buildInvestigationReportState(
    source.id,
    preparation?.parsed(source) ??
      parseInvestigationReport(source.text, source.id),
    source.sourcePath
  );
  return built.status === "valid" ? built.state.resourceIds : null;
}

function candidateAuthoringResources(
  source: InvestigationSource,
  preparation?: InvestigationPreparation
): readonly string[] | null {
  const parsed =
    preparation?.parsed(source, true) ??
    parseInvestigationReport(source.text, source.id, {
      allowEmptyCoreSections: true
    });
  return parsed.errors.length === 0 && parsed.report !== null
    ? parsed.report.resourceIds
    : null;
}
