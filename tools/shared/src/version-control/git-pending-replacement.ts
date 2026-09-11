import fs from "node:fs/promises";
import type { GitRepositoryContext } from "./git-context.ts";
import {
  createPendingEntries,
  initializePendingIndexLock,
  listPendingEntries,
  readPendingEntries,
  removePendingIndexLock,
  resolvePendingIndexPath,
  writePendingEntries
} from "./git-pending.ts";
import {
  normalizePendingReplacement,
  pendingConflictError,
  pendingRecoveryError,
  pendingReplacementError,
  sameExpectedPendingEntries,
  sameGitIndexEntries,
  sameVersionControlFiles
} from "./git-pending-values.ts";
import type {
  ReplacePendingFilesOptions,
  ReplacePendingFilesResult,
  RevisionId
} from "./types.ts";

export async function replacePendingFiles(
  context: GitRepositoryContext,
  getCurrentRevision: () => Promise<RevisionId | null>,
  options: ReplacePendingFilesOptions
): Promise<ReplacePendingFilesResult> {
  const replacement = normalizePendingReplacement(options);
  let indexPath: string;
  try {
    indexPath = await resolvePendingIndexPath(context);
  } catch (error) {
    throw pendingReplacementError(replacement.pathScope, error);
  }
  const lockPath = indexPath + ".lock";
  let lock: Awaited<ReturnType<typeof fs.open>>;
  try {
    lock = await fs.open(lockPath, "wx");
  } catch (error) {
    if (isFileSystemError(error, "EEXIST"))
      throw pendingConflictError(replacement.pathScope, "busy", error);
    throw pendingReplacementError(replacement.pathScope, error);
  }
  let lockIsOpen = true;
  try {
    await assertExpectedRevision(
      getCurrentRevision,
      replacement.expectedRevision,
      replacement.pathScope
    );
    await initializePendingIndexLock({
      handle: lock,
      indexPath,
      lockPath,
      rootDirectory: context.rootDirectory
    });
    await lock.close();
    lockIsOpen = false;
    const previousEntries = await listPendingEntries(
      context,
      [replacement.pathScope],
      lockPath
    );
    assertExpectedEntries(
      previousEntries,
      replacement.expectedFiles,
      replacement.pathScope
    );
    const previousFiles = await readPendingEntries(context, previousEntries);
    assertExpectedFiles(
      previousFiles,
      replacement.expectedFiles,
      replacement.pathScope
    );
    const targetEntries = await createPendingEntries(
      context,
      replacement.files,
      previousEntries,
      previousFiles
    );
    const result = replacementResult(
      replacement.pathScope,
      replacement.files,
      previousFiles
    );
    if (sameGitIndexEntries(previousEntries, targetEntries)) {
      await removePendingIndexLock(lockPath);
      return result;
    }
    await context.hooks.beforePendingWrite?.();
    await writePendingEntries(
      context,
      previousEntries,
      targetEntries,
      lockPath
    );
    await context.hooks.afterPendingWrite?.();
    await assertWrittenEntries(
      context,
      lockPath,
      replacement.pathScope,
      targetEntries,
      replacement.files
    );
    await fs.rename(lockPath, indexPath);
    return result;
  } catch (error) {
    await recoverLock(
      lock,
      lockIsOpen,
      lockPath,
      context,
      replacement.pathScope
    );
    if (isPendingConflict(error)) throw error;
    throw pendingReplacementError(replacement.pathScope, error);
  } finally {
    if (lockIsOpen) await lock.close().catch(() => undefined);
  }
}

async function assertExpectedRevision(
  getCurrentRevision: () => Promise<RevisionId | null>,
  expected: RevisionId | null,
  pathScope: string
): Promise<void> {
  if ((await getCurrentRevision()) !== expected) {
    throw pendingConflictError(
      pathScope,
      "unknown",
      "the current revision differs from the expected revision"
    );
  }
}

function assertExpectedEntries(
  entries: Parameters<typeof sameExpectedPendingEntries>[0],
  expected: Parameters<typeof sameExpectedPendingEntries>[1] | null,
  pathScope: string
): void {
  if (expected !== null && !sameExpectedPendingEntries(entries, expected)) {
    throw pendingConflictError(
      pathScope,
      "unknown",
      "the pending range differs from the expected file set"
    );
  }
}

function assertExpectedFiles(
  files: Parameters<typeof sameVersionControlFiles>[0],
  expected: Parameters<typeof sameVersionControlFiles>[1] | null,
  pathScope: string
): void {
  if (expected !== null && !sameVersionControlFiles(files, expected)) {
    throw pendingConflictError(
      pathScope,
      "unknown",
      "the pending range bytes differ from the expected file set"
    );
  }
}

async function assertWrittenEntries(
  context: GitRepositoryContext,
  lockPath: string,
  pathScope: string,
  targetEntries: Parameters<typeof sameGitIndexEntries>[1],
  files: Parameters<typeof sameVersionControlFiles>[1]
): Promise<void> {
  const writtenEntries = await listPendingEntries(
    context,
    [pathScope],
    lockPath
  );
  if (!sameGitIndexEntries(writtenEntries, targetEntries)) {
    throw pendingReplacementError(
      pathScope,
      "the pending range did not match the written target"
    );
  }
  const writtenFiles = await readPendingEntries(context, writtenEntries);
  if (!sameVersionControlFiles(writtenFiles, files)) {
    throw pendingReplacementError(
      pathScope,
      "the pending range bytes did not match the written target"
    );
  }
}

function replacementResult(
  pathScope: string,
  files: readonly { path: string }[],
  previousFiles: readonly { path: string }[]
): ReplacePendingFilesResult {
  return {
    pathScope,
    pendingPaths: files.map((file) => file.path),
    previousPaths: previousFiles.map((file) => file.path)
  };
}

async function recoverLock(
  lock: Awaited<ReturnType<typeof fs.open>>,
  lockIsOpen: boolean,
  lockPath: string,
  context: GitRepositoryContext,
  pathScope: string
): Promise<void> {
  if (lockIsOpen) {
    try {
      await lock.close();
    } catch (error) {
      throw pendingRecoveryError(pathScope, error);
    }
  }
  try {
    await context.hooks.beforePendingRecovery?.();
    await removePendingIndexLock(lockPath);
  } catch (error) {
    throw pendingRecoveryError(pathScope, error);
  }
}

function isPendingConflict(error: unknown): error is { code: string } {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "pending-conflict"
  );
}

function isFileSystemError(error: unknown, code: string): boolean {
  return error instanceof Error && "code" in error && error.code === code;
}
