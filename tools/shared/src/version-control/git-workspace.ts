import { VersionControlError } from "./errors.ts";
import {
  normalizePathScopes,
  operationError,
  parseNullSeparatedPaths
} from "./git-core.ts";
import type { GitRepositoryContext } from "./git-context.ts";
import { getCurrentRevision, resolveRevision } from "./git-revision.ts";
import { normalizeRepositoryPaths } from "./repository-path.ts";
import type {
  ListChangedPathsOptions,
  ListPendingChangedPathsOptions,
  ListVersionControlFilesOptions
} from "./types.ts";

export async function listWorkspaceFiles(
  context: GitRepositoryContext,
  options: ListVersionControlFilesOptions = {}
): Promise<string[]> {
  const scopes = pathspecs(options.pathScopes);
  try {
    return parseNullSeparatedPaths(
      await context.git.raw([
        "ls-files",
        "--cached",
        "--others",
        "--exclude-standard",
        "-z",
        "--",
        ...scopes
      ])
    );
  } catch (error) {
    throw operationError(
      "list version-control-visible workspace files",
      error,
      { causeCategory: "command-failed" }
    );
  }
}

export async function listWorkspaceChangedPaths(
  context: GitRepositoryContext
): Promise<string[]> {
  try {
    const status = await context.git.status([
      "--untracked-files=all",
      "--no-renames"
    ]);
    return normalizeRepositoryPaths(status.files.map((file) => file.path));
  } catch (error) {
    throw operationError("list changed workspace paths", error, {
      causeCategory: "command-failed"
    });
  }
}

export async function listChangedPaths(
  context: GitRepositoryContext,
  options: ListChangedPathsOptions
): Promise<string[]> {
  const from = await resolveRevision(context, options.from);
  const to =
    options.to === undefined
      ? await getCurrentRevision(context)
      : await resolveRevision(context, options.to);
  if (to === null)
    throw new VersionControlError({
      causeCategory: "revision-unavailable",
      code: "revision-not-found",
      operation: "read the current revision",
      target: "current revision"
    });
  if (from === to) return [];
  try {
    return parseNullSeparatedPaths(
      await context.git.raw([
        "diff",
        "--name-only",
        "--no-renames",
        "-z",
        from,
        to,
        "--"
      ])
    );
  } catch (error) {
    throw operationError("list changed paths between revisions", error, {
      causeCategory: "command-failed"
    });
  }
}

export async function listPendingChangedPaths(
  context: GitRepositoryContext,
  options: ListPendingChangedPathsOptions
): Promise<string[]> {
  const from = await resolveRevision(context, options.from);
  const scopes = pathspecs(options.pathScopes);
  try {
    return parseNullSeparatedPaths(
      await context.git.raw([
        "diff",
        "--cached",
        "--name-only",
        "--no-renames",
        "-z",
        from,
        "--",
        ...scopes
      ])
    );
  } catch (cause) {
    if (cause instanceof VersionControlError) throw cause;
    throw operationError(
      "list changed paths from a revision to the pending snapshot",
      cause,
      { causeCategory: "command-failed" }
    );
  }
}

function pathspecs(scopes: readonly string[] | undefined): string[] {
  return normalizePathScopes(scopes ?? []).map((scope) => `:(literal)${scope}`);
}
