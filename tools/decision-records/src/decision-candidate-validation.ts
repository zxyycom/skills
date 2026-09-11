import { decisionDiagnostic } from "./application-result.ts";
import { creationFailure } from "./decision-candidate-publication.ts";
import type {
  NewDecisionCandidateRequest,
  NewDecisionCandidateResult
} from "./decision-candidate-service.ts";
import { scanDecisionRecords } from "./scan.ts";

export function validateCandidateCreationRequest(
  scan: Awaited<ReturnType<typeof scanDecisionRecords>>,
  request: NewDecisionCandidateRequest
): NewDecisionCandidateResult | null {
  const invalidCollection = candidateCollectionFailure(scan);
  if (invalidCollection !== null) return invalidCollection;
  const identityConflict = candidateIdentityConflict(scan, request);
  if (identityConflict !== null) return identityConflict;
  return candidateRelationFailure(scan, request);
}

function candidateCollectionFailure(
  scan: Awaited<ReturnType<typeof scanDecisionRecords>>
): NewDecisionCandidateResult | null {
  if (candidateCollectionIsUsable(scan)) return null;
  return creationFailure(candidateCollectionDiagnostic(scan));
}

function candidateCollectionIsUsable(
  scan: Awaited<ReturnType<typeof scanDecisionRecords>>
): boolean {
  if (!scan.decisionsDirectoryAvailable) return false;
  if (scan.collectionErrors.length > 0) return false;
  return scan.sourceErrors.length === 0;
}

function candidateCollectionDiagnostic(
  scan: Awaited<ReturnType<typeof scanDecisionRecords>>
) {
  return decisionDiagnostic({
    code: "decision-records.new-collection-invalid",
    outcome: "no-change",
    reason: firstCollectionProblem(scan),
    recovery:
      "Correct the reported decision collection problem, then retry the command.",
    scope: "Decision candidate scaffold",
    target: scan.decisionsDirectory
  });
}

function firstCollectionProblem(
  scan: Awaited<ReturnType<typeof scanDecisionRecords>>
): string {
  return (
    scan.collectionErrors[0] ??
    scan.sourceErrors[0] ??
    "The decision candidate collection is unavailable."
  );
}

function candidateIdentityConflict(
  scan: Awaited<ReturnType<typeof scanDecisionRecords>>,
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
  scan: Awaited<ReturnType<typeof scanDecisionRecords>>,
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
    if (!scan.records.some((record) => record.decisionId === relation.target)) {
      return creationFailure(
        decisionDiagnostic({
          code: "decision-records.new-relation-target-missing",
          outcome: "no-change",
          reason:
            "Candidate relation target does not exist: " + relation.target,
          recovery:
            "Choose an existing direct predecessor Decision ID, then retry the command.",
          scope: "Decision candidate scaffold",
          target: relation.target
        })
      );
    }
  }
  return null;
}
