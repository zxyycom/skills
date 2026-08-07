import fs from "node:fs/promises";
import path from "node:path";
import { performance } from "node:perf_hooks";
import writeFileAtomic from "write-file-atomic";
import { TaskGraphError } from "./errors.ts";
import {
  loadNativeLockBinding,
  type NativeLockBinding
} from "./runtime.ts";
import {
  emptyTaskIndex,
  parseTaskIndex,
  serializeTaskIndex
} from "./schema.ts";
import {
  defaultTaskGraphIndexPath,
  type JsonObject,
  type TaskIndex
} from "./types.ts";

const gitIgnoreComment = "# task-graph runtime artifacts";
const gitIgnoreRule = "/task-graph-index.json.*";

export type AtomicWrite = (
  target: string,
  text: string,
  options: { encoding: "utf8"; fsync: true }
) => Promise<void>;

export type TaskGraphStoreOptions = {
  atomicWrite?: AtomicWrite;
  indexPath?: string;
  loadNativeLock?: () => Promise<NativeLockBinding>;
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

export type TaskIndexCheck = {
  valid: boolean;
  canonical: boolean;
  diagnostics: Array<{
    code:
      | "index-invalid"
      | "index-not-canonical"
      | "index-read-failed"
      | "schema-unsupported";
    message: string;
  }>;
  revision: number | null;
};

export type TaskIndexInfo = {
  revision: number;
  schemaVersion: 1;
  scopeCount: number;
  taskCount: number;
  nextIds: { scope: number; task: number };
};

type LockHandle = {
  binding: NativeLockBinding;
  file: fs.FileHandle;
};

type ObservedIndex = {
  revision: number | null | "unreadable";
  text: string | null | "unreadable";
};

const defaultSleep = async (milliseconds: number): Promise<void> => {
  await new Promise<void>((resolve) => setTimeout(resolve, milliseconds));
};

const defaultAtomicWrite: AtomicWrite = async (target, text, options) => {
  await writeFileAtomic(target, text, options);
};

function getErrnoCode(error: unknown): string | null {
  return error instanceof Error
    && "code" in error
    && typeof (error as NodeJS.ErrnoException).code === "string"
    ? (error as NodeJS.ErrnoException).code ?? null
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

async function lstatOrNull(target: string): Promise<Awaited<ReturnType<typeof fs.lstat>> | null> {
  try {
    return await fs.lstat(target);
  } catch (error) {
    if (isErrno(error, "ENOENT")) return null;
    throw error;
  }
}

async function assertNoSymbolicPath(
  target: string,
  failureCode: "INDEX_READ_FAILED" | "WRITE_FAILED" = "INDEX_READ_FAILED"
): Promise<void> {
  const resolved = path.resolve(target);
  const parsed = path.parse(resolved);
  let current = parsed.root;
  const parts = resolved.slice(parsed.root.length).split(path.sep).filter(Boolean);
  for (const part of parts) {
    current = path.join(current, part);
    let stat: Awaited<ReturnType<typeof fs.lstat>> | null;
    try {
      stat = await lstatOrNull(current);
    } catch (error) {
      throwFileBoundaryError(
        error,
        failureCode,
        `Unable to inspect task graph path component: ${current}`,
        current
      );
    }
    if (stat === null) break;
    if (stat.isSymbolicLink()) {
      throw new TaskGraphError(
        "PATH_SYMLINK",
        `Task graph path crosses symbolic link ${current}`,
        { path: current }
      );
    }
  }
}

function resolveIndexPath(root: string, configured?: string): string {
  const candidate = configured ?? defaultTaskGraphIndexPath;
  if (path.isAbsolute(candidate)) return path.resolve(candidate);
  const resolved = path.resolve(root, candidate);
  const relative = path.relative(root, resolved);
  if (relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new TaskGraphError(
      "ARGUMENT_INVALID",
      "Relative task index path must stay inside --root",
      { root, indexPath: candidate }
    );
  }
  return resolved;
}

function hasGitIgnoreRule(text: string): boolean {
  return text.split(/\r\n|\n|\r/u).includes(gitIgnoreRule);
}

function appendGitIgnoreRule(text: string): string {
  if (hasGitIgnoreRule(text)) return text;
  const lineEnding = text.includes("\r\n") ? "\r\n" : "\n";
  const prefix = text.length === 0 || text.endsWith("\n")
    ? text
    : `${text}${lineEnding}`;
  return `${prefix}${gitIgnoreComment}${lineEnding}${gitIgnoreRule}${lineEnding}`;
}

export class TaskGraphStore {
  readonly indexPath: string;
  readonly lockPath: string;
  private readonly atomicWrite: AtomicWrite;
  private readonly loadNativeLock: () => Promise<NativeLockBinding>;
  private readonly lockPollMilliseconds: number;
  private readonly lockWaitMilliseconds: number;
  private readonly monotonicClock: () => number;
  private readonly sleep: (milliseconds: number) => Promise<void>;
  private nativeBindingPromise: Promise<NativeLockBinding> | null = null;

  constructor(options: TaskGraphStoreOptions = {}) {
    const root = path.resolve(options.root ?? process.cwd());
    this.indexPath = resolveIndexPath(root, options.indexPath);
    this.lockPath = `${this.indexPath}.lock`;
    this.atomicWrite = options.atomicWrite ?? defaultAtomicWrite;
    this.loadNativeLock = options.loadNativeLock ?? loadNativeLockBinding;
    this.lockPollMilliseconds = options.lockPollMilliseconds ?? 50;
    this.lockWaitMilliseconds = options.lockWaitMilliseconds ?? 5_000;
    this.monotonicClock = options.monotonicClock ?? (() => performance.now());
    this.sleep = options.sleep ?? defaultSleep;
    if (
      !Number.isFinite(this.lockPollMilliseconds)
      || this.lockPollMilliseconds <= 0
      || !Number.isFinite(this.lockWaitMilliseconds)
      || this.lockWaitMilliseconds < 0
    ) {
      throw new TaskGraphError(
        "ARGUMENT_INVALID",
        "Task graph lock timing values must be finite and non-negative",
        {
          lockPollMilliseconds: this.lockPollMilliseconds,
          lockWaitMilliseconds: this.lockWaitMilliseconds
        }
      );
    }
  }

  async read(): Promise<TaskIndexRead> {
    await assertNoSymbolicPath(this.indexPath);
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
    const { index } = await this.read();
    return {
      revision: index.revision,
      schemaVersion: index.schemaVersion,
      scopeCount: Object.keys(index.scopes).length,
      taskCount: Object.values(index.scopes).reduce(
        (count, scope) => count + Object.keys(scope.tasks).length,
        0
      ),
      nextIds: { ...index.nextIds }
    };
  }

  async check(): Promise<TaskIndexCheck> {
    try {
      const read = await this.read();
      return {
        valid: read.canonical,
        canonical: read.canonical,
        diagnostics: read.canonical
          ? []
          : [{
              code: "index-not-canonical",
              message: "Task index must use canonical field order, LF, and trailing newline"
            }],
        revision: read.index.revision
      };
    } catch (error) {
      if (!(error instanceof TaskGraphError)) throw error;
      const diagnosticCode = error.code === "INDEX_INVALID"
        ? "index-invalid"
        : error.code === "SCHEMA_UNSUPPORTED"
          ? "schema-unsupported"
          : error.code === "INDEX_NOT_FOUND"
              || error.code === "INDEX_READ_FAILED"
              || error.code === "PATH_SYMLINK"
            ? "index-read-failed"
            : null;
      if (diagnosticCode === null) throw error;
      return {
        valid: false,
        canonical: false,
        diagnostics: [{ code: diagnosticCode, message: error.message }],
        revision: null
      };
    }
  }

  async assertMutationRuntime(): Promise<void> {
    await this.getNativeBinding();
  }

  async init(): Promise<TaskIndex> {
    await this.assertMutationRuntime();
    await assertNoSymbolicPath(this.indexPath, "WRITE_FAILED");
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
    await assertNoSymbolicPath(this.indexPath, "WRITE_FAILED");
    await this.assertIndexMissing();
    await this.ensureLocalGitIgnore();
    return await this.withLock(async () => {
      await this.assertIndexMissing();
      const index = emptyTaskIndex();
      await this.commit(null, index);
      return index;
    }, (index) => index.revision);
  }

  async mutate<TData>(
    transform: (index: TaskIndex) => Promise<{ index: TaskIndex; data: TData }>
      | { index: TaskIndex; data: TData }
  ): Promise<{ index: TaskIndex; data: TData }> {
    return await this.withLock(async () => {
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
      await this.commit(current.text, candidate);
      return { index: candidate, data: transformed.data };
    }, (result) => result.index.revision);
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
      if (this.nativeBindingPromise === pending) this.nativeBindingPromise = null;
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

  private async ensureLocalGitIgnore(): Promise<void> {
    const ignorePath = path.join(path.dirname(this.indexPath), ".gitignore");
    await assertNoSymbolicPath(ignorePath, "WRITE_FAILED");
    let previousText = "";
    try {
      previousText = await fs.readFile(ignorePath, "utf8");
    } catch (error) {
      if (!isErrno(error, "ENOENT")) {
        throwFileBoundaryError(
          error,
          "WRITE_FAILED",
          "Unable to read task graph local .gitignore",
          ignorePath,
          { phase: "gitignore-read" }
        );
      }
    }
    if (hasGitIgnoreRule(previousText)) return;
    const candidateText = appendGitIgnoreRule(previousText);
    try {
      await this.atomicWrite(ignorePath, candidateText, { encoding: "utf8", fsync: true });
    } catch (error) {
      try {
        if (hasGitIgnoreRule(await fs.readFile(ignorePath, "utf8"))) return;
      } catch {
        // The stable write failure below remains actionable.
      }
      throw new TaskGraphError(
        "WRITE_FAILED",
        "Unable to write task graph local .gitignore",
        { phase: "gitignore-write", path: ignorePath, cause: error },
        error instanceof Error ? { cause: error } : undefined
      );
    }
    try {
      if (hasGitIgnoreRule(await fs.readFile(ignorePath, "utf8"))) return;
    } catch (error) {
      throw new TaskGraphError(
        "WRITE_FAILED",
        "Unable to verify task graph local .gitignore",
        { phase: "gitignore-readback", path: ignorePath, cause: error },
        error instanceof Error ? { cause: error } : undefined
      );
    }
    throw new TaskGraphError(
      "WRITE_FAILED",
      "Task graph local .gitignore does not contain the required rule",
      { phase: "gitignore-readback", path: ignorePath }
    );
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

    const released = await this.releaseLock(lock);
    if (operationError !== undefined) throw operationError;
    if (result === undefined) throw new Error("Task graph transaction returned no result");
    if (!released) {
      const revision = committedRevision(result);
      throw this.writeOutcomeUnknown(revision, new Error("native lock release failed"), revision, {
        phase: "lock-release"
      });
    }
    return result;
  }

  private async acquireLock(): Promise<LockHandle> {
    const binding = await this.getNativeBinding();
    await assertNoSymbolicPath(this.lockPath, "WRITE_FAILED");
    let file: fs.FileHandle | null = null;
    try {
      file = await fs.open(this.lockPath, "a+");
      const stat = await file.stat();
      if (!stat.isFile()) {
        throw new TaskGraphError(
          "WRITE_FAILED",
          "Task graph lock path must be a regular file",
          { phase: "lock-open", lockPath: this.lockPath }
        );
      }
    } catch (error) {
      await file?.close().catch(() => undefined);
      if (error instanceof TaskGraphError) throw error;
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
    if (file === null) throw new Error("Task graph lock file was not opened");

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
          { lockPath: this.lockPath, waitMilliseconds: this.lockWaitMilliseconds }
        );
      }
      await this.sleep(Math.min(
        this.lockPollMilliseconds,
        this.lockWaitMilliseconds - elapsed
      ));
    }
  }

  private async releaseLock(lock: LockHandle): Promise<boolean> {
    let unlocked = false;
    let closed = false;
    try {
      lock.binding.unlock(lock.file.fd);
      unlocked = true;
    } catch {
      // Closing the descriptor below still releases the operating-system lock.
    }
    try {
      await lock.file.close();
      closed = true;
    } catch {
      // A successful unlock above already released the operating-system lock.
    }
    return unlocked || closed;
  }

  private async commit(previousText: string | null, candidate: TaskIndex): Promise<void> {
    await assertNoSymbolicPath(this.indexPath, "WRITE_FAILED");
    const candidateText = serializeTaskIndex(candidate);
    try {
      await this.atomicWrite(
        this.indexPath,
        candidateText,
        { encoding: "utf8", fsync: true }
      );
    } catch (error) {
      const observed = await this.observeIndex();
      if (observed.text === candidateText) return;
      if (observed.text === previousText) {
        throw new TaskGraphError(
          "WRITE_FAILED",
          "Atomic write failed and the previous task index is still current",
          {
            indexPath: this.indexPath,
            candidateRevision: candidate.revision,
            observedRevision: observed.revision,
            committed: false,
            cause: error
          },
          error instanceof Error ? { cause: error } : undefined
        );
      }
      throw this.writeOutcomeUnknown(candidate.revision, error, observed.revision);
    }

    const observed = await this.observeIndex();
    if (observed.text !== candidateText) {
      throw this.writeOutcomeUnknown(
        candidate.revision,
        new Error("task index read-back did not match the committed candidate"),
        observed.revision
      );
    }
  }

  private async observeIndex(): Promise<ObservedIndex> {
    let text: string;
    try {
      text = await fs.readFile(this.indexPath, "utf8");
    } catch (error) {
      return isErrno(error, "ENOENT")
        ? { revision: null, text: null }
        : { revision: "unreadable", text: "unreadable" };
    }
    try {
      const input: unknown = JSON.parse(text);
      return { revision: parseTaskIndex(input).revision, text };
    } catch {
      return { revision: "unreadable", text };
    }
  }

  private unknownOutcomeDetails(
    possibleRevision: number,
    cause: unknown,
    observedRevision: number | null | "unreadable" = "unreadable",
    extra: JsonObject = {}
  ): JsonObject {
    return new TaskGraphError("WRITE_OUTCOME_UNKNOWN", "details", {
      indexPath: this.indexPath,
      possibleRevision,
      observedRevision,
      recoveryAction: "Run index info and index check before attempting another mutation",
      ...extra,
      cause
    }).details;
  }

  private writeOutcomeUnknown(
    possibleRevision: number,
    cause: unknown,
    observedRevision: number | null | "unreadable" = "unreadable",
    extra: JsonObject = {}
  ): TaskGraphError {
    return new TaskGraphError(
      "WRITE_OUTCOME_UNKNOWN",
      "Task index write outcome is unknown; re-query before any retry",
      this.unknownOutcomeDetails(possibleRevision, cause, observedRevision, extra),
      cause instanceof Error ? { cause } : undefined
    );
  }
}

export function createTaskGraphStore(
  options: TaskGraphStoreOptions = {}
): TaskGraphStore {
  return new TaskGraphStore(options);
}
