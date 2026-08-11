import path from "node:path";
import { checkChangePlanDirectory } from "./check.ts";
import { readCurrentHeadCommit } from "./git-distance.ts";
import { writeChangePlanMetadata } from "./metadata.ts";
import type {
  ChangePlanAssessment,
  ChangePlanCheckResult,
  ChangePlanDiagnostic,
  ChangePlanLifecycleAction,
  ChangePlanLifecycleErrorCode,
  ChangePlanLifecycleFailure,
  ChangePlanLifecycleResult,
  ChangePlanMetadata,
  ChangePlanStage
} from "./types.ts";

type AssessedPlan = {
  assessment: Exclude<
    ChangePlanAssessment,
    { assessment: "not-applicable" }
  >;
  metadata: Extract<ChangePlanMetadata, { stage: "plan" }>;
};

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function failure(
  action: ChangePlanLifecycleAction,
  sourceCheck: ChangePlanCheckResult | null,
  errorCode: ChangePlanLifecycleErrorCode,
  error: string,
  diagnostics: readonly ChangePlanDiagnostic[] = sourceCheck?.diagnostics ?? []
): ChangePlanLifecycleFailure {
  return {
    action,
    diagnostics: [...diagnostics],
    error,
    errorCode,
    fromStage: sourceCheck?.stage ?? null,
    success: false
  };
}

function checkFailureCode(
  check: ChangePlanCheckResult
): "change-check-failed" | "version-control-failed" {
  return check.diagnostics.some(
    (diagnostic) => diagnostic.code === "version-control-failed"
  )
    ? "version-control-failed"
    : "change-check-failed";
}

function hasCompletedReadiness(check: ChangePlanCheckResult): boolean {
  const readiness = check.taskProgress.readiness;
  return readiness.taskCount > 0
    && readiness.completedTaskCount === readiness.taskCount;
}

function hasStartedDelivery(check: ChangePlanCheckResult): boolean {
  return check.taskProgress.implementation.completedTaskCount > 0
    || check.taskProgress.verification.completedTaskCount > 0;
}

function blockingPlanDiagnostics(
  check: ChangePlanCheckResult
): ChangePlanDiagnostic[] {
  return check.diagnostics.filter(
    (diagnostic) => diagnostic.code !== "plan-review-required"
  );
}

function assessedPlan(
  action: "implement" | "reconcile" | "shelve",
  check: ChangePlanCheckResult
): AssessedPlan | ChangePlanLifecycleFailure {
  if (check.stage !== "plan" || check.metadata?.stage !== "plan") {
    return failure(
      action,
      check,
      "invalid-source-stage",
      `${action} requires an active plan; inspect the current stage first`
    );
  }
  if (
    check.assessment === null
    || check.assessment.assessment === "not-applicable"
  ) {
    return failure(
      action,
      check,
      checkFailureCode(check),
      "plan assessment is unavailable; restore version-control access and retry"
    );
  }
  const blockingDiagnostics = blockingPlanDiagnostics(check);
  if (blockingDiagnostics.length > 0) {
    return failure(
      action,
      check,
      "change-check-failed",
      "plan artifacts must pass check before the lifecycle can advance; fix the reported diagnostics and retry",
      blockingDiagnostics
    );
  }
  return { assessment: check.assessment, metadata: check.metadata };
}

function isLifecycleFailure(
  result: AssessedPlan | ChangePlanLifecycleFailure
): result is ChangePlanLifecycleFailure {
  return "success" in result;
}

async function persistMetadata(
  action: ChangePlanLifecycleAction,
  changeDirectory: string,
  fromStage: ChangePlanStage,
  metadata: ChangePlanMetadata,
  sourceCheck: ChangePlanCheckResult
): Promise<ChangePlanLifecycleResult> {
  try {
    await writeChangePlanMetadata(changeDirectory, metadata);
  } catch (error) {
    return failure(
      action,
      sourceCheck,
      "metadata-write-failed",
      `cannot write lifecycle metadata; inspect ${changeDirectory}/.change-plan.json and retry: ${errorMessage(error)}`
    );
  }
  return { action, fromStage, metadata, success: true };
}

export async function planChangePlanDirectory(
  changeDirectoryInput: string
): Promise<ChangePlanLifecycleResult> {
  const action = "plan";
  const changeDirectory = path.resolve(changeDirectoryInput);
  const check = await checkChangePlanDirectory(changeDirectory, "plan");
  if (check.stage !== "draft" && check.stage !== "plan") {
    return failure(
      action,
      check,
      "invalid-source-stage",
      "plan requires an active draft or plan change; inspect the current stage first"
    );
  }
  if (check.stage === "plan" && check.assessment === null) {
    return failure(
      action,
      check,
      checkFailureCode(check),
      "plan assessment is unavailable; restore version-control access and retry"
    );
  }

  const blockingDiagnostics = check.stage === "plan"
    ? blockingPlanDiagnostics(check)
    : check.diagnostics;
  if (blockingDiagnostics.length > 0) {
    return failure(
      action,
      check,
      "artifact-check-failed",
      "proposal.md, design.md, and tasks.md must pass plan checks; fix the reported diagnostics and retry",
      blockingDiagnostics
    );
  }
  if (
    check.stage === "plan"
    && check.assessment?.assessment !== "plan-review-required"
    && check.assessment?.assessment !== "shelve-candidate"
  ) {
    return failure(
      action,
      check,
      "invalid-assessment",
      "plan accepts draft, plan-review-required, or shelve-candidate changes; inspect the current assessment before retrying"
    );
  }
  if (!hasCompletedReadiness(check)) {
    return failure(
      action,
      check,
      "readiness-incomplete",
      "all Readiness tasks must be completed before plan; complete them and retry"
    );
  }
  if (hasStartedDelivery(check)) {
    return failure(
      action,
      check,
      "delivery-already-started",
      "Implementation and Verification tasks must remain unchecked before plan; reconcile task state and retry"
    );
  }

  let baseCommit: string | null;
  try {
    baseCommit = await readCurrentHeadCommit(changeDirectory);
  } catch (error) {
    return failure(
      action,
      check,
      "version-control-failed",
      `cannot read the current Git revision for the plan baseline; restore repository access and retry: ${errorMessage(error)}`
    );
  }
  if (baseCommit === null) {
    return failure(
      action,
      check,
      "base-commit-unavailable",
      "plan requires an existing HEAD commit to record as baseCommit; create or restore a Git commit and retry"
    );
  }
  return await persistMetadata(
    action,
    changeDirectory,
    check.stage,
    { baseCommit, stage: "plan" },
    check
  );
}

export async function implementChangePlanDirectory(
  changeDirectoryInput: string
): Promise<ChangePlanLifecycleResult> {
  const action = "implement";
  const changeDirectory = path.resolve(changeDirectoryInput);
  const check = await checkChangePlanDirectory(changeDirectory);
  const plan = assessedPlan(action, check);
  if (isLifecycleFailure(plan)) {
    return plan;
  }
  if (plan.assessment.assessment === "shelve-candidate") {
    return failure(
      action,
      check,
      "invalid-assessment",
      "shelve-candidate cannot enter implementation; run plan to reconfirm it, reconcile the mechanical shelf, or shelve it with a reason"
    );
  }
  if (
    plan.assessment.assessment !== "current"
    || plan.metadata.baseCommit === null
  ) {
    return failure(
      action,
      check,
      "invalid-assessment",
      "plan must be reviewed with plan before implementation; run plan and retry"
    );
  }
  return await persistMetadata(
    action,
    changeDirectory,
    "plan",
    {
      baseCommit: plan.metadata.baseCommit,
      stage: "implementation"
    },
    check
  );
}

export async function shelveChangePlanDirectory(
  changeDirectoryInput: string,
  reasonInput: string
): Promise<ChangePlanLifecycleResult> {
  const action = "shelve";
  const reason = reasonInput.trim();
  if (reason.length === 0) {
    return failure(
      action,
      null,
      "reason-required",
      "shelve requires a non-empty reason; provide --reason <text> and retry"
    );
  }

  const changeDirectory = path.resolve(changeDirectoryInput);
  const check = await checkChangePlanDirectory(changeDirectory);
  const plan = assessedPlan(action, check);
  if (isLifecycleFailure(plan)) {
    return plan;
  }
  if (
    plan.metadata.baseCommit === null
    || (
      plan.assessment.assessment !== "current"
      && plan.assessment.assessment !== "shelve-candidate"
    )
  ) {
    return failure(
      action,
      check,
      "invalid-assessment",
      "only a confirmed current or shelve-candidate plan can be shelved; run plan first"
    );
  }
  return await persistMetadata(
    action,
    changeDirectory,
    "plan",
    {
      baseCommit: plan.metadata.baseCommit,
      shelf: {
        atCommit: plan.assessment.headCommit,
        reason,
        source: "explicit"
      },
      stage: "shelved"
    },
    check
  );
}

export async function reconcileChangePlanDirectory(
  changeDirectoryInput: string
): Promise<ChangePlanLifecycleResult> {
  const action = "reconcile";
  const changeDirectory = path.resolve(changeDirectoryInput);
  const check = await checkChangePlanDirectory(changeDirectory);
  const plan = assessedPlan(action, check);
  if (isLifecycleFailure(plan)) {
    return plan;
  }
  if (plan.assessment.assessment !== "shelve-candidate") {
    return failure(
      action,
      check,
      "invalid-assessment",
      "reconcile only accepts a shelve-candidate; inspect the current assessment first"
    );
  }
  if (plan.metadata.baseCommit === null) {
    return failure(
      action,
      check,
      "invalid-assessment",
      "only a confirmed plan can be reconciled; run plan first"
    );
  }
  return await persistMetadata(
    action,
    changeDirectory,
    "plan",
    {
      baseCommit: plan.metadata.baseCommit,
      shelf: {
        atCommit: plan.assessment.headCommit,
        changedLines: plan.assessment.changedLines,
        commitCount: plan.assessment.commitCount,
        source: "git-distance-v1"
      },
      stage: "shelved"
    },
    check
  );
}

export async function resumeChangePlanDirectory(
  changeDirectoryInput: string
): Promise<ChangePlanLifecycleResult> {
  const action = "resume";
  const changeDirectory = path.resolve(changeDirectoryInput);
  const check = await checkChangePlanDirectory(changeDirectory);
  if (check.stage !== "shelved") {
    return failure(
      action,
      check,
      "invalid-source-stage",
      "resume requires an active shelved change; inspect the current stage first"
    );
  }
  if (!check.valid) {
    return failure(
      action,
      check,
      checkFailureCode(check),
      "shelved change plan must pass check before resume; fix the reported diagnostics and retry"
    );
  }
  return await persistMetadata(
    action,
    changeDirectory,
    "shelved",
    { baseCommit: null, stage: "plan" },
    check
  );
}
