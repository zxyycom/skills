import { sameBytes } from "../../../node/bytes.ts";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import { VersionControlError } from "../../errors.ts";
import { readGitBlobs } from "../git-blob-batch.ts";
import { runGitWithInputForExitCode } from "../git-command.ts";
import {
  fileKindForGitMode,
  gitBlobModes,
  gitModeForFileKind,
  type GitIndexEntry,
  normalizePathScopes,
  operationError,
  parseGitIndexEntries,
  parseObjectId
} from "../git-core.ts";
import type { GitRepositoryContext } from "../git-context.ts";
import { queryGitPathspecs } from "../git-pathspec-query.ts";
import { normalizeRepositoryPaths } from "../../repository-path.ts";
import type {
  ListVersionControlFilesOptions,
  VersionControlFile
} from "../../types.ts";
import {
  createEmptyPendingIndex,
  type NormalizedPendingReplacementFile
} from "./git-pending-values.ts";

export async function readPendingFiles(
  context: GitRepositoryContext,
  options: ListVersionControlFilesOptions = {}
): Promise<VersionControlFile[]> {
  return await readPendingEntries(
    context,
    await listPendingEntries(context, options.pathScopes ?? [])
  );
}

export async function listPendingEntries(
  context: GitRepositoryContext,
  pathScopes: readonly string[],
  pendingIndexPath?: string
): Promise<GitIndexEntry[]> {
  const scopes = normalizePathScopes(pathScopes);
  try {
    return parseGitIndexEntries(
      await queryGitPathspecs(
        context,
        ["ls-files", "--stage", "-z", "--"],
        scopes,
        pendingIndexPath === undefined
          ? undefined
          : pendingIndexEnvironment(pendingIndexPath)
      )
    );
  } catch (cause) {
    if (cause instanceof VersionControlError) throw cause;
    throw operationError("list files in the pending snapshot", cause, {
      causeCategory: "command-failed"
    });
  }
}

export async function readPendingEntries(
  context: GitRepositoryContext,
  entries: readonly GitIndexEntry[]
): Promise<VersionControlFile[]> {
  validatePendingEntries(entries);
  let blobs: ReadonlyMap<string, Buffer>;
  try {
    blobs = await readGitBlobs(
      context.rootDirectory,
      entries.map((entry) => entry.objectId)
    );
  } catch (cause) {
    if (cause instanceof VersionControlError) throw cause;
    throw operationError("read files from the pending snapshot", cause, {
      causeCategory: "command-failed"
    });
  }
  return entries.map((entry) => {
    const data = blobs.get(entry.objectId);
    if (data === undefined)
      throw operationError("read a file from the pending snapshot", undefined, {
        target: entry.path
      });
    return { data, kind: fileKindForGitMode(entry.mode), path: entry.path };
  });
}

export function validatePendingEntries(
  entries: readonly GitIndexEntry[]
): void {
  const conflicts = normalizeRepositoryPaths(
    entries.filter((entry) => entry.stage !== 0).map((entry) => entry.path)
  );
  if (conflicts.length > 0)
    throw operationError(
      "resolve pending content conflicts before reading",
      undefined,
      { target: "pending snapshot" }
    );
  assertUniquePaths(entries);
  const unsupported = entries.find((entry) => !gitBlobModes.has(entry.mode));
  if (unsupported !== undefined)
    throw operationError("read a non-file pending entry", undefined, {
      target: unsupported.path
    });
}

export async function resolvePendingIndexPath(
  context: GitRepositoryContext
): Promise<string> {
  let output: string;
  try {
    output = await context.git.raw(["rev-parse", "--git-path", "index"]);
  } catch (error) {
    throw operationError("locate the pending snapshot", error, {
      causeCategory: "command-failed"
    });
  }
  const indexPath = output.trim();
  if (indexPath.length === 0 || indexPath.includes("\0")) {
    throw operationError(
      "locate the pending snapshot",
      "the version-control tool returned an invalid pending snapshot path",
      { causeCategory: "command-failed" }
    );
  }
  return await import("node:path").then(({ default: path }) =>
    path.resolve(context.rootDirectory, indexPath)
  );
}

export async function initializePendingIndexLock(
  options: Readonly<{
    handle: Awaited<ReturnType<typeof fs.open>>;
    indexPath: string;
    lockPath: string;
    rootDirectory: string;
  }>
): Promise<void> {
  let indexData: Buffer;
  try {
    indexData = await fs.readFile(options.indexPath);
  } catch (error) {
    if (!isFileSystemError(error, "ENOENT")) throw error;
    indexData = await createEmptyPendingIndex(
      options.rootDirectory,
      options.lockPath
    );
  }
  await options.handle.writeFile(indexData);
  await options.handle.sync();
}

export async function removePendingIndexLock(lockPath: string): Promise<void> {
  await removeFileIfPresent(lockPath + ".lock");
  await fs.unlink(lockPath);
}

export async function createPendingEntries(
  context: GitRepositoryContext,
  files: readonly NormalizedPendingReplacementFile[],
  currentEntries: readonly GitIndexEntry[],
  currentFiles: readonly VersionControlFile[]
): Promise<GitIndexEntry[]> {
  const currentFilesByPath = new Map(
    currentFiles.map((file) => [file.path, file])
  );
  const reusableEntries = new Map(
    currentEntries
      .filter((entry) => entry.stage === 0)
      .map((entry) => [entry.path, entry])
  );
  const groups: Array<{ data: Buffer; objectId?: string }> = [];
  const groupsByDigest = new Map<string, number[]>();
  const targets = files.map((file) => {
    const reusable = reusableEntries.get(file.path);
    const current = currentFilesByPath.get(file.path);
    if (
      reusable !== undefined &&
      reusable.mode === gitModeForFileKind(file.kind) &&
      current !== undefined &&
      sameBytes(current.data, file.data)
    )
      return { file, reusable };
    const digest = createHash("sha256").update(file.data).digest("hex");
    const bucket = groupsByDigest.get(digest) ?? [];
    let group = bucket.find((index) =>
      sameBytes(groups[index]!.data, file.data)
    );
    if (group === undefined) {
      group = groups.length;
      groups.push({ data: file.data });
      bucket.push(group);
      groupsByDigest.set(digest, bucket);
    }
    return { file, group };
  });
  await writeUniquePendingBlobs(context, groups);
  return targets.map((target) => {
    if (target.reusable !== undefined) return target.reusable;
    return {
      mode: gitModeForFileKind(target.file.kind),
      objectId: groups[target.group!]!.objectId!,
      path: target.file.path,
      stage: 0
    };
  });
}

/** Stop dispatch at the first observed failure, then settle every active Git write. */
async function writeUniquePendingBlobs(
  context: GitRepositoryContext,
  groups: Array<{ data: Buffer; objectId?: string }>
): Promise<void> {
  const concurrency = 4;
  let next = 0;
  let failed = false;
  let firstError: unknown;
  async function worker(): Promise<void> {
    while (!failed && next < groups.length) {
      const group = groups[next++]!;
      try {
        group.objectId = await writeGitBlob(context, group.data);
      } catch (error) {
        if (!failed) {
          failed = true;
          firstError = error;
        }
      }
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(concurrency, groups.length) }, worker)
  );
  if (failed) throw firstError;
}

export async function writePendingEntries(
  context: GitRepositoryContext,
  currentEntries: readonly GitIndexEntry[],
  targetEntries: readonly GitIndexEntry[],
  pendingIndexPath: string
): Promise<void> {
  const records = pendingIndexRecords(currentEntries, targetEntries);
  if (records === null) return;
  await updatePendingIndex(context, pendingIndexPath, records);
}

export function pendingIndexRecords(
  currentEntries: readonly GitIndexEntry[],
  targetEntries: readonly GitIndexEntry[]
): string | null {
  const removed = removedEntries(currentEntries, targetEntries);
  const currentByPath = new Map(
    currentEntries.map((entry) => [entry.path, entry])
  );
  const changed = targetEntries.filter((entry) => {
    const current = currentByPath.get(entry.path);
    return (
      current === undefined ||
      current.mode !== entry.mode ||
      current.objectId !== entry.objectId ||
      current.stage !== entry.stage
    );
  });
  const objectIdLength = objectIdLengthFor(changed, removed);
  return objectIdLength === null
    ? null
    : recordsForEntries(removed, changed, objectIdLength);
}

function objectIdLengthFor(
  target: readonly GitIndexEntry[],
  removed: readonly GitIndexEntry[]
): number | null {
  const entry = target[0] ?? removed[0];
  return entry === undefined ? null : entry.objectId.length;
}

function removedEntries(
  current: readonly GitIndexEntry[],
  target: readonly GitIndexEntry[]
): GitIndexEntry[] {
  const paths = new Set(target.map((entry) => entry.path));
  return current.filter((entry) => !paths.has(entry.path));
}

function recordsForEntries(
  removed: readonly GitIndexEntry[],
  target: readonly GitIndexEntry[],
  objectIdLength: number
): string {
  const zero = "0".repeat(objectIdLength);
  return [
    ...removed.map((entry) => `0 ${zero}\t${entry.path}\0`),
    ...target.map((entry) => `${entry.mode} ${entry.objectId}\t${entry.path}\0`)
  ].join("");
}

async function updatePendingIndex(
  context: GitRepositoryContext,
  indexPath: string,
  records: string
): Promise<void> {
  let result;
  try {
    result = await runGitWithInputForExitCode(
      context.rootDirectory,
      ["update-index", "-z", "--index-info"],
      Buffer.from(records, "utf8"),
      pendingIndexEnvironment(indexPath)
    );
  } catch (error) {
    throw operationError("write pending files", error, {
      causeCategory: "command-failed"
    });
  }
  if (result.exitCode !== 0)
    throw operationError("write pending files", result.stderr, {
      causeCategory: "command-failed"
    });
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

function assertUniquePaths(entries: readonly GitIndexEntry[]): void {
  const seen = new Set<string>();
  for (const entry of entries) {
    if (seen.has(entry.path)) {
      throw operationError("validate pending snapshot paths", undefined, {
        target: entry.path
      });
    }
    seen.add(entry.path);
  }
}

async function writeGitBlob(
  context: GitRepositoryContext,
  data: Uint8Array
): Promise<string> {
  let result;
  try {
    result = await runGitWithInputForExitCode(
      context.rootDirectory,
      ["hash-object", "-w", "--stdin"],
      data
    );
  } catch (error) {
    throw operationError("store a pending file", error, {
      causeCategory: "command-failed"
    });
  }
  if (result.exitCode !== 0) {
    throw operationError("store a pending file", result.stderr, {
      causeCategory: "command-failed"
    });
  }
  return parseObjectId(result.stdout, "pending file");
}
