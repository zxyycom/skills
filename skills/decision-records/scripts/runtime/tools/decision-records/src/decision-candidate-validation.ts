/*
 * Synced TypeScript runtime; repository maintenance edits tools/decision-records/src/decision-candidate-validation.ts.
 * Installed skill copies may be edited directly; updates overwrite matching files.
 * Repository: https://github.com/zxyycom/skills
 * Source path: tools/decision-records/src/decision-candidate-validation.ts
 * Maintained source: https://github.com/zxyycom/skills/blob/main/tools/decision-records/src/decision-candidate-validation.ts
 * Skill source directory: https://github.com/zxyycom/skills/tree/main/skills/decision-records
 * Rebuild: bun run sync:decision-records-cli
 */
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
  return candidateRelationFailure(scan, request);
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
  scan: CandidateIdentityContext,
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
