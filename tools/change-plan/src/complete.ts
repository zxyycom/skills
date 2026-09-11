import path from "node:path";
import { checkChangePlanDirectory } from "./check.ts";
import {
  ensureChangeTombstoneRoot,
  executePreparedChangeDeletion,
  prepareChangeDeletion,
  type ChangeDeletionPreparation
} from "./change-deletion.ts";
import {
  completeFailure,
  completeGateError,
  matchesCompletionSnapshot,
  sameCompletionLifecycle,
  type ChangePlanCompleteResult
} from "./complete-result.ts";
import type { ChangePlanCheckResult } from "./types.ts";

export type ChangePlanCompleteOptions = Readonly<{ preflight?: boolean }>;
export type { ChangePlanCompleteResult } from "./complete-result.ts";
export async function completeChangePlanDirectory(
  changeDirectoryInput: string,
  options: ChangePlanCompleteOptions = {}
): Promise<ChangePlanCompleteResult> {
  const sourceDirectory = path.resolve(changeDirectoryInput);
  const check = await checkChangePlanDirectory(sourceDirectory);
  const gateError = completeGateError(check);
  if (gateError !== null)
    return completeFailure(sourceDirectory, check, gateError);
  const prepared = await prepareCompletion(sourceDirectory, check);
  if (prepared instanceof Error)
    return completeFailure(sourceDirectory, check, prepared.message);
  if (options.preflight === true)
    return preflightResult(sourceDirectory, check, prepared);
  const refreshed = await refreshCompletion(sourceDirectory, check, prepared);
  if (refreshed.preparation === null)
    return completeFailure(sourceDirectory, refreshed.check, refreshed.error);
  const execution = await executePreparedChangeDeletion(refreshed.preparation);
  return {
    changed: execution.changed,
    check,
    error: execution.error,
    headCommit: refreshed.preparation.headCommit,
    memberCount: refreshed.preparation.memberCount,
    outcome: execution.outcome,
    sourceDirectory,
    tombstoneDirectory: execution.tombstoneDirectory
  };
}
async function prepareCompletion(
  sourceDirectory: string,
  check: Awaited<ReturnType<typeof checkChangePlanDirectory>>
): Promise<ChangeDeletionPreparation | Error> {
  try {
    const preparation = await prepareChangeDeletion(
      sourceDirectory,
      path.dirname(sourceDirectory)
    );
    return matchesCompletionSnapshot(check, preparation.headCommit)
      ? preparation
      : new Error(
          "change lifecycle or Git HEAD changed during completion preparation"
        );
  } catch (error) {
    return new Error(`cannot prepare change deletion: ${errorMessage(error)}`);
  }
}
function preflightResult(
  sourceDirectory: string,
  check: Awaited<ReturnType<typeof checkChangePlanDirectory>>,
  preparation: ChangeDeletionPreparation
): ChangePlanCompleteResult {
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
async function refreshCompletion(
  sourceDirectory: string,
  check: ChangePlanCheckResult,
  preparation: ChangeDeletionPreparation
): Promise<CompletionRefresh> {
  let refreshedCheck = check;
  try {
    await ensureChangeTombstoneRoot(preparation);
    refreshedCheck = await checkChangePlanDirectory(sourceDirectory);
    const gateError = completeGateError(refreshedCheck);
    if (gateError !== null)
      return completionRefreshFailure(
        refreshedCheck,
        `change lifecycle changed before completion: ${gateError}`
      );
    const refreshed = await prepareChangeDeletion(
      sourceDirectory,
      path.dirname(sourceDirectory)
    );
    const lifecycleIsCurrent =
      sameCompletionLifecycle(check, refreshedCheck) &&
      refreshed.headCommit === preparation.headCommit &&
      matchesCompletionSnapshot(refreshedCheck, refreshed.headCommit);
    return lifecycleIsCurrent
      ? { check: refreshedCheck, error: null, preparation: refreshed }
      : completionRefreshFailure(
          refreshedCheck,
          "change lifecycle or Git HEAD changed before completion"
        );
  } catch (error) {
    return completionRefreshFailure(
      refreshedCheck,
      `cannot prepare change tombstone: ${errorMessage(error)}`
    );
  }
}
type CompletionRefresh =
  | Readonly<{
      check: ChangePlanCheckResult;
      error: string;
      preparation: null;
    }>
  | Readonly<{
      check: ChangePlanCheckResult;
      error: null;
      preparation: ChangeDeletionPreparation;
    }>;
function completionRefreshFailure(
  check: ChangePlanCheckResult,
  error: string
): CompletionRefresh {
  return { check, error, preparation: null };
}
function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
