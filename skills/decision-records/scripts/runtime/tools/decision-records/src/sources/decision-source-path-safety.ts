/*
 * Synced TypeScript runtime; repository maintenance edits tools/decision-records/src/sources/decision-source-path-safety.ts.
 * Installed skill copies may be edited directly; updates overwrite matching files.
 * Repository: https://github.com/zxyycom/skills
 * Source path: tools/decision-records/src/sources/decision-source-path-safety.ts
 * Maintained source: https://github.com/zxyycom/skills/blob/main/tools/decision-records/src/sources/decision-source-path-safety.ts
 * Skill source directory: https://github.com/zxyycom/skills/tree/main/skills/decision-records
 * Rebuild: bun run sync:decision-records-cli
 */
import fs from "node:fs/promises";
import path from "node:path";
import { isFileSystemError } from "../../../shared/src/node/filesystem.ts";

/** Validate each managed directory component without following a symbolic link. */
export async function ensureDecisionDirectoryPath(
  root: string,
  directory: string,
  allowMissing = false
): Promise<void> {
  const relative = managedRelativeDirectory(root, directory);
  let current = root;
  if (!(await inspectManagedDirectory(current, allowMissing))) return;
  for (const component of relative.split(path.sep).filter(Boolean)) {
    current = path.join(current, component);
    if (!(await inspectManagedDirectory(current, allowMissing))) return;
  }
}

function managedRelativeDirectory(root: string, directory: string): string {
  const relative = path.relative(root, directory);
  if (
    relative === ".." ||
    relative.startsWith(".." + path.sep) ||
    path.isAbsolute(relative)
  )
    throw new Error(
      "Decision directory escapes its managed root: " + directory
    );
  return relative;
}

async function inspectManagedDirectory(
  current: string,
  allowMissing: boolean
): Promise<boolean> {
  try {
    const entry = await fs.lstat(current);
    if (!entry.isDirectory() || entry.isSymbolicLink())
      throw new Error(
        "Decision directory must be a regular non-symbolic-link directory: " +
          current
      );
    return true;
  } catch (error) {
    if (allowMissing && isFileSystemError(error, "ENOENT")) return false;
    throw error;
  }
}
