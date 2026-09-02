import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { performance } from "node:perf_hooks";
import writeFileAtomic from "write-file-atomic";
import { TaskGraphError } from "./errors.ts";
import { loadNativeLockBinding, type NativeLockBinding } from "./runtime.ts";
import {
  emptyTaskIndex,
  parseTaskIndex,
  serializeTaskIndex
} from "./schema.ts";
import {
  defaultTaskGraphIndexPath,
  type JsonObject,
  type TaskIndex,
  type TaskIndexInfo
} from "./types.ts";

export type AtomicWrite = (
  target: string,
  text: string,
  options: { encoding: "utf8"; fsync: true }
) => Promise<void>;

export type TaskGraphStoreOptions = {
  atomicWrite?: AtomicWrite;
  indexPath?: string;
  loadNativeLock?: () => Promise<NativeLockBinding>;
  lockRoot?: string;
  lockPollMilliseconds?: number;
  lockWaitMilliseconds?: number;
  monotonicClock?: () => number;
  root?: string;
  sleep?: (milliseconds: number) => Promise<void>;
};

export type TaskIndexRead = {
  canonical: boolean;
  index: TaskIndex;
  text: string;
};

type LockHandle = {
  binding: NativeLockBinding;
  file: fs.FileHandle;
};

const defaultSleep = async (milliseconds: number): Promise<void> => {
  await new Promise<void>((resolve) => setTimeout(resolve, milliseconds));
};

const defaultAtomicWrite: AtomicWrite = async (target, text, options) => {
  await writeFileAtomic(target, text, options);
};

function getErrnoCode(error: unknown): string | null {
  return error instanceof Error &&
    "code" in error &&
    typeof (error as NodeJS.ErrnoException).code === "string"
    ? ((error as NodeJS.ErrnoException).code ?? null)
    : null;
}

function isErrno(error: unknown, code: string): boolean {
  return getErrnoCode(error) === code;
}

function throwFileBoundaryError(
  error: unknown,
  code: "INDEX_READ_FAILED" | "WRITE_FAILED",
  message: string,
  target: string,
  details: JsonObject = {}
): never {
  if (error instanceof TaskGraphError) throw error;
  const fileErrorCode = getErrnoCode(error);
  if (fileErrorCode !== null) {
    throw new TaskGraphError(
      code,
      message,
      {
        path: target,
        fileErrorCode,
        ...details,
        cause: error
      },
      { cause: error }
    );
  }
  throw error instanceof Error ? error : new Error(String(error));
}

async function lstatOrNull(
  target: string
): Promise<Awaited<ReturnType<typeof fs.lstat>> | null> {
  try {
    return await fs.lstat(target);
  } catch (error) {
    if (isErrno(error, "ENOENT")) return null;
    throw error;
  }
}

function resolveIndexPath(root: string, configured?: string): string {
  const candidate = configured ?? defaultTaskGraphIndexPath;
  if (path.isAbsolute(candidate)) return path.resolve(candidate);
  const resolved = path.resolve(root, candidate);
  const relative = path.relative(root, resolved);
  if (
    relative === ".." ||
    relative.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relative)
  ) {
    throw new TaskGraphError(
      "ARGUMENT_INVALID",
      "Relative task index path must stay inside --root",
      { root, indexPath: candidate }
    );
  }
  return resolved;
}

function storePaths(options: TaskGraphStoreOptions): {
  indexPath: string;
  lockPath: string;
  lockRoot: string;
} {
  const root = path.resolve(options.root ?? process.cwd());
  const indexPath = resolveIndexPath(root, options.indexPath);
  const lockRoot = path.resolve(
    options.lockRoot ?? path.join(os.tmpdir(), "task-graph-locks")
  );
  const normalizedIndexPath =
    process.platform === "win32" ? indexPath.toLowerCase() : indexPath;
  const lockName = createHash("sha256")
    .update(normalizedIndexPath, "utf8")
    .digest("hex");
  return {
    indexPath,
    lockPath: path.join(lockRoot, `${lockName}.lock`),
    lockRoot
  };
}

function lockTiming(options: TaskGraphStoreOptions): {
  pollMilliseconds: number;
  waitMilliseconds: number;
} {
  const pollMilliseconds = options.lockPollMilliseconds ?? 50;
  const waitMilliseconds = options.lockWaitMilliseconds ?? 5_000;
  if (
    !Number.isFinite(pollMilliseconds) ||
    pollMilliseconds <= 0 ||
    !Number.isFinite(waitMilliseconds) ||
    waitMilliseconds < 0
  ) {
    throw new TaskGraphError(
      "ARGUMENT_INVALID",
      "Task graph lock timing values must be finite and non-negative",
      {
        lockPollMilliseconds: pollMilliseconds,
        lockWaitMilliseconds: waitMilliseconds
      }
    );
  }
  return { pollMilliseconds, waitMilliseconds };
}

export class TaskGraphStore {
  readonly indexPath: string;
  readonly lockPath: string;
  private readonly atomicWrite: AtomicWrite;
  private readonly loadNativeLock: () => Promise<NativeLockBinding>;
  private readonly lockPollMilliseconds: number;
  private readonly lockRoot: string;
  private readonly lockWaitMilliseconds: number;
  private readonly monotonicClock: () => number;
  private readonly sleep: (milliseconds: number) => Promise<void>;
  private nativeBindingPromise: Promise<NativeLockBinding> | null = null;

  constructor(options: TaskGraphStoreOptions = {}) {
    const paths = storePaths(options);
    const timing = lockTiming(options);
    this.indexPath = paths.indexPath;
    this.lockRoot = paths.lockRoot;
    this.lockPath = paths.lockPath;
    this.atomicWrite = options.atomicWrite ?? defaultAtomicWrite;
    this.loadNativeLock = options.loadNativeLock ?? loadNativeLockBinding;
    this.lockPollMilliseconds = timing.pollMilliseconds;
    this.lockWaitMilliseconds = timing.waitMilliseconds;
    this.monotonicClock = options.monotonicClock ?? (() => performance.now());
    this.sleep = options.sleep ?? defaultSleep;
  }

  async read(): Promise<TaskIndexRead> {
    let text: string;
    try {
      text = await fs.readFile(this.indexPath, "utf8");
    } catch (error) {
      if (isErrno(error, "ENOENT")) {
        throw new TaskGraphError(
          "INDEX_NOT_FOUND",
          `Task index does not exist: ${this.indexPath}`,
          { indexPath: this.indexPath }
        );
      }
      throwFileBoundaryError(
        error,
        "INDEX_READ_FAILED",
        `Unable to read task index: ${this.indexPath}`,
        this.indexPath
      );
    }
    let input: unknown;
    try {
      input = JSON.parse(text) as unknown;
    } catch (error) {
      throw new TaskGraphError(
        "INDEX_INVALID",
        "Task index is not valid JSON",
        { indexPath: this.indexPath, cause: error }
      );
    }
    const index = parseTaskIndex(input);
    return { index, text, canonical: serializeTaskIndex(index) === text };
  }

  async info(): Promise<TaskIndexInfo> {
    const { canonical, index } = await this.read();
    return {
      valid: true,
      canonical,
      diagnostics: canonical
        ? []
        : [
            {
              code: "index-not-canonical",
              message:
                "Task index must use canonical field order, LF, and trailing newline"
            }
          ],
      revision: index.revision,
      schemaVersion: index.schemaVersion,
      taskCount: Object.keys(index.tasks).length,
      topTaskCount: Object.values(index.tasks).filter(
        (task) => task.state.relations.parentId === null
      ).length,
      nextTaskId: index.nextTaskId
    };
  }

  async assertMutationRuntime(): Promise<void> {
    await this.getNativeBinding();
  }

  async init(): Promise<TaskIndex> {
    await this.assertMutationRuntime();
    await this.assertIndexMissing();
    const indexDirectory = path.dirname(this.indexPath);
    try {
      await fs.mkdir(indexDirectory, { recursive: true });
    } catch (error) {
      throwFileBoundaryError(
        error,
        "WRITE_FAILED",
        "Unable to create the task graph index directory",
        indexDirectory
      );
    }
    return await this.withLock(
      async () => {
        await this.assertIndexMissing();
        const index = emptyTaskIndex();
        await this.commit(index);
        return index;
      },
      (index) => index.revision
    );
  }

  async mutate<TData>(
    transform: (
      index: TaskIndex
    ) =>
      | Promise<{ index: TaskIndex; data: TData }>
      | { index: TaskIndex; data: TData }
  ): Promise<{ index: TaskIndex; data: TData }> {
    return await this.withLock(
      async () => {
        const current = await this.read();
        const transformed = await transform(structuredClone(current.index));
        const candidate = parseTaskIndex(transformed.index);
        if (candidate.revision !== current.index.revision + 1) {
          throw new TaskGraphError(
            "STATE_CONFLICT",
            "Every mutation must increase revision exactly once",
            {
              currentRevision: current.index.revision,
              candidateRevision: candidate.revision
            }
          );
        }
        await this.commit(candidate);
        return { index: candidate, data: transformed.data };
      },
      (result) => result.index.revision
    );
  }

  private async getNativeBinding(): Promise<NativeLockBinding> {
    const existing = this.nativeBindingPromise;
    if (existing !== null) return await existing;
    const pending = this.loadNativeLock();
    this.nativeBindingPromise = pending;
    try {
      const binding = await pending;
      this.nativeBindingPromise = Promise.resolve(binding);
      return binding;
    } catch (error) {
      if (this.nativeBindingPromise === pending)
        this.nativeBindingPromise = null;
      throw error;
    }
  }

  private async assertIndexMissing(): Promise<void> {
    let existing: Awaited<ReturnType<typeof fs.lstat>> | null;
    try {
      existing = await lstatOrNull(this.indexPath);
    } catch (error) {
      throwFileBoundaryError(
        error,
        "WRITE_FAILED",
        "Unable to inspect the task graph index before initialization",
        this.indexPath
      );
    }
    if (existing !== null) {
      throw new TaskGraphError(
        "INDEX_EXISTS",
        `Task index already exists: ${this.indexPath}`,
        { indexPath: this.indexPath }
      );
    }
  }

  private async withLock<T>(
    operation: () => Promise<T>,
    committedRevision: (result: T) => number
  ): Promise<T> {
    const lock = await this.acquireLock();
    let result: T | undefined;
    let operationError: unknown;
    try {
      result = await operation();
    } catch (error) {
      operationError = error;
    }

    let releaseError: unknown;
    try {
      await this.releaseLock(lock);
    } catch (error) {
      releaseError = error;
    }
    if (operationError !== undefined) throw operationError;
    if (result === undefined)
      throw new Error("Task graph transaction returned no result");
    if (releaseError !== undefined) {
      const revision = committedRevision(result);
      throw this.writeOutcomeUnknown(revision, releaseError, "lock-release");
    }
    return result;
  }

  private async acquireLock(): Promise<LockHandle> {
    const binding = await this.getNativeBinding();
    try {
      await fs.mkdir(this.lockRoot, { recursive: true });
    } catch (error) {
      throwFileBoundaryError(
        error,
        "WRITE_FAILED",
        "Unable to create the task graph lock directory",
        this.lockRoot,
        { phase: "lock-directory" }
      );
    }
    let file: fs.FileHandle;
    try {
      file = await fs.open(this.lockPath, "a+");
    } catch (error) {
      const fileErrorCode = getErrnoCode(error);
      throw new TaskGraphError(
        "WRITE_FAILED",
        "Unable to open the task graph lock file",
        {
          phase: "lock-open",
          lockPath: this.lockPath,
          ...(fileErrorCode === null ? {} : { fileErrorCode }),
          cause: error
        },
        error instanceof Error ? { cause: error } : undefined
      );
    }
    const startedAt = this.monotonicClock();
    while (true) {
      let acquired: boolean;
      try {
        acquired = binding.tryLock(file.fd);
      } catch (error) {
        await file.close().catch(() => undefined);
        throw new TaskGraphError(
          "WRITE_FAILED",
          "Unable to acquire the task graph native lock",
          { phase: "lock-acquire", lockPath: this.lockPath, cause: error },
          error instanceof Error ? { cause: error } : undefined
        );
      }
      if (acquired) return { binding, file };
      const elapsed = Math.max(0, this.monotonicClock() - startedAt);
      if (elapsed >= this.lockWaitMilliseconds) {
        await file.close().catch(() => undefined);
        throw new TaskGraphError(
          "LOCK_TIMEOUT",
          `Timed out waiting ${this.lockWaitMilliseconds}ms for task graph lock`,
          {
            lockPath: this.lockPath,
            waitMilliseconds: this.lockWaitMilliseconds
          }
        );
      }
      await this.sleep(
        Math.min(this.lockPollMilliseconds, this.lockWaitMilliseconds - elapsed)
      );
    }
  }

  private async releaseLock(lock: LockHandle): Promise<void> {
    let unlockError: unknown;
    try {
      lock.binding.unlock(lock.file.fd);
    } catch (error) {
      unlockError = error;
    }
    try {
      await lock.file.close();
    } catch (closeError) {
      throw unlockError ?? closeError;
    }
    if (unlockError !== undefined) throw unlockError;
  }

  private async commit(candidate: TaskIndex): Promise<void> {
    const candidateText = serializeTaskIndex(candidate);
    try {
      await this.atomicWrite(this.indexPath, candidateText, {
        encoding: "utf8",
        fsync: true
      });
    } catch (error) {
      throw this.writeOutcomeUnknown(candidate.revision, error);
    }
  }

  private writeOutcomeUnknown(
    possibleRevision: number,
    cause: unknown,
    phase?: "lock-release"
  ): TaskGraphError {
    return new TaskGraphError(
      "WRITE_OUTCOME_UNKNOWN",
      "Task index write outcome is unknown; re-query before any retry",
      {
        indexPath: this.indexPath,
        possibleRevision,
        recoveryAction: "Run index info before attempting another mutation",
        ...(phase === undefined ? {} : { phase }),
        cause
      },
      cause instanceof Error ? { cause } : undefined
    );
  }
}
