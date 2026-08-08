import type {
  ChangePlanAssessment,
  ChangePlanMetadata,
  ChangePlanStatus
} from "./types.ts";
import {
  classifyGitDistance,
  confirmPlanArtifactsAtHead,
  inspectPlanVersionControl
} from "./git-distance.ts";

export type { PlanArtifactConfirmation } from "./git-distance.ts";

export { confirmPlanArtifactsAtHead };

export async function assessChangePlan(
  changeDirectory: string,
  metadata: ChangePlanMetadata,
  status: ChangePlanStatus = "active"
): Promise<ChangePlanAssessment> {
  if (status === "archived" || metadata.stage !== "plan") {
    return { assessment: "not-applicable" };
  }

  const inspection = await inspectPlanVersionControl(
    changeDirectory,
    metadata.baseCommit
  );
  if (inspection.outcome === "base-unavailable") {
    return {
      assessment: "plan-review-required",
      baseCommit: inspection.baseCommit,
      headCommit: inspection.headCommit,
      reason: "base-unavailable"
    };
  }
  if (inspection.outcome === "artifacts-changed") {
    return {
      assessment: "plan-review-required",
      baseCommit: inspection.baseCommit,
      headCommit: inspection.headCommit,
      reason: "artifacts-changed"
    };
  }
  return classifyGitDistance(inspection.evidence);
}
