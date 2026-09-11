import fs from "node:fs/promises";
import { findCandidatePathForInvestigationId } from "./candidate-path.ts";
import {
  inspectInvestigationCollectionLayout,
  readInvestigationSources
} from "./investigation-index-source.ts";
import { parseInvestigationReport } from "./markdown.ts";
import { buildInvestigationReportState } from "./report-validation.ts";
import type { InvestigationResourceReferencesByReport } from "./resources.ts";
import type { InvestigationSource } from "./types.ts";

export async function readCandidateAuthoringResourceReferences(
  investigationsDirectory: string,
  options: Readonly<{ failOnInvalidSources?: boolean }> = {}
): Promise<InvestigationResourceReferencesByReport> {
  const layout = await inspectInvestigationCollectionLayout(
    investigationsDirectory
  );
  const references = new Map<string, ReadonlySet<string>>();
  if (layout.errors.length > 0) return references;
  recordFormalAuthoringReferences(
    await readInvestigationSources(investigationsDirectory, layout.reportIds),
    references,
    options.failOnInvalidSources === true
  );
  for (const id of layout.candidateIds)
    await recordCandidateAuthoringReferences(
      investigationsDirectory,
      id,
      references,
      options.failOnInvalidSources === true
    );
  return references;
}
function recordFormalAuthoringReferences(
  sources: readonly InvestigationSource[],
  references: Map<string, ReadonlySet<string>>,
  failOnInvalidSources: boolean
): void {
  for (const source of sources) {
    const built = buildInvestigationReportState(
      source.id,
      parseInvestigationReport(source.text, source.id),
      source.sourcePath
    );
    if (built.status === "valid")
      references.set(source.id, new Set(built.state.resourceIds));
    else if (failOnInvalidSources)
      throw new Error(
        `${source.id} authoring resource references could not be safely read`
      );
  }
}
async function recordCandidateAuthoringReferences(
  investigationsDirectory: string,
  id: string,
  references: Map<string, ReadonlySet<string>>,
  failOnInvalidSources: boolean
): Promise<void> {
  try {
    const candidatePath = await findCandidatePathForInvestigationId(
      investigationsDirectory,
      id
    );
    if (candidatePath === null) throw new Error("candidate does not exist");
    const entry = await fs.lstat(candidatePath);
    if (entry.isSymbolicLink() || !entry.isFile())
      throw new Error("candidate must be a regular non-symbolic-link file");
    const parsed = parseInvestigationReport(
      await fs.readFile(candidatePath, "utf8"),
      id,
      { allowEmptyCoreSections: true }
    );
    if (parsed.report !== null && parsed.errors.length === 0)
      references.set(id, new Set(parsed.report.resourceIds));
    else if (failOnInvalidSources)
      throw new Error(
        "candidate must have a valid scaffold and resource links"
      );
  } catch (error) {
    if (failOnInvalidSources)
      throw new Error(
        `${id} authoring resource references could not be safely read`,
        { cause: error }
      );
  }
}
