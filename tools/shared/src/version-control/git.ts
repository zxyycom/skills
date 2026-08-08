import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import {
  simpleGit,
  type SimpleGit
} from "simple-git";
import { VersionControlError } from "./errors.ts";
import { readGitBlobs } from "./git-blob-batch.ts";
import {
  parseGitTreeEntries,
  type GitTreeEntry
} from "./git-tree-entry.ts";
import {
  normalizeRepositoryPath,
  normalizeRepositoryPaths
} from "./repository-path.ts";
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

const gitMaxConcurrentProcesses = 4;
const gitOutputMaxBuffer = 16 * 1024 * 1024;
const operationErrorDetailMaxLength = 500;
const gitBlobModes = new Set(["100644", "100755", "120000"]);
const defaultGitBlobMode = "100644";
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
  stdout: string;
};

type PendingReplacementHooks = {
  afterPendingWrite?: () => Promise<void> | void;
  beforePendingRecovery?: () => Promise<void> | void;
  beforePendingWrite?: () => Promise<void> | void;
};

type NormalizedPendingReplacementFile = {
  data: Buffer;
  path: string;
};

type NormalizedPendingReplacement = {
  expectedRevision: RevisionId | null;
  files: NormalizedPendingReplacementFile[];
  pathScope: string;
};

export async function openGitVersionControl(
  startDirectory: string,
  hooks: PendingReplacementHooks = {}
): Promise<VersionControlRepository> {
  const resolvedStart = path.resolve(startDirectory);
  let discoveryState: GitCommandExit;
  try {
    discoveryState = await runGitForExitCode(resolvedStart, [
      "rev-parse",
      "--show-toplevel"
    ]);
  } catch (error) {
    throw operationError(
      `discover a Git worktree from ${resolvedStart}`,
      error
    );
  }

  if (discoveryState.exitCode !== 0) {
    let hasWorktreeMarker: boolean;
    try {
      hasWorktreeMarker = await hasGitWorktreeMarker(resolvedStart);
    } catch (error) {
      throw operationError(
        `discover a Git worktree from ${resolvedStart}`,
        error
      );
    }
    if (discoveryState.exitCode === 128 && !hasWorktreeMarker) {
      throw new VersionControlError(
        "not-repository",
        `No Git worktree could be opened from ${resolvedStart}`
      );
    }
    throw operationError(
      `discover a Git worktree from ${resolvedStart}`,
      discoveryState.stderr
    );
  }

  const discoveredRoot = discoveryState.stdout.trim();
  if (discoveredRoot.length === 0) {
    throw operationError(
      `discover a Git worktree from ${resolvedStart}`,
      "Git returned an empty worktree root."
    );
  }
  const rootDirectory = path.resolve(resolvedStart, discoveredRoot);

  return new GitVersionControlRepository(rootDirectory, hooks);
}

async function hasGitWorktreeMarker(startDirectory: string): Promise<boolean> {
  const canonicalStart = await fs.realpath(startDirectory);
  if (!(await fs.stat(canonicalStart)).isDirectory()) {
    throw new Error(
      `Version-control discovery path is not a directory: ${startDirectory}`
    );
  }

  let candidate = canonicalStart;
  while (true) {
    try {
      await fs.lstat(path.join(candidate, ".git"));
      return true;
    } catch (cause) {
      if (!isFileNotFoundError(cause)) {
        throw cause;
      }
    }

    const parent = path.dirname(candidate);
    if (parent === candidate) {
      return false;
    }
    candidate = parent;
  }
}

function isFileNotFoundError(cause: unknown): boolean {
  return typeof cause === "object"
    && cause !== null
    && "code" in cause
    && cause.code === "ENOENT";
}

class GitVersionControlRepository implements VersionControlRepository {
  readonly rootDirectory: string;
  readonly #git: SimpleGit;
  readonly #hooks: PendingReplacementHooks;

  constructor(rootDirectory: string, hooks: PendingReplacementHooks) {
    this.rootDirectory = rootDirectory;
    this.#git = createGitClient(rootDirectory);
    this.#hooks = hooks;
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
      } catch (error) {
        throw operationError("resolve the current revision", error);
      }

      if (symbolicHead.length === 0) {
        throw operationError(
          "resolve the current revision",
          "Git returned an empty symbolic HEAD."
        );
      }
      let referenceState: GitCommandExit;
      try {
        referenceState = await runGitForExitCode(this.rootDirectory, [
          "show-ref",
          "--verify",
          "--quiet",
          symbolicHead
        ]);
      } catch (error) {
        throw operationError("resolve the current revision", error);
      }
      if (referenceState.exitCode === 1 && referenceState.stderr.trim().length === 0) {
        return null;
      }
      throw operationError(
        "resolve the current revision",
        referenceState.stderr
      );
    }
  }

  async resolveRevision(revision: string): Promise<RevisionId> {
    assertRevisionInput(revision);
    let result: GitCommandExit;
    try {
      result = await runGitForExitCode(this.rootDirectory, [
        "rev-parse",
        "--verify",
        "--quiet",
        "--end-of-options",
        `${revision}^{commit}`
      ]);
    } catch (error) {
      throw operationError(`resolve revision ${revision}`, error);
    }
    if (result.exitCode === 0) {
      return parseObjectId(result.stdout, `revision ${revision}`);
    }
    if (result.exitCode === 1 && result.stderr.trim().length === 0) {
      throw new VersionControlError(
        "revision-not-found",
        `Version-control revision could not be resolved: ${revision}`
      );
    }
    throw operationError(`resolve revision ${revision}`, result.stderr);
  }

  async listRevisionFiles(
    revision: RevisionId,
    options: ListVersionControlFilesOptions = {}
  ): Promise<string[]> {
    const pathScopes = normalizePathScopes(options.pathScopes ?? []);
    const resolvedRevision = await this.resolveRevision(revision);
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

  async readRevisionFile(
    revision: RevisionId,
    filePath: string
  ): Promise<VersionControlFile | null> {
    const normalizedPath = normalizeRepositoryPath(filePath);
    const resolvedRevision = await this.resolveRevision(revision);
    let entries: GitTreeEntry[];
    try {
      entries = parseGitTreeEntries(await this.#git.raw([
        "ls-tree",
        "-z",
        resolvedRevision,
        "--",
        `:(literal)${normalizedPath}`
      ]));
    } catch {
      throw operationError(
        `locate ${normalizedPath} in revision ${resolvedRevision}`
      );
    }
    if (entries.length === 0) {
      return null;
    }

    const entry = entries[0];
    if (
      entries.length !== 1
      || entry === undefined
      || entry.path !== normalizedPath
      || entry.objectType !== "blob"
      || !gitBlobModes.has(entry.mode)
    ) {
      throw operationError(
        `locate file ${normalizedPath} in revision ${resolvedRevision}`
      );
    }

    let data: Buffer | undefined;
    try {
      data = (await readGitBlobs(
        this.rootDirectory,
        [entry.objectId]
      )).get(entry.objectId);
    } catch {
      throw operationError(
        `read ${normalizedPath} from revision ${resolvedRevision}`
      );
    }
    if (data === undefined) {
      throw operationError(
        `read ${normalizedPath} from revision ${resolvedRevision}`
      );
    }
    return { data, path: normalizedPath };
  }

  async readPendingFiles(
    options: ListVersionControlFilesOptions = {}
  ): Promise<VersionControlFile[]> {
    const pathScopes = normalizePathScopes(options.pathScopes ?? []);
    return await this.#readPendingIndexEntries(
      await this.#listPendingIndexEntries(pathScopes)
    );
  }

  async replacePendingFiles(
    options: ReplacePendingFilesOptions
  ): Promise<ReplacePendingFilesResult> {
    const replacement = normalizePendingReplacement(options);
    const pendingIndexPath = await this.#resolvePendingIndexPath();
    const pendingIndexLockPath = pendingIndexPath + ".lock";
    let pendingIndexLock: Awaited<ReturnType<typeof fs.open>>;
    try {
      pendingIndexLock = await fs.open(pendingIndexLockPath, "wx");
    } catch (error) {
      if (isFileSystemError(error, "EEXIST")) {
        throw pendingConflictError(replacement.pathScope);
      }
      throw pendingReplacementError(replacement.pathScope);
    }

    let lockIsOpen = true;
    try {
      const currentRevision = await this.getCurrentRevision();
      if (currentRevision !== replacement.expectedRevision) {
        throw pendingConflictError(replacement.pathScope);
      }
      await initializePendingIndexLock({
        handle: pendingIndexLock,
        indexPath: pendingIndexPath,
        lockPath: pendingIndexLockPath,
        rootDirectory: this.rootDirectory
      });
      await pendingIndexLock.close();
      lockIsOpen = false;

      const previousEntries = await this.#listPendingIndexEntries(
        [replacement.pathScope],
        pendingIndexLockPath
      );
      const previousFiles = await this.#readPendingIndexEntries(previousEntries);
      const targetEntries = await this.#createPendingIndexEntries(
        replacement.files
      );
      await this.#hooks.beforePendingWrite?.();
      await this.#writePendingIndexEntries(
        previousEntries,
        targetEntries,
        pendingIndexLockPath
      );
      await this.#hooks.afterPendingWrite?.();
      const writtenEntries = await this.#listPendingIndexEntries(
        [replacement.pathScope],
        pendingIndexLockPath
      );
      const writtenFiles = await this.#readPendingIndexEntries(writtenEntries);
      if (
        !sameGitIndexEntries(writtenEntries, targetEntries)
        || !sameVersionControlFiles(writtenFiles, replacement.files)
      ) {
        throw pendingReplacementError(replacement.pathScope);
      }

      await fs.rename(pendingIndexLockPath, pendingIndexPath);
      return {
        pathScope: replacement.pathScope,
        pendingPaths: replacement.files.map((file) => file.path),
        previousPaths: previousFiles.map((file) => file.path)
      };
    } catch (error) {
      if (lockIsOpen) {
        try {
          await pendingIndexLock.close();
          lockIsOpen = false;
        } catch {
          throw pendingRecoveryError(replacement.pathScope);
        }
      }

      try {
        await this.#hooks.beforePendingRecovery?.();
        await removePendingIndexLock(pendingIndexLockPath);
      } catch {
        throw pendingRecoveryError(replacement.pathScope);
      }
      if (
        error instanceof VersionControlError
        && error.code === "pending-conflict"
      ) {
        throw error;
      }
      throw pendingReplacementError(replacement.pathScope, true);
    } finally {
      if (lockIsOpen) {
        await pendingIndexLock.close().catch(() => undefined);
      }
    }
  }

  async listPendingChangedPaths(
    options: ListPendingChangedPathsOptions
  ): Promise<string[]> {
    const pathScopes = normalizePathScopes(options.pathScopes ?? []);
    const from = await this.resolveRevision(options.from);
    const pathspecs = pathScopes.map((scope) => `:(literal)${scope}`);
    try {
      return parseNullSeparatedPaths(await this.#git.raw([
        "diff",
        "--cached",
        "--name-only",
        "--no-renames",
        "-z",
        from,
        "--",
        ...pathspecs
      ]));
    } catch (cause) {
      if (cause instanceof VersionControlError) {
        throw cause;
      }
      throw operationError(`list changed paths from ${from} to the pending snapshot`);
    }
  }

  async #listPendingIndexEntries(
    pathScopes: readonly string[],
    pendingIndexPath?: string
  ): Promise<GitIndexEntry[]> {
    const pathspecs = pathScopes.map((scope) => `:(literal)${scope}`);
    try {
      const args = [
        "ls-files",
        "--stage",
        "-z",
        "--",
        ...pathspecs
      ];
      if (pendingIndexPath === undefined) {
        return parseGitIndexEntries(await this.#git.raw(args));
      }
      const result = await runGitForExitCode(
        this.rootDirectory,
        args,
        pendingIndexEnvironment(pendingIndexPath)
      );
      if (result.exitCode !== 0) {
        throw operationError("list files in the pending snapshot");
      }
      return parseGitIndexEntries(result.stdout);
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

  async #createPendingIndexEntries(
    files: readonly NormalizedPendingReplacementFile[]
  ): Promise<GitIndexEntry[]> {
    const entries: GitIndexEntry[] = [];
    for (const file of files) {
      entries.push({
        mode: defaultGitBlobMode,
        objectId: await this.#writeGitBlob(file.data),
        path: file.path,
        stage: 0
      });
    }
    return entries;
  }

  async #writeGitBlob(data: Uint8Array): Promise<string> {
    let result: GitCommandExit;
    try {
      result = await runGitWithInputForExitCode(
        this.rootDirectory,
        ["hash-object", "-w", "--stdin"],
        data
      );
    } catch {
      throw operationError("store a pending file");
    }
    if (result.exitCode !== 0) {
      throw operationError("store a pending file");
    }
    return parseObjectId(result.stdout, "pending file");
  }

  async #writePendingIndexEntries(
    currentEntries: readonly GitIndexEntry[],
    targetEntries: readonly GitIndexEntry[],
    pendingIndexPath: string
  ): Promise<void> {
    const targetPaths = new Set(targetEntries.map((entry) => entry.path));
    const removedEntries = currentEntries.filter(
      (entry) => !targetPaths.has(entry.path)
    );
    if (removedEntries.length === 0 && sameGitIndexEntries(
      currentEntries,
      targetEntries
    )) {
      return;
    }

    const objectIdLength = targetEntries[0]?.objectId.length
      ?? removedEntries[0]?.objectId.length;
    if (objectIdLength === undefined) {
      return;
    }
    const zeroObjectId = "0".repeat(objectIdLength);
    const records = [
      ...removedEntries.map((entry) => (
        `0 ${zeroObjectId}\t${entry.path}\0`
      )),
      ...targetEntries.map((entry) => (
        `${entry.mode} ${entry.objectId}\t${entry.path}\0`
      ))
    ].join("");

    let result: GitCommandExit;
    try {
      result = await runGitWithInputForExitCode(
        this.rootDirectory,
        ["update-index", "-z", "--index-info"],
        Buffer.from(records, "utf8"),
        pendingIndexEnvironment(pendingIndexPath)
      );
    } catch {
      throw operationError("replace pending files");
    }
    if (result.exitCode !== 0) {
      throw operationError("replace pending files");
    }
  }

  async #resolvePendingIndexPath(): Promise<string> {
    let output: string;
    try {
      output = await this.#git.raw(["rev-parse", "--git-path", "index"]);
    } catch {
      throw operationError("locate the pending snapshot");
    }
    const indexPath = output.trim();
    if (indexPath.length === 0 || indexPath.includes("\0")) {
      throw operationError("locate the pending snapshot");
    }
    return path.resolve(this.rootDirectory, indexPath);
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
    const from = await this.resolveRevision(options.from);
    const to = options.to === undefined
      ? await this.getCurrentRevision()
      : await this.resolveRevision(options.to);
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
  args: readonly string[],
  environment?: NodeJS.ProcessEnv
): Promise<GitCommandExit> {
  return new Promise((resolve, reject) => {
    execFile(
      "git",
      ["-C", rootDirectory, ...args],
      {
        encoding: "utf8",
        env: environment,
        maxBuffer: gitOutputMaxBuffer,
        windowsHide: true
      },
      (error, stdout, stderr) => {
        if (error === null) {
          resolve({ exitCode: 0, stderr, stdout });
          return;
        }

        const exitCode = (error as Error & { code?: string | number }).code;
        if (typeof exitCode === "number") {
          resolve({ exitCode, stderr, stdout });
          return;
        }
        reject(error);
      }
    );
  });
}

function runGitWithInputForExitCode(
  rootDirectory: string,
  args: readonly string[],
  input: Uint8Array,
  environment?: NodeJS.ProcessEnv
): Promise<GitCommandExit> {
  return new Promise((resolve, reject) => {
    let inputError: Error | null = null;
    let inputFinished = false;
    let processError: Error | null = null;
    let processFinished = false;
    let processResult: GitCommandExit | null = null;
    const settle = (): void => {
      if (!inputFinished || !processFinished) {
        return;
      }
      if (inputError !== null) {
        reject(inputError);
        return;
      }
      if (processError !== null) {
        reject(processError);
        return;
      }
      if (processResult === null) {
        reject(new Error("Version-control process returned no result"));
        return;
      }
      resolve(processResult);
    };
    const child = execFile(
      "git",
      ["-C", rootDirectory, ...args],
      {
        encoding: "utf8",
        env: environment,
        maxBuffer: gitOutputMaxBuffer,
        windowsHide: true
      },
      (error, stdout, stderr) => {
        if (error === null) {
          processResult = { exitCode: 0, stderr, stdout };
        } else {
          const exitCode = (error as Error & { code?: string | number }).code;
          if (typeof exitCode === "number") {
            processResult = { exitCode, stderr, stdout };
          } else {
            processError = error;
          }
        }
        processFinished = true;
        settle();
      }
    );
    if (child.stdin === null) {
      inputError = new Error("Version-control process input is unavailable");
      inputFinished = true;
      child.kill();
      settle();
      return;
    }
    child.stdin.once("error", (error) => {
      inputError = error;
      inputFinished = true;
      settle();
    });
    child.stdin.once("finish", () => {
      inputFinished = true;
      settle();
    });
    try {
      child.stdin.end(input);
    } catch (error) {
      inputError = error instanceof Error ? error : new Error(String(error));
      inputFinished = true;
      child.kill();
      settle();
    }
  });
}

async function initializePendingIndexLock(options: {
  handle: Awaited<ReturnType<typeof fs.open>>;
  indexPath: string;
  lockPath: string;
  rootDirectory: string;
}): Promise<void> {
  let indexData: Buffer;
  try {
    indexData = await fs.readFile(options.indexPath);
  } catch (error) {
    if (!isFileSystemError(error, "ENOENT")) {
      throw error;
    }
    indexData = await createEmptyPendingIndex(
      options.rootDirectory,
      options.lockPath
    );
  }
  await options.handle.writeFile(indexData);
  await options.handle.sync();
}

async function createEmptyPendingIndex(
  rootDirectory: string,
  lockPath: string
): Promise<Buffer> {
  const temporaryIndexPath = lockPath
    + `.empty-${process.pid}-${randomUUID()}`;
  try {
    const result = await runGitForExitCode(
      rootDirectory,
      ["read-tree", "--empty"],
      pendingIndexEnvironment(temporaryIndexPath)
    );
    if (result.exitCode !== 0) {
      throw operationError("initialize an empty pending snapshot");
    }
    return await fs.readFile(temporaryIndexPath);
  } finally {
    await removeFileIfPresent(temporaryIndexPath + ".lock");
    await removeFileIfPresent(temporaryIndexPath);
  }
}

async function removePendingIndexLock(lockPath: string): Promise<void> {
  await removeFileIfPresent(lockPath + ".lock");
  await fs.unlink(lockPath);
}

async function removeFileIfPresent(filePath: string): Promise<void> {
  try {
    await fs.unlink(filePath);
  } catch (error) {
    if (!isFileSystemError(error, "ENOENT")) {
      throw error;
    }
  }
}

function pendingIndexEnvironment(indexPath: string): NodeJS.ProcessEnv {
  return { ...process.env, GIT_INDEX_FILE: indexPath };
}

function isFileSystemError(error: unknown, code: string): boolean {
  return error instanceof Error
    && "code" in error
    && error.code === code;
}

function normalizePathScopes(pathScopes: readonly string[]): string[] {
  return normalizeRepositoryPaths(pathScopes);
}

function normalizePendingReplacement(
  options: ReplacePendingFilesOptions
): NormalizedPendingReplacement {
  const pathScope = normalizeRepositoryPath(options.pathScope);
  if (
    options.expectedRevision !== null
    && !objectIdPattern.test(options.expectedRevision)
  ) {
    throw pendingConflictError(pathScope);
  }
  const seenPaths = new Set<string>();
  const files = options.files.map((file) => {
    const filePath = normalizeRepositoryPath(file.path);
    if (!isWithinLiteralScope(filePath, pathScope)) {
      throw new VersionControlError(
        "invalid-path",
        `Pending replacement file must stay within ${pathScope}: ${file.path}`
      );
    }
    if (seenPaths.has(filePath)) {
      throw new VersionControlError(
        "invalid-path",
        `Pending replacement paths must be unique: ${filePath}`
      );
    }
    seenPaths.add(filePath);
    return { data: Buffer.from(file.data), path: filePath };
  }).sort((left, right) => left.path.localeCompare(right.path));
  return {
    expectedRevision: options.expectedRevision,
    files,
    pathScope
  };
}

function isWithinLiteralScope(filePath: string, pathScope: string): boolean {
  return filePath === pathScope || filePath.startsWith(pathScope + "/");
}

function sameVersionControlFiles(
  left: readonly VersionControlFile[],
  right: readonly VersionControlFile[]
): boolean {
  return left.length === right.length && left.every((file, index) => {
    const expected = right[index];
    return expected !== undefined
      && file.path === expected.path
      && Buffer.from(file.data).equals(Buffer.from(expected.data));
  });
}

function sameGitIndexEntries(
  left: readonly GitIndexEntry[],
  right: readonly GitIndexEntry[]
): boolean {
  return left.length === right.length && left.every((entry, index) => {
    const expected = right[index];
    return expected !== undefined
      && entry.mode === expected.mode
      && entry.objectId === expected.objectId
      && entry.path === expected.path
      && entry.stage === expected.stage;
  });
}

function pendingReplacementError(
  pathScope: string,
  restored = false
): VersionControlError {
  return new VersionControlError(
    "pending-replacement-failed",
    `Pending snapshot replacement failed for ${pathScope}`
      + (restored ? "; the original range was restored" : "")
  );
}

function pendingConflictError(pathScope: string): VersionControlError {
  return new VersionControlError(
    "pending-conflict",
    `Pending snapshot replacement conflicted for ${pathScope}; `
      + "retry from the current revision"
  );
}

function pendingRecoveryError(pathScope: string): VersionControlError {
  return new VersionControlError(
    "pending-recovery-failed",
    `Pending snapshot recovery was incomplete for ${pathScope}; `
      + "the range may be partially updated"
  );
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

function operationError(
  operation: string,
  detail?: unknown
): VersionControlError {
  const detailText = operationErrorDetail(detail);
  return new VersionControlError(
    "operation-failed",
    `Version-control operation failed: ${operation}`
      + (detailText === null ? "" : ": " + detailText)
  );
}

function operationErrorDetail(detail: unknown): string | null {
  if (detail === undefined || detail === null) {
    return null;
  }
  const text = (detail instanceof Error ? detail.message : String(detail))
    .trim()
    .replace(/\s+/gu, " ");
  if (text.length === 0) {
    return null;
  }
  return text.length <= operationErrorDetailMaxLength
    ? text
    : text.slice(0, operationErrorDetailMaxLength - 1) + "…";
}
