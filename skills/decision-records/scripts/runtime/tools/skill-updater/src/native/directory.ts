/*
 * Synced TypeScript runtime; repository maintenance edits tools/skill-updater/src/native/directory.ts.
 * Installed skill copies may be edited directly; updates overwrite matching files.
 * Repository: https://github.com/zxyycom/skills
 * Source path: tools/skill-updater/src/native/directory.ts
 * Maintained source: https://github.com/zxyycom/skills/blob/main/tools/skill-updater/src/native/directory.ts
 * Skill source directory: https://github.com/zxyycom/skills/tree/main/skills/decision-records
 * Rebuild: bun run sync:decision-records-cli
 */
import fs from "node:fs/promises";
import path from "node:path";

/** Refuse symlink or junction components without comparing Windows path spellings. */
export async function assertNativeDirectory(directory: string): Promise<void> {
  let current = path.resolve(directory);
  while (true) {
    const info = await fs.lstat(current);
    if (!info.isDirectory() || info.isSymbolicLink())
      throw new Error(`unsafe native directory: ${current}`);
    const parent = path.dirname(current);
    if (parent === current) return;
    current = parent;
  }
}
