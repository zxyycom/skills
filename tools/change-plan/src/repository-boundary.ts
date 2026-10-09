import type { Dirent } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { errorMessage, lstatOrNull } from "./check-support.ts";
import { tombstoneDirectoryName } from "./types.ts";

export type ChangeRootBoundaryFailure = Readonly<{
  code: "change-root-contains-repository" | "change-root-read-failed";
  message: string;
}>;

function repositoryMarker(entries: readonly Dirent[]): string | null {
  if (entries.some((entry) => entry.name === ".git")) return ".git";
  const directories = new Set(
    entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name)
  );
  const hasHead = entries.some(
    (entry) => entry.name === "HEAD" && !entry.isDirectory()
  );
  return hasHead && directories.has("objects") && directories.has("refs")
    ? "HEAD + objects + refs (bare repository layout)"
    : null;
}

async function scanRepositoryBoundary(
  directory: string,
  changeRoot: string
): Promise<ChangeRootBoundaryFailure | null> {
  let entries: Dirent[];
  try {
    entries = await fs.readdir(directory, { withFileTypes: true });
  } catch (error) {
    return {
      code: "change-root-read-failed",
      message: `cannot inspect Change repository boundary at ${directory}: ${errorMessage(error)}`
    };
  }
  const marker = repositoryMarker(entries);
  if (marker !== null) {
    return {
      code: "change-root-contains-repository",
      message: `Change root must not contain repositories: ${directory} contains ${marker}; keep Change artifacts in the enclosing project repository`
    };
  }
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (directory === changeRoot && entry.name === tombstoneDirectoryName)
      continue;
    const failure = await scanRepositoryBoundary(
      path.join(directory, entry.name),
      changeRoot
    );
    if (failure !== null) return failure;
  }
  return null;
}

export async function inspectChangeRootRepositoryBoundary(
  changeRoot: string
): Promise<ChangeRootBoundaryFailure | null> {
  try {
    const stat = await lstatOrNull(changeRoot);
    if (stat === null || stat.isSymbolicLink() || !stat.isDirectory()) {
      return {
        code: "change-root-read-failed",
        message: `Change root must be an accessible regular directory: ${changeRoot}`
      };
    }
  } catch (error) {
    return {
      code: "change-root-read-failed",
      message: `cannot access Change root ${changeRoot}: ${errorMessage(error)}`
    };
  }
  return await scanRepositoryBoundary(changeRoot, changeRoot);
}
