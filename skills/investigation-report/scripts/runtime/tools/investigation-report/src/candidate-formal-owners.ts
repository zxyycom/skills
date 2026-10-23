/*
 * Synced TypeScript runtime; repository maintenance edits tools/investigation-report/src/candidate-formal-owners.ts.
 * Installed skill copies may be edited directly; updates overwrite matching files.
 * Repository: https://github.com/zxyycom/skills
 * Source path: tools/investigation-report/src/candidate-formal-owners.ts
 * Maintained source: https://github.com/zxyycom/skills/blob/main/tools/investigation-report/src/candidate-formal-owners.ts
 * Skill source directory: https://github.com/zxyycom/skills/tree/main/skills/investigation-report
 * Rebuild: bun run sync:investigation-report-check
 */
import type {
  CandidateIdentity,
  RecordCandidateCollection
} from "../../record-operations/src/candidate.ts";
import { readRecordSource } from "../../record-operations/src/source.ts";
import {
  discoverInvestigationCandidates,
  type CandidateCollectionLayout
} from "./candidate-discovery.ts";
import {
  investigationIdFromMarkdown,
  parseInvestigationReport
} from "./markdown.ts";
import type { InvestigationSource } from "./types.ts";

export async function readCandidateFormalOwners(
  directory: string,
  layout: CandidateCollectionLayout,
  ids: readonly string[],
  owners: readonly string[]
): Promise<InvestigationSource[]> {
  if (
    layout.candidateCollection === undefined &&
    layout.formalSources.length > 0
  ) {
    rejectCandidateFormalConflicts(ids, layout.reportIds);
    return layout.formalSources.filter((source) => owners.includes(source.id));
  }
  const collection =
    layout.candidateCollection ??
    (await discoverInvestigationCandidates(directory)).candidateCollection;
  rejectCandidateFormalConflicts(
    ids,
    collection.formal.map(({ id }) => id)
  );
  const selectedOwners = collection.formal.filter(({ id }) =>
    owners.includes(id)
  );
  requireFormalOwnerBaseline(collection, owners, selectedOwners.length);
  const sources: InvestigationSource[] = [];
  for (const source of selectedOwners) {
    sources.push(await readFormalResourceOwner(directory, source));
  }
  return sources;
}

function rejectCandidateFormalConflicts(
  ids: readonly string[],
  formalIds: readonly string[]
): void {
  for (const id of ids) {
    if (formalIds.includes(id)) {
      throw new Error(
        `${id} exists as both a formal investigation report and an authoring candidate`
      );
    }
  }
}

function requireFormalOwnerBaseline(
  collection: RecordCandidateCollection,
  owners: readonly string[],
  selectedCount: number
): void {
  if (collection.indexStatus !== "missing") {
    return;
  }
  if (selectedCount > 0) {
    throw new Error(
      "required formal resource owners need explicit index recovery"
    );
  }
  if (
    owners.some(
      (id) => !collection.candidates.some((source) => source.id === id)
    )
  ) {
    throw new Error(
      "required resource owner cannot be resolved without a published index"
    );
  }
}

async function readFormalResourceOwner(
  directory: string,
  source: CandidateIdentity
): Promise<InvestigationSource> {
  const text = await readRecordSource({
    collectionRoot: directory,
    sourcePath: source.sourcePath,
    id: source.id,
    idFromMarkdown: investigationIdFromMarkdown
  });
  const parsed = parseInvestigationReport(text, source.id);
  if (parsed.report === null || parsed.errors.length > 0) {
    throw new Error(
      "required formal resource owner is invalid: " +
        source.id +
        "; " +
        parsed.errors.join("; ")
    );
  }
  return { ...source, text };
}
