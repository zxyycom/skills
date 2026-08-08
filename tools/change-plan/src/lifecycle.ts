import path from "node:path";
import { confirmPlanArtifactsAtHead } from "./assessment.ts";
import {
  checkChangePlanArtifactsForStage,
  checkChangePlanDirectory
} from "./check.ts";
import { writeChangePlanMetadata } from "./metadata.ts";
import type {
  ChangePlanArtifactCheckResult,
  ChangePlanAssessment,
  ChangePlanCheckResult,
  ChangePlanLifecycleAction,
  ChangePlanLifecycleErrorCode,
  ChangePlanLifecycleFailure,
  ChangePlanLifecycleResult,
  ChangePlanMetadata
} from "./types.ts";

type LifecycleTransition =
  | {
    action: "plan";
    fromStage: "draft" | "plan";
    metadata: Extract<ChangePlanMetadata, { stage: "plan" }>;
    toStage: "plan";
  }
  | {
    action: "implement";
    fromStage: "plan";
    metadata: Extract<ChangePlanMetadata, { stage: "implementation" }>;
    toStage: "implementation";
  }
  | {
    action: "shelve";
    fromStage: "plan";
    metadata: Extract<ChangePlanMetadata, { stage: "shelved" }>;
    toStage: "shelved";
  }
  | {
    action: "reconcile";
    fromStage: "plan";
    metadata: Extract<ChangePlanMetadata, { stage: "shelved" }>;
    toStage: "shelved";
  }
  | {
    action: "resume";
    fromStage: "shelved";
    metadata: Extract<ChangePlanMetadata, { stage: "plan" }>;
    toStage: "plan";
  };

type PersistedLifecycleSuccess<
  Transition extends LifecycleTransition
> = Omit<Transition, "metadata"> & {
  assessment: ChangePlanAssessment | null;
  changeDirectory: string;
  check: ChangePlanCheckResult;
  error: null;
  errorCode: null;
  success: true;
};

type PersistedLifecycleResult<
  Transition extends LifecycleTransition
> = PersistedLifecycleSuccess<Transition>
  | ChangePlanLifecycleFailure<Transition["action"]>;

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function failure<Action extends ChangePlanLifecycleAction>(
  action: Action,
  sourceCheck: ChangePlanCheckResult,
  errorCode: ChangePlanLifecycleErrorCode,
  error: string,
  reportedCheck: ChangePlanArtifactCheckResult | ChangePlanCheckResult = sourceCheck
): ChangePlanLifecycleFailure<Action> {
  return {
    action,
    assessment: sourceCheck.assessment,
    changeDirectory: sourceCheck.changeDirectory,
    check: reportedCheck,
    error,
    errorCode,
    fromStage: sourceCheck.stage,
    success: false,
    toStage: null
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

async function persistMetadata<Transition extends LifecycleTransition>(
  sourceCheck: ChangePlanCheckResult,
  transition: Transition
): Promise<PersistedLifecycleResult<Transition>> {
  try {
    await writeChangePlanMetadata(
      sourceCheck.changeDirectory,
      transition.metadata
    );
  } catch (error) {
    return failure(
      transition.action,
      sourceCheck,
      "metadata-write-failed",
      `cannot write lifecycle metadata; inspect ${sourceCheck.changeDirectory}/.change-plan.json and retry: ${errorMessage(error)}`
    );
  }

  const updatedCheck = await checkChangePlanDirectory(
    sourceCheck.changeDirectory
  );
  const { metadata: _metadata, ...transitionResult } = transition;
  return {
    ...transitionResult,
    assessment: updatedCheck.assessment,
    changeDirectory: sourceCheck.changeDirectory,
    check: updatedCheck,
    error: null,
    errorCode: null,
    success: true
  };
}

function hasCompletedReadiness(
  check: ChangePlanArtifactCheckResult
): boolean {
  const readiness = check.taskProgress.readiness;
  return readiness.taskCount > 0
    && readiness.completedTaskCount === readiness.taskCount;
}

function hasStartedDelivery(check: ChangePlanArtifactCheckResult): boolean {
  return check.taskProgress.implementation.completedTaskCount > 0
    || check.taskProgress.verification.completedTaskCount > 0;
}

async function checkPlanArtifacts<Action extends ChangePlanLifecycleAction>(
  sourceCheck: ChangePlanCheckResult,
  action: Action
): Promise<
  ChangePlanArtifactCheckResult | ChangePlanLifecycleFailure<Action>
> {
  const artifactCheck = await checkChangePlanArtifactsForStage(
    sourceCheck.changeDirectory,
    "plan"
  );
  return artifactCheck.valid
    ? artifactCheck
    : failure(
      action,
      sourceCheck,
      "artifact-check-failed",
      "proposal.md, design.md, and tasks.md must pass plan checks; fix the reported diagnostics and retry",
      artifactCheck
    );
}

function isLifecycleFailure<Action extends ChangePlanLifecycleAction>(
  value: ChangePlanArtifactCheckResult | ChangePlanLifecycleFailure<Action>
): value is ChangePlanLifecycleFailure<Action> {
  return "success" in value && value.success === false;
}

export async function planChangePlanDirectory(
  changeDirectoryInput: string
): Promise<ChangePlanLifecycleResult<"plan">> {
  const action = "plan";
  const changeDirectory = path.resolve(changeDirectoryInput);
  const sourceCheck = await checkChangePlanDirectory(changeDirectory);

  if (sourceCheck.stage === "draft") {
    if (!sourceCheck.valid) {
      return failure(
        action,
        sourceCheck,
        checkFailureCode(sourceCheck),
        "draft change plan must pass its current check before plan; fix the reported diagnostics and retry"
      );
    }
  } else if (sourceCheck.stage === "plan") {
    if (sourceCheck.assessment === null) {
      return failure(
        action,
        sourceCheck,
        checkFailureCode(sourceCheck),
        "plan assessment is unavailable; restore version-control access and retry"
      );
    }
    if (
      sourceCheck.assessment.assessment !== "plan-review-required"
      && sourceCheck.assessment.assessment !== "shelve-candidate"
    ) {
      return failure(
        action,
        sourceCheck,
        "invalid-assessment",
        "plan accepts draft, plan-review-required, or shelve-candidate changes; inspect the current assessment before retrying"
      );
    }
  } else {
    return failure(
      action,
      sourceCheck,
      "invalid-source-stage",
      "plan requires an active draft or plan change; inspect the current stage first"
    );
  }

  const planCheck = await checkPlanArtifacts(sourceCheck, action);
  if (isLifecycleFailure(planCheck)) {
    return planCheck;
  }
  if (!hasCompletedReadiness(planCheck)) {
    return failure(
      action,
      sourceCheck,
      "readiness-incomplete",
      "all Readiness tasks must be completed before plan; complete them and retry",
      planCheck
    );
  }
  if (hasStartedDelivery(planCheck)) {
    return failure(
      action,
      sourceCheck,
      "delivery-already-started",
      "Implementation and Verification tasks must remain unchecked before plan; reconcile task state and retry",
      planCheck
    );
  }

  let confirmation;
  try {
    confirmation = await confirmPlanArtifactsAtHead(changeDirectory);
  } catch (error) {
    return failure(
      action,
      sourceCheck,
      "version-control-failed",
      `cannot confirm plan artifacts in version control; restore repository access and retry: ${errorMessage(error)}`,
      planCheck
    );
  }
  if (!confirmation.confirmed) {
    return failure(
      action,
      sourceCheck,
      "artifacts-not-confirmed",
      "proposal.md, design.md, and tasks.md must be committed at HEAD; commit the current artifacts and retry",
      planCheck
    );
  }
  return await persistMetadata(sourceCheck, {
    action,
    fromStage: sourceCheck.stage,
    metadata: {
      baseCommit: confirmation.headCommit,
      schemaVersion: 1,
      stage: "plan"
    },
    toStage: "plan"
  });
}

export async function implementChangePlanDirectory(
  changeDirectoryInput: string
): Promise<ChangePlanLifecycleResult<"implement">> {
  const action = "implement";
  const check = await checkChangePlanDirectory(path.resolve(changeDirectoryInput));
  if (check.stage !== "plan" || check.metadata?.stage !== "plan") {
    return failure(
      action,
      check,
      "invalid-source-stage",
      "implement requires an active plan; inspect the current stage first"
    );
  }
  if (check.assessment === null) {
    return failure(
      action,
      check,
      checkFailureCode(check),
      "plan assessment is unavailable; restore version-control access and retry"
    );
  }
  const artifactCheck = await checkPlanArtifacts(check, action);
  if (isLifecycleFailure(artifactCheck)) {
    return artifactCheck;
  }
  if (check.assessment.assessment === "shelve-candidate") {
    return failure(
      action,
      check,
      "invalid-assessment",
      "shelve-candidate cannot enter implementation; run plan to reconfirm it, reconcile the mechanical shelf, or shelve it with a reason"
    );
  }
  if (
    check.assessment.assessment !== "current"
    || check.metadata.baseCommit === null
  ) {
    return failure(
      action,
      check,
      "invalid-assessment",
      "plan must be reviewed with plan before implementation; run plan and retry"
    );
  }
  return await persistMetadata(check, {
    action,
    fromStage: "plan",
    metadata: {
      baseCommit: check.metadata.baseCommit,
      schemaVersion: 1,
      stage: "implementation"
    },
    toStage: "implementation"
  });
}

export async function shelveChangePlanDirectory(
  changeDirectoryInput: string,
  reasonInput: string
): Promise<ChangePlanLifecycleResult<"shelve">> {
  const action = "shelve";
  const check = await checkChangePlanDirectory(path.resolve(changeDirectoryInput));
  const reason = reasonInput.trim();
  if (reason.length === 0) {
    return failure(
      action,
      check,
      "reason-required",
      "shelve requires a non-empty reason; provide --reason <text> and retry"
    );
  }
  if (check.stage !== "plan" || check.metadata?.stage !== "plan") {
    return failure(
      action,
      check,
      "invalid-source-stage",
      "shelve requires an active plan; inspect the current stage first"
    );
  }
  if (check.assessment === null) {
    return failure(
      action,
      check,
      checkFailureCode(check),
      "plan assessment is unavailable; restore version-control access and retry"
    );
  }
  const artifactCheck = await checkPlanArtifacts(check, action);
  if (isLifecycleFailure(artifactCheck)) {
    return artifactCheck;
  }
  if (
    check.metadata.baseCommit === null
    || (
      check.assessment.assessment !== "current"
      && check.assessment.assessment !== "shelve-candidate"
    )
  ) {
    return failure(
      action,
      check,
      "invalid-assessment",
      "only a confirmed current or shelve-candidate plan can be shelved; run plan first"
    );
  }
  return await persistMetadata(check, {
    action,
    fromStage: "plan",
    metadata: {
      baseCommit: check.metadata.baseCommit,
      schemaVersion: 1,
      shelf: {
        atCommit: check.assessment.headCommit,
        reason,
        source: "explicit"
      },
      stage: "shelved"
    },
    toStage: "shelved"
  });
}

export async function reconcileChangePlanDirectory(
  changeDirectoryInput: string
): Promise<ChangePlanLifecycleResult<"reconcile">> {
  const action = "reconcile";
  const check = await checkChangePlanDirectory(path.resolve(changeDirectoryInput));
  if (check.stage !== "plan" || check.metadata?.stage !== "plan") {
    return failure(
      action,
      check,
      "invalid-source-stage",
      "reconcile requires an active plan; inspect the current stage first"
    );
  }
  if (check.assessment === null) {
    return failure(
      action,
      check,
      checkFailureCode(check),
      "plan assessment is unavailable; restore version-control access and retry"
    );
  }
  const artifactCheck = await checkPlanArtifacts(check, action);
  if (isLifecycleFailure(artifactCheck)) {
    return artifactCheck;
  }
  if (check.assessment.assessment !== "shelve-candidate") {
    return failure(
      action,
      check,
      "invalid-assessment",
      "reconcile only accepts a shelve-candidate; inspect the current assessment first"
    );
  }
  if (check.metadata.baseCommit === null) {
    return failure(
      action,
      check,
      "invalid-assessment",
      "only a confirmed plan can be reconciled; run plan first"
    );
  }
  return await persistMetadata(check, {
    action,
    fromStage: "plan",
    metadata: {
      baseCommit: check.metadata.baseCommit,
      schemaVersion: 1,
      shelf: {
        atCommit: check.assessment.headCommit,
        changedLines: check.assessment.changedLines,
        commitCount: check.assessment.commitCount,
        source: "git-distance-v1"
      },
      stage: "shelved"
    },
    toStage: "shelved"
  });
}

export async function resumeChangePlanDirectory(
  changeDirectoryInput: string
): Promise<ChangePlanLifecycleResult<"resume">> {
  const action = "resume";
  const check = await checkChangePlanDirectory(path.resolve(changeDirectoryInput));
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
  return await persistMetadata(check, {
    action,
    fromStage: "shelved",
    metadata: {
      baseCommit: null,
      schemaVersion: 1,
      stage: "plan"
    },
    toStage: "plan"
  });
}
