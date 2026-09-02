import fs from "node:fs/promises";
import path from "node:path";
import { isFileSystemError } from "../../shared/src/node/filesystem.ts";

export type DecisionCollectionLockFailureKind =
  | "access-denied"
  | "busy"
  | "release-failed"
  | "unavailable";

export class DecisionCollectionLockError extends Error {
  readonly kind: DecisionCollectionLockFailureKind;
  readonly lockPath: string;
  readonly operationResult: unknown;

  constructor(options: {
    cause: unknown;
    kind: DecisionCollectionLockFailureKind;
    lockPath: string;
    operationResult?: unknown;
  }) {
    super(lockErrorMessage(options.kind, options.lockPath), {
      cause: options.cause
    });
    this.name = "DecisionCollectionLockError";
    this.kind = options.kind;
    this.lockPath = options.lockPath;
    this.operationResult = options.operationResult;
  }
}

export async function withDecisionCollectionMutationLock<Result>(
  indexPath: string,
  operation: () => Promise<Result>
): Promise<Result> {
  const lockPath = path.join(
    path.dirname(path.dirname(indexPath)),
    `.${path.basename(indexPath)}.mutation.lock`
  );
  let handle: Awaited<ReturnType<typeof fs.open>>;
  try {
    handle = await fs.open(lockPath, "wx");
  } catch (error) {
    throw new DecisionCollectionLockError({
      cause: error,
      kind: lockFailureKind(error),
      lockPath
    });
  }
  let operationError: unknown;
  let operationFailed = false;
  let result: Result | null = null;
  try {
    result = await operation();
  } catch (error) {
    operationError = error;
    operationFailed = true;
  }
  const released = await releaseLock(handle, lockPath);
  if (released.status === "error") {
    throw new DecisionCollectionLockError({
      cause: !operationFailed
        ? released.error
        : new AggregateError(
            [operationError, released.error],
            "Decision transaction and lock release both failed"
          ),
      kind: "release-failed",
      lockPath,
      operationResult: result
    });
  }
  if (operationFailed) {
    throw operationError;
  }
  return result as Result;
}

async function releaseLock(
  handle: Awaited<ReturnType<typeof fs.open>>,
  lockPath: string
): Promise<{ status: "ok" } | { error: unknown; status: "error" }> {
  const errors: unknown[] = [];
  try {
    await handle.close();
  } catch (error) {
    errors.push(error);
  }
  try {
    await fs.rm(lockPath);
  } catch (error) {
    errors.push(error);
  }
  if (errors.length === 0) {
    return { status: "ok" };
  }
  return {
    error:
      errors.length === 1
        ? errors[0]
        : new AggregateError(errors, "Decision collection lock release failed"),
    status: "error"
  };
}

function lockFailureKind(error: unknown): DecisionCollectionLockFailureKind {
  if (isFileSystemError(error, "EEXIST")) {
    return "busy";
  }
  if (isFileSystemError(error, "EACCES") || isFileSystemError(error, "EPERM")) {
    return "access-denied";
  }
  return "unavailable";
}

function lockErrorMessage(
  kind: DecisionCollectionLockFailureKind,
  lockPath: string
): string {
  switch (kind) {
    case "busy":
      return "Decision collection mutation lock already exists: " + lockPath;
    case "access-denied":
      return (
        "Access was denied while acquiring the decision collection mutation lock: " +
        lockPath
      );
    case "release-failed":
      return (
        "Decision collection mutation lock could not be released: " + lockPath
      );
    case "unavailable":
      return (
        "Decision collection mutation lock could not be acquired: " + lockPath
      );
  }
}
