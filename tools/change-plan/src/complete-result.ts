import type { ChangePlanCheckResult } from "./types.ts";
import type { ChangeDeletionOutcome } from "./change-deletion-types.ts";

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

export function completeGateError(check: ChangePlanCheckResult): string | null {
  if (!check.valid) return "change plan must pass check before complete";
  if (check.stage !== "plan")
    return "change plan must be a plan before complete";
  return check.completedTaskCount === check.taskCount
    ? null
    : `all tasks must be completed before complete: ${check.completedTaskCount}/${check.taskCount}`;
}
export function matchesCompletionSnapshot(
  check: ChangePlanCheckResult,
  headCommit: string
): boolean {
  return (
    check.stage === "plan" &&
    check.metadata?.stage === "plan" &&
    check.distance?.headCommit === headCommit
  );
}
export function sameCompletionLifecycle(
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
export function completeFailure(
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
function planBaseCommit(check: ChangePlanCheckResult): string | null {
  return check.metadata?.stage === "plan" ? check.metadata.baseCommit : null;
}
