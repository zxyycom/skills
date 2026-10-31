/*
 * Synced TypeScript runtime; repository maintenance edits tools/record-operations/src/transactions/transaction-snapshot.ts.
 * Installed skill copies may be edited directly; updates overwrite matching files.
 * Repository: https://github.com/zxyycom/skills
 * Source path: tools/record-operations/src/transactions/transaction-snapshot.ts
 * Maintained source: https://github.com/zxyycom/skills/blob/main/tools/record-operations/src/transactions/transaction-snapshot.ts
 * Skill source directory: https://github.com/zxyycom/skills/tree/main/skills/decision-records
 * Rebuild: bun run sync:decision-records-cli
 */
import { constants, type Stats } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import {
  isFileSystemError,
  isPathWithinDirectory
} from "../../../shared/src/node/filesystem.ts";

export type RecordFileSnapshot = Readonly<{
  bytes: Uint8Array;
  dev: number;
  ino: number;
  mode: number;
  parents: readonly Readonly<{ dev: number; ino: number }>[];
}>;

/** Facts from one preparation read, explicitly anchored to the transaction namespace. */
export type RecordTextSnapshot = Readonly<{
  root: string;
  path: string;
  text: string;
  snapshot: RecordFileSnapshot;
}>;

export async function readRecordTextSnapshot(
  root: string,
  target: string
): Promise<RecordTextSnapshot> {
  const snapshot = await readRecordFileSnapshot(root, target);
  if (snapshot === null)
    throw Object.assign(new Error("Record source is missing: " + target), {
      code: "ENOENT"
    });
  return {
    root: path.resolve(root),
    path: path.resolve(target),
    text: new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(
      snapshot.bytes
    ),
    snapshot
  };
}

/** Same-stage proof transfer never re-anchors parents or substitutes a later read. */
export function requireRecordTextSnapshot(
  captured: RecordTextSnapshot,
  root: string,
  target: string,
  expected: string
): RecordFileSnapshot {
  if (
    captured.root !== path.resolve(root) ||
    captured.path !== path.resolve(target) ||
    captured.text !== expected ||
    !sameRecordBytes(captured.snapshot.bytes, Buffer.from(expected))
  )
    throw new Error(
      "Prepared source proof does not match its transaction root, path or text: " +
        target
    );
  return captured.snapshot;
}

export type RecordWriteIdentity = Readonly<{
  dev: number;
  ino: number;
  /** Actual permissions from the writing handle, not a later path observation. */
  mode?: number;
}>;

/** The canonical root and every parent stay safe during this one read. */
export async function readRecordFileSnapshot(
  root: string,
  target: string
): Promise<RecordFileSnapshot | null> {
  const parents = await inspectRecordParents(root, target);
  let initial: Stats;
  try {
    initial = await fs.lstat(target);
  } catch (error) {
    if (!isFileSystemError(error, "ENOENT")) throw error;
    await verifyParents(root, target, parents);
    return null;
  }
  requireRecordSnapshotEntry(initial, target);
  const handle = await fs.open(
    target,
    constants.O_RDONLY | constants.O_NOFOLLOW
  );
  try {
    const opened = await handle.stat();
    if (!sameRecordIdentity(initial, opened))
      throw new Error("Transaction member changed while opening: " + target);
    const bytes = await handle.readFile();
    const final = await handle.stat();
    const located = await fs.lstat(target);
    await verifyParents(root, target, parents);
    verifyReadSnapshot(opened, final, located, bytes.byteLength, target);
    return {
      bytes,
      dev: final.dev,
      ino: final.ino,
      mode: final.mode & 0o7777,
      parents: parents.map(({ dev, ino }) => ({ dev, ino }))
    };
  } finally {
    await handle.close();
  }
}

/** 读取返回前，把 handle 修订与当前路径成员绑定为同一个安全证明。 */
export function verifyReadSnapshot(
  opened: Stats,
  final: Stats,
  located: Stats,
  byteLength: number,
  target: string
): void {
  if (
    !sameReadRevision(opened, final, byteLength) ||
    !sameRecordIdentity(final, located) ||
    !located.isFile() ||
    located.isSymbolicLink() ||
    final.mode !== located.mode
  )
    throw new Error("Transaction member changed while reading: " + target);
}

/** 同一 handle 的读取证明同时绑定身份、表示、字节长度与内容修订。 */
function sameReadRevision(
  before: Stats,
  after: Stats,
  byteLength: number
): boolean {
  return (
    sameRecordIdentity(before, after) &&
    before.mode === after.mode &&
    before.size === byteLength &&
    after.size === byteLength &&
    before.mtimeMs === after.mtimeMs &&
    before.ctimeMs === after.ctimeMs
  );
}

export function sameRecordFile(
  left: RecordFileSnapshot | null,
  right: RecordFileSnapshot | null,
  identity = true
): boolean {
  if (left === null || right === null) return left === right;
  return (
    (!identity ||
      (sameRecordIdentity(left, right) &&
        left.parents.length === right.parents.length &&
        left.parents.every((parent, index) =>
          sameRecordIdentity(parent, right.parents[index]!)
        ))) &&
    left.mode === right.mode &&
    sameRecordBytes(left.bytes, right.bytes)
  );
}

export function sameRecordBytes(left: Uint8Array, right: Uint8Array): boolean {
  return (
    left.byteLength === right.byteLength &&
    left.every((byte, index) => byte === right[index])
  );
}

export async function verifyRecordFile(
  root: string,
  target: string,
  expected: RecordFileSnapshot | null
): Promise<void> {
  if (!sameRecordFile(await readRecordFileSnapshot(root, target), expected))
    throw new Error("Transaction member changed: " + target);
}

export function sameRecordIdentity(
  left: Readonly<{ dev: number; ino: number }>,
  right: Readonly<{ dev: number; ino: number }>
): boolean {
  return left.dev === right.dev && left.ino === right.ino;
}

export async function inspectRecordParents(
  root: string,
  target: string
): Promise<readonly Stats[]> {
  requireRecordSnapshotRoot(root, target, await fs.realpath(root));
  const parents: Stats[] = [];
  let current = root;
  for (const component of [
    "",
    ...path.relative(root, path.dirname(target)).split(path.sep).filter(Boolean)
  ]) {
    current = path.join(current, component);
    let stats: Stats;
    try {
      stats = await fs.lstat(current);
    } catch (error) {
      if (isFileSystemError(error, "ENOENT")) break;
      throw error;
    }
    requireRecordSnapshotParent(stats, current);
    parents.push(stats);
  }
  return parents;
}

async function verifyParents(
  root: string,
  target: string,
  expected: readonly Stats[]
): Promise<void> {
  const current = await inspectRecordParents(root, target);
  if (
    current.length !== expected.length ||
    current.some((stats, index) => !sameRecordIdentity(stats, expected[index]!))
  )
    throw new Error("Transaction parent identity changed: " + target);
}

export function requireRecordSnapshotEntry(stats: Stats, target: string): void {
  if (!stats.isFile() || stats.isSymbolicLink())
    throw new Error(
      "Transaction member must be a regular non-symbolic-link file: " + target
    );
}
export function requireRecordSnapshotRoot(
  root: string,
  target: string,
  canonical: string
): void {
  if (
    canonical !== path.resolve(root) ||
    !isPathWithinDirectory(path.resolve(target), path.resolve(root)) ||
    path.resolve(target) === path.resolve(root)
  )
    throw new Error("Transaction path escaped its canonical root: " + target);
}
export function requireRecordSnapshotParent(
  stats: Stats,
  current: string
): void {
  if (!stats.isDirectory() || stats.isSymbolicLink())
    throw new Error(
      "Transaction parent must be a non-symbolic-link directory: " + current
    );
}
