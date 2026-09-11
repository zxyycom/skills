import fs from "node:fs/promises";
import path from "node:path";
import { InvestigationCollectionMutationLockError } from "./collection-mutation-lock.ts";
import {
  diagnosticFromError,
  diagnosticFromStateIndexDiagnostic,
  type InvestigationDiagnostic,
  type InvestigationMutationDiagnostic
} from "./diagnostics.ts";
import {
  investigationIndexFileName,
  syncInvestigationStateIndex
} from "./investigation-state-index.ts";
import { defaultInvestigationsDirectory } from "./report-path.ts";
import type {
  InvestigationIndexSyncResult,
  InvestigationReportCheckResult
} from "./types.ts";
import type {
  InvestigationIndexSyncFailure,
  InvestigationReportCheckFailure
} from "./validation.ts";

export function syncFailureResult(
  error: unknown,
  indexPath: string,
  selectors: readonly string[] = []
): InvestigationIndexSyncResult {
  return error instanceof InvestigationCollectionMutationLockError
    ? lockSyncFailureResult(error, indexPath, selectors)
    : unexpectedSyncFailureResult(error, indexPath, selectors);
}

function lockSyncFailureResult(
  error: InvestigationCollectionMutationLockError,
  indexPath: string,
  selectors: readonly string[]
): InvestigationIndexSyncResult {
  if (
    error.operationCompleted &&
    isInvestigationIndexSyncResult(error.operationResult)
  ) {
    const completed = error.operationResult;
    const mutation =
      completed.mutation ??
      syncMutation(
        completed.changed ? "committed-cleanup-pending" : "no-change"
      );
    return {
      ...completed,
      diagnostics: [
        ...completed.diagnostics,
        { ...error.diagnostic, mutation }
      ],
      errors: uniqueSorted([...completed.errors, error.message]),
      mutation
    };
  }
  const mutation = syncMutation(
    error.diagnostic.code ===
      "investigation-report.collection-lock-release-failed"
      ? "partial-or-unknown"
      : "no-change"
  );
  return emptySyncResult(
    [error.message],
    indexPath,
    [{ ...error.diagnostic, mutation }],
    mutation,
    selectors
  );
}

function unexpectedSyncFailureResult(
  error: unknown,
  indexPath: string,
  selectors: readonly string[]
): InvestigationIndexSyncResult {
  const mutation = syncMutation("partial-or-unknown");
  return emptySyncResult(
    ["investigation index synchronization could not be completed"],
    indexPath,
    [
      diagnosticFromError({
        code: "investigation-report.sync-transaction-failed",
        error,
        mutation,
        reason: "the index synchronization transaction stopped unexpectedly",
        recovery:
          "inspect the reported failure and verify the collection and index before retrying",
        target: indexPath
      })
    ],
    mutation,
    selectors
  );
}

export function isInvestigationIndexSyncResult(
  value: unknown
): value is InvestigationIndexSyncResult {
  if (typeof value !== "object" || value === null) return false;
  const fields = value as Record<string, unknown>;
  return [
    booleanSyncField(fields, "changed"),
    stringSyncField(fields, "indexPath"),
    numberSyncField(fields, "reportCount"),
    stringSyncField(fields, "state"),
    arraySyncFields(fields),
    syncScopeField(fields)
  ].every(Boolean);
}

function booleanSyncField(
  fields: Record<string, unknown>,
  key: string
): boolean {
  return typeof fields[key] === "boolean";
}
function stringSyncField(
  fields: Record<string, unknown>,
  key: string
): boolean {
  return typeof fields[key] === "string";
}
function numberSyncField(
  fields: Record<string, unknown>,
  key: string
): boolean {
  return typeof fields[key] === "number";
}
function arraySyncFields(fields: Record<string, unknown>): boolean {
  return [
    "changedIds",
    "diagnostics",
    "errors",
    "selectedIds",
    "selectors",
    "warnings"
  ].every((key) => Array.isArray(fields[key]));
}
function syncScopeField(fields: Record<string, unknown>): boolean {
  return ["all", "selected"].includes(String(fields["scope"]));
}

export function stateIndexSyncDiagnostics(
  result: Extract<
    Awaited<ReturnType<typeof syncInvestigationStateIndex>>,
    { status: "error" }
  >,
  indexPath: string
): InvestigationDiagnostic[] {
  const mutation = syncMutation(
    result.state === "index-write-failed" ? "partial-or-unknown" : "no-change"
  );
  return result.diagnostics.map((diagnostic) => ({
    ...diagnosticFromStateIndexDiagnostic(diagnostic, {
      mutation,
      recovery:
        "correct the reported derived-index problem, then retry the synchronization",
      target: indexPath
    })
  }));
}

export function syncMutation(
  outcome: InvestigationMutationDiagnostic["outcome"]
): InvestigationMutationDiagnostic {
  return { outcome, scope: "investigation report index collection" };
}

export function checkResult(
  options: Readonly<{
    availableReportCount: number;
    diagnostics?: readonly InvestigationDiagnostic[];
    errors: readonly string[];
    indexChecked: boolean;
    indexPath: string;
    selectedReportCount?: number;
    warnings?: readonly string[];
  }>
): InvestigationReportCheckResult {
  return {
    availableReportCount: options.availableReportCount,
    diagnostics: optionalDiagnostics(options.diagnostics),
    errors: uniqueSorted(options.errors),
    indexChecked: options.indexChecked,
    indexPath: options.indexPath,
    selectedReportCount:
      options.selectedReportCount ?? options.availableReportCount,
    warnings: optionalWarnings(options.warnings)
  };
}

function optionalDiagnostics(
  diagnostics: readonly InvestigationDiagnostic[] | undefined
): InvestigationDiagnostic[] {
  return diagnostics === undefined ? [] : [...diagnostics];
}
function optionalWarnings(warnings: readonly string[] | undefined): string[] {
  return uniqueSorted(warnings ?? []);
}

export function syncResult(
  options: Readonly<{
    changed: boolean;
    changedIds?: readonly string[];
    diagnostics?: readonly InvestigationDiagnostic[];
    errors: readonly string[];
    indexPath: string;
    mutation?: InvestigationMutationDiagnostic;
    reportCount: number;
    scope?: "all" | "selected";
    selectedIds?: readonly string[];
    selectors?: readonly string[];
    state?: string;
    warnings?: readonly string[];
  }>
): InvestigationIndexSyncResult {
  return withSyncMutation(syncResultBase(options), options.mutation);
}

function syncResultBase(
  options: Parameters<typeof syncResult>[0]
): Omit<InvestigationIndexSyncResult, "mutation"> {
  return {
    changed: options.changed,
    changedIds: copiedStrings(options.changedIds),
    diagnostics: optionalDiagnostics(options.diagnostics),
    errors: uniqueSorted(options.errors),
    indexPath: options.indexPath,
    reportCount: options.reportCount,
    scope: syncScope(options.scope),
    selectedIds: copiedStrings(options.selectedIds),
    selectors: copiedStrings(options.selectors),
    state: options.state ?? "source-invalid",
    warnings: optionalWarnings(options.warnings)
  };
}

function copiedStrings(values: readonly string[] | undefined): string[] {
  return values === undefined ? [] : [...values];
}

function syncScope(scope: "all" | "selected" | undefined): "all" | "selected" {
  return scope === undefined ? "all" : scope;
}

function withSyncMutation(
  result: Omit<InvestigationIndexSyncResult, "mutation">,
  mutation: InvestigationMutationDiagnostic | undefined
): InvestigationIndexSyncResult {
  if (mutation === undefined) return result;
  return { ...result, mutation };
}

export function emptyResult(
  errors: readonly string[],
  indexPath: string,
  diagnostics: readonly InvestigationDiagnostic[] = []
): InvestigationReportCheckResult {
  return checkResult({
    availableReportCount: 0,
    diagnostics,
    errors,
    indexChecked: false,
    indexPath,
    selectedReportCount: 0
  });
}
export function emptySyncResult(
  errors: readonly string[],
  indexPath: string,
  diagnostics: readonly InvestigationDiagnostic[] = [],
  mutation?: InvestigationMutationDiagnostic,
  selectors: readonly string[] = []
): InvestigationIndexSyncResult {
  return syncResult({
    changed: false,
    diagnostics,
    errors,
    indexPath,
    mutation,
    reportCount: 0,
    selectors
  });
}
export function checkFailure(
  kind: InvestigationReportCheckFailure["kind"],
  result: InvestigationReportCheckResult
): InvestigationReportCheckFailure {
  return { kind, result };
}
export function syncFailure(
  kind: InvestigationIndexSyncFailure["kind"],
  result: InvestigationIndexSyncResult
): InvestigationIndexSyncFailure {
  return { kind, result };
}
export function defaultInvestigationIndexPath(): string {
  return path.join(
    path.resolve("."),
    defaultInvestigationsDirectory,
    investigationIndexFileName
  );
}
export function investigationIndexPathForOptions(options: {
  investigationsDir?: string;
  workspaceRoot: string;
}): string {
  return path.join(
    path.resolve(
      options.workspaceRoot,
      options.investigationsDir ?? defaultInvestigationsDirectory
    ),
    investigationIndexFileName
  );
}
export function uniqueSorted(values: readonly string[]): string[] {
  return [...new Set(values)].sort(compareText);
}

export function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
export async function lstatOrNull(
  filePath: string
): Promise<Awaited<ReturnType<typeof fs.lstat>> | null> {
  try {
    return await fs.lstat(filePath);
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      Reflect.get(error, "code") === "ENOENT"
    )
      return null;
    throw error;
  }
}
export {
  collectValidatedInvestigationCollection,
  type ValidatedInvestigationCollection
} from "./validation-collection.ts";
export { unrecordedPredecessorWarnings } from "./validation-history.ts";
