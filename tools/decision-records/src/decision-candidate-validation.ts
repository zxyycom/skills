import type { CandidateIdentityContext } from "./decision-candidate-context.ts";
import { decisionDiagnostic } from "./application-result.ts";
import { creationFailure } from "./decision-candidate-publication.ts";
import type {
  NewDecisionCandidateRequest,
  NewDecisionCandidateResult
} from "./decision-candidate-service.ts";

export function validateCandidateCreationRequest(
  scan: CandidateIdentityContext,
  request: NewDecisionCandidateRequest
): NewDecisionCandidateResult | null {
  const identityConflict = candidateIdentityConflict(scan, request);
  if (identityConflict !== null) return identityConflict;
  return candidateRelationFailure(request);
}

function candidateIdentityConflict(
  scan: CandidateIdentityContext,
  request: NewDecisionCandidateRequest
): NewDecisionCandidateResult | null {
  if (!scan.records.some((record) => record.decisionId === request.decisionId))
    return null;
  return creationFailure(
    decisionDiagnostic({
      code: "decision-records.new-identity-conflict",
      outcome: "no-change",
      reason:
        "Decision ID already exists in the current collection: " +
        request.decisionId,
      recovery:
        "Choose a new Decision ID or continue the existing candidate; do not rerun new for the same identity.",
      scope: "Decision candidate scaffold",
      target: request.decisionId
    })
  );
}

function candidateRelationFailure(
  request: NewDecisionCandidateRequest
): NewDecisionCandidateResult | null {
  for (const relation of request.relations) {
    if (relation.target === request.decisionId) {
      return creationFailure(
        decisionDiagnostic({
          code: "decision-records.new-relation-invalid",
          outcome: "no-change",
          reason: "A candidate cannot relate to itself: " + relation.target,
          recovery:
            "Choose an existing direct predecessor Decision ID, then retry the command.",
          scope: "Decision candidate scaffold",
          target: request.decisionId
        })
      );
    }
  }
  return null;
}
