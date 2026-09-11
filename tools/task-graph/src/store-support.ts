import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import writeFileAtomic from "write-file-atomic";
import { TaskGraphError } from "./errors.ts";
import { defaultTaskGraphIndexPath, type JsonObject } from "./types.ts";
import type { AtomicWrite, TaskGraphStoreOptions } from "./store-contract.ts";

export const defaultSleep = async (milliseconds: number): Promise<void> => {
  await new Promise<void>((resolve) => setTimeout(resolve, milliseconds));
};

export const defaultAtomicWrite: AtomicWrite = async (
  target,
  text,
  options
) => {
  await writeFileAtomic(target, text, options);
};

export function getErrnoCode(error: unknown): string | null {
  return error instanceof Error &&
    "code" in error &&
    typeof (error as NodeJS.ErrnoException).code === "string"
    ? ((error as NodeJS.ErrnoException).code ?? null)
    : null;
}

export function isErrno(error: unknown, code: string): boolean {
  return getErrnoCode(error) === code;
}

export function throwFileBoundaryError(
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

export async function lstatOrNull(
  target: string
): Promise<Awaited<ReturnType<typeof fs.lstat>> | null> {
  try {
    return await fs.lstat(target);
  } catch (error) {
    if (isErrno(error, "ENOENT")) return null;
    throw error;
  }
}

export function resolveIndexPath(root: string, configured?: string): string {
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

export function storePaths(options: TaskGraphStoreOptions): {
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

function invalidLockTiming(
  pollMilliseconds: number,
  waitMilliseconds: number
): TaskGraphError {
  return new TaskGraphError(
    "ARGUMENT_INVALID",
    "Task graph lock timing values must be finite and non-negative",
    {
      lockPollMilliseconds: pollMilliseconds,
      lockWaitMilliseconds: waitMilliseconds
    }
  );
}

function validTimingValue(value: number, permitZero: boolean): boolean {
  return Number.isFinite(value) && (permitZero ? value >= 0 : value > 0);
}

function checkedTimingValue(
  value: number,
  permitZero: boolean,
  pollMilliseconds: number,
  waitMilliseconds: number
): number {
  if (!validTimingValue(value, permitZero))
    throw invalidLockTiming(pollMilliseconds, waitMilliseconds);
  return value;
}

export function lockTiming(options: TaskGraphStoreOptions): {
  pollMilliseconds: number;
  waitMilliseconds: number;
} {
  const pollMilliseconds = options.lockPollMilliseconds ?? 50;
  const waitMilliseconds = options.lockWaitMilliseconds ?? 5_000;
  return {
    pollMilliseconds: checkedTimingValue(
      pollMilliseconds,
      false,
      pollMilliseconds,
      waitMilliseconds
    ),
    waitMilliseconds: checkedTimingValue(
      waitMilliseconds,
      true,
      pollMilliseconds,
      waitMilliseconds
    )
  };
}
