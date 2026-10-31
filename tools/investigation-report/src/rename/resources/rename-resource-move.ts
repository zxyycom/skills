import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import {
  captureRecordWrite,
  readRecordFileSnapshot,
  sameRecordFile,
  verifyRecordFile,
  writeRecordFile
} from "../../../../record-operations/src/transactions/transaction-files.ts";
import { isFileSystemError } from "../../../../shared/src/node/filesystem.ts";
import type { ResourceMove, ResourceMoveProgress } from "../rename-contract.ts";
import {
  directoryIdentity,
  verifyDirectory,
  verifyResourceOwnerSnapshot
} from "./rename-resource-proof.ts";
export {
  verifyResourceOwnerSnapshot,
  verifyResourceSourceProof
} from "./rename-resource-proof.ts";
import { lstatOrNull } from "../rename-support.ts";

/** Resource-owner lifecycle is domain-owned; every changed member has an actual ownership proof. */
export async function moveResourceOwner(
  move: ResourceMove,
  oldId: string,
  newId: string,
  progress: ResourceMoveProgress,
  beforeSourceOwnerRemoval?: () => Promise<void>
): Promise<void> {
  const root = move.root ?? path.dirname(path.dirname(move.from));
  progress.writtenFiles = new Map();
  progress.removedFiles = new Set();
  progress.targetDirectories = new Map();
  progress.removedDirectories = new Set();
  await verifyResourceOwnerSnapshot(move.from, oldId, move.snapshot);
  for (const relative of [
    "",
    ...move.snapshot.directories.map((directory) => directory.path)
  ]) {
    const current = await directoryIdentity(path.join(move.from, relative));
    const before = progress.sourceDirectories.get(relative);
    if (
      before !== undefined &&
      JSON.stringify(current) !== JSON.stringify(before)
    )
      throw new Error(
        "Prepared resource directory changed identity: " + relative
      );
    progress.sourceDirectories.set(relative, current);
  }
  for (const file of move.snapshot.files) {
    const snapshot = await readRecordFileSnapshot(
      root,
      path.join(move.from, file.path)
    );
    if (
      snapshot === null ||
      snapshot.mode !== file.mode ||
      snapshot.bytes.byteLength !== file.size ||
      createHash("sha256").update(snapshot.bytes).digest("hex") !==
        file.contentHash
    )
      throw new Error(
        "Resource source changed after preparation: " + file.path
      );
    const before = progress.sourceFiles.get(file.path);
    if (before !== undefined && !sameRecordFile(before, snapshot))
      throw new Error("Prepared resource file changed identity: " + file.path);
    progress.sourceFiles.set(file.path, snapshot);
  }
  await createResourceDirectory(move.to, "", move.snapshot.mode, progress);
  for (const directory of [...move.snapshot.directories].sort(
    (left, right) => left.path.split("/").length - right.path.split("/").length
  ))
    await createResourceDirectory(
      path.join(move.to, directory.path),
      directory.path,
      directory.mode,
      progress
    );
  for (const [relative, original] of progress.sourceFiles) {
    await verifyRecordFile(root, path.join(move.from, relative), original);
    const change = {
      path: path.join(move.to, relative),
      before: null,
      next: original.bytes,
      mode: original.mode
    };
    try {
      const identity = await writeRecordFile(root, change);
      const written = await captureRecordWrite(root, change, identity);
      if (written === null)
        throw new Error("Resource copy disappeared: " + relative);
      progress.writtenFiles.set(relative, written);
    } catch (error) {
      progress.uncertainWrite = true;
      throw error;
    }
  }
  await verifyResourceOwnerSnapshot(move.to, newId, move.snapshot);
  await verifyResourceOwnerSnapshot(move.from, oldId, move.snapshot);
  await beforeSourceOwnerRemoval?.();
  for (const [relative, original] of progress.sourceFiles) {
    await verifyRecordFile(root, path.join(move.from, relative), original);
    await fs.unlink(path.join(move.from, relative));
    progress.removedFiles.add(relative);
  }
  for (const relative of [...progress.sourceDirectories.keys()].sort(
    (left, right) =>
      right.split("/").length - left.split("/").length ||
      right.length - left.length
  )) {
    await verifyDirectory(
      path.join(move.from, relative),
      progress.sourceDirectories.get(relative)!
    );
    await fs.rmdir(path.join(move.from, relative));
    progress.removedDirectories.add(relative);
  }
}

export {
  restoreResourceOwnerMove,
  removeResourceOwnerCopy,
  verifyResourceOwnerCopy
} from "./rename-resource-recovery.ts";

/** Record successful mkdir before chmod; an unproved created path cannot be rolled back. */
async function createResourceDirectory(
  target: string,
  relative: string,
  mode: number,
  progress: ResourceMoveProgress
): Promise<void> {
  let created = false;
  try {
    await fs.mkdir(target, { mode });
    created = true;
    progress.targetClaimed = true;
    progress.targetDirectories.set(relative, await directoryIdentity(target));
    await fs.chmod(target, mode);
    progress.targetDirectories.set(relative, await directoryIdentity(target));
  } catch (error) {
    await recordDirectoryCreationFailure(
      target,
      relative,
      progress,
      created,
      error
    );
    throw error;
  }
}

async function recordDirectoryCreationFailure(
  target: string,
  relative: string,
  progress: ResourceMoveProgress,
  created: boolean,
  error: unknown
): Promise<void> {
  if (created) {
    if (!progress.targetDirectories.has(relative))
      progress.uncertainWrite = true;
    return;
  }
  if (isFileSystemError(error, "EEXIST")) return;
  try {
    if ((await lstatOrNull(target)) === null) return;
  } catch {
    /* Unavailable identity cannot prove that mkdir left no target. */
  }
  progress.targetClaimed = true;
  progress.uncertainWrite = true;
}
