import { VersionControlError } from "./errors.ts";
import { readGitBlobs } from "./git-blob-batch.ts";
import { runGitForExitCode } from "./git-command.ts";
import {
  assertRevisionInput,
  gitBlobModes,
  normalizePathScopes,
  operationError,
  parseNullSeparatedPaths,
  parseObjectId
} from "./git-core.ts";
import type { GitRepositoryContext } from "./git-context.ts";
import { parseGitTreeEntries, type GitTreeEntry } from "./git-tree-entry.ts";
import { normalizeRepositoryPath } from "./repository-path.ts";
import type {
  ListVersionControlFilesOptions,
  RevisionId,
  VersionControlFile
} from "./types.ts";

export async function getCurrentRevision(
  context: GitRepositoryContext
): Promise<RevisionId | null> {
  try {
    return parseObjectId(
      await context.git.revparse(["--verify", "--quiet", "HEAD^{commit}"]),
      "current revision"
    );
  } catch {
    const symbolicHead = await readSymbolicHead(context);
    const state = await runGitState(context, [
      "show-ref",
      "--verify",
      "--quiet",
      symbolicHead
    ]);
    if (state.exitCode === 1 && state.stderr.trim().length === 0) return null;
    throw operationError("resolve the current revision", state.stderr, {
      causeCategory: "command-failed"
    });
  }
}

export async function resolveRevision(
  context: GitRepositoryContext,
  revision: string
): Promise<RevisionId> {
  assertRevisionInput(revision);
  const result = await runGitState(
    context,
    [
      "rev-parse",
      "--verify",
      "--quiet",
      "--end-of-options",
      `${revision}^{commit}`
    ],
    "requested revision"
  );
  if (result.exitCode === 0)
    return parseObjectId(result.stdout, `revision ${revision}`);
  if (result.exitCode === 1 && result.stderr.trim().length === 0) {
    throw new VersionControlError({
      causeCategory: "revision-unavailable",
      code: "revision-not-found",
      operation: "resolve a revision",
      target: "requested revision"
    });
  }
  throw operationError("resolve a revision", result.stderr, {
    causeCategory: "command-failed",
    target: "requested revision"
  });
}

export async function listRevisionFiles(
  context: GitRepositoryContext,
  revision: RevisionId,
  options: ListVersionControlFilesOptions = {}
): Promise<string[]> {
  const resolved = await resolveRevision(context, revision);
  const scopes = pathspecs(options.pathScopes);
  try {
    return parseNullSeparatedPaths(
      await context.git.raw([
        "ls-tree",
        "-r",
        "-z",
        "--name-only",
        resolved,
        "--",
        ...scopes
      ])
    );
  } catch (cause) {
    if (cause instanceof VersionControlError) throw cause;
    throw operationError("list files in the revision snapshot", cause, {
      causeCategory: "command-failed"
    });
  }
}

export async function readRevisionFile(
  context: GitRepositoryContext,
  revision: RevisionId,
  filePath: string
): Promise<VersionControlFile | null> {
  const normalizedPath = normalizeRepositoryPath(filePath);
  const entries = await listTreeEntries(context, {
    revision,
    scopes: [normalizedPath],
    recursive: false,
    operation: "locate a file in a revision",
    target: normalizedPath
  });
  if (entries.length === 0) return null;
  const entry = entries[0];
  if (
    entries.length !== 1 ||
    entry === undefined ||
    !isReadableBlob(entry) ||
    entry.path !== normalizedPath
  ) {
    throw operationError("validate a revision file entry", undefined, {
      target: normalizedPath
    });
  }
  const data = await readBlob(
    context,
    entry.objectId,
    "read a file from a revision",
    normalizedPath
  );
  return { data, path: normalizedPath };
}

export async function readRevisionFiles(
  context: GitRepositoryContext,
  revision: RevisionId,
  options: ListVersionControlFilesOptions = {}
): Promise<VersionControlFile[]> {
  const entries = await listTreeEntries(context, {
    revision,
    scopes: options.pathScopes ?? [],
    recursive: true,
    operation: "locate files in a revision"
  });
  const unsupported = entries.find((entry) => !isReadableBlob(entry));
  if (unsupported !== undefined) {
    throw operationError("validate a revision file entry", undefined, {
      target: unsupported.path
    });
  }
  let blobs: ReadonlyMap<string, Buffer>;
  try {
    blobs = await readGitBlobs(
      context.rootDirectory,
      entries.map((entry) => entry.objectId)
    );
  } catch (error) {
    throw operationError("read files from a revision", error, {
      causeCategory: "command-failed"
    });
  }
  const files = entries
    .map((entry) => {
      const data = blobs.get(entry.objectId);
      if (data === undefined)
        throw operationError("read a file from a revision", undefined, {
          target: entry.path
        });
      return { data, path: entry.path };
    })
    .sort((left, right) => left.path.localeCompare(right.path));
  if (files.some((file, index) => file.path === files[index - 1]?.path)) {
    throw operationError("validate revision file entries");
  }
  return files;
}

async function readSymbolicHead(
  context: GitRepositoryContext
): Promise<string> {
  let head: string;
  try {
    head = (await context.git.raw(["symbolic-ref", "--quiet", "HEAD"])).trim();
  } catch (error) {
    throw operationError("resolve the current revision", error, {
      causeCategory: "command-failed"
    });
  }
  if (head.length === 0)
    throw operationError(
      "resolve the current revision",
      "The version-control tool returned an empty symbolic HEAD.",
      { causeCategory: "command-failed" }
    );
  return head;
}

async function runGitState(
  context: GitRepositoryContext,
  args: readonly string[],
  target?: string
) {
  try {
    return await runGitForExitCode(context.rootDirectory, args);
  } catch (error) {
    throw operationError("resolve a revision", error, {
      causeCategory: "command-failed",
      target
    });
  }
}

type TreeQuery = Readonly<{
  operation: string;
  recursive: boolean;
  revision: RevisionId;
  scopes: readonly string[];
  target?: string;
}>;

async function listTreeEntries(
  context: GitRepositoryContext,
  query: TreeQuery
): Promise<GitTreeEntry[]> {
  const resolved = await resolveRevision(context, query.revision);
  const pathspecArguments = pathspecs(query.scopes);
  try {
    return parseGitTreeEntries(
      await context.git.raw([
        "ls-tree",
        ...(query.recursive ? ["-r", "-z"] : ["-z"]),
        resolved,
        "--",
        ...pathspecArguments
      ])
    );
  } catch (error) {
    throw operationError(query.operation, error, {
      causeCategory: "command-failed",
      target: query.target
    });
  }
}

async function readBlob(
  context: GitRepositoryContext,
  objectId: string,
  operation: string,
  target: string
): Promise<Buffer> {
  try {
    const data = (await readGitBlobs(context.rootDirectory, [objectId])).get(
      objectId
    );
    if (data === undefined)
      throw operationError(operation, undefined, { target });
    return data;
  } catch (error) {
    if (error instanceof VersionControlError) throw error;
    throw operationError(operation, error, {
      causeCategory: "command-failed",
      target
    });
  }
}

function pathspecs(scopes: readonly string[] | undefined): string[] {
  return normalizePathScopes(scopes ?? []).map((scope) => `:(literal)${scope}`);
}

function isReadableBlob(entry: GitTreeEntry): boolean {
  return entry.objectType === "blob" && gitBlobModes.has(entry.mode);
}
