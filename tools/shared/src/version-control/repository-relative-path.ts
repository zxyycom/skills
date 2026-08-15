import path from "node:path";
import { VersionControlError } from "./errors.ts";
import { normalizeRepositoryPath } from "./repository-path.ts";

export function repositoryRelativePathFromFileSystemPath(
  rootDirectory: string,
  fileSystemPath: string
): string {
  if (!path.isAbsolute(fileSystemPath)) {
    throw invalidFileSystemPath(fileSystemPath);
  }
  const relativePath = path.relative(
    rootDirectory,
    path.resolve(fileSystemPath)
  );
  if (
    relativePath.length === 0 ||
    path.isAbsolute(relativePath) ||
    relativePath === ".." ||
    relativePath.startsWith(".." + path.sep)
  ) {
    throw invalidFileSystemPath(fileSystemPath);
  }
  return normalizeRepositoryPath(relativePath);
}

function invalidFileSystemPath(fileSystemPath: string): VersionControlError {
  return new VersionControlError(
    "invalid-path",
    `Filesystem path must be an absolute repository descendant: ${fileSystemPath}`
  );
}
