import path from "node:path";
import { checkChangePlanDirectory } from "./check.ts";
import {
  ensureChangeTombstoneRoot,
  executePreparedChangeDeletion,
  prepareChangeDeletion,
  type ChangeDeletionPreparation
} from "./change-deletion.ts";
import {
  finalizeFailure,
  finalizeGateError,
  matchesFinalizationSnapshot,
  sameFinalizationLifecycle,
  type ChangePlanFinalizeResult
} from "./finalize-result.ts";
import type { ChangePlanCheckResult } from "./types.ts";

export type ChangePlanFinalizeOptions = Readonly<{ preflight?: boolean }>;
export type { ChangePlanFinalizeResult } from "./finalize-result.ts";
export async function finalizeChangePlanDirectory(
  changeDirectoryInput: string,
  options: ChangePlanFinalizeOptions = {}
): Promise<ChangePlanFinalizeResult> {
  const sourceDirectory = path.resolve(changeDirectoryInput);
  const check = await checkChangePlanDirectory(sourceDirectory);
  const gateError = finalizeGateError(check);
  if (gateError !== null)
    return finalizeFailure(sourceDirectory, check, gateError);
  const prepared = await prepareFinalization(sourceDirectory, check);
  if (prepared instanceof Error)
    return finalizeFailure(sourceDirectory, check, prepared.message);
  if (options.preflight === true)
    return preflightResult(sourceDirectory, check, prepared);
  const refreshed = await refreshFinalization(sourceDirectory, check, prepared);
  if (refreshed.preparation === null)
    return finalizeFailure(sourceDirectory, refreshed.check, refreshed.error);
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
async function prepareFinalization(
  sourceDirectory: string,
  check: Awaited<ReturnType<typeof checkChangePlanDirectory>>
): Promise<ChangeDeletionPreparation | Error> {
  try {
    const preparation = await prepareChangeDeletion(
      sourceDirectory,
      path.dirname(sourceDirectory)
    );
    return matchesFinalizationSnapshot(check, preparation.headCommit)
      ? preparation
      : new Error(
          "change lifecycle or Git HEAD changed during finalization preparation"
        );
  } catch (error) {
    return new Error(`cannot prepare change deletion: ${errorMessage(error)}`);
  }
}
function preflightResult(
  sourceDirectory: string,
  check: Awaited<ReturnType<typeof checkChangePlanDirectory>>,
  preparation: ChangeDeletionPreparation
): ChangePlanFinalizeResult {
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
async function refreshFinalization(
  sourceDirectory: string,
  check: ChangePlanCheckResult,
  preparation: ChangeDeletionPreparation
): Promise<FinalizationRefresh> {
  let refreshedCheck = check;
  try {
    await ensureChangeTombstoneRoot(preparation);
    refreshedCheck = await checkChangePlanDirectory(sourceDirectory);
    const gateError = finalizeGateError(refreshedCheck);
    if (gateError !== null)
      return finalizationRefreshFailure(
        refreshedCheck,
        `change lifecycle changed before finalization: ${gateError}`
      );
    const refreshed = await prepareChangeDeletion(
      sourceDirectory,
      path.dirname(sourceDirectory)
    );
    const lifecycleIsCurrent =
      sameFinalizationLifecycle(check, refreshedCheck) &&
      refreshed.headCommit === preparation.headCommit &&
      matchesFinalizationSnapshot(refreshedCheck, refreshed.headCommit);
    return lifecycleIsCurrent
      ? { check: refreshedCheck, error: null, preparation: refreshed }
      : finalizationRefreshFailure(
          refreshedCheck,
          "change lifecycle or Git HEAD changed before finalization"
        );
  } catch (error) {
    return finalizationRefreshFailure(
      refreshedCheck,
      `cannot prepare change tombstone: ${errorMessage(error)}`
    );
  }
}
type FinalizationRefresh =
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
function finalizationRefreshFailure(
  check: ChangePlanCheckResult,
  error: string
): FinalizationRefresh {
  return { check, error, preparation: null };
}
function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
