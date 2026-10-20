/*
 * Synced TypeScript runtime; repository maintenance edits tools/shared/src/node/filesystem.ts.
 * Installed skill copies may be edited directly; updates overwrite matching files.
 * Repository: https://github.com/zxyycom/skills
 * Source path: tools/shared/src/node/filesystem.ts
 * Maintained source: https://github.com/zxyycom/skills/blob/main/tools/shared/src/node/filesystem.ts
 * Skill source directory: https://github.com/zxyycom/skills/tree/main/skills/codex-shell-permissions
 * Rebuild: bun run sync:skill-updaters
 */
import fs from "node:fs/promises";
import path from "node:path";

export function isFileSystemError(
  error: unknown,
  code: string
): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error && error.code === code;
}

export async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await fs.access(targetPath);
    return true;
  } catch (error) {
    if (isFileSystemError(error, "ENOENT")) {
      return false;
    }
    throw error;
  }
}

export function toPosix(targetPath: string): string {
  return targetPath.split(path.sep).join("/");
}

export function isPathWithinDirectory(
  candidate: string,
  directory: string
): boolean {
  const relativePath = path.relative(
    path.resolve(directory),
    path.resolve(candidate)
  );
  return (
    relativePath === "" ||
    (relativePath !== ".." &&
      !relativePath.startsWith(".." + path.sep) &&
      !path.isAbsolute(relativePath))
  );
}
