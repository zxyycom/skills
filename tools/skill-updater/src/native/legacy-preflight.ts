import { assertNativeDirectory } from "./directory.ts";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { assertNativeRelativePaths } from "../../../skill-package/src/native-paths.ts";

export type LegacyFile = Readonly<{ byteLength: number; sha256: string }>;

async function regularLegacyFile(
  root: string,
  name: string
): Promise<string | null> {
  const parts = name.split("/");
  let current = root;
  for (let index = 0; index < parts.length; index++) {
    current = path.join(current, parts[index]!);
    try {
      const info = await fs.lstat(current);
      if (
        info.isSymbolicLink() ||
        (index < parts.length - 1 ? !info.isDirectory() : !info.isFile())
      )
        return null;
    } catch (error) {
      if (error instanceof Error && "code" in error && error.code === "ENOENT")
        return null;
      throw error;
    }
  }
  return current;
}

/** Read-only ownership proof; no path is overwritten or retired by this step. */
export async function verifyLegacyInstallation(
  target: string,
  files: Readonly<Record<string, LegacyFile>>
): Promise<string[]> {
  const root = path.resolve(target);
  await assertNativeDirectory(root);
  assertNativeRelativePaths(Object.keys(files));
  const conflicts: string[] = [];
  for (const [name, expected] of Object.entries(files)) {
    const filename = await regularLegacyFile(root, name);
    if (filename === null) {
      conflicts.push(name);
      continue;
    }
    const data = await fs.readFile(filename);
    if (
      data.byteLength !== expected.byteLength ||
      createHash("sha256").update(data).digest("hex") !== expected.sha256
    )
      conflicts.push(name);
  }
  return conflicts.sort();
}
