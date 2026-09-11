import path from "node:path";
import { err, errAsync, ok, ResultAsync, type Result } from "neverthrow";
import { investigationIndexFileName } from "./investigation-state-index.ts";
import { diagnosticFromError } from "./diagnostics.ts";
import {
  parseInvestigationIndexSyncOptions,
  parseInvestigationReportCheckOptions
} from "./options.ts";
import {
  canonicalizeInvestigationsDirectory,
  isInvestigationId,
  resolveInvestigationsDirectory,
  type ResolvedInvestigationsDirectory
} from "./report-path.ts";
export { collectValidatedInvestigationCollection } from "./validation-collection.ts";
export type {
  InvestigationSnapshot,
  ValidatedInvestigationCollection
} from "./validation-collection.ts";
export { unrecordedPredecessorWarnings } from "./validation-history.ts";
import type {
  InvestigationIndexSyncOptions,
  InvestigationIndexSyncResult,
  InvestigationReportCheckOptions,
  InvestigationReportCheckResult
} from "./types.ts";
import {
  validateFullCollection,
  validateScopedCollection
} from "./validation-check-flow.ts";
import { synchronizeFullCollectionWithMutationLock } from "./validation-sync-flow.ts";
import {
  checkFailure,
  defaultInvestigationIndexPath,
  emptyResult,
  emptySyncResult,
  investigationIndexPathForOptions,
  syncFailure,
  syncFailureResult,
  uniqueSorted
} from "./validation-results.ts";

export type InvestigationReportCheckFailure = Readonly<{
  kind: "invalid-options" | "operation";
  result: InvestigationReportCheckResult;
}>;
export type InvestigationIndexSyncFailure = Readonly<{
  kind: "invalid-options" | "operation";
  result: InvestigationIndexSyncResult;
}>;
export type PreparedCheck = Readonly<{
  ids: string[];
  indexPath: string;
  resolved: ResolvedInvestigationsDirectory;
}>;
export type PreparedSync = Readonly<{
  indexPath: string;
  mode: "check" | "write";
  resolved: ResolvedInvestigationsDirectory;
  selectors?: readonly string[];
}>;

export function executeInvestigationReportCheck(
  input: unknown
): ResultAsync<
  InvestigationReportCheckResult,
  InvestigationReportCheckFailure
> {
  const prepared = prepareCheck(input);
  if (prepared.isErr()) {
    return errAsync(prepared.error);
  }
  return canonicalizeInvestigationsDirectory(prepared.value.resolved)
    .mapErr((errors) =>
      checkFailure("operation", emptyResult(errors, prepared.value.indexPath))
    )
    .andThen((canonical) =>
      ResultAsync.fromPromise<
        InvestigationReportCheckResult,
        InvestigationReportCheckFailure
      >(
        prepared.value.ids.length > 0
          ? validateScopedCollection(
              canonical.investigationsDirectory,
              prepared.value.ids
            )
          : validateFullCollection(canonical.investigationsDirectory),
        (error) =>
          checkFailure(
            "operation",
            emptyResult(
              ["investigation report check could not be completed"],
              prepared.value.indexPath,
              [
                diagnosticFromError({
                  code: "investigation-report.check-unavailable",
                  error,
                  reason:
                    "the investigation report check could not be completed",
                  recovery:
                    "correct the reported collection failure, then retry the check",
                  target: prepared.value.indexPath
                })
              ]
            )
          )
      )
    )
    .andThen((result) =>
      result.errors.length === 0
        ? ok(result)
        : err(checkFailure("operation", result))
    );
}

export async function validateInvestigationReports(
  options: InvestigationReportCheckOptions
): Promise<InvestigationReportCheckResult> {
  const executed = await executeInvestigationReportCheck(options);
  return executed.match(
    (result) => result,
    (failure) => failure.result
  );
}

export function executeInvestigationIndexSync(
  input: unknown
): ResultAsync<InvestigationIndexSyncResult, InvestigationIndexSyncFailure> {
  const prepared = prepareSync(input);
  if (prepared.isErr()) {
    return errAsync(prepared.error);
  }
  return canonicalizeInvestigationsDirectory(prepared.value.resolved)
    .mapErr((errors) =>
      syncFailure(
        "operation",
        emptySyncResult(
          errors,
          prepared.value.indexPath,
          [],
          undefined,
          prepared.value.selectors ?? []
        )
      )
    )
    .andThen((canonical) => syncCanonicalCollection(canonical, prepared.value))
    .andThen((result) =>
      result.errors.length === 0
        ? ok(result)
        : err(syncFailure("operation", result))
    );
}

function syncCanonicalCollection(
  canonical: ResolvedInvestigationsDirectory,
  prepared: PreparedSync
): ResultAsync<InvestigationIndexSyncResult, InvestigationIndexSyncFailure> {
  return ResultAsync.fromPromise(
    synchronizeFullCollectionWithMutationLock(
      canonical.investigationsDirectory,
      prepared.mode,
      prepared.selectors
    ),
    (error) =>
      syncFailure(
        "operation",
        syncFailureResult(error, prepared.indexPath, prepared.selectors ?? [])
      )
  );
}

export async function synchronizeInvestigationIndex(
  options: InvestigationIndexSyncOptions
): Promise<InvestigationIndexSyncResult> {
  const executed = await executeInvestigationIndexSync(options);
  return executed.match(
    (result) => result,
    (failure) => failure.result
  );
}

function prepareCheck(
  input: unknown
): Result<PreparedCheck, InvestigationReportCheckFailure> {
  const parsed = parseInvestigationReportCheckOptions(input);
  if (parsed.isErr()) {
    return err(
      checkFailure(
        "invalid-options",
        emptyResult(parsed.error, defaultInvestigationIndexPath())
      )
    );
  }
  const resolved = resolveInvestigationsDirectory(
    parsed.value.workspaceRoot,
    parsed.value.investigationsDir
  );
  const ids = uniqueSorted(parsed.value.ids ?? []);
  const invalidIds = ids.filter((id) => !isInvestigationId(id));
  if (resolved.isErr() || invalidIds.length > 0) {
    return err(
      checkFailure(
        "invalid-options",
        emptyResult(
          [
            ...(resolved.isErr() ? resolved.error : []),
            ...invalidIds.map(
              (id) => `${id || "<empty>"} check id must use an Investigation ID`
            )
          ],
          investigationIndexPathForOptions(parsed.value)
        )
      )
    );
  }
  return ok({
    ids,
    indexPath: path.join(
      resolved.value.investigationsDirectory,
      investigationIndexFileName
    ),
    resolved: resolved.value
  });
}

function prepareSync(
  input: unknown
): Result<PreparedSync, InvestigationIndexSyncFailure> {
  const parsed = parseInvestigationIndexSyncOptions(input);
  if (parsed.isErr()) {
    return err(
      syncFailure(
        "invalid-options",
        emptySyncResult(parsed.error, defaultInvestigationIndexPath())
      )
    );
  }
  const resolved = resolveInvestigationsDirectory(
    parsed.value.workspaceRoot,
    parsed.value.investigationsDir
  );
  if (resolved.isErr()) {
    return err(
      syncFailure(
        "invalid-options",
        emptySyncResult(
          resolved.error,
          investigationIndexPathForOptions(parsed.value),
          [],
          undefined,
          parsed.value.selectors ?? []
        )
      )
    );
  }
  return ok({
    indexPath: path.join(
      resolved.value.investigationsDirectory,
      investigationIndexFileName
    ),
    mode:
      parsed.value.mode ??
      (parsed.value.selectors === undefined ? "write" : "check"),
    resolved: resolved.value,
    ...(parsed.value.selectors === undefined
      ? {}
      : { selectors: parsed.value.selectors })
  });
}
