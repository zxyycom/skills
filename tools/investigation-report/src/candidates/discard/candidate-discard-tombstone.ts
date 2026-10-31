import path from "node:path";
import { publishDiscard } from "../../discard/discard-publication.ts";
import { discardMutation, result } from "./candidate-discard-support.ts";
import type { CandidateDiscardPreparation } from "./candidate-discard.ts";
import { investigationResourcesDirectoryName } from "../../resources/resource-reference.ts";
import { investigationIndexFileName } from "../../collection/report-path.ts";
import type {
  InvestigationCandidateDiscardOptions,
  InvestigationCandidateDiscardResult
} from "../../types.ts";

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
