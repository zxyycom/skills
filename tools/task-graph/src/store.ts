import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { randomUUID } from "node:crypto";
import { TaskGraphError } from "./errors.ts";
import {
  emptyTaskIndex,
  parseTaskIndex,
  serializeTaskIndex
} from "./schema.ts";
import {
  defaultTaskGraphIndexPath,
  type Clock,
  type JsonObject,
  type TaskIndex
} from "./types.ts";

type ProcessState = "alive" | "dead" | "unknown";
type IdGenerator = () => string;

type LockMetadata = {
  ownerToken: string;
  hostname: string;
  pid: number;
  updatedAt: string;
};

type LockHandle = {
  metadata: LockMetadata;
  ownerFileName: string;
  path: string;
};

type LockRecoveryMetadata = {
  hostname: string;
  observedOwnerToken: string;
  pid: number;
  reclaimerToken: string;
  updatedAt: string;
};

type LockGeneration = {
  claimant: LockRecoveryMetadata | null;
  claimantToken: string | null;
  metadata: LockMetadata;
  ownerFileName: string;
};

const uuidPatternSource =
  "[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}";
const ownerFilePattern = new RegExp(`^owner-(${uuidPatternSource})\\.json$`, "u");
const claimedOwnerFilePattern = new RegExp(
  `^owner-(${uuidPatternSource})\\.claimed-by-(${uuidPatternSource})\\.json$`,
  "u"
);
const reclaimerFilePattern = new RegExp(`^reclaimer-(${uuidPatternSource})\\.json$`, "u");
const temporaryOwnerFilePattern = new RegExp(
  `^owner-(${uuidPatternSource})\\.json\\.tmp$`,
  "u"
);

const ownerFileName = (ownerToken: string): string => `owner-${ownerToken}.json`;
const claimedOwnerFileName = (ownerToken: string, reclaimerToken: string): string =>
  `owner-${ownerToken}.claimed-by-${reclaimerToken}.json`;
const reclaimerFileName = (reclaimerToken: string): string =>
  `reclaimer-${reclaimerToken}.json`;

export type TaskGraphStoreHooks = {
  afterStaleLockDirectoryObserved?: (context: {
    lockPath: string;
  }) => Promise<void> | void;
  afterCommit?: (context: { indexPath: string; revision: number }) => Promise<void> | void;
  beforeCommit?: (context: { indexPath: string; revision: number }) => Promise<void> | void;
  beforeLockMetadataPublish?: (context: {
    lockPath: string;
    ownerToken: string;
  }) => Promise<void> | void;
  beforeLockReleaseIsolation?: (context: {
    lockPath: string;
    ownerToken: string;
    quarantinePath: string;
  }) => Promise<void> | void;
  beforeStaleLockClaim?: (context: {
    lockPath: string;
    observedClaimantToken: string | null;
    ownerToken: string;
    reclaimerToken: string;
  }) => Promise<void> | void;
  beforeStaleLockIsolation?: (context: {
    lockPath: string;
    ownerToken: string;
    reclaimerToken: string;
  }) => Promise<void> | void;
  replaceFile?: (temporaryPath: string, indexPath: string) => Promise<void>;
};

export type TaskGraphStoreOptions = {
  clock?: Clock;
  hostname?: string;
  idGenerator?: IdGenerator;
  indexPath?: string;
  lockPollMilliseconds?: number;
  lockStaleMilliseconds?: number;
  lockWaitMilliseconds?: number;
  monotonicClock?: () => number;
  pid?: number;
  processState?: (pid: number) => ProcessState;
  root?: string;
  sleep?: (milliseconds: number) => Promise<void>;
  hooks?: TaskGraphStoreHooks;
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

const defaultProcessState = (pid: number): ProcessState => {
  try {
    process.kill(pid, 0);
    return "alive";
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ESRCH") return "dead";
    return "unknown";
  }
};

const defaultSleep = async (milliseconds: number): Promise<void> => {
  await new Promise<void>((resolve) => setTimeout(resolve, milliseconds));
};

function isErrno(error: unknown, code: string): boolean {
  return error instanceof Error
    && "code" in error
    && (error as NodeJS.ErrnoException).code === code;
}

function throwFileBoundaryError(
  error: unknown,
  code: "INDEX_READ_FAILED" | "LOCK_RECOVERY_REQUIRED" | "WRITE_FAILED",
  message: string,
  target: string
): never {
  if (error instanceof TaskGraphError) {
    throw error;
  }
  if (
    error instanceof Error
    && "code" in error
    && typeof (error as NodeJS.ErrnoException).code === "string"
  ) {
    throw new TaskGraphError(
      code,
      message,
      {
        path: target,
        fileErrorCode: (error as NodeJS.ErrnoException).code ?? "UNKNOWN",
        cause: error
      },
      { cause: error }
    );
  }
  throw error instanceof Error ? error : new Error(String(error));
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function parseLockMetadata(input: unknown): LockMetadata | null {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return null;
  }
  const value = input as Record<string, unknown>;
  const keys = Object.keys(value).sort(compareText);
  if (keys.join("\0") !== ["hostname", "ownerToken", "pid", "updatedAt"].join("\0")) {
    return null;
  }
  if (
    typeof value.ownerToken !== "string"
    || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u
      .test(value.ownerToken)
    || typeof value.hostname !== "string"
    || value.hostname.length === 0
    || typeof value.pid !== "number"
    || !Number.isSafeInteger(value.pid)
    || value.pid < 1
    || typeof value.updatedAt !== "string"
  ) {
    return null;
  }
  const updatedAt = new Date(value.updatedAt);
  if (Number.isNaN(updatedAt.valueOf()) || updatedAt.toISOString() !== value.updatedAt) {
    return null;
  }
  return {
    ownerToken: value.ownerToken,
    hostname: value.hostname,
    pid: value.pid,
    updatedAt: value.updatedAt
  };
}

function parseLockRecoveryMetadata(input: unknown): LockRecoveryMetadata | null {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return null;
  }
  const value = input as Record<string, unknown>;
  const keys = Object.keys(value).sort(compareText);
  if (
    keys.join("\0")
      !== [
        "hostname",
        "observedOwnerToken",
        "pid",
        "reclaimerToken",
        "updatedAt"
      ].join("\0")
  ) {
    return null;
  }
  if (
    typeof value.hostname !== "string"
    || value.hostname.length === 0
    || typeof value.observedOwnerToken !== "string"
    || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u
      .test(value.observedOwnerToken)
    || typeof value.reclaimerToken !== "string"
    || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u
      .test(value.reclaimerToken)
    || typeof value.pid !== "number"
    || !Number.isSafeInteger(value.pid)
    || value.pid < 1
    || typeof value.updatedAt !== "string"
  ) {
    return null;
  }
  const updatedAt = new Date(value.updatedAt);
  if (Number.isNaN(updatedAt.valueOf()) || updatedAt.toISOString() !== value.updatedAt) {
    return null;
  }
  return {
    hostname: value.hostname,
    observedOwnerToken: value.observedOwnerToken,
    pid: value.pid,
    reclaimerToken: value.reclaimerToken,
    updatedAt: value.updatedAt
  };
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
  failureCode: "INDEX_READ_FAILED" | "LOCK_RECOVERY_REQUIRED" | "WRITE_FAILED"
    = "INDEX_READ_FAILED"
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
    if (stat === null) {
      break;
    }
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
  if (path.isAbsolute(candidate)) {
    return path.resolve(candidate);
  }
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

async function syncDirectory(directory: string): Promise<void> {
  let handle: fs.FileHandle | null = null;
  try {
    handle = await fs.open(directory, "r");
    await handle.sync();
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code !== "EINVAL" && code !== "ENOTSUP" && code !== "EPERM" && code !== "EISDIR") {
      throw error;
    }
  } finally {
    await handle?.close().catch(() => undefined);
  }
}

export class TaskGraphStore {
  readonly indexPath: string;
  readonly lockPath: string;
  private readonly clock: Clock;
  private readonly hostname: string;
  private readonly hooks: TaskGraphStoreHooks;
  private readonly idGenerator: IdGenerator;
  private readonly lockPollMilliseconds: number;
  private readonly lockStaleMilliseconds: number;
  private readonly lockWaitMilliseconds: number;
  private readonly monotonicClock: () => number;
  private readonly pid: number;
  private readonly processState: (pid: number) => ProcessState;
  private readonly sleep: (milliseconds: number) => Promise<void>;

  constructor(options: TaskGraphStoreOptions = {}) {
    const root = path.resolve(options.root ?? process.cwd());
    this.indexPath = resolveIndexPath(root, options.indexPath);
    this.lockPath = `${this.indexPath}.lock`;
    this.clock = options.clock ?? (() => new Date());
    this.hostname = options.hostname ?? os.hostname();
    this.hooks = options.hooks ?? {};
    this.idGenerator = options.idGenerator ?? randomUUID;
    this.lockPollMilliseconds = options.lockPollMilliseconds ?? 50;
    this.lockStaleMilliseconds = options.lockStaleMilliseconds ?? 60_000;
    this.lockWaitMilliseconds = options.lockWaitMilliseconds ?? 5_000;
    this.monotonicClock = options.monotonicClock ?? (() => performance.now());
    this.pid = options.pid ?? process.pid;
    this.processState = options.processState ?? defaultProcessState;
    this.sleep = options.sleep ?? defaultSleep;
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
      throw new TaskGraphError(
        "INDEX_READ_FAILED",
        `Unable to read task index: ${this.indexPath}`,
        { indexPath: this.indexPath, cause: error },
        error instanceof Error ? { cause: error } : undefined
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
      if (!(error instanceof TaskGraphError)) {
        throw error;
      }
      const diagnosticCode = error.code === "INDEX_INVALID"
        ? "index-invalid"
        : error.code === "SCHEMA_UNSUPPORTED"
          ? "schema-unsupported"
          : error.code === "INDEX_NOT_FOUND"
              || error.code === "INDEX_READ_FAILED"
              || error.code === "PATH_SYMLINK"
            ? "index-read-failed"
            : null;
      if (diagnosticCode === null) {
        throw error;
      }
      return {
        valid: false,
        canonical: false,
        diagnostics: [{
          code: diagnosticCode,
          message: error.message
        }],
        revision: null
      };
    }
  }

  async init(): Promise<TaskIndex> {
    await assertNoSymbolicPath(this.indexPath, "WRITE_FAILED");
    try {
      await fs.mkdir(path.dirname(this.indexPath), { recursive: true });
    } catch (error) {
      throwFileBoundaryError(
        error,
        "WRITE_FAILED",
        "Unable to create the task graph index directory",
        path.dirname(this.indexPath)
      );
    }
    await assertNoSymbolicPath(this.indexPath, "WRITE_FAILED");
    return await this.withLock(async (lock) => {
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
      const index = emptyTaskIndex();
      await this.commit(null, index, lock);
      return index;
    }, (index) => index.revision);
  }

  async mutate<TData>(
    transform: (index: TaskIndex) => Promise<{ index: TaskIndex; data: TData }>
      | { index: TaskIndex; data: TData }
  ): Promise<{ index: TaskIndex; data: TData }> {
    return await this.withLock(async (lock) => {
      const current = (await this.read()).index;
      const transformed = await transform(structuredClone(current));
      const candidate = parseTaskIndex(transformed.index);
      if (candidate.revision !== current.revision + 1) {
        throw new TaskGraphError(
          "STATE_CONFLICT",
          "Every mutation must increase revision exactly once",
          { currentRevision: current.revision, candidateRevision: candidate.revision }
        );
      }
      await this.commit(current.revision, candidate, lock);
      return { index: candidate, data: transformed.data };
    }, (result) => result.index.revision);
  }

  private async withLock<T>(
    operation: (lock: LockHandle) => Promise<T>,
    committedRevision: (result: T) => number
  ): Promise<T> {
    const lock = await this.acquireLock();
    let result: T;
    try {
      result = await operation(lock);
    } catch (error) {
      try {
        await this.releaseLock(lock);
      } catch (releaseError) {
        if (
          error instanceof TaskGraphError
          && (error.code === "WRITE_OUTCOME_UNKNOWN" || error.code === "LOCK_LOST")
        ) {
          throw error;
        }
        throw new TaskGraphError(
          "LOCK_RECOVERY_REQUIRED",
          "Task graph operation failed and its lock could not be safely released",
          {
            operationError: error instanceof TaskGraphError
              ? {
                  code: error.code,
                  message: error.message,
                  details: error.details
                }
              : error,
            releaseError,
            lockPath: lock.path,
            recoveryAction: "Inspect and recover the canonical task graph lock before retrying"
          },
          releaseError instanceof Error ? { cause: releaseError } : undefined
        );
      }
      throw error;
    }
    const revision = committedRevision(result);
    try {
      await this.releaseLock(lock);
    } catch (error) {
      throw this.writeOutcomeUnknown(revision, error, revision);
    }
    return result;
  }

  private async acquireLock(): Promise<LockHandle> {
    await assertNoSymbolicPath(this.lockPath, "WRITE_FAILED");
    const startedAt = this.clock().valueOf();
    const monotonicStartedAt = this.monotonicClock();
    let elapsed = 0;
    while (elapsed <= this.lockWaitMilliseconds) {
      const ownerToken = this.nextUuid("lock owner token");
      try {
        await fs.mkdir(this.lockPath);
        const metadata: LockMetadata = {
          ownerToken,
          hostname: this.hostname,
          pid: this.pid,
          updatedAt: this.clock().toISOString()
        };
        try {
          const metadataFileName = ownerFileName(ownerToken);
          const metadataPath = path.join(this.lockPath, metadataFileName);
          const temporaryMetadataPath = path.join(this.lockPath, `${metadataFileName}.tmp`);
          const handle = await fs.open(temporaryMetadataPath, "wx");
          try {
            await handle.writeFile(`${JSON.stringify(metadata, null, 2)}\n`, "utf8");
            await handle.sync();
          } finally {
            await handle.close();
          }
          await this.hooks.beforeLockMetadataPublish?.({
            lockPath: this.lockPath,
            ownerToken
          });
          await this.verifyFreshLockGeneration(ownerToken);
          await fs.rename(temporaryMetadataPath, metadataPath);
          await syncDirectory(this.lockPath);
        } catch (error) {
          const discarded = await this.discardFreshLockDirectory(ownerToken);
          throw new TaskGraphError(
            discarded ? "WRITE_FAILED" : "LOCK_RECOVERY_REQUIRED",
            discarded
              ? "Unable to publish task graph lock metadata"
              : "Unable to publish or safely discard task graph lock metadata",
            { lockPath: this.lockPath, cause: error },
            error instanceof Error ? { cause: error } : undefined
          );
        }
        return {
          metadata,
          ownerFileName: ownerFileName(ownerToken),
          path: this.lockPath
        };
      } catch (error) {
        if (!isErrno(error, "EEXIST")) {
          throwFileBoundaryError(
            error,
            "WRITE_FAILED",
            "Unable to create the task graph lock directory",
            this.lockPath
          );
        }
      }

      const recovered = await this.tryRecoverStaleLock();
      if (recovered) {
        continue;
      }
      await this.sleep(this.lockPollMilliseconds);
      elapsed = Math.max(
        this.clock().valueOf() - startedAt,
        this.monotonicClock() - monotonicStartedAt
      );
    }
    throw new TaskGraphError(
      "LOCK_TIMEOUT",
      `Timed out waiting ${this.lockWaitMilliseconds}ms for task graph lock`,
      { lockPath: this.lockPath }
    );
  }

  private async tryRecoverStaleLock(): Promise<boolean> {
    try {
      const lockStat = await lstatOrNull(this.lockPath);
      if (lockStat === null) {
        return true;
      }
      if (lockStat.isSymbolicLink() || !lockStat.isDirectory()) {
        throw new TaskGraphError(
          "PATH_SYMLINK",
          `Task graph lock path must be a non-symbolic directory: ${this.lockPath}`
        );
      }

      await this.hooks.afterStaleLockDirectoryObserved?.({ lockPath: this.lockPath });

      const generation = await this.readLockGeneration(this.lockPath);
      if (generation === null) {
        const currentStat = await lstatOrNull(this.lockPath);
        if (currentStat === null) return true;
        const ageFromDirectory = this.clock().valueOf() - Number(currentStat.mtimeMs);
        if (ageFromDirectory < this.lockStaleMilliseconds) return false;
        throw new TaskGraphError(
          "LOCK_RECOVERY_REQUIRED",
          "Stale task graph lock has incomplete or invalid generation metadata",
          { lockPath: this.lockPath }
        );
      }

      const observedProcess = generation.claimant ?? generation.metadata;
      const observedKind = generation.claimant === null ? "owner" : "reclaimer";
      const age = this.clock().valueOf() - new Date(observedProcess.updatedAt).valueOf();
      if (age < this.lockStaleMilliseconds) return false;
      if (observedProcess.hostname !== this.hostname) {
        throw new TaskGraphError(
          "LOCK_RECOVERY_REQUIRED",
          `Cannot confirm a stale task graph lock ${observedKind} on another host`,
          { lockPath: this.lockPath, observedHostname: observedProcess.hostname }
        );
      }
      const state = this.processState(observedProcess.pid);
      if (state !== "dead") {
        throw new TaskGraphError(
          "LOCK_RECOVERY_REQUIRED",
          state === "alive"
            ? `Stale task graph lock ${observedKind} process is still alive`
            : `Task graph lock ${observedKind} process state cannot be confirmed`,
          {
            lockPath: this.lockPath,
            observedPid: observedProcess.pid,
            processState: state
          }
        );
      }

      const reclaimerToken = this.nextUuid("lock reclaimer token");
      if (reclaimerToken === generation.claimantToken) {
        throw new TaskGraphError(
          "LOCK_RECOVERY_REQUIRED",
          "A lock reclaimer token must identify a new generation",
          { lockPath: this.lockPath, reclaimerToken }
        );
      }
      const reclaimer = {
        hostname: this.hostname,
        observedOwnerToken: generation.metadata.ownerToken,
        pid: this.pid,
        reclaimerToken,
        updatedAt: this.clock().toISOString()
      } satisfies LockRecoveryMetadata;
      const reclaimerPath = path.join(this.lockPath, reclaimerFileName(reclaimerToken));
      let reclaimerHandle: fs.FileHandle | null = null;
      let reclaimerCreated = false;
      try {
        reclaimerHandle = await fs.open(reclaimerPath, "wx");
        reclaimerCreated = true;
        await reclaimerHandle.writeFile(`${JSON.stringify(reclaimer, null, 2)}\n`, "utf8");
        await reclaimerHandle.sync();
        await reclaimerHandle.close();
        reclaimerHandle = null;
      } catch (error) {
        await reclaimerHandle?.close().catch(() => undefined);
        if (isErrno(error, "ENOENT") || isErrno(error, "ENOTDIR")) {
          return true;
        }
        if (reclaimerCreated) {
          await this.removeOwnReclaimerFile(reclaimerPath);
        }
        throw error;
      }
      try {
        await syncDirectory(this.lockPath);
      } catch (error) {
        await this.removeOwnReclaimerFile(reclaimerPath);
        if (isErrno(error, "ENOENT") || isErrno(error, "ENOTDIR")) {
          return true;
        }
        throw error;
      }
      try {
        await this.hooks.beforeStaleLockClaim?.({
          lockPath: this.lockPath,
          observedClaimantToken: generation.claimantToken,
          ownerToken: generation.metadata.ownerToken,
          reclaimerToken
        });
      } catch (error) {
        await this.removeOwnReclaimerFile(reclaimerPath);
        throw error;
      }

      const claimedFileName = claimedOwnerFileName(
        generation.metadata.ownerToken,
        reclaimerToken
      );
      try {
        await fs.rename(
          path.join(this.lockPath, generation.ownerFileName),
          path.join(this.lockPath, claimedFileName)
        );
      } catch (error) {
        await this.removeOwnReclaimerFile(reclaimerPath);
        if (isErrno(error, "ENOENT") || isErrno(error, "ENOTDIR")) {
          return true;
        }
        throw error;
      }
      await syncDirectory(this.lockPath);

      await this.hooks.beforeStaleLockIsolation?.({
        lockPath: this.lockPath,
        ownerToken: generation.metadata.ownerToken,
        reclaimerToken
      });
      if (!await this.matchesClaimedGeneration(
        this.lockPath,
        claimedFileName,
        generation.metadata.ownerToken,
        reclaimerToken
      )) {
        throw new TaskGraphError(
          "LOCK_RECOVERY_REQUIRED",
          "Task graph lock recovery generation changed before isolation",
          { lockPath: this.lockPath, reclaimerToken }
        );
      }
      const quarantinePath = `${this.lockPath}.quarantine-${this.nextUuid("lock quarantine id")}`;
      try {
        await fs.rename(this.lockPath, quarantinePath);
      } catch (error) {
        if (isErrno(error, "ENOENT")) return true;
        throw error;
      }
      if (!await this.matchesClaimedGeneration(
        quarantinePath,
        claimedFileName,
        generation.metadata.ownerToken,
        reclaimerToken
      )) {
        throw new TaskGraphError(
          "LOCK_RECOVERY_REQUIRED",
          "Isolated task graph lock does not match the claimed recovery generation",
          { quarantinePath, reclaimerToken }
        );
      }
      await this.removeQuarantine(quarantinePath).catch(() => undefined);
      return true;
    } catch (error) {
      if (error instanceof TaskGraphError) throw error;
      if (error instanceof Error && "code" in error) {
        throw new TaskGraphError(
          "LOCK_RECOVERY_REQUIRED",
          "Task graph lock recovery requires inspection before retrying",
          {
            lockPath: this.lockPath,
            fileErrorCode: (error as NodeJS.ErrnoException).code ?? "UNKNOWN",
            cause: error,
            recoveryAction: "Inspect the lock generation and retry only after ownership is clear"
          },
          { cause: error }
        );
      }
      throw error;
    }
  }

  private async readLockGeneration(lockDirectory: string): Promise<LockGeneration | null> {
    let entries: Array<{ name: string; isFile(): boolean }>;
    try {
      entries = await fs.readdir(lockDirectory, { withFileTypes: true });
    } catch (error) {
      if (isErrno(error, "ENOENT") || isErrno(error, "ENOTDIR")) return null;
      throw error;
    }
    const ownerEntries = entries.filter((entry) =>
      ownerFilePattern.test(entry.name) || claimedOwnerFilePattern.test(entry.name)
    );
    if (ownerEntries.length === 0) return null;
    if (ownerEntries.length !== 1 || ownerEntries[0]?.isFile() !== true) {
      throw new TaskGraphError(
        "LOCK_RECOVERY_REQUIRED",
        "Task graph lock must contain exactly one regular owner generation file",
        { lockPath: lockDirectory, ownerEntries: ownerEntries.map((entry) => entry.name) }
      );
    }
    const entry = ownerEntries[0];
    const plainMatch = ownerFilePattern.exec(entry.name);
    const claimedMatch = claimedOwnerFilePattern.exec(entry.name);
    const tokenFromName = plainMatch?.[1] ?? claimedMatch?.[1] ?? null;
    const claimantToken = claimedMatch?.[2] ?? null;
    const ownerPath = path.join(lockDirectory, entry.name);
    const input = await this.readRegularGenerationJson(
      ownerPath,
      "task graph owner generation"
    );
    if (input === null) return null;
    const metadata = parseLockMetadata(input);
    if (metadata === null || metadata.ownerToken !== tokenFromName) {
      throw new TaskGraphError(
        "LOCK_RECOVERY_REQUIRED",
        "Task graph owner metadata does not match its generation filename",
        { lockPath: lockDirectory, ownerFileName: entry.name }
      );
    }
    if (claimantToken === null) {
      return { claimant: null, claimantToken: null, metadata, ownerFileName: entry.name };
    }
    const claimantPath = path.join(lockDirectory, reclaimerFileName(claimantToken));
    const claimantInput = await this.readRegularGenerationJson(
      claimantPath,
      "task graph reclaimer generation"
    );
    if (claimantInput === null) {
      if (await lstatOrNull(ownerPath) === null) return null;
      throw new TaskGraphError(
        "LOCK_RECOVERY_REQUIRED",
        "Claimed task graph owner is missing its generation-bound reclaimer",
        { lockPath: lockDirectory, ownerFileName: entry.name, claimantToken }
      );
    }
    const claimant = parseLockRecoveryMetadata(claimantInput);
    if (
      claimant === null
      || claimant.reclaimerToken !== claimantToken
      || claimant.observedOwnerToken !== metadata.ownerToken
    ) {
      throw new TaskGraphError(
        "LOCK_RECOVERY_REQUIRED",
        "Claimed task graph owner has invalid reclaimer metadata",
        { lockPath: lockDirectory, ownerFileName: entry.name, claimantToken }
      );
    }
    return { claimant, claimantToken, metadata, ownerFileName: entry.name };
  }

  private async matchesClaimedGeneration(
    lockDirectory: string,
    claimedFileName: string,
    ownerToken: string,
    reclaimerToken: string
  ): Promise<boolean> {
    const ownerInput = await this.readRegularGenerationJson(
      path.join(lockDirectory, claimedFileName),
      "claimed task graph owner generation"
    );
    const reclaimerInput = await this.readRegularGenerationJson(
      path.join(lockDirectory, reclaimerFileName(reclaimerToken)),
      "task graph reclaimer generation"
    );
    if (ownerInput === null || reclaimerInput === null) return false;
    const owner = parseLockMetadata(ownerInput);
    const reclaimer = parseLockRecoveryMetadata(reclaimerInput);
    if (owner === null || reclaimer === null) {
      throw new TaskGraphError(
        "LOCK_RECOVERY_REQUIRED",
        "Task graph recovery generation metadata is invalid",
        { lockPath: lockDirectory, claimedFileName, reclaimerToken }
      );
    }
    return owner.ownerToken === ownerToken
      && reclaimer.reclaimerToken === reclaimerToken
      && reclaimer.observedOwnerToken === ownerToken;
  }

  private async readRegularGenerationJson(
    target: string,
    label: string
  ): Promise<unknown | null> {
    const stat = await lstatOrNull(target);
    if (stat === null) return null;
    if (!stat.isFile() || stat.isSymbolicLink()) {
      throw new TaskGraphError(
        "LOCK_RECOVERY_REQUIRED",
        `${label} must be a regular non-symbolic file`,
        { path: target }
      );
    }
    try {
      return JSON.parse(await fs.readFile(target, "utf8")) as unknown;
    } catch (error) {
      if (isErrno(error, "ENOENT") || isErrno(error, "ENOTDIR")) return null;
      if (error instanceof SyntaxError) {
        throw new TaskGraphError(
          "LOCK_RECOVERY_REQUIRED",
          `${label} contains invalid JSON`,
          { path: target }
        );
      }
      throw error;
    }
  }

  private async removeOwnReclaimerFile(reclaimerPath: string): Promise<void> {
    try {
      await fs.unlink(reclaimerPath);
    } catch (error) {
      if (!isErrno(error, "ENOENT") && !isErrno(error, "ENOTDIR")) throw error;
    }
  }

  private async verifyLock(lock: LockHandle): Promise<void> {
    let metadata: LockMetadata | null = null;
    try {
      const metadataPath = path.join(lock.path, lock.ownerFileName);
      const stat = await fs.lstat(metadataPath);
      if (!stat.isFile() || stat.isSymbolicLink()) {
        throw new Error("lock owner generation is not a regular file");
      }
      const input: unknown = JSON.parse(
        await fs.readFile(metadataPath, "utf8")
      );
      metadata = parseLockMetadata(input);
    } catch {
      // Mapped to the stable ownership failure below.
    }
    if (metadata?.ownerToken !== lock.metadata.ownerToken) {
      throw new TaskGraphError(
        "LOCK_LOST",
        "Task graph lock ownership changed before commit",
        { lockPath: lock.path, ownerToken: lock.metadata.ownerToken }
      );
    }
  }

  private async commit(
    previousRevision: number | null,
    candidate: TaskIndex,
    lock: LockHandle
  ): Promise<void> {
    await this.verifyLock(lock);
    const text = serializeTaskIndex(candidate);
    const temporaryPath = `${this.indexPath}.tmp-${this.nextUuid("temporary file id")}`;
    await assertNoSymbolicPath(temporaryPath, "WRITE_FAILED");
    let handle: fs.FileHandle | null = null;
    let committed = false;
    let temporaryCreated = false;
    try {
      handle = await fs.open(temporaryPath, "wx");
      temporaryCreated = true;
      await handle.writeFile(text, "utf8");
      await handle.sync();
      await handle.close();
      handle = null;
      await this.verifyLock(lock);
      await this.hooks.beforeCommit?.({
        indexPath: this.indexPath,
        revision: candidate.revision
      });
      await this.verifyLock(lock);
      try {
        await (this.hooks.replaceFile ?? fs.rename)(temporaryPath, this.indexPath);
        committed = true;
      } catch (error) {
        await this.classifyReplaceFailure(previousRevision, candidate.revision, error);
      }
      try {
        await syncDirectory(path.dirname(this.indexPath));
        const readBack = await this.read();
        if (
          readBack.index.revision !== candidate.revision
          || readBack.text !== text
        ) {
          throw new Error("task index read-back did not match the committed candidate");
        }
        await this.hooks.afterCommit?.({
          indexPath: this.indexPath,
          revision: candidate.revision
        });
      } catch (error) {
        throw this.writeOutcomeUnknown(candidate.revision, error);
      }
    } catch (error) {
      if (error instanceof TaskGraphError) {
        throw error;
      }
      throw new TaskGraphError(
        committed ? "WRITE_OUTCOME_UNKNOWN" : "WRITE_FAILED",
        committed
          ? "Task index may have committed but the result could not be confirmed"
          : "Task index write failed before the commit point",
        committed
          ? this.unknownOutcomeDetails(candidate.revision, error)
          : { indexPath: this.indexPath, cause: error },
        error instanceof Error ? { cause: error } : undefined
      );
    } finally {
      await handle?.close().catch(() => undefined);
      if (temporaryCreated) {
        await fs.unlink(temporaryPath).catch((error) => {
          if (!isErrno(error, "ENOENT")) {
            // The deterministic temp prefix remains ignored and can be inspected.
          }
        });
      }
    }
  }

  private async classifyReplaceFailure(
    previousRevision: number | null,
    candidateRevision: number,
    cause: unknown
  ): Promise<never> {
    let observedRevision: number | null | "unreadable" = "unreadable";
    try {
      observedRevision = (await this.read()).index.revision;
    } catch (error) {
      if (previousRevision === null && error instanceof TaskGraphError && error.code === "INDEX_NOT_FOUND") {
        observedRevision = null;
      }
    }
    if (observedRevision === previousRevision) {
      throw new TaskGraphError(
        "WRITE_FAILED",
        "Atomic replace failed and the previous task index is still current",
        {
          indexPath: this.indexPath,
          previousRevision,
          candidateRevision,
          observedRevision,
          committed: false,
          cause
        },
        cause instanceof Error ? { cause } : undefined
      );
    }
    throw this.writeOutcomeUnknown(candidateRevision, cause, observedRevision);
  }

  private unknownOutcomeDetails(
    possibleRevision: number,
    cause: unknown,
    observedRevision: number | null | "unreadable" = "unreadable"
  ): JsonObject {
    return new TaskGraphError("WRITE_OUTCOME_UNKNOWN", "details", {
      indexPath: this.indexPath,
      possibleRevision,
      observedRevision,
      recoveryAction: "Run index info and index check before attempting another mutation",
      cause
    }).details;
  }

  private writeOutcomeUnknown(
    possibleRevision: number,
    cause: unknown,
    observedRevision: number | null | "unreadable" = "unreadable"
  ): TaskGraphError {
    return new TaskGraphError(
      "WRITE_OUTCOME_UNKNOWN",
      "Task index write outcome is unknown; re-query before any retry",
      this.unknownOutcomeDetails(possibleRevision, cause, observedRevision),
      cause instanceof Error ? { cause } : undefined
    );
  }

  private async releaseLock(lock: LockHandle): Promise<void> {
    await this.verifyLock(lock);
    const quarantinePath = `${lock.path}.quarantine-${this.nextUuid("lock release id")}`;
    await this.hooks.beforeLockReleaseIsolation?.({
      lockPath: lock.path,
      ownerToken: lock.metadata.ownerToken,
      quarantinePath
    });
    await this.verifyLock(lock);
    try {
      await fs.rename(lock.path, quarantinePath);
    } catch (error) {
      if (isErrno(error, "ENOENT")) {
        throw new TaskGraphError(
          "LOCK_LOST",
          "Task graph lock disappeared before release",
          { lockPath: lock.path }
        );
      }
      throw error;
    }
    await this.removeQuarantine(quarantinePath).catch(() => undefined);
  }

  private async discardFreshLockDirectory(ownerToken: string): Promise<boolean> {
    let ownsGeneration = false;
    const publishedMetadataPath = path.join(this.lockPath, ownerFileName(ownerToken));
    try {
      const input: unknown = JSON.parse(
        await fs.readFile(publishedMetadataPath, "utf8")
      );
      const publishedOwner = parseLockMetadata(input)?.ownerToken;
      if (publishedOwner !== ownerToken) {
        return false;
      }
      ownsGeneration = true;
    } catch (error) {
      if (!isErrno(error, "ENOENT") && !isErrno(error, "ENOTDIR")) {
        return false;
      }
    }
    const temporaryMetadataPath = path.join(this.lockPath, `${ownerFileName(ownerToken)}.tmp`);
    if (!ownsGeneration) {
      try {
        ownsGeneration = (await fs.lstat(temporaryMetadataPath)).isFile();
      } catch (error) {
        if (!isErrno(error, "ENOENT") && !isErrno(error, "ENOTDIR")) {
          return false;
        }
      }
    }
    if (!ownsGeneration) {
      return false;
    }
    let ownerEntries: string[];
    try {
      ownerEntries = await fs.readdir(this.lockPath);
    } catch {
      return false;
    }
    if (ownerEntries.some((entry) =>
      (ownerFilePattern.test(entry) || claimedOwnerFilePattern.test(entry))
      && entry !== ownerFileName(ownerToken)
    )) {
      return false;
    }
    const quarantinePath = `${this.lockPath}.quarantine-${ownerToken}`;
    try {
      await fs.rename(this.lockPath, quarantinePath);
    } catch (error) {
      return isErrno(error, "ENOENT");
    }
    await this.removeQuarantine(quarantinePath).catch(() => undefined);
    return true;
  }

  private async verifyFreshLockGeneration(ownerToken: string): Promise<void> {
    const metadataFileName = ownerFileName(ownerToken);
    const metadataPath = path.join(this.lockPath, metadataFileName);
    const temporaryMetadataPath = path.join(this.lockPath, `${metadataFileName}.tmp`);
    const [metadata, temporaryMetadata, entries] = await Promise.all([
      lstatOrNull(metadataPath),
      lstatOrNull(temporaryMetadataPath),
      fs.readdir(this.lockPath)
    ]).catch((error) => {
      throwFileBoundaryError(
        error,
        "LOCK_RECOVERY_REQUIRED",
        "Unable to verify fresh task graph lock generation",
        this.lockPath
      );
    });
    const anotherOwnerGeneration = entries.some((entry) =>
      (ownerFilePattern.test(entry) || claimedOwnerFilePattern.test(entry))
      && entry !== metadataFileName
    );
    if (
      metadata !== null
      || temporaryMetadata?.isFile() !== true
      || anotherOwnerGeneration
    ) {
      throw new TaskGraphError(
        "LOCK_LOST",
        "Fresh task graph lock generation changed before metadata publication",
        { lockPath: this.lockPath, ownerToken }
      );
    }
  }

  private async removeQuarantine(quarantinePath: string): Promise<void> {
    await assertNoSymbolicPath(quarantinePath, "LOCK_RECOVERY_REQUIRED");
    const entries = await fs.readdir(quarantinePath, { withFileTypes: true });
    for (const entry of entries) {
      if (
        !entry.isFile()
        || (!ownerFilePattern.test(entry.name)
          && !claimedOwnerFilePattern.test(entry.name)
          && !reclaimerFilePattern.test(entry.name)
          && !temporaryOwnerFilePattern.test(entry.name))
      ) {
        throw new TaskGraphError(
          "LOCK_RECOVERY_REQUIRED",
          "Quarantined task graph lock contains an unexpected entry",
          { quarantinePath, entry: entry.name }
        );
      }
      await fs.unlink(path.join(quarantinePath, entry.name));
    }
    await fs.rmdir(quarantinePath);
  }

  private nextUuid(label: string): string {
    const value = this.idGenerator();
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u.test(value)) {
      throw new TaskGraphError(
        "ARGUMENT_INVALID",
        `${label} generator returned a non-canonical UUID`,
        { value }
      );
    }
    return value;
  }
}

export function createTaskGraphStore(
  options: TaskGraphStoreOptions = {}
): TaskGraphStore {
  return new TaskGraphStore(options);
}
