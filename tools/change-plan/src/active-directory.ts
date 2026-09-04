import type { Stats } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";

const tombstoneDirectoryName = ".change-plan-tombstones";

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isMissingPathError(error: unknown): boolean {
  return (
    error !== null &&
    typeof error === "object" &&
    "code" in error &&
    error.code === "ENOENT"
  );
}

async function lstatOrNull(targetPath: string): Promise<Stats | null> {
  try {
    return await fs.lstat(targetPath);
  } catch (error) {
    if (isMissingPathError(error)) return null;
    throw error;
  }
}

async function activeMetadataAncestorError(
  changeRoot: string
): Promise<string | null> {
  let ancestor = changeRoot;
  while (true) {
    const metadataPath = path.join(ancestor, ".change-plan.json");
    try {
      if ((await lstatOrNull(metadataPath)) !== null) {
        return `change directory must not be nested inside another Change: ${ancestor}`;
      }
    } catch (error) {
      return `cannot verify Change root boundary at ${metadataPath}: ${errorMessage(error)}`;
    }
    const parent = path.dirname(ancestor);
    if (parent === ancestor) return null;
    ancestor = parent;
  }
}

function reservedSubtreeError(changeRoot: string): string | null {
  let ancestor = changeRoot;
  while (true) {
    const directoryName = path.basename(ancestor);
    if (directoryName === tombstoneDirectoryName) {
      return "the tombstone subtree is not an active Change directory";
    }
    const parent = path.dirname(ancestor);
    if (parent === ancestor) return null;
    ancestor = parent;
  }
}

/**
 * Public single-directory commands infer the Change root from their target's
 * parent and only accept its direct current member.
 */
export async function activeChangeDirectoryError(
  changeDirectoryInput: string
): Promise<string | null> {
  const changeDirectory = path.resolve(changeDirectoryInput);
  const changeName = path.basename(changeDirectory);
  if (changeName === tombstoneDirectoryName) {
    return "the tombstone root is not an active Change directory";
  }
  const changeRoot = path.dirname(changeDirectory);
  const reservedError = reservedSubtreeError(changeRoot);
  if (reservedError !== null) return reservedError;
  return await activeMetadataAncestorError(changeRoot);
}

export function directChangeDirectoryError(
  changeDirectoryInput: string,
  changeRootInput: string
): string | null {
  const changeDirectory = path.resolve(changeDirectoryInput);
  const changeRoot = path.resolve(changeRootInput);
  if (path.dirname(changeDirectory) !== changeRoot) {
    return "change directory must be a direct member of its Change root";
  }
  return null;
}
