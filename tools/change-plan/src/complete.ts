import path from "node:path";
import { checkChangePlanDirectory } from "./check.ts";
import {
  ensureChangeTombstoneRoot,
  executePreparedChangeDeletion,
  prepareChangeDeletion,
  type ChangeDeletionOutcome
} from "./change-deletion.ts";
import type { ChangePlanCheckResult } from "./types.ts";

export type ChangePlanCompleteOptions = Readonly<{ preflight?: boolean }>;

export type ChangePlanCompleteResult = Readonly<{
  changed: boolean;
  check: ChangePlanCheckResult | null;
  error: string | null;
  headCommit: string | null;
  memberCount: number;
  outcome: ChangeDeletionOutcome | "preflight";
  sourceDirectory: string;
  tombstoneDirectory: string | null;
}>;

export async function completeChangePlanDirectory(
  changeDirectoryInput: string,
  options: ChangePlanCompleteOptions = {}
): Promise<ChangePlanCompleteResult> {
  const sourceDirectory = path.resolve(changeDirectoryInput);
  const check = await checkChangePlanDirectory(sourceDirectory);
  const gateError = completeGateError(check);
  if (gateError !== null)
    return completeFailure(sourceDirectory, check, gateError);

  let preparation;
  try {
    preparation = await prepareChangeDeletion(
      sourceDirectory,
      path.dirname(sourceDirectory)
    );
  } catch (error) {
    return completeFailure(
      sourceDirectory,
      check,
      `cannot prepare change deletion: ${errorMessage(error)}`
    );
  }
  if (!matchesCompletionSnapshot(check, preparation.headCommit)) {
    return completeFailure(
      sourceDirectory,
      check,
      "change lifecycle or Git HEAD changed during completion preparation"
    );
  }
  if (options.preflight === true) {
    return {
      changed: false,
      check,
      error: null,
      headCommit: preparation.headCommit,
      memberCount: preparation.memberCount,
      outcome: "preflight",
      sourceDirectory,
      tombstoneDirectory: preparation.tombstoneDirectory
    };
  }

  try {
    await ensureChangeTombstoneRoot(preparation);
    const refreshedCheck = await checkChangePlanDirectory(sourceDirectory);
    const refreshedGateError = completeGateError(refreshedCheck);
    if (refreshedGateError !== null) {
      return completeFailure(
        sourceDirectory,
        refreshedCheck,
        `change lifecycle changed before completion: ${refreshedGateError}`
      );
    }
    const refreshedPreparation = await prepareChangeDeletion(
      sourceDirectory,
      path.dirname(sourceDirectory)
    );
    if (
      !sameCompletionLifecycle(check, refreshedCheck) ||
      refreshedPreparation.headCommit !== preparation.headCommit ||
      !matchesCompletionSnapshot(
        refreshedCheck,
        refreshedPreparation.headCommit
      )
    ) {
      return completeFailure(
        sourceDirectory,
        refreshedCheck,
        "change lifecycle or Git HEAD changed before completion"
      );
    }
    preparation = refreshedPreparation;
  } catch (error) {
    return completeFailure(
      sourceDirectory,
      check,
      `cannot prepare change tombstone: ${errorMessage(error)}`
    );
  }
  const execution = await executePreparedChangeDeletion(preparation);
  return {
    changed: execution.changed,
    check,
    error: execution.error,
    headCommit: preparation.headCommit,
    memberCount: preparation.memberCount,
    outcome: execution.outcome,
    sourceDirectory,
    tombstoneDirectory: execution.tombstoneDirectory
  };
}

function matchesCompletionSnapshot(
  check: ChangePlanCheckResult,
  headCommit: string
): boolean {
  return (
    check.stage === "plan" &&
    check.metadata?.stage === "plan" &&
    check.distance?.headCommit === headCommit
  );
}

function sameCompletionLifecycle(
  initial: ChangePlanCheckResult,
  refreshed: ChangePlanCheckResult
): boolean {
  return (
    initial.stage === refreshed.stage &&
    initial.taskCount === refreshed.taskCount &&
    initial.completedTaskCount === refreshed.completedTaskCount &&
    initial.metadata?.stage === refreshed.metadata?.stage &&
    planBaseCommit(initial) === planBaseCommit(refreshed)
  );
}

function planBaseCommit(check: ChangePlanCheckResult): string | null {
  return check.metadata?.stage === "plan" ? check.metadata.baseCommit : null;
}

function completeGateError(check: ChangePlanCheckResult): string | null {
  if (!check.valid) return "change plan must pass check before complete";
  if (check.stage !== "plan") {
    return "change plan must be a plan before complete";
  }
  return check.completedTaskCount === check.taskCount
    ? null
    : `all tasks must be completed before complete: ${check.completedTaskCount}/${check.taskCount}`;
}

function completeFailure(
  sourceDirectory: string,
  check: ChangePlanCheckResult | null,
  error: string
): ChangePlanCompleteResult {
  return {
    changed: false,
    check,
    error,
    headCommit: null,
    memberCount: 0,
    outcome: "no-change",
    sourceDirectory,
    tombstoneDirectory: null
  };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
