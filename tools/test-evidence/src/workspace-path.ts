import fs from "node:fs/promises";
import path from "node:path";
import { isFileSystemError } from "../../shared/src/node/filesystem.ts";

export function normalizePathSeparators(value: string): string {
  return value.replaceAll("\\", "/");
}

export function normalizeWorkspaceRelative(value: string): string | null {
  const normalized = normalizePathSeparators(value).trim();
  const segments = normalized.split("/");
  if (
    normalized.length === 0
    || path.posix.isAbsolute(normalized)
    || path.win32.isAbsolute(normalized)
    || /^[A-Za-z]:/u.test(normalized)
    || segments.includes("..")
  ) {
    return null;
  }
  const canonicalSegments = segments.filter((segment) => (
    segment.length > 0 && segment !== "."
  ));
  return canonicalSegments.length === 0 ? null : canonicalSegments.join("/");
}

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
