import { constants, type Stats } from "node:fs";
import type { FileHandle } from "node:fs/promises";
import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { isFileSystemError } from "../../shared/src/node/filesystem.ts";

import {
  inspectRecordParents,
  readRecordFileSnapshot,
  sameRecordBytes,
  sameRecordFile,
  sameRecordIdentity,
  verifyRecordFile,
  type RecordFileSnapshot,
  type RecordWriteIdentity
} from "./transaction-snapshot.ts";
export {
  readRecordFileSnapshot,
  sameRecordBytes,
  sameRecordFile,
  verifyRecordFile,
  type RecordFileSnapshot,
  type RecordWriteIdentity
} from "./transaction-snapshot.ts";

/** Exact mode preserves representation; creationMode is a native umask/ACL request. */
export type RecordWritePermissions =
  | Readonly<{ mode?: number; creationMode?: never }>
  | Readonly<{ mode?: never; creationMode: number }>;

export type RecordFileWrite = Readonly<
  {
    path: string;
    before: RecordFileSnapshot | null;
    next: Uint8Array | null;
    /** Existing test/publication seam; returning does not prove the written bytes. */
    write?: (
      target: string,
      bytes: Uint8Array
    ) => Promise<void | RecordWriteIdentity>;
  } & RecordWritePermissions
>;

export type RecordWrittenFile = Readonly<{
  change: RecordFileWrite;
  written: RecordFileSnapshot | null;
  owned?: boolean;
}>;

export type RecordCreatedDirectory = Readonly<{
  path: string;
  dev: number;
  ino: number;
  mode: number;
}>;

export class RecordAtomicCleanupError extends Error {
  readonly target: string;
  readonly temporaryPath: string;
  readonly identity: RecordWriteIdentity | undefined;
  constructor(
    target: string,
    temporaryPath: string,
    cause: unknown,
    identity?: RecordWriteIdentity
  ) {
    super("Record index published but temporary cleanup failed: " + target, {
      cause
    });
    this.name = "RecordAtomicCleanupError";
    this.target = target;
    this.temporaryPath = temporaryPath;
    this.identity = identity;
  }
}

/** Formal index publication preserves representation and uses exclusive creation when absent. */
export async function writeRecordFileAtomically(
  root: string,
  change: RecordFileWrite,
  stagingDirectory = path.dirname(change.path)
): Promise<RecordWriteIdentity> {
  if (change.next === null)
    throw new Error("Atomic publication requires bytes");
  await verifyRecordFile(root, change.path, change.before);
  const temporary = path.join(
    stagingDirectory,
    "." + path.basename(change.path) + "." + randomUUID() + ".publish"
  );
  await inspectRecordParents(root, temporary);
  if (
    (await fs.stat(stagingDirectory)).dev !==
    (await fs.stat(path.dirname(change.path))).dev
  )
    throw new Error(
      "Record publication staging must share the collection filesystem"
    );
  const handle = await fs.open(temporary, "wx", recordFileOpenMode(change));
  let identity: RecordWriteIdentity;
  let published = false;
  let operationError: unknown;
  let cleanupError: unknown;
  try {
    await handle.writeFile(change.next);
    identity = await captureRecordHandle(handle, change);
    await handle.sync();
    await handle.close();
    await verifyRecordFile(root, change.path, change.before);
    if (change.before === null) await fs.link(temporary, change.path);
    else await fs.rename(temporary, change.path);
    published = true;
  } catch (error) {
    operationError = error;
  }
  await handle.close().catch(() => undefined);
  try {
    await fs.unlink(temporary);
  } catch (error) {
    if (!isFileSystemError(error, "ENOENT")) cleanupError = error;
  }
  if (cleanupError !== undefined) {
    if (published)
      throw new RecordAtomicCleanupError(
        change.path,
        temporary,
        cleanupError,
        identity!
      );
    if (operationError !== undefined)
      throw new AggregateError(
        [operationError, cleanupError],
        "Record publication and temporary cleanup both failed"
      );
    throw cleanupError;
  }
  if (operationError !== undefined) throw operationError;
  return identity!;
}

/** Writes only this file; the caller records completion before further work. */
export async function writeRecordFile(
  root: string,
  change: RecordFileWrite
): Promise<RecordWriteIdentity | null | undefined> {
  const openMode = recordFileOpenMode(change);
  await verifyRecordFile(root, change.path, change.before);
  if (change.next === null) {
    await fs.unlink(change.path);
    return null;
  }
  if (change.write !== undefined) {
    return (await change.write(change.path, change.next)) ?? undefined;
  }
  const handle = await fs.open(
    change.path,
    change.before === null ? "wx" : constants.O_WRONLY | constants.O_NOFOLLOW,
    openMode
  );
  let identity: RecordWriteIdentity;
  try {
    const opened = await handle.stat();
    verifyWritableHandle(opened, change);
    await handle.writeFile(change.next);
    await handle.truncate(change.next.byteLength);
    identity = await captureRecordHandle(handle, change);
  } finally {
    await handle.close();
  }
  return identity!;
}

export async function captureRecordWrite(
  root: string,
  change: RecordFileWrite,
  identity?: RecordWriteIdentity | null
): Promise<RecordFileSnapshot | null> {
  const written = await readRecordFileSnapshot(root, change.path);
  verifyWriteIdentity(written, identity, change.path);
  if (!recordWriteMatches(change, written, identity))
    throw new Error(
      "Transaction write failed byte/mode readback: " + change.path
    );
  return written;
}

/** 返回值只证明动作结果的字节与表示，不单独证明写入归属。 */
export function recordWriteMatches(
  change: RecordFileWrite,
  written: RecordFileSnapshot | null,
  identity?: RecordWriteIdentity | null
): boolean {
  if (change.next === null) return written === null;
  return (
    written !== null &&
    sameRecordBytes(written.bytes, change.next) &&
    written.mode ===
      (change.creationMode === undefined
        ? (change.mode ?? change.before?.mode ?? 0o644)
        : identity?.mode)
  );
}

/** Permission intent must be valid even when a journal would otherwise skip an unchanged write. */
export function validateRecordWritePermissions(change: RecordFileWrite): void {
  if (change.creationMode === undefined) return;
  if (
    change.before !== null ||
    change.mode !== undefined ||
    change.next === null
  )
    throw new Error(
      "Native creation mode requires an absent target and no exact mode"
    );
}

function recordFileOpenMode(change: RecordFileWrite): number {
  validateRecordWritePermissions(change);
  return change.creationMode ?? change.mode ?? change.before?.mode ?? 0o644;
}

async function captureRecordHandle(
  handle: FileHandle,
  change: RecordFileWrite
): Promise<RecordWriteIdentity> {
  if (change.creationMode === undefined)
    await handle.chmod(recordFileOpenMode(change));
  const actual = await handle.stat();
  return { dev: actual.dev, ino: actual.ino, mode: actual.mode & 0o7777 };
}

/** 写入打开的实际 handle 必须仍是准备时的成员与权限。 */
function verifyWritableHandle(opened: Stats, change: RecordFileWrite): void {
  if (change.before === null) return;
  if (
    !sameRecordIdentity(opened, change.before) ||
    (opened.mode & 0o7777) !== change.before.mode
  )
    throw new Error("Transaction member changed before write: " + change.path);
}

/** 目标 readback 不得把关闭 handle 后出现的同字节新 inode 当成本事务写入。 */
function verifyWriteIdentity(
  written: RecordFileSnapshot | null,
  identity: RecordWriteIdentity | null | undefined,
  target: string
): void {
  if (identity === undefined || identity === null) {
    return;
  }
  if (
    written === null ||
    !sameRecordIdentity(written, identity) ||
    (identity.mode !== undefined && written.mode !== identity.mode)
  ) {
    throw new Error(
      "Transaction write identity differs from its actual handle: " + target
    );
  }
}

/** Reverse only completed writes that still belong to this transaction. */
export async function restoreRecordWrites(
  root: string,
  writes: readonly RecordWrittenFile[]
): Promise<unknown[]> {
  const errors: unknown[] = [];
  for (const { change, written, owned } of [...writes].reverse()) {
    try {
      if (owned === false)
        throw new Error(
          "Transaction writer did not prove ownership; retain current path: " +
            change.path
        );
      await verifyRecordFile(root, change.path, written);
      if (change.before === null) await fs.unlink(change.path);
      else {
        await writeRecordFile(root, {
          path: change.path,
          before: written,
          next: change.before.bytes,
          mode: change.before.mode
        });
        const restored = await readRecordFileSnapshot(root, change.path);
        if (!sameRecordFile(restored, change.before, false))
          throw new Error(
            "Restored member does not match its old bytes/mode: " + change.path
          );
      }
    } catch (error) {
      errors.push(error);
    }
  }
  return errors;
}

export async function createRecordWriteParents(
  root: string,
  target: string,
  created: RecordCreatedDirectory[]
): Promise<void> {
  await inspectRecordParents(root, target);
  let current = root;
  for (const component of path
    .relative(root, path.dirname(target))
    .split(path.sep)
    .filter(Boolean)) {
    current = path.join(current, component);
    let made = false;
    try {
      await fs.mkdir(current);
      made = true;
    } catch (error) {
      if (!isFileSystemError(error, "EEXIST")) throw error;
    }
    const stats = await fs.lstat(current);
    if (!stats.isDirectory() || stats.isSymbolicLink())
      throw new Error("Transaction parent became unsafe: " + current);
    if (made)
      created.push({
        path: current,
        dev: stats.dev,
        ino: stats.ino,
        mode: stats.mode & 0o7777
      });
  }
}

export async function restoreRecordDirectories(
  created: readonly RecordCreatedDirectory[]
): Promise<unknown[]> {
  const errors: unknown[] = [];
  for (const directory of [...created].reverse()) {
    try {
      const current = await fs.lstat(directory.path);
      if (
        !current.isDirectory() ||
        current.isSymbolicLink() ||
        !sameRecordIdentity(current, directory) ||
        (current.mode & 0o7777) !== directory.mode
      )
        throw new Error(
          "Created transaction directory changed: " + directory.path
        );
      await fs.rmdir(directory.path);
    } catch (error) {
      errors.push(error);
    }
  }
  return errors;
}
