import { createHash } from "node:crypto";
import { constants as fileSystemConstants } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import type {
  ResourceDirectorySnapshot,
  ResourceFileSnapshot,
  ResourceMove,
  ResourceMoveProgress,
  ResourceOwnerSnapshot
} from "./rename-contract.ts";
import { compareText, errorText, lstatOrNull, noOp } from "./rename-support.ts";
import {
  resourceMode,
  sameResourceOwnerSnapshot,
  scanResourceOwner
} from "./rename-resource-snapshot.ts";

export async function moveResourceOwner(
  move: ResourceMove,
  oldId: string,
  newId: string,
  progress: ResourceMoveProgress,
  beforeSourceOwnerRemoval: (() => Promise<void>) | undefined
): Promise<void> {
  await fs.mkdir(move.to, { mode: move.snapshot.mode });
  await fs.chmod(move.to, move.snapshot.mode);
  progress.targetClaimed = true;
  await copyResourceOwnerMembers(move.from, move.to, move.snapshot);
  await verifyResourceOwnerSnapshot(move.to, newId, move.snapshot);
  await verifyResourceOwnerSnapshot(move.from, oldId, move.snapshot);
  await (beforeSourceOwnerRemoval ?? noOp)();
  progress.sourceRemovalStarted = true;
  await removeResourceOwnerMembers(move.from, oldId, move.snapshot);
  progress.sourceRemoved = true;
}

export async function copyResourceOwnerMembers(
  from: string,
  to: string,
  snapshot: ResourceOwnerSnapshot
): Promise<void> {
  for (const directory of [...snapshot.directories].sort(
    compareResourceDirectory
  )) {
    const target = path.join(to, directory.path);
    await fs.mkdir(target, { mode: directory.mode });
    await fs.chmod(target, directory.mode);
  }
  for (const file of snapshot.files) {
    const target = path.join(to, file.path);
    await fs.copyFile(
      path.join(from, file.path),
      target,
      fileSystemConstants.COPYFILE_EXCL
    );
    await fs.chmod(target, file.mode);
  }
}

export async function verifyResourceOwnerSnapshot(
  ownerPath: string,
  ownerId: string,
  expected: ResourceOwnerSnapshot
): Promise<void> {
  const current = await scanResourceOwner(ownerPath, ownerId);
  if (
    current.errors.length > 0 ||
    !sameResourceOwnerSnapshot(expected, current.value)
  ) {
    throw new Error("Investigation resource owner changed while being moved");
  }
}

/** Deletes only the preflighted members; a concurrent extra keeps its directory non-empty. */
export async function removeResourceOwnerMembers(
  ownerPath: string,
  ownerId: string,
  expected: ResourceOwnerSnapshot
): Promise<void> {
  await verifyResourceOwnerSnapshot(ownerPath, ownerId, expected);
  for (const file of expected.files) {
    await verifyResourceFileSnapshot(path.join(ownerPath, file.path), file);
    await fs.rm(path.join(ownerPath, file.path), { force: false });
  }
  for (const directory of [...expected.directories].sort((left, right) =>
    compareResourceDirectory(right, left)
  )) {
    await verifyResourceDirectorySnapshot(
      path.join(ownerPath, directory.path),
      directory
    );
    await fs.rmdir(path.join(ownerPath, directory.path));
  }
  const owner = await fs.lstat(ownerPath);
  if (
    owner.isSymbolicLink() ||
    !owner.isDirectory() ||
    resourceMode(owner.mode) !== expected.mode
  ) {
    throw new Error("Investigation resource owner changed before removal");
  }
  await fs.rmdir(ownerPath);
}

export async function verifyResourceFileSnapshot(
  filePath: string,
  expected: ResourceFileSnapshot
): Promise<void> {
  const initial = await fs.lstat(filePath);
  if (!matchesResourceFile(initial, expected)) throw resourceFileChanged();
  const contents = await fs.readFile(filePath);
  const current = await fs.lstat(filePath);
  if (!matchesResourceFile(current, expected)) throw resourceFileChanged();
  if (
    createHash("sha256").update(contents).digest("hex") !== expected.contentHash
  )
    throw resourceFileChanged();
}

function matchesResourceFile(
  current: Awaited<ReturnType<typeof fs.lstat>>,
  expected: ResourceFileSnapshot
): boolean {
  return (
    !current.isSymbolicLink() &&
    current.isFile() &&
    current.size === expected.size &&
    resourceMode(Number(current.mode)) === expected.mode
  );
}

function resourceFileChanged(): Error {
  return new Error("Investigation resource file changed before removal");
}

export async function verifyResourceDirectorySnapshot(
  directoryPath: string,
  expected: ResourceDirectorySnapshot
): Promise<void> {
  const current = await fs.lstat(directoryPath);
  if (
    current.isSymbolicLink() ||
    !current.isDirectory() ||
    resourceMode(current.mode) !== expected.mode
  ) {
    throw new Error("Investigation resource directory changed before removal");
  }
}

function compareResourceDirectory(
  left: ResourceDirectorySnapshot,
  right: ResourceDirectorySnapshot
): number {
  const depth = (value: string): number => value.split("/").length;
  return (
    depth(left.path) - depth(right.path) || compareText(left.path, right.path)
  );
}

export async function restoreResourceOwnerMove(
  move: ResourceMove,
  oldId: string,
  newId: string,
  progress: ResourceMoveProgress
): Promise<string[]> {
  if (!progress.targetClaimed) return [];
  try {
    await verifyResourceOwnerSnapshot(move.to, newId, move.snapshot);
  } catch (error) {
    return [
      "failed to restore Investigation resource owner because its target changed after publication: " +
        errorText(error)
    ];
  }
  if (!progress.sourceRemovalStarted)
    return await removeClaimedResourceOwner(move.to, newId, move.snapshot);
  return progress.sourceRemoved
    ? await restoreRemovedResourceOwner(move, oldId, newId)
    : await restorePartiallyRemovedResourceOwner(move, oldId, newId);
}

async function restorePartiallyRemovedResourceOwner(
  move: ResourceMove,
  oldId: string,
  newId: string
): Promise<string[]> {
  const sourceState = await resourceOwnerRecoveryState(
    move.from,
    oldId,
    move.snapshot
  );
  if (sourceState === "equal")
    return await removeClaimedResourceOwner(move.to, newId, move.snapshot);
  if (sourceState === "diverged")
    return [
      "failed to restore Investigation resource owner because its old owner changed during removal"
    ];
  try {
    await restoreMissingResourceOwnerMembers(move.to, move.from, move.snapshot);
    await verifyResourceOwnerSnapshot(move.from, oldId, move.snapshot);
  } catch (error) {
    return [
      "failed to restore Investigation resource owner: " + errorText(error)
    ];
  }
  return await removeClaimedResourceOwner(move.to, newId, move.snapshot);
}

async function restoreRemovedResourceOwner(
  move: ResourceMove,
  oldId: string,
  newId: string
): Promise<string[]> {
  try {
    if ((await lstatOrNull(move.from)) !== null)
      return [
        "failed to restore Investigation resource owner because its old owner path reappeared"
      ];
    await fs.mkdir(move.from, { mode: move.snapshot.mode });
    await fs.chmod(move.from, move.snapshot.mode);
    await copyResourceOwnerMembers(move.to, move.from, move.snapshot);
    await verifyResourceOwnerSnapshot(move.from, oldId, move.snapshot);
  } catch (error) {
    return [
      "failed to restore Investigation resource owner: " + errorText(error)
    ];
  }
  return await removeClaimedResourceOwner(move.to, newId, move.snapshot);
}

type ResourceOwnerRecoveryState = "diverged" | "equal" | "subset";

async function resourceOwnerRecoveryState(
  ownerPath: string,
  ownerId: string,
  expected: ResourceOwnerSnapshot
): Promise<ResourceOwnerRecoveryState> {
  try {
    const current = await scanResourceOwner(ownerPath, ownerId);
    if (current.errors.length > 0) return "diverged";
    if (sameResourceOwnerSnapshot(current.value, expected)) return "equal";
    return isResourceOwnerSnapshotSubset(current.value, expected)
      ? "subset"
      : "diverged";
  } catch {
    return "diverged";
  }
}

function isResourceOwnerSnapshotSubset(
  current: ResourceOwnerSnapshot,
  expected: ResourceOwnerSnapshot
): boolean {
  return (
    current.mode === expected.mode &&
    current.directories.every((directory) =>
      expected.directories.some(
        (candidate) =>
          candidate.path === directory.path && candidate.mode === directory.mode
      )
    ) &&
    current.files.every((file) =>
      expected.files.some(
        (candidate) =>
          candidate.path === file.path &&
          candidate.mode === file.mode &&
          candidate.size === file.size &&
          candidate.contentHash === file.contentHash
      )
    )
  );
}

async function restoreMissingResourceOwnerMembers(
  from: string,
  to: string,
  snapshot: ResourceOwnerSnapshot
): Promise<void> {
  for (const directory of [...snapshot.directories].sort(
    compareResourceDirectory
  )) {
    const target = path.join(to, directory.path);
    const existing = await lstatOrNull(target);
    if (existing === null) {
      await fs.mkdir(target, { mode: directory.mode });
      await fs.chmod(target, directory.mode);
    } else {
      await verifyResourceDirectorySnapshot(target, directory);
    }
  }
  for (const file of snapshot.files) {
    const target = path.join(to, file.path);
    if ((await lstatOrNull(target)) === null) {
      await fs.copyFile(
        path.join(from, file.path),
        target,
        fileSystemConstants.COPYFILE_EXCL
      );
      await fs.chmod(target, file.mode);
    } else {
      await verifyResourceFileSnapshot(target, file);
    }
  }
}

async function removeClaimedResourceOwner(
  ownerPath: string,
  ownerId: string,
  expected: ResourceOwnerSnapshot
): Promise<string[]> {
  try {
    const entry = await lstatOrNull(ownerPath);
    if (entry === null) return [];
    if (entry.isSymbolicLink() || !entry.isDirectory()) {
      return [
        "failed to remove Investigation resource owner because its target changed type"
      ];
    }
    await removeResourceOwnerMembers(ownerPath, ownerId, expected);
    return [];
  } catch (error) {
    return [
      "failed to remove renamed Investigation resource owner: " +
        errorText(error)
    ];
  }
}
