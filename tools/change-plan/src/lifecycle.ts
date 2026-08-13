import path from "node:path";
import { checkChangePlanDirectoryForPlan } from "./check.ts";
import { readCurrentHeadCommit } from "./git-distance.ts";
import { writeChangePlanMetadata } from "./metadata.ts";
import type {
  ChangePlanCheckResult,
  ChangePlanDiagnostic,
  ChangePlanLifecycleErrorCode,
  ChangePlanLifecycleFailure,
  ChangePlanLifecycleResult,
  ChangePlanMetadata,
  ChangePlanStage
} from "./types.ts";

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function failure(
  sourceCheck: ChangePlanCheckResult | null,
  errorCode: ChangePlanLifecycleErrorCode,
  error: string,
  diagnostics: readonly ChangePlanDiagnostic[] = sourceCheck?.diagnostics ?? []
): ChangePlanLifecycleFailure {
  return {
    action: "plan",
    diagnostics: [...diagnostics],
    error,
    errorCode,
    fromStage: sourceCheck?.stage ?? null,
    success: false
  };
}

async function persistMetadata(
  changeDirectory: string,
  fromStage: ChangePlanStage,
  metadata: ChangePlanMetadata,
  sourceCheck: ChangePlanCheckResult
): Promise<ChangePlanLifecycleResult> {
  try {
    await writeChangePlanMetadata(changeDirectory, metadata);
  } catch (error) {
    return failure(
      sourceCheck,
      "metadata-write-failed",
      `cannot write plan metadata; inspect ${changeDirectory}/.change-plan.json and retry: ${errorMessage(error)}`
    );
  }
  return {
    action: "plan",
    fromStage,
    metadata,
    success: true
  };
}

export async function planChangePlanDirectory(
  changeDirectoryInput: string
): Promise<ChangePlanLifecycleResult> {
  const changeDirectory = path.resolve(changeDirectoryInput);
  const check = await checkChangePlanDirectoryForPlan(changeDirectory);
  if (check.stage !== "draft" && check.stage !== "plan") {
    return failure(
      check,
      "invalid-source-stage",
      "plan requires an active draft or plan change; inspect the current stage first"
    );
  }

  if (check.diagnostics.length > 0) {
    return failure(
      check,
      "artifact-check-failed",
      "proposal.md, design.md, and tasks.md must pass plan checks; fix the reported diagnostics and retry"
    );
  }

  let baseCommit: string | null;
  try {
    baseCommit = await readCurrentHeadCommit(changeDirectory);
  } catch (error) {
    return failure(
      check,
      "version-control-failed",
      `cannot read the current Git revision for the plan baseline; restore repository access and retry: ${errorMessage(error)}`
    );
  }
  if (baseCommit === null) {
    return failure(
      check,
      "base-commit-unavailable",
      "plan requires an existing HEAD commit to record as baseCommit; create or restore a Git commit and retry"
    );
  }
  return await persistMetadata(
    changeDirectory,
    check.stage,
    { baseCommit, stage: "plan" },
    check
  );
}
