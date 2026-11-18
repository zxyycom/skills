/*
 * Synced TypeScript runtime; repository maintenance edits tools/skill-updater/src/native/directory.ts.
 * Installed skill copies may be edited directly; updates overwrite matching files.
 * Repository: https://github.com/zxyycom/skills
 * Source path: tools/skill-updater/src/native/directory.ts
 * Maintained source: https://github.com/zxyycom/skills/blob/main/tools/skill-updater/src/native/directory.ts
 * Skill source directory: https://github.com/zxyycom/skills/tree/main/skills/resource-records
 * Rebuild: bun run sync:resource-records-cli
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

/** Find the deepest existing ancestor while validating every existing component. */
export async function existingNativeAncestor(
  directory: string
): Promise<string> {
  let current = path.resolve(directory);
  while (true) {
    try {
      await assertNativeDirectory(current);
      return current;
    } catch (error) {
      if (
        !(error instanceof Error && "code" in error && error.code === "ENOENT")
      )
        throw error;
      const parent = path.dirname(current);
      if (parent === current) throw error;
      current = parent;
    }
  }
}

/** Create missing ordinary ancestors only after confirmation. */
export async function createNativeDirectories(
  directory: string,
  created: Set<string>
): Promise<void> {
  const target = path.resolve(directory);
  const ancestor = await existingNativeAncestor(target);
  const parts = path.relative(ancestor, target).split(path.sep).filter(Boolean);
  let current = ancestor;
  for (const part of parts) {
    current = path.join(current, part);
    try {
      await fs.mkdir(current);
      created.add(current);
    } catch (error) {
      if (
        !(error instanceof Error && "code" in error && error.code === "EEXIST")
      )
        throw error;
    }
    await assertNativeDirectory(current);
  }
}
