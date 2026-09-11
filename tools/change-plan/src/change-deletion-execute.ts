import fs from "node:fs/promises";
import path from "node:path";
import { openVersionControl } from "../../shared/src/version-control/index.ts";
import {
  compareDeepest,
  hasDirectoryIdentity,
  identity,
  type ChangeDeletionExecution,
  type ChangeDeletionPreparation,
  type DeletionTree,
  type DirectoryExpectation,
  type FileExpectation
} from "./change-deletion-types.ts";
import {
  copyPreparedTree,
  scanPhysicalTree,
  verifyFile,
  verifyPhysicalTree
} from "./change-deletion-tree.ts";

export async function ensureChangeTombstoneRoot(
  preparation: ChangeDeletionPreparation
): Promise<void> {
  if (preparation.tombstoneRootIdentity !== null) return;
  const [root, source, tombstone] = await Promise.all([
    fs.lstat(preparation.changeRoot),
    fs.lstat(preparation.sourceDirectory),
    lstatOrNull(preparation.tombstoneRoot)
  ]);
  if (!hasDirectoryIdentity(root, preparation.changeRootIdentity))
    throw new Error("change root changed before tombstone creation");
  if (!hasDirectoryIdentity(source, preparation.sourceIdentity))
    throw new Error("change directory changed before tombstone creation");
  if (tombstone !== null)
    throw new Error("change tombstone root appeared before creation");
  await fs.mkdir(preparation.tombstoneRoot, { mode: 0o700 });
}

export async function executePreparedChangeDeletion(
  preparation: ChangeDeletionPreparation
): Promise<ChangeDeletionExecution> {
  const revalidationError = await revalidatePreparation(preparation);
  if (revalidationError !== null)
    return executionFailure(revalidationError, null);
  const claimed = await claimAndCopyTombstone(preparation);
  if (typeof claimed === "string")
    return executionFailure(claimed, preparation.tombstoneDirectory);
  const sourceCleanupError = await removePreparedTree(
    preparation.sourceDirectory,
    {
      directories: preparation.directories,
      files: preparation.files,
      rootIdentity: preparation.sourceIdentity
    },
    "source"
  );
  if (sourceCleanupError !== null)
    return {
      changed: true,
      error: `source cleanup is pending: ${sourceCleanupError}`,
      outcome: "committed-cleanup-pending",
      tombstoneDirectory: preparation.tombstoneDirectory
    };
  const cleanupError = await removePreparedTree(
    preparation.tombstoneDirectory,
    claimed,
    "tombstone"
  );
  return cleanupError === null
    ? {
        changed: true,
        error: null,
        outcome: "completed",
        tombstoneDirectory: null
      }
    : {
        changed: true,
        error: cleanupError,
        outcome: "committed-cleanup-pending",
        tombstoneDirectory: preparation.tombstoneDirectory
      };
}

function executionFailure(
  error: string,
  tombstoneDirectory: string | null
): ChangeDeletionExecution {
  return { changed: false, error, outcome: "no-change", tombstoneDirectory };
}

async function claimAndCopyTombstone(
  preparation: ChangeDeletionPreparation
): Promise<DeletionTree | string> {
  try {
    await fs.mkdir(preparation.tombstoneDirectory, { mode: 0o700 });
  } catch (error) {
    return `cannot claim change tombstone target without overwrite: ${errorMessage(error)}`;
  }
  try {
    await copyPreparedTree(
      preparation.sourceDirectory,
      preparation.tombstoneDirectory,
      preparation.directories,
      preparation.files
    );
    return await captureCopiedTree(preparation);
  } catch (error) {
    return `claimed tombstone copy is pending inspection: ${errorMessage(error)}`;
  }
}

async function captureCopiedTree(
  preparation: ChangeDeletionPreparation
): Promise<DeletionTree> {
  const root = await requireDirectory(
    preparation.tombstoneDirectory,
    "claimed tombstone"
  );
  const copied = await scanPhysicalTree(preparation.tombstoneDirectory);
  if (
    copied.directories.length !== preparation.directories.length ||
    copied.files.length !== preparation.files.length
  )
    throw new Error("claimed tombstone members differ from preparation");
  return {
    directories: copied.directories.map((directory, index) =>
      matchDirectory(directory, preparation.directories[index])
    ),
    files: copied.files.map((file, index) =>
      matchFile(file, preparation.files[index])
    ),
    rootIdentity: identity(root)
  };
}

function matchDirectory(
  directory: DirectoryExpectation,
  expected: DirectoryExpectation | undefined
): DirectoryExpectation {
  if (
    expected === undefined ||
    directory.relativePath !== expected.relativePath
  )
    throw new Error("claimed tombstone members differ from preparation");
  return directory;
}
function matchFile(
  file: Awaited<ReturnType<typeof scanPhysicalTree>>["files"][number],
  expected: FileExpectation | undefined
): FileExpectation {
  if (
    expected === undefined ||
    file.relativePath !== expected.relativePath ||
    !file.bytes.equals(expected.bytes) ||
    ((file.mode & 0o100) !== 0) !== (expected.mode === "100755")
  )
    throw new Error("claimed tombstone members differ from preparation");
  return {
    bytes: expected.bytes,
    identity: file.identity,
    mode: expected.mode,
    relativePath: file.relativePath
  };
}

async function revalidatePreparation(
  preparation: ChangeDeletionPreparation
): Promise<string | null> {
  try {
    const identityError = await preparationIdentityError(preparation);
    if (identityError !== null) return identityError;
    const repository = await openVersionControl(preparation.sourceDirectory);
    if ((await repository.getCurrentRevision()) !== preparation.headCommit)
      return "Git HEAD changed before completion";
    await verifyPhysicalTree(
      preparation.sourceDirectory,
      preparation.directories,
      preparation.files
    );
    return null;
  } catch (error) {
    return `cannot revalidate change deletion: ${errorMessage(error)}`;
  }
}

async function preparationIdentityError(
  preparation: ChangeDeletionPreparation
): Promise<string | null> {
  const [root, source, tombstoneRoot, target] = await Promise.all([
    fs.lstat(preparation.changeRoot),
    fs.lstat(preparation.sourceDirectory),
    fs.lstat(preparation.tombstoneRoot),
    lstatOrNull(preparation.tombstoneDirectory)
  ]);
  if (!hasDirectoryIdentity(root, preparation.changeRootIdentity))
    return "change root changed before completion";
  if (!hasDirectoryIdentity(source, preparation.sourceIdentity))
    return "change directory changed before completion";
  if (
    preparation.tombstoneRootIdentity === null ||
    !hasDirectoryIdentity(tombstoneRoot, preparation.tombstoneRootIdentity)
  )
    return "change tombstone root changed before completion";
  return target === null
    ? null
    : "change tombstone target appeared before completion";
}

async function removePreparedTree(
  root: string,
  expected: DeletionTree,
  label: "source" | "tombstone"
): Promise<string | null> {
  try {
    const rootStat = await fs.lstat(root);
    if (!hasDirectoryIdentity(rootStat, expected.rootIdentity))
      throw new Error(`${label} root changed before cleanup`);
    await verifyPhysicalTree(root, expected.directories, expected.files);
    for (const file of expected.files) {
      const target = path.join(root, file.relativePath);
      await verifyFile(target, file);
      await fs.unlink(target);
    }
    for (const directory of [...expected.directories].sort(compareDeepest)) {
      const target = path.join(root, directory.relativePath);
      const stat = await fs.lstat(target);
      if (!hasDirectoryIdentity(stat, directory.identity))
        throw new Error(
          `${label} directory changed: ${directory.relativePath}`
        );
      await fs.rmdir(target);
    }
    const after = await fs.lstat(root);
    if (!hasDirectoryIdentity(after, expected.rootIdentity))
      throw new Error(`${label} root changed before cleanup`);
    await fs.rmdir(root);
    return null;
  } catch (error) {
    return `${label} cleanup failed: ${errorMessage(error)}`;
  }
}

async function requireDirectory(target: string, label: string) {
  const stat = await fs.lstat(target);
  if (stat.isSymbolicLink() || !stat.isDirectory())
    throw new Error(`${label} must be a regular directory`);
  return stat;
}
async function lstatOrNull(target: string) {
  try {
    return await fs.lstat(target);
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "ENOENT"
    )
      return null;
    throw error;
  }
}
function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
