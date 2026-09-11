import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
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

export function renameMutation(
  outcome: InvestigationMutationDiagnostic["outcome"]
): InvestigationMutationDiagnostic {
  return { outcome, scope: renameScope };
}

export async function readRegularText(filePath: string): Promise<string> {
  const entry = await fs.lstat(filePath);
  if (entry.isSymbolicLink() || !entry.isFile()) {
    throw new Error("must be a regular non-symbolic-link file");
  }
  return await fs.readFile(filePath, "utf8");
}

export async function writeTextAtomically(
  targetPath: string,
  text: string
): Promise<void> {
  await readRegularText(targetPath);
  const temporaryPath = `${targetPath}.${process.pid}.${randomUUID()}.tmp`;
  const handle = await fs.open(temporaryPath, "wx", 0o600);
  try {
    await handle.writeFile(text, "utf8");
  } finally {
    await handle.close();
  }
  try {
    await fs.rename(temporaryPath, targetPath);
  } catch (error) {
    await fs.rm(temporaryPath, { force: true }).catch(() => undefined);
    throw error;
  }
}

export async function writeNewText(
  targetPath: string,
  text: string
): Promise<void> {
  await fs.mkdir(path.dirname(targetPath), { recursive: true });
  const file = await fs.open(targetPath, "wx", 0o600);
  try {
    await file.writeFile(text, "utf8");
  } finally {
    await file.close();
  }
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
