import fs from "node:fs/promises";
import path from "node:path";
import { readRecordText } from "../../record-operations/src/source.ts";
import {
  diagnosticFromError,
  genericInvestigationDiagnostic,
  sanitizeInvestigationDiagnosticText,
  type InvestigationMutationDiagnostic
} from "./diagnostics.ts";
import { InvestigationCollectionMutationLockError } from "./collection-mutation-lock.ts";
import type {
  InvestigationRenamePlan,
  InvestigationRenameResult
} from "./rename-contract.ts";

const renameScope = "investigation report rename collection";

export type RenameStep<T> =
  | Readonly<{ result: InvestigationRenameResult }>
  | Readonly<{ value: T }>;

export function renameSuccess(
  changed: boolean,
  indexPath: string,
  plan: InvestigationRenamePlan,
  outcome: "committed" | "no-change" | "preflight"
): InvestigationRenameResult {
  return {
    changed,
    diagnostics: [],
    errors: [],
    indexPath,
    plan: { ...plan, outcome: outcome === "preflight" ? "preflight" : "ready" },
    status: "ok"
  };
}

export function renameFailure(
  indexPath: string,
  plan: InvestigationRenamePlan | null,
  errors: readonly string[],
  mutation?: InvestigationMutationDiagnostic
): InvestigationRenameResult {
  const sorted = uniqueSorted(errors);
  return {
    changed: false,
    diagnostics: [
      genericInvestigationDiagnostic({
        code: "investigation-report.rename-failed",
        ...(mutation === undefined ? {} : { mutation }),
        reason: sorted.join("; "),
        recovery:
          "Correct the reported Investigation identity, collection, or recovery issue before retrying rename.",
        target: plan?.oldId ?? indexPath
      })
    ],
    errors: sorted,
    indexPath,
    ...(mutation === undefined ? {} : { mutation }),
    plan,
    status: "error"
  };
}

export function renameStepFailure<T>(
  indexPath: string,
  errors: readonly string[]
): RenameStep<T> {
  return { result: renameFailure(indexPath, null, errors) };
}

export function renameLockFailure(
  indexPath: string,
  error: unknown
): InvestigationRenameResult {
  if (
    error instanceof InvestigationCollectionMutationLockError &&
    error.operationCompleted &&
    isRenameResult(error.operationResult)
  ) {
    return completedRenameLockFailure(error.operationResult, error);
  }
  const mutation = renameMutation(
    error instanceof InvestigationCollectionMutationLockError &&
      error.operationCompleted
      ? "committed-cleanup-pending"
      : "no-change"
  );
  return {
    ...renameFailure(
      indexPath,
      null,
      ["Investigation rename lock failed: " + errorText(error)],
      mutation
    ),
    diagnostics: [
      diagnosticFromError({
        code: "investigation-report.rename-lock-failed",
        error,
        mutation,
        reason:
          "the Investigation rename transaction could not acquire or release its collection lock",
        recovery:
          "Wait for the active transaction or inspect the collection lock before retrying rename.",
        target: indexPath
      })
    ]
  };
}

function isRenameResult(value: unknown): value is InvestigationRenameResult {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof Reflect.get(value, "changed") === "boolean" &&
    Array.isArray(Reflect.get(value, "errors")) &&
    Array.isArray(Reflect.get(value, "diagnostics")) &&
    "plan" in value &&
    typeof Reflect.get(value, "indexPath") === "string" &&
    ["ok", "attention", "error"].includes(String(Reflect.get(value, "status")))
  );
}

export function renameMutation(
  outcome: InvestigationMutationDiagnostic["outcome"]
): InvestigationMutationDiagnostic {
  return { outcome, scope: renameScope };
}

export async function readRegularText(filePath: string): Promise<string> {
  return await readRecordText(path.dirname(filePath), path.basename(filePath));
}

export async function lstatOrNull(
  targetPath: string
): Promise<Awaited<ReturnType<typeof fs.lstat>> | null> {
  try {
    return await fs.lstat(targetPath);
  } catch (error) {
    if (isNotFound(error)) return null;
    throw error;
  }
}

function isNotFound(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "ENOENT"
  );
}

export function countText(text: string, needle: string): number {
  let count = 0;
  let index = text.indexOf(needle);
  while (index >= 0) {
    count += 1;
    index = text.indexOf(needle, index + needle.length);
  }
  return count;
}

export async function noOp(): Promise<void> {}

export function uniqueSorted(values: readonly string[]): string[] {
  return [...new Set(values)].sort(compareText);
}

export function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

export function errorText(error: unknown): string {
  return sanitizeInvestigationDiagnosticText(error);
}

function completedRenameLockFailure(
  completed: InvestigationRenameResult,
  error: InvestigationCollectionMutationLockError
): InvestigationRenameResult {
  const mutation =
    completed.mutation ??
    renameMutation(
      completed.changed ? "committed-cleanup-pending" : "no-change"
    );
  return {
    ...completed,
    status: "error",
    mutation,
    errors: [...completed.errors, errorText(error)],
    diagnostics: [...completed.diagnostics, { ...error.diagnostic, mutation }]
  };
}
