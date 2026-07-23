import { execFile } from "node:child_process";
import path from "node:path";
import {
  simpleGit,
  type SimpleGit
} from "simple-git";
import { VersionControlError } from "./errors.ts";
import { readGitBlobs } from "./git-blob-batch.ts";
import {
  normalizeRepositoryPath,
  normalizeRepositoryPaths
} from "./repository-path.ts";
import type {
  ListChangedPathsOptions,
  ListVersionControlFilesOptions,
  RevisionId,
  VersionControlFile,
  VersionControlRepository
} from "./types.ts";

const gitMaxConcurrentProcesses = 4;
const gitOutputMaxBuffer = 16 * 1024 * 1024;
const gitBlobModes = new Set(["100644", "100755", "120000"]);
const gitIndexModePattern = /^[0-7]{6}$/u;
const objectIdPattern = /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/u;

type GitIndexEntry = {
  mode: string;
  objectId: string;
  path: string;
  stage: number;
};

type GitCommandExit = {
  exitCode: number;
  stderr: string;
};

export async function openGitVersionControl(
  startDirectory: string
): Promise<VersionControlRepository> {
  const resolvedStart = path.resolve(startDirectory);
  let rootDirectory: string;
  try {
    const discoveryClient = createGitClient(resolvedStart);
    rootDirectory = path.resolve(
      (await discoveryClient.revparse(["--show-toplevel"])).trim()
    );
  } catch {
    throw new VersionControlError(
      "not-repository",
      `No Git worktree could be opened from ${resolvedStart}`
    );
  }

  return new GitVersionControlRepository(rootDirectory);
}

class GitVersionControlRepository implements VersionControlRepository {
  readonly rootDirectory: string;
  readonly #git: SimpleGit;

  constructor(rootDirectory: string) {
    this.rootDirectory = rootDirectory;
    this.#git = createGitClient(rootDirectory);
  }

  async getCurrentRevision(): Promise<RevisionId | null> {
    try {
      return parseObjectId(await this.#git.revparse([
        "--verify",
        "--quiet",
        "HEAD^{commit}"
      ]), "current revision");
    } catch {
      let symbolicHead: string;
      try {
        symbolicHead = (await this.#git.raw([
          "symbolic-ref",
          "--quiet",
          "HEAD"
        ])).trim();
      } catch {
        throw operationError("resolve the current revision");
      }

      if (symbolicHead.length === 0) {
        throw operationError("resolve the current revision");
      }
      let referenceState: GitCommandExit;
      try {
        referenceState = await runGitForExitCode(this.rootDirectory, [
          "show-ref",
          "--verify",
          "--quiet",
          symbolicHead
        ]);
      } catch {
        throw operationError("resolve the current revision");
      }
      if (referenceState.exitCode === 1 && referenceState.stderr.trim().length === 0) {
        return null;
      }
      throw operationError("resolve the current revision");
    }
  }

  async #resolveRevision(revision: string): Promise<RevisionId> {
    assertRevisionInput(revision);
    try {
      return parseObjectId(await this.#git.revparse([
        "--verify",
        "--end-of-options",
        `${revision}^{commit}`
      ]), `revision ${revision}`);
    } catch (cause) {
      if (cause instanceof VersionControlError) {
        throw cause;
      }
      throw new VersionControlError(
        "revision-not-found",
        `Version-control revision could not be resolved: ${revision}`
      );
    }
  }

  async listRevisionFiles(
    revision: RevisionId,
    options: ListVersionControlFilesOptions = {}
  ): Promise<string[]> {
    const pathScopes = normalizePathScopes(options.pathScopes ?? []);
    const resolvedRevision = await this.#resolveRevision(revision);
    const pathspecs = pathScopes.map((scope) => `:(literal)${scope}`);
    try {
      return parseNullSeparatedPaths(await this.#git.raw([
        "ls-tree",
        "-r",
        "-z",
        "--name-only",
        resolvedRevision,
        "--",
        ...pathspecs
      ]));
    } catch (cause) {
      if (cause instanceof VersionControlError) {
        throw cause;
      }
      throw operationError("list files in the revision snapshot");
    }
  }

  async readPendingFiles(
    options: ListVersionControlFilesOptions = {}
  ): Promise<VersionControlFile[]> {
    const pathScopes = normalizePathScopes(options.pathScopes ?? []);
    return await this.#readPendingIndexEntries(
      await this.#listPendingIndexEntries(pathScopes)
    );
  }

  async #listPendingIndexEntries(
    pathScopes: readonly string[]
  ): Promise<GitIndexEntry[]> {
    const pathspecs = pathScopes.map((scope) => `:(literal)${scope}`);
    try {
      return parseGitIndexEntries(await this.#git.raw([
        "ls-files",
        "--stage",
        "-z",
        "--",
        ...pathspecs
      ]));
    } catch (cause) {
      if (cause instanceof VersionControlError) {
        throw cause;
      }
      throw operationError("list files in the pending snapshot");
    }
  }

  async #readPendingIndexEntries(
    entries: readonly GitIndexEntry[]
  ): Promise<VersionControlFile[]> {
    const unsupportedEntry = entries.find((entry) => !gitBlobModes.has(entry.mode));
    if (unsupportedEntry !== undefined) {
      throw operationError(
        `read non-file pending entry ${unsupportedEntry.path}`
      );
    }

    let blobs: ReadonlyMap<string, Buffer>;
    try {
      blobs = await readGitBlobs(
        this.rootDirectory,
        entries.map((entry) => entry.objectId)
      );
    } catch (cause) {
      if (cause instanceof VersionControlError) {
        throw cause;
      }
      throw operationError("read files from the pending snapshot");
    }

    return entries.map((entry) => {
      const data = blobs.get(entry.objectId);
      if (data === undefined) {
        throw operationError(`read ${entry.path} from the pending snapshot`);
      }
      return { data, path: entry.path };
    });
  }

  async listWorkspaceFiles(): Promise<string[]> {
    try {
      return parseNullSeparatedPaths(await this.#git.raw([
        "ls-files",
        "--cached",
        "--others",
        "--exclude-standard",
        "-z"
      ]));
    } catch {
      throw operationError("list version-control-visible workspace files");
    }
  }

  async listWorkspaceChangedPaths(): Promise<string[]> {
    try {
      const status = await this.#git.status([
        "--untracked-files=all",
        "--no-renames"
      ]);
      return normalizeRepositoryPaths(status.files.map((file) => file.path));
    } catch {
      throw operationError("list changed workspace paths");
    }
  }

  async listChangedPaths(options: ListChangedPathsOptions): Promise<string[]> {
    const from = await this.#resolveRevision(options.from);
    const to = options.to === undefined
      ? await this.getCurrentRevision()
      : await this.#resolveRevision(options.to);
    if (to === null) {
      throw new VersionControlError(
        "revision-not-found",
        "The current version-control revision does not exist"
      );
    }
    if (from === to) {
      return [];
    }

    try {
      return parseNullSeparatedPaths(await this.#git.raw([
        "diff",
        "--name-only",
        "--no-renames",
        "-z",
        from,
        to,
        "--"
      ]));
    } catch {
      throw operationError(`list changed paths between ${from} and ${to}`);
    }
  }
}

function createGitClient(baseDir: string): SimpleGit {
  return simpleGit({
    baseDir,
    maxConcurrentProcesses: gitMaxConcurrentProcesses,
    trimmed: false
  });
}

function assertRevisionInput(revision: string): void {
  if (
    revision.length === 0
    || revision.startsWith("-")
    || revision.includes("\0")
    || /[\r\n]/u.test(revision)
  ) {
    throw new VersionControlError(
      "revision-not-found",
      `Version-control revision is invalid: ${revision}`
    );
  }
}

function parseObjectId(output: string, source: string): RevisionId {
  const objectId = output.trim();
  if (!objectIdPattern.test(objectId)) {
    throw operationError(
      `parse ${source}`
    );
  }
  return objectId;
}

function parseGitIndexEntries(output: string): GitIndexEntry[] {
  const records = output.split("\0");
  if (records.at(-1) === "") {
    records.pop();
  }

  const entries = records.map((record) => {
    const separatorIndex = record.indexOf("\t");
    const metadata = separatorIndex === -1
      ? []
      : record.slice(0, separatorIndex).split(/\s+/u);
    const [mode, objectId, stageText] = metadata;
    if (
      metadata.length !== 3
      || !gitIndexModePattern.test(mode ?? "")
      || !objectIdPattern.test(objectId ?? "")
      || !/^[0-3]$/u.test(stageText ?? "")
    ) {
      throw operationError("parse pending Git index entries");
    }

    return {
      mode,
      objectId,
      path: normalizeRepositoryPath(record.slice(separatorIndex + 1)),
      stage: Number(stageText)
    };
  });

  const conflictedPaths = normalizeRepositoryPaths(
    entries.filter((entry) => entry.stage !== 0).map((entry) => entry.path)
  );
  if (conflictedPaths.length > 0) {
    throw operationError(
      `resolve pending content conflicts before reading: ${conflictedPaths.join(", ")}`
    );
  }

  const seenPaths = new Set<string>();
  for (const entry of entries) {
    if (seenPaths.has(entry.path)) {
      throw operationError(`parse duplicate pending index path ${entry.path}`);
    }
    seenPaths.add(entry.path);
  }

  return entries.sort((left, right) => left.path.localeCompare(right.path));
}

function runGitForExitCode(
  rootDirectory: string,
  args: readonly string[]
): Promise<GitCommandExit> {
  return new Promise((resolve, reject) => {
    execFile(
      "git",
      ["-C", rootDirectory, ...args],
      {
        encoding: "utf8",
        maxBuffer: gitOutputMaxBuffer,
        windowsHide: true
      },
      (error, _stdout, stderr) => {
        if (error === null) {
          resolve({ exitCode: 0, stderr });
          return;
        }

        const exitCode = (error as Error & { code?: string | number }).code;
        if (typeof exitCode === "number") {
          resolve({ exitCode, stderr });
          return;
        }
        reject(error);
      }
    );
  });
}

function normalizePathScopes(pathScopes: readonly string[]): string[] {
  return normalizeRepositoryPaths(pathScopes);
}

function parseNullSeparatedPaths(output: string): string[] {
  const candidates = output.split("\0");
  if (candidates.at(-1) === "") {
    candidates.pop();
  }
  if (candidates.some((candidate) => candidate.length === 0)) {
    throw operationError(
      "parse version-control paths"
    );
  }
  return normalizeRepositoryPaths(candidates);
}

function operationError(operation: string): VersionControlError {
  return new VersionControlError(
    "operation-failed",
    `Version-control operation failed: ${operation}`
  );
}
