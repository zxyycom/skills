import fs from "node:fs/promises";
import path from "node:path";
import { hasEntry } from "../../index-runtime/src/index.ts";
import {
  inspectInvestigationCollectionLayout,
  readInvestigationSources,
  type InvestigationCollectionLayout
} from "./investigation-index-source.ts";
import { isInvestigationSourcePath } from "./report-path.ts";
import { loadInvestigationIndex } from "./investigation-state-index.ts";
import {
  prepareInvestigationResourceRoot,
  type ResourceRootPreparation
} from "./resource-root.ts";
import {
  diagnosticFromError,
  type InvestigationDiagnostic
} from "./diagnostics.ts";
import { parseInvestigationReport } from "./markdown.ts";
import { validateInvestigationBody } from "./markdown-body.ts";
import { normalizeMarkdownNewlines } from "./markdown-values.ts";
import {
  validateCandidateInvestigationResources,
  validateFullInvestigationResources,
  type InvestigationResourceReferencesByReport
} from "./resources.ts";
import { investigationResourcesDirectoryName } from "./resource-reference.ts";
import { errorText, uniqueSorted } from "./candidate-support.ts";
import type {
  InvestigationCandidate,
  InvestigationSource,
  ParsedInvestigationReport
} from "./types.ts";

export type CandidateReadContext = Readonly<{
  sources: ReadonlyMap<string, InvestigationSource>;
  parsed: ReadonlyMap<string, ParsedInvestigationReport>;
  references: InvestigationResourceReferencesByReport;
  resources: ResourceRootPreparation | undefined;
  ownerWarnings: readonly string[];
}>;

export async function prepareCandidateReadContext(
  investigationsDirectory: string,
  layout: InvestigationCollectionLayout,
  ids: readonly string[] = layout.candidateIds
): Promise<CandidateReadContext> {
  const sources = new Map(
    layout.candidateSources.map((source) => [source.id, source])
  );
  const parsed = parseCandidateScaffolds(layout.candidateSources);
  const references = new Map<string, ReadonlySet<string>>();
  for (const [id, document] of parsed)
    appendParsedReferences(references, id, document);
  const selectedResources = ids.flatMap((id) => [
    ...(references.get(id) ?? [])
  ]);
  const owners = [...new Set(selectedResources.map((id) => id.split("/")[0]!))];
  const formalSources = await readCandidateFormalOwners(
    investigationsDirectory,
    layout,
    ids,
    references,
    owners
  );
  for (const source of formalSources)
    appendParsedReferences(
      references,
      source.id,
      parseInvestigationReport(source.text, source.id)
    );
  const { resources, ownerWarnings } = await prepareCandidateResources(
    investigationsDirectory,
    selectedResources.length > 0,
    references
  );
  return {
    sources,
    parsed,
    references,
    resources,
    ownerWarnings
  };
}

function appendParsedReferences(
  references: Map<string, ReadonlySet<string>>,
  id: string,
  document: ParsedInvestigationReport
): void {
  if (document.report !== null && document.errors.length === 0)
    references.set(id, new Set(document.report.resourceIds));
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

async function readCandidateFormalOwners(
  investigationsDirectory: string,
  layout: InvestigationCollectionLayout,
  ids: readonly string[],
  references: InvestigationResourceReferencesByReport,
  owners: readonly string[]
): Promise<InvestigationSource[]> {
  const { layout: formalLayout, ids: formalIds } =
    await candidateFormalIdentity(
      investigationsDirectory,
      layout,
      references,
      owners
    );
  const formalIdentity = new Set(formalIds);
  for (const id of ids) {
    if (formalIdentity.has(id))
      throw new Error(
        `${id} exists as both a formal investigation report and an authoring candidate`
      );
  }
  const formalOwners = owners.filter((id) => formalIdentity.has(id));
  const selectedOwners = new Set(formalOwners);
  const formalSources =
    formalLayout.formalSources.length > 0
      ? formalLayout.formalSources.filter((source) =>
          selectedOwners.has(source.id)
        )
      : await readInvestigationSources(investigationsDirectory, formalOwners);
  const ownerCounts = new Map<string, number>();
  for (const source of formalSources)
    ownerCounts.set(source.id, (ownerCounts.get(source.id) ?? 0) + 1);
  if (formalOwners.some((id) => ownerCounts.get(id) !== 1))
    throw new Error(
      "required formal resource owners must resolve to unique current sources"
    );
  return formalSources;
}

async function candidateFormalIdentity(
  investigationsDirectory: string,
  layout: InvestigationCollectionLayout,
  references: InvestigationResourceReferencesByReport,
  owners: readonly string[]
): Promise<
  Readonly<{
    layout: InvestigationCollectionLayout;
    ids: readonly string[];
  }>
> {
  const loaded = await loadInvestigationIndex({ investigationsDirectory });
  const needsDiscovery =
    layout.formalSources.length === 0 &&
    (loaded.status === "error" ||
      owners.some((id) => !references.has(id) && !hasEntry(loaded.value, id)));
  if (
    needsDiscovery &&
    (await fs.readdir(investigationsDirectory)).some(isInvestigationSourcePath)
  ) {
    const discovered = await inspectInvestigationCollectionLayout(
      investigationsDirectory,
      { readCandidateSources: false }
    );
    return { layout: discovered, ids: discovered.reportIds };
  }
  return {
    layout,
    ids:
      layout.formalSources.length === 0 && loaded.status === "ok"
        ? Object.keys(loaded.value.entries)
        : layout.reportIds
  };
}

async function prepareCandidateResources(
  investigationsDirectory: string,
  required: boolean,
  references: InvestigationResourceReferencesByReport
): Promise<Pick<CandidateReadContext, "resources" | "ownerWarnings">> {
  if (!required) {
    try {
      await fs.lstat(
        path.join(investigationsDirectory, investigationResourcesDirectoryName)
      );
    } catch (error) {
      if (error instanceof Error && "code" in error && error.code === "ENOENT")
        return { resources: undefined, ownerWarnings: [] };
      throw error;
    }
  }
  const resources = await prepareInvestigationResourceRoot(
    investigationsDirectory
  );
  const validated = await validateFullInvestigationResources(
    investigationsDirectory,
    references,
    { preparation: resources }
  );
  return { resources, ownerWarnings: validated.warnings };
}

type CandidateReadFailure = Readonly<{
  diagnostics: InvestigationDiagnostic[];
  errors: string[];
  status: "error";
}>;
export async function readInvestigationCandidate(
  investigationsDirectory: string,
  id: string,
  context?: CandidateReadContext
): Promise<
  { status: "ok"; value: InvestigationCandidate } | CandidateReadFailure
> {
  try {
    const prepared =
      context ??
      (await prepareCandidateReadContext(
        investigationsDirectory,
        await inspectInvestigationCollectionLayout(investigationsDirectory),
        [id]
      ));
    const source = prepared.sources.get(id);
    if (source === undefined) return missingCandidate(id);
    const target = path.join(investigationsDirectory, source.sourcePath);
    return await parsedCandidateResult(
      investigationsDirectory,
      id,
      target,
      source.text,
      prepared
    );
  } catch (error) {
    return {
      status: "error",
      diagnostics: [
        diagnosticFromError({
          code: "investigation-report.candidate-read-failed",
          error,
          reason: "the selected investigation candidate could not be read",
          recovery:
            "restore access to the selected candidate and its required owners, then retry",
          target: investigationsDirectory
        })
      ],
      errors: [`${id} investigation candidate could not be read`]
    };
  }
}

function missingCandidate(id: string): CandidateReadFailure {
  return {
    diagnostics: [],
    errors: [`${id} investigation candidate could not be read`],
    status: "error"
  };
}

async function parsedCandidateResult(
  investigationsDirectory: string,
  id: string,
  target: string,
  markdown: string,
  context: CandidateReadContext
): Promise<{ status: "ok"; value: InvestigationCandidate }> {
  const scaffold = context.parsed.get(id)!;
  const bodyErrors: string[] = [];
  validateInvestigationBody(
    normalizeMarkdownNewlines(markdown).split("\n"),
    scaffold.report?.frontmatter.endLine ?? 0,
    id,
    bodyErrors,
    {}
  );
  const scaffoldErrors = uniqueSorted([
    ...scaffold.frontmatterErrors,
    ...scaffold.bodyErrors
  ]);
  const resourceErrors = await candidateResourceErrors(
    investigationsDirectory,
    id,
    scaffold,
    scaffoldErrors,
    context
  );
  const errors = uniqueSorted([
    ...scaffoldErrors,
    ...bodyErrors,
    ...resourceErrors
  ]);
  return {
    status: "ok",
    value: {
      diagnostics: [],
      errors,
      id,
      markdown,
      path: target,
      readiness: candidateReadiness(scaffoldErrors, bodyErrors, resourceErrors),
      warnings: []
    }
  };
}

function candidateReadiness(
  scaffoldErrors: readonly string[],
  bodyErrors: readonly string[],
  resourceErrors: readonly string[]
): InvestigationCandidate["readiness"] {
  return {
    bodyReady: scaffoldErrors.length === 0 && bodyErrors.length === 0,
    resourceReady:
      scaffoldErrors.length === 0 && uniqueSorted(resourceErrors).length === 0,
    scaffoldValid: scaffoldErrors.length === 0
  };
}

async function candidateResourceErrors(
  investigationsDirectory: string,
  id: string,
  scaffold: ParsedInvestigationReport,
  scaffoldErrors: readonly string[],
  context: CandidateReadContext
): Promise<string[]> {
  const errors = [...scaffold.resourceErrors];
  if (scaffoldErrors.length > 0 || scaffold.report === null) return errors;
  try {
    const references = context.references;
    errors.push(
      ...(await validateCandidateInvestigationResources(
        investigationsDirectory,
        scaffold.report.resourceIds,
        references,
        undefined,
        context.resources
      ))
    );
    const ownerPrefix = `${id}/`;
    errors.push(
      ...context.ownerWarnings
        .filter((warning) =>
          warning.startsWith(
            `${investigationResourcesDirectoryName}/${ownerPrefix}`
          )
        )
        .map(
          (warning) =>
            `candidate owner resources must be directly referenced before publish: ${warning}`
        )
    );
  } catch (error) {
    errors.push(
      `candidate resource ownership could not be inspected: ${errorText(error)}`
    );
  }
  return errors;
}
