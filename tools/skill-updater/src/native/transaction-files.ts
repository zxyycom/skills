import fs from "node:fs/promises";
import path from "node:path";

export type FileState = Readonly<{ bytes: Buffer; mode: number }>;

/** Inspect each component without following symbolic links. */
export async function readTargetFile(
  root: string,
  name: string
): Promise<FileState | null> {
  const parts = name.split("/");
  let current = root;
  for (let index = 0; index < parts.length; index++) {
    current = path.join(current, parts[index]!);
    try {
      const info = await fs.lstat(current);
      if (info.isSymbolicLink()) throw new Error(`symbolic link at ${name}`);
      if (index < parts.length - 1) {
        if (!info.isDirectory())
          throw new Error(`non-directory parent at ${name}`);
        continue;
      }
      if (!info.isFile()) throw new Error(`non-regular target at ${name}`);
      return { bytes: await fs.readFile(current), mode: info.mode & 0o777 };
    } catch (error) {
      if (error instanceof Error && "code" in error && error.code === "ENOENT")
        return null;
      throw error;
    }
  }
  throw new Error(`invalid empty target path: ${name}`);
}

export function sameFileState(
  left: FileState | null,
  right: FileState | null
): boolean {
  if (left === null || right === null) return left === right;
  return left.mode === right.mode && left.bytes.equals(right.bytes);
}

async function ensureParents(root: string, name: string): Promise<void> {
  const parts = name.split("/").slice(0, -1);
  let current = root;
  for (const part of parts) {
    current = path.join(current, part);
    try {
      await fs.mkdir(current);
    } catch (error) {
      if (
        !(error instanceof Error && "code" in error && error.code === "EEXIST")
      )
        throw error;
    }
    const info = await fs.lstat(current);
    if (info.isSymbolicLink() || !info.isDirectory())
      throw new Error(`unsafe target parent: ${name}`);
  }
}

/** Replace one verified target with a staged file; callers serialize all updates. */
export async function replaceTargetFile(
  root: string,
  name: string,
  staged: string,
  expected: FileState | null
): Promise<void> {
  await ensureParents(root, name);
  const current = await readTargetFile(root, name);
  if (!sameFileState(current, expected))
    throw new Error(`target changed before replacement: ${name}`);
  await fs.rename(staged, path.join(root, ...name.split("/")));
}
