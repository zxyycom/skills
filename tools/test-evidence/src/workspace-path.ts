import fs from "node:fs/promises";
import path from "node:path";
import { isFileSystemError } from "../../shared/src/node/filesystem.ts";

type WorkspaceFileIdentity = {
  device: bigint;
  inode: bigint;
};

export async function workspaceRelativePathsAreDistinct(
  workspaceRoot: string,
  relativePaths: readonly string[],
  platform: NodeJS.Platform = process.platform
): Promise<boolean> {
  const paths = await Promise.all(relativePaths.map(async (relativePath) => ({
    identity: await readWorkspaceFileIdentity(workspaceRoot, relativePath),
    relativePath
  })));
  for (let leftIndex = 0; leftIndex < paths.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < paths.length; rightIndex += 1) {
      const left = paths[leftIndex]!;
      const right = paths[rightIndex]!;
      if (left.identity !== null && right.identity !== null) {
        if (
          left.identity.device === right.identity.device
          && left.identity.inode === right.identity.inode
        ) {
          return false;
        }
        continue;
      }
      if (sameUnresolvedWorkspacePath(
        left.relativePath,
        right.relativePath,
        platform
      )) {
        return false;
      }
    }
  }
  return true;
}

async function readWorkspaceFileIdentity(
  workspaceRoot: string,
  relativePath: string
): Promise<WorkspaceFileIdentity | null> {
  try {
    const stats = await fs.stat(
      path.resolve(workspaceRoot, ...relativePath.split("/")),
      { bigint: true }
    );
    return { device: stats.dev, inode: stats.ino };
  } catch (error) {
    if (
      isFileSystemError(error, "ENOENT")
      || isFileSystemError(error, "ENOTDIR")
    ) {
      return null;
    }
    throw error;
  }
}

function sameUnresolvedWorkspacePath(
  left: string,
  right: string,
  platform: NodeJS.Platform
): boolean {
  return platform === "win32" || platform === "darwin"
    ? left.toLowerCase() === right.toLowerCase()
    : left === right;
}
