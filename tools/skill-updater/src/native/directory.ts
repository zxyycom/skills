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
