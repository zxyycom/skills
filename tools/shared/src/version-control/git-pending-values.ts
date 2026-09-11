import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import { runGitForExitCode } from "./git-command.ts";
import {
  classifyVersionControlCause,
  VersionControlError,
  type VersionControlErrorCauseCategory
} from "./errors.ts";
import {
  defaultGitBlobMode,
  operationError,
  type GitIndexEntry
} from "./git-core.ts";
import { normalizeRepositoryPath } from "./repository-path.ts";
import type {
  ReplacePendingFilesOptions,
  RevisionId,
  VersionControlFile
} from "./types.ts";

const objectIdPattern = /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/u;

export type NormalizedPendingReplacementFile = Readonly<{
  data: Buffer;
  path: string;
}>;
export type NormalizedPendingReplacement = Readonly<{
  expectedFiles: readonly NormalizedPendingReplacementFile[] | null;
  expectedRevision: RevisionId | null;
  files: readonly NormalizedPendingReplacementFile[];
  pathScope: string;
}>;

export function normalizePendingReplacement(
  options: ReplacePendingFilesOptions
): NormalizedPendingReplacement {
  const pathScope = normalizeRepositoryPath(options.pathScope);
  if (
    options.expectedRevision !== null &&
    !objectIdPattern.test(options.expectedRevision)
  ) {
    throw pendingConflictError(
      pathScope,
      "unknown",
      "the expected revision is not a valid object identifier"
    );
  }
  return {
    expectedFiles:
      options.expectedFiles === undefined
        ? null
        : normalizePendingFiles(options.expectedFiles, pathScope, "expected"),
    expectedRevision: options.expectedRevision,
    files: normalizePendingFiles(options.files, pathScope, "replacement"),
    pathScope
  };
}

export function sameVersionControlFiles(
  left: readonly VersionControlFile[],
  right: readonly { data: Uint8Array; path: string }[]
): boolean {
  return (
    left.length === right.length &&
    left.every((file, index) => {
      const expected = right[index];
      return (
        expected !== undefined &&
        file.path === expected.path &&
        Buffer.from(file.data).equals(Buffer.from(expected.data))
      );
    })
  );
}

export function sameExpectedPendingEntries(
  entries: readonly GitIndexEntry[],
  expected: readonly { path: string }[]
): boolean {
  return (
    entries.length === expected.length &&
    entries.every(
      (entry, index) =>
        entry.mode === defaultGitBlobMode &&
        entry.stage === 0 &&
        entry.path === expected[index]?.path
    )
  );
}

export function sameGitIndexEntries(
  left: readonly GitIndexEntry[],
  right: readonly GitIndexEntry[]
): boolean {
  return (
    left.length === right.length &&
    left.every((entry, index) => {
      const expected = right[index];
      return expected !== undefined && sameGitIndexEntry(entry, expected);
    })
  );
}

function sameGitIndexEntry(left: GitIndexEntry, right: GitIndexEntry): boolean {
  return [
    left.mode === right.mode,
    left.objectId === right.objectId,
    left.path === right.path,
    left.stage === right.stage
  ].every(Boolean);
}

export function pendingReplacementError(
  pathScope: string,
  cause?: unknown
): VersionControlError {
  return new VersionControlError({
    cause: errorCause(cause),
    causeCategory: classifyVersionControlCause(cause, "command-failed"),
    code: "pending-replacement-failed",
    detail: errorDetail(cause),
    operation: "replace a pending range",
    target: pathScope
  });
}

export function pendingConflictError(
  pathScope: string,
  causeCategory: VersionControlErrorCauseCategory = "unknown",
  cause?: unknown
): VersionControlError {
  return new VersionControlError({
    cause: errorCause(cause),
    causeCategory,
    code: "pending-conflict",
    detail: errorDetail(cause),
    operation: "verify a pending replacement",
    target: pathScope
  });
}

export function pendingRecoveryError(
  pathScope: string,
  cause?: unknown
): VersionControlError {
  return new VersionControlError({
    cause: errorCause(cause),
    causeCategory: classifyVersionControlCause(cause, "unknown"),
    code: "pending-recovery-failed",
    detail: errorDetail(cause),
    operation: "recover a pending range",
    target: pathScope
  });
}

function normalizePendingFiles(
  input: readonly VersionControlFile[],
  pathScope: string,
  role: "expected" | "replacement"
): NormalizedPendingReplacementFile[] {
  const seen = new Set<string>();
  return input
    .map((file) => {
      const filePath = normalizeRepositoryPath(file.path);
      if (!isWithinScope(filePath, pathScope))
        throw invalidReplacementPath(
          pathScope,
          `a ${role} file is outside the requested pending range`
        );
      if (seen.has(filePath))
        throw invalidReplacementPath(
          pathScope,
          `a ${role} file path is duplicated`
        );
      seen.add(filePath);
      return { data: Buffer.from(file.data), path: filePath };
    })
    .sort((left, right) => left.path.localeCompare(right.path));
}

function invalidReplacementPath(
  pathScope: string,
  detail: string
): VersionControlError {
  return new VersionControlError({
    causeCategory: "unknown",
    code: "invalid-path",
    detail,
    operation: "validate pending replacement paths",
    target: pathScope
  });
}

function isWithinScope(filePath: string, pathScope: string): boolean {
  return filePath === pathScope || filePath.startsWith(pathScope + "/");
}
export async function createEmptyPendingIndex(
  rootDirectory: string,
  lockPath: string
): Promise<Buffer> {
  const temporary = lockPath + `.empty-${process.pid}-${randomUUID()}`;
  try {
    const result = await runGitForExitCode(
      rootDirectory,
      ["read-tree", "--empty"],
      pendingIndexEnvironment(temporary)
    );
    if (result.exitCode !== 0)
      throw operationError(
        "initialize an empty pending snapshot",
        result.stderr,
        { causeCategory: "command-failed" }
      );
    return await fs.readFile(temporary);
  } finally {
    await removeFileIfPresent(temporary + ".lock");
    await removeFileIfPresent(temporary);
  }
}
function pendingIndexEnvironment(indexPath: string): NodeJS.ProcessEnv {
  return { ...process.env, GIT_INDEX_FILE: indexPath };
}
function isFileSystemError(error: unknown, code: string): boolean {
  return error instanceof Error && "code" in error && error.code === code;
}
async function removeFileIfPresent(filePath: string): Promise<void> {
  try {
    await fs.unlink(filePath);
  } catch (error) {
    if (!isFileSystemError(error, "ENOENT")) throw error;
  }
}
function errorCause(cause: unknown): unknown {
  return cause instanceof VersionControlError ? (cause.cause ?? cause) : cause;
}
function errorDetail(cause: unknown): unknown {
  return cause instanceof VersionControlError ? cause.detail : cause;
}
