import fs from "node:fs/promises";
import { VersionControlError } from "./errors.ts";
import { readGitBlobs } from "./git-blob-batch.ts";
import {
  runGitForExitCode,
  runGitWithInputForExitCode
} from "./git-command.ts";
import {
  defaultGitBlobMode,
  type GitIndexEntry,
  normalizePathScopes,
  operationError,
  parseGitIndexEntries,
  parseObjectId
} from "./git-core.ts";
import type { GitRepositoryContext } from "./git-context.ts";
import { normalizeRepositoryPaths } from "./repository-path.ts";
import type {
  ListVersionControlFilesOptions,
  VersionControlFile
} from "./types.ts";
import {
  createEmptyPendingIndex,
  sameGitIndexEntries,
  type NormalizedPendingReplacementFile
} from "./git-pending-values.ts";

const readablePendingModes = new Set(["100644", "100755", "120000"]);

export async function readPendingFiles(
  context: GitRepositoryContext,
  options: ListVersionControlFilesOptions = {}
): Promise<VersionControlFile[]> {
  return await readPendingEntries(
    context,
    await listPendingEntries(
      context,
      normalizePathScopes(options.pathScopes ?? [])
    )
  );
}

export async function listPendingEntries(
  context: GitRepositoryContext,
  pathScopes: readonly string[],
  pendingIndexPath?: string
): Promise<GitIndexEntry[]> {
  const args = ["ls-files", "--stage", "-z", "--", ...pathSpecs(pathScopes)];
  try {
    if (pendingIndexPath === undefined)
      return parseGitIndexEntries(await context.git.raw(args));
    const result = await runGitForExitCode(
      context.rootDirectory,
      args,
      pendingIndexEnvironment(pendingIndexPath)
    );
    if (result.exitCode !== 0)
      throw operationError(
        "list files in the pending snapshot",
        result.stderr,
        { causeCategory: "command-failed" }
      );
    return parseGitIndexEntries(result.stdout);
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
  const unsupported = entries.find(
    (entry) => !readablePendingModes.has(entry.mode)
  );
  if (unsupported !== undefined)
    throw operationError("read a non-file pending entry", undefined, {
      target: unsupported.path
    });
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
    return { data, path: entry.path };
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
      .filter((entry) => entry.stage === 0 && entry.mode === defaultGitBlobMode)
      .map((entry) => [entry.path, entry])
  );
  return await Promise.all(
    files.map(async (file) => {
      const reusable = reusableEntries.get(file.path);
      const current = currentFilesByPath.get(file.path);
      if (
        reusable !== undefined &&
        current !== undefined &&
        Buffer.from(current.data).equals(file.data)
      )
        return reusable;
      return {
        mode: defaultGitBlobMode,
        objectId: await writeGitBlob(context, file.data),
        path: file.path,
        stage: 0
      };
    })
  );
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

function pendingIndexRecords(
  currentEntries: readonly GitIndexEntry[],
  targetEntries: readonly GitIndexEntry[]
): string | null {
  const removed = removedEntries(currentEntries, targetEntries);
  if (hasNoPendingChange(removed, currentEntries, targetEntries)) return null;
  const objectIdLength = objectIdLengthFor(targetEntries, removed);
  return objectIdLength === null
    ? null
    : recordsForEntries(removed, targetEntries, objectIdLength);
}

function hasNoPendingChange(
  removed: readonly GitIndexEntry[],
  current: readonly GitIndexEntry[],
  target: readonly GitIndexEntry[]
): boolean {
  return removed.length === 0 && sameGitIndexEntries(current, target);
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

function pathSpecs(scopes: readonly string[]): string[] {
  return scopes.map((scope) => `:(literal)${scope}`);
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
