/*
 * Synced TypeScript runtime; repository maintenance edits tools/record-operations/src/reader-sync.ts.
 * Installed skill copies may be edited directly; updates overwrite matching files.
 * Repository: https://github.com/zxyycom/skills
 * Source path: tools/record-operations/src/reader-sync.ts
 * Maintained source: https://github.com/zxyycom/skills/blob/main/tools/record-operations/src/reader-sync.ts
 * Skill source directory: https://github.com/zxyycom/skills/tree/main/skills/decision-records
 * Rebuild: bun run sync:decision-records-cli
 */
import fs, { constants, type Stats } from "node:fs";
import path from "node:path";
import {
  isFileSystemError,
  isPathWithinDirectory
} from "../../shared/src/node/filesystem.ts";
import {
  assertStableSource,
  sameSourceIdentity,
  requireSourceComponent,
  requireSourceDirectory
} from "./source.ts";
import {
  requireRecordSnapshotEntry,
  requireRecordSnapshotRoot,
  requireRecordSnapshotParent,
  sameRecordIdentity,
  verifyReadSnapshot,
  type RecordFileSnapshot
} from "./transaction-snapshot.ts";

/** Worker-owned synchronous I/O; pure read/revision rules stay with the async owners. */
export function readRecordTextSync(root: string, sourcePath: string): string {
  if (fs.realpathSync(root) !== path.resolve(root)) {
    throw new Error(
      "record collection canonical identity changed before reading"
    );
  }
  const target = path.resolve(root, sourcePath);
  if (!isPathWithinDirectory(target, root) || target === root) {
    throw new Error("record source must stay within its collection");
  }
  const beforePath = inspectSourcePath(root, target);
  const fd = fs.openSync(target, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const before = fs.fstatSync(fd);
    if (!before.isFile() || !sameSourceIdentity(beforePath.entry, before)) {
      throw new Error("record source changed while opening the file");
    }
    const bytes = fs.readFileSync(fd);
    const after = fs.fstatSync(fd);
    assertStableSource(
      before,
      after,
      beforePath,
      inspectSourcePath(root, target)
    );
    return new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(
      bytes
    );
  } finally {
    fs.closeSync(fd);
  }
}

function inspectSourcePath(root: string, target: string) {
  const rootStats = fs.lstatSync(root);
  requireSourceDirectory(rootStats);
  const parents = [{ dev: rootStats.dev, ino: rootStats.ino }];
  let current = root;
  const components = path.relative(root, target).split(path.sep);
  for (const [index, component] of components.entries()) {
    current = path.join(current, component);
    const stats = fs.lstatSync(current);
    requireSourceComponent(stats, index === components.length - 1);
    if (index < components.length - 1)
      parents.push({ dev: stats.dev, ino: stats.ino });
  }
  if (fs.realpathSync(target) !== target)
    throw new Error("record source escaped its canonical collection");
  return { entry: fs.lstatSync(target), parents };
}

export function readRecordFileSnapshotSync(
  root: string,
  target: string
): RecordFileSnapshot | null {
  const parents = inspectParents(root, target);
  let initial: Stats;
  try {
    initial = fs.lstatSync(target);
  } catch (error) {
    if (!isFileSystemError(error, "ENOENT")) throw error;
    verifyParents(root, target, parents);
    return null;
  }
  requireRecordSnapshotEntry(initial, target);
  const fd = fs.openSync(target, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const opened = fs.fstatSync(fd);
    if (!sameRecordIdentity(initial, opened))
      throw new Error("Transaction member changed while opening: " + target);
    const bytes = fs.readFileSync(fd);
    const final = fs.fstatSync(fd);
    const located = fs.lstatSync(target);
    verifyParents(root, target, parents);
    verifyReadSnapshot(opened, final, located, bytes.byteLength, target);
    return {
      bytes,
      dev: final.dev,
      ino: final.ino,
      mode: final.mode & 0o7777,
      parents: parents.map(({ dev, ino }) => ({ dev, ino }))
    };
  } finally {
    fs.closeSync(fd);
  }
}

function inspectParents(root: string, target: string): readonly Stats[] {
  requireRecordSnapshotRoot(root, target, fs.realpathSync(root));
  const parents: Stats[] = [];
  let current = root;
  for (const component of [
    "",
    ...path.relative(root, path.dirname(target)).split(path.sep).filter(Boolean)
  ]) {
    current = path.join(current, component);
    let stats: Stats;
    try {
      stats = fs.lstatSync(current);
    } catch (error) {
      if (isFileSystemError(error, "ENOENT")) break;
      throw error;
    }
    requireRecordSnapshotParent(stats, current);
    parents.push(stats);
  }
  return parents;
}

function verifyParents(
  root: string,
  target: string,
  expected: readonly Stats[]
): void {
  const current = inspectParents(root, target);
  if (
    current.length !== expected.length ||
    current.some((stats, index) => !sameRecordIdentity(stats, expected[index]!))
  )
    throw new Error("Transaction parent identity changed: " + target);
}
