import fs from "node:fs/promises";
import path from "node:path";
import {
  diagnosticFromError,
  type InvestigationDiagnostic
} from "./diagnostics.ts";

type CollectionLockFileSystem = Readonly<{
  open?: typeof fs.open;
  rm?: typeof fs.rm;
}>;

export class InvestigationCollectionMutationLockError extends Error {
  readonly diagnostic: InvestigationDiagnostic;
  readonly operationCompleted: boolean;
  readonly operationResult: unknown;

  constructor(
    diagnostic: InvestigationDiagnostic,
    cause?: unknown,
    operation: Readonly<{ completed: boolean; result?: unknown }> = {
      completed: false
    }
  ) {
    super(
      `[${diagnostic.code}] ${diagnostic.reason}`,
      cause === undefined ? undefined : { cause }
    );
    this.name = "InvestigationCollectionMutationLockError";
    this.diagnostic = diagnostic;
    this.operationCompleted = operation.completed;
    this.operationResult = operation.result;
  }
}

export async function withInvestigationCollectionMutationLock<Result>(
  indexPath: string,
  operation: () => Promise<Result>,
  fileSystem: CollectionLockFileSystem = {}
): Promise<Result> {
  const lockPath = path.join(
    path.dirname(path.dirname(indexPath)),
    `.${path.basename(indexPath)}.mutation.lock`
  );
  let handle: Awaited<ReturnType<typeof fs.open>>;
  try {
    handle = await (fileSystem.open ?? fs.open)(lockPath, "wx");
  } catch (error) {
    throw new InvestigationCollectionMutationLockError(
      lockAcquisitionDiagnostic(lockPath, error),
      error
    );
  }
  let completed = false;
  let operationError: unknown;
  let value: Result | undefined;
  try {
    value = await operation();
    completed = true;
  } catch (error) {
    operationError = error;
  }
  const releaseErrors: unknown[] = [];
  try {
    await handle.close();
  } catch (error) {
    releaseErrors.push(error);
  }
  try {
    await (fileSystem.rm ?? fs.rm)(lockPath, { force: true });
  } catch (error) {
    releaseErrors.push(error);
  }
  if (releaseErrors.length > 0) {
    const cause =
      operationError === undefined
        ? new AggregateError(releaseErrors)
        : new AggregateError([...releaseErrors, operationError]);
    throw new InvestigationCollectionMutationLockError(
      diagnosticFromError({
        code: "investigation-report.collection-lock-release-failed",
        error: releaseErrors[0],
        reason:
          "the collection mutation lock could not be released after the transaction",
        recovery:
          "verify the collection state before retrying and remove a confirmed stale lock only with explicit authorization",
        target: lockPath
      }),
      cause,
      completed ? { completed: true, result: value } : { completed: false }
    );
  }
  if (!completed) throw operationError;
  return value as Result;
}

function lockAcquisitionDiagnostic(
  lockPath: string,
  error: unknown
): InvestigationDiagnostic {
  if (fileSystemErrorCode(error) === "EEXIST") {
    return {
      ...diagnosticFromError({
        code: "investigation-report.collection-lock-busy",
        error,
        reason: "another collection mutation lock already exists",
        recovery:
          "wait for or confirm the other collection transaction; if none is active, inspect the lock as a possible stale lock",
        target: lockPath
      }),
      causeCategory: "busy"
    };
  }
  const accessDenied =
    fileSystemErrorCode(error) === "EACCES" ||
    fileSystemErrorCode(error) === "EPERM";
  return diagnosticFromError({
    code: accessDenied
      ? "investigation-report.collection-lock-access-denied"
      : "investigation-report.collection-lock-unavailable",
    error,
    reason: accessDenied
      ? "the current process was denied access to the collection mutation lock"
      : "the collection mutation lock could not be acquired",
    recovery: accessDenied
      ? "grant the current process the required access to the collection directory, then retry the command"
      : "inspect the collection directory and retry after resolving the reported filesystem failure",
    target: lockPath
  });
}

function fileSystemErrorCode(error: unknown): string | null {
  if (typeof error !== "object" || error === null) return null;
  const code = Reflect.get(error, "code");
  return typeof code === "string" ? code : null;
}
