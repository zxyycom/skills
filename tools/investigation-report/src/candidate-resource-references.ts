import {
  inspectInvestigationCollectionLayout,
  type InvestigationCollectionLayout
} from "./investigation-index-source.ts";
import { parseInvestigationReport } from "./markdown.ts";
import { buildInvestigationReportState } from "./report-validation.ts";
import type { InvestigationResourceReferencesByReport } from "./resources.ts";

export async function readCandidateAuthoringResourceReferences(
  investigationsDirectory: string,
  options: Readonly<{
    failOnInvalidSources?: boolean;
    layout?: InvestigationCollectionLayout;
    formalReferences?: InvestigationResourceReferencesByReport;
  }> = {}
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
      const built = buildInvestigationReportState(
        source.id,
        parseInvestigationReport(source.text, source.id),
        source.sourcePath
      );
      appendAuthoringReference(
        references,
        source.id,
        built.status === "valid" ? built.state.resourceIds : null,
        options.failOnInvalidSources
      );
    }
  }
  for (const source of layout.candidateSources) {
    const parsed = parseInvestigationReport(source.text, source.id, {
      allowEmptyCoreSections: true
    });
    appendAuthoringReference(
      references,
      source.id,
      parsed.errors.length === 0 && parsed.report !== null
        ? parsed.report.resourceIds
        : null,
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
