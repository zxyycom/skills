import type { CandidateCollectionLayout } from "./candidate-discovery.ts";
import type { ResourceRootPreparation } from "./resource-root.ts";
import type { InvestigationResourceReferencesByReport } from "./resources.ts";
import type {
  InvestigationSource,
  ParsedInvestigationReport
} from "./types.ts";
import { parseInvestigationReport } from "./markdown.ts";
import { prepareCandidateResources } from "./candidate-read-resources.ts";
import { loadInvestigationQueryIndex } from "./investigation-state-index.ts";

export type CandidateReadContext = Readonly<{
  sources: ReadonlyMap<string, InvestigationSource>;
  formalSources: readonly InvestigationSource[];
  parsed: ReadonlyMap<string, ParsedInvestigationReport>;
  references: InvestigationResourceReferencesByReport;
  resources: ResourceRootPreparation | undefined;
  ownerWarnings: readonly string[];
}>;

export async function prepareCandidateReadContext(
  investigationsDirectory: string,
  layout: CandidateCollectionLayout,
  ids: readonly string[] = layout.candidateIds
): Promise<CandidateReadContext> {
  const candidates = prepareCandidateDocuments(layout, ids);
  const selectedResources = ids.flatMap((id) => [
    ...(candidates.references.get(id) ?? [])
  ]);
  const owners = [...new Set(selectedResources.map((id) => id.split("/")[0]!))];
  appendCandidateOwnerReferences(candidates, owners);
  const formalSources: InvestigationSource[] = [];
  const reportIds = new Set(layout.reportIds);
  const formalOwners = owners.filter((id) => reportIds.has(id));
  if (formalOwners.length > 0) {
    const loaded = await loadInvestigationQueryIndex({
      investigationsDirectory
    });
    if (loaded.status === "error")
      throw new Error(
        "required formal resource owners need explicit index recovery"
      );
    for (const owner of formalOwners)
      candidates.references.set(
        owner,
        new Set(loaded.value.entries[owner]!.resourceIds)
      );
  }
  const { resources, ownerWarnings } = await prepareCandidateResources(
    investigationsDirectory,
    selectedResources.length > 0,
    candidates.references,
    ids
  );
  return {
    ...candidates,
    formalSources,
    resources,
    ownerWarnings
  };
}

function prepareCandidateDocuments(
  layout: CandidateCollectionLayout,
  ids: readonly string[]
) {
  const sources =
    layout.candidateCollection?.candidateById ??
    new Map(layout.candidateSources.map((source) => [source.id, source]));
  const selectedSources = ids.flatMap((id) => {
    const source = sources.get(id);
    return source === undefined ? [] : [source];
  });
  const parsed = new Map(parseCandidateScaffolds(selectedSources));
  const references = new Map<string, ReadonlySet<string>>();
  for (const [id, document] of parsed) {
    appendParsedReferences(references, id, document);
  }
  return { sources, parsed, references };
}

function appendCandidateOwnerReferences(
  candidates: ReturnType<typeof prepareCandidateDocuments>,
  owners: readonly string[]
): void {
  for (const owner of owners) {
    const source = candidates.sources.get(owner);
    if (source !== undefined && !candidates.parsed.has(owner)) {
      const document = parseInvestigationReport(source.text, owner, {
        allowEmptyCoreSections: true
      });
      candidates.parsed.set(owner, document);
      appendParsedReferences(candidates.references, owner, document);
    }
    const document = candidates.parsed.get(owner);
    if (
      document !== undefined &&
      (document.report === null || document.errors.length > 0)
    ) {
      throw new Error("required candidate resource owner is invalid: " + owner);
    }
  }
}

function appendParsedReferences(
  references: Map<string, ReadonlySet<string>>,
  id: string,
  document: ParsedInvestigationReport
): void {
  if (document.report !== null && document.errors.length === 0) {
    references.set(id, new Set(document.report.resourceIds));
  }
}

function parseCandidateScaffolds(
  sources: readonly InvestigationSource[]
): CandidateReadContext["parsed"] {
  return new Map(
    sources.map((source) => [
      source.id,
      parseInvestigationReport(source.text, source.id, {
        allowEmptyCoreSections: true
      })
    ])
  );
}
