import { genericInvestigationDiagnostic } from "./diagnostics.ts";
import { candidateRecordedAtHead } from "./candidate-discard-resources.ts";
import { discardMutation, result } from "./candidate-discard-support.ts";
import type { CandidateDiscardPreparation } from "./candidate-discard.ts";
import type {
  InvestigationCandidateDiscardOptions,
  InvestigationCandidateDiscardResult
} from "./types.ts";

export function candidateDiscardEligibility(
  input: InvestigationCandidateDiscardOptions,
  preparation: CandidateDiscardPreparation
): InvestigationCandidateDiscardResult | null {
  if (
    preparation.resources.resourceIds.length > 0 &&
    input.deleteOwnedResources !== true
  ) {
    return result(
      input,
      false,
      [],
      [
        `${input.id} owns ${preparation.resources.resourceIds.length} resource(s); re-run with --delete-owned-resources only after confirming their deletion`
      ],
      { mutation: discardMutation("no-change") }
    );
  }
  if (preparation.sharedReferences.length > 0) {
    return result(input, false, [], preparation.sharedReferences, {
      mutation: discardMutation("no-change")
    });
  }
  return null;
}

export async function candidateDiscardHistoryGate(
  root: string,
  input: InvestigationCandidateDiscardOptions,
  preparation: CandidateDiscardPreparation,
  protectedCheck: boolean
): Promise<InvestigationCandidateDiscardResult | null> {
  const recorded = await candidateRecordedAtHead(
    root,
    input.id,
    preparation.resources.resourceIds
  );
  if (recorded.status === "error") {
    const timing = protectedCheck
      ? " immediately before candidate discard"
      : " before candidate discard";
    return result(input, false, [], recorded.errors, {
      diagnostics: [
        genericInvestigationDiagnostic({
          code: "investigation-report.discard-candidate-history-check-unavailable",
          mutation: discardMutation("no-change"),
          reason: `the Git history check required${timing} could not be completed`,
          recovery:
            "restore version-control access, then rerun discard-candidate before deleting the candidate",
          target: input.id
        })
      ],
      mutation: discardMutation("no-change")
    });
  }
  if (!recorded.value || input.deleteRecordedCandidate === true) return null;
  const timing = protectedCheck ? " entered" : " has entered";
  return {
    ...result(
      input,
      false,
      [],
      [
        `Investigation candidate ${input.id}${timing} Git HEAD${protectedCheck ? " before deletion" : ""}; confirm that its recorded history should be deleted.`,
        "Re-run with --delete-recorded-candidate only after confirming deletion; no files were changed."
      ],
      { mutation: discardMutation("no-change") }
    ),
    requiresRecordedDeletionConfirmation: true
  };
}
