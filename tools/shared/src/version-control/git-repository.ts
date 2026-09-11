import fs from "node:fs/promises";
import path from "node:path";
import { VersionControlError } from "./errors.ts";
import { createGitClient, runGitForExitCode } from "./git-command.ts";
import type {
  GitRepositoryContext,
  PendingReplacementHooks
} from "./git-context.ts";
import { readPendingFiles } from "./git-pending.ts";
import {
  listChangedPaths,
  listPendingChangedPaths,
  listWorkspaceChangedPaths,
  listWorkspaceFiles
} from "./git-workspace.ts";
import { replacePendingFiles } from "./git-pending-replacement.ts";
import {
  getCurrentRevision,
  listRevisionFiles,
  readRevisionFile,
  readRevisionFiles,
  resolveRevision
} from "./git-revision.ts";
import type {
  ListChangedPathsOptions,
  ListPendingChangedPathsOptions,
  ListVersionControlFilesOptions,
  ReplacePendingFilesOptions,
  ReplacePendingFilesResult,
  RevisionId,
  VersionControlFile,
  VersionControlRepository
} from "./types.ts";
import { operationError } from "./git-core.ts";

export async function openGitVersionControl(
  startDirectory: string,
  hooks: PendingReplacementHooks = {}
): Promise<VersionControlRepository> {
  const start = path.resolve(startDirectory);
  const state = await discoverWorktree(start);
  if (state.exitCode !== 0)
    await throwDiscoveryError(start, state.exitCode, state.stderr);
  const root = state.stdout.trim();
  if (root.length === 0)
    throw operationError(
      "discover a version-control worktree",
      "The version-control tool returned an empty worktree root.",
      { causeCategory: "command-failed" }
    );
  return new GitVersionControlRepository(path.resolve(start, root), hooks);
}

class GitVersionControlRepository implements VersionControlRepository {
  readonly rootDirectory: string;
  readonly #context: GitRepositoryContext;

  constructor(rootDirectory: string, hooks: PendingReplacementHooks) {
    this.rootDirectory = rootDirectory;
    this.#context = {
      git: createGitClient(rootDirectory),
      hooks,
      rootDirectory
    };
  }

  async getCurrentRevision(): Promise<RevisionId | null> {
    return await getCurrentRevision(this.#context);
  }
  async resolveRevision(revision: string): Promise<RevisionId> {
    return await resolveRevision(this.#context, revision);
  }
  async listRevisionFiles(
    revision: RevisionId,
    options: ListVersionControlFilesOptions = {}
  ): Promise<string[]> {
    return await listRevisionFiles(this.#context, revision, options);
  }
  async readRevisionFile(
    revision: RevisionId,
    filePath: string
  ): Promise<VersionControlFile | null> {
    return await readRevisionFile(this.#context, revision, filePath);
  }
  async readRevisionFiles(
    revision: RevisionId,
    options: ListVersionControlFilesOptions = {}
  ): Promise<VersionControlFile[]> {
    return await readRevisionFiles(this.#context, revision, options);
  }
  async readPendingFiles(
    options: ListVersionControlFilesOptions = {}
  ): Promise<VersionControlFile[]> {
    return await readPendingFiles(this.#context, options);
  }
  async replacePendingFiles(
    options: ReplacePendingFilesOptions
  ): Promise<ReplacePendingFilesResult> {
    return await replacePendingFiles(
      this.#context,
      () => this.getCurrentRevision(),
      options
    );
  }
  async listPendingChangedPaths(
    options: ListPendingChangedPathsOptions
  ): Promise<string[]> {
    return await listPendingChangedPaths(this.#context, options);
  }
  async listWorkspaceFiles(
    options: ListVersionControlFilesOptions = {}
  ): Promise<string[]> {
    return await listWorkspaceFiles(this.#context, options);
  }
  async listWorkspaceChangedPaths(): Promise<string[]> {
    return await listWorkspaceChangedPaths(this.#context);
  }
  async listChangedPaths(options: ListChangedPathsOptions): Promise<string[]> {
    return await listChangedPaths(this.#context, options);
  }
}

async function discoverWorktree(start: string) {
  try {
    return await runGitForExitCode(start, ["rev-parse", "--show-toplevel"]);
  } catch (error) {
    throw operationError("discover a version-control worktree", error);
  }
}

async function throwDiscoveryError(
  start: string,
  exitCode: number,
  stderr: string
): Promise<never> {
  let hasMarker: boolean;
  try {
    hasMarker = await hasGitWorktreeMarker(start);
  } catch (error) {
    throw operationError("discover a version-control worktree", error);
  }
  if (exitCode === 128 && !hasMarker)
    throw new VersionControlError({
      causeCategory: "not-repository",
      code: "not-repository",
      operation: "discover a version-control worktree",
      target: "configured root"
    });
  throw operationError("discover a version-control worktree", stderr, {
    causeCategory: "command-failed"
  });
}

async function hasGitWorktreeMarker(start: string): Promise<boolean> {
  const canonical = await fs.realpath(start);
  if (!(await fs.stat(canonical)).isDirectory())
    throw new Error(
      `Version-control discovery path is not a directory: ${start}`
    );
  for (let candidate = canonical; ; candidate = path.dirname(candidate)) {
    try {
      await fs.lstat(path.join(candidate, ".git"));
      return true;
    } catch (error) {
      if (!isFileNotFoundError(error)) throw error;
    }
    if (path.dirname(candidate) === candidate) return false;
  }
}

function isFileNotFoundError(cause: unknown): boolean {
  return (
    typeof cause === "object" &&
    cause !== null &&
    "code" in cause &&
    cause.code === "ENOENT"
  );
}
