/*
 * Synced TypeScript runtime; repository maintenance edits tools/investigation-report/src/candidate-discard-tombstone.ts.
 * Installed skill copies may be edited directly; updates overwrite matching files.
 * Repository: https://github.com/zxyycom/skills
 * Source path: tools/investigation-report/src/candidate-discard-tombstone.ts
 * Maintained source: https://github.com/zxyycom/skills/blob/main/tools/investigation-report/src/candidate-discard-tombstone.ts
 * Skill source directory: https://github.com/zxyycom/skills/tree/main/skills/investigation-report
 * Rebuild: bun run sync:investigation-report-check
 */
import path from "node:path";
import { publishDiscard } from "./discard-publication.ts";
import { discardMutation, result } from "./candidate-discard-support.ts";
import type { CandidateDiscardPreparation } from "./candidate-discard.ts";
import { investigationResourcesDirectoryName } from "./resource-reference.ts";
import { investigationIndexFileName } from "./report-path.ts";
import type {
  InvestigationCandidateDiscardOptions,
  InvestigationCandidateDiscardResult
} from "./types.ts";

/** Candidate exit uses the same protected write set, without formal index publication. */
export async function discardPreparedCandidate(
  input: InvestigationCandidateDiscardOptions,
  root: string,
  preparation: CandidateDiscardPreparation
): Promise<InvestigationCandidateDiscardResult> {
  const publication = await publishDiscard({
    root,
    indexPath: path.join(root, investigationIndexFileName),
    indexText: null,
    originalIndexText: null,
    originalSources: [
      {
        id: input.id,
        sourcePath: path.basename(preparation.candidatePath),
        text: preparation.candidateText
      }
    ],
    reportPath: preparation.candidatePath,
    resourceOwnerPath: path.join(
      root,
      investigationResourcesDirectoryName,
      input.id
    ),
    resourceSnapshot: preparation.resources,
    resourceProgress: preparation.resourceProgress,
    afterResourceTombstone: async () => {},
    write: async () => {
      throw new Error("Candidate discard must never publish the formal index");
    }
  });
  const mutation =
    publication.mutation === undefined
      ? undefined
      : discardMutation(publication.mutation.outcome);
  return result(
    input,
    publication.changed,
    preparation.resources.resourceIds,
    publication.errors,
    {
      mutation,
      diagnostics: publication.diagnostics.map((diagnostic) => ({
        ...diagnostic,
        ...(mutation === undefined ? {} : { mutation })
      }))
    }
  );
}
