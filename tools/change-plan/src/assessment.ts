import type {
  ChangePlanAssessment,
  ChangePlanMetadata
} from "./types.ts";
import {
  classifyGitDistance,
  inspectPlanVersionControl
} from "./git-distance.ts";

export async function assessChangePlan(
  changeDirectory: string,
  metadata: ChangePlanMetadata
): Promise<ChangePlanAssessment> {
  if (metadata.stage !== "plan") {
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
