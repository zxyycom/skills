import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import type { ResourceTreeScan } from "./discard-history.ts";

export async function writeTextAtomically(
  targetPath: string,
  text: string
): Promise<void> {
  await ensureRegularFile(targetPath);
  const temporaryPath = `${targetPath}.${process.pid}.${randomUUID()}.tmp`;
  const handle = await fs.open(temporaryPath, "wx", 0o600);
  try {
    await handle.writeFile(text, "utf8");
  } finally {
    await handle.close();
  }
  try {
    await fs.rename(temporaryPath, targetPath);
  } catch (error) {
    await fs.rm(temporaryPath, { force: true }).catch(() => undefined);
    throw error;
  }
}

export async function readRegularText(filePath: string): Promise<string> {
  await ensureRegularFile(filePath);
  return await fs.readFile(filePath, "utf8");
}
export async function ensureRegularFile(filePath: string): Promise<void> {
  const entry = await fs.lstat(filePath);
  if (entry.isSymbolicLink() || !entry.isFile()) {
    throw new Error("must be a regular non-symbolic-link file");
  }
}
export async function lstatOrNull(
  filePath: string
): Promise<Awaited<ReturnType<typeof fs.lstat>> | null> {
  try {
    return await fs.lstat(filePath);
  } catch (error) {
    if (isMissing(error)) return null;
    throw error;
  }
}
export function isMissing(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    Reflect.get(error, "code") === "ENOENT"
  );
}
export function sameTextList(
  left: readonly string[],
  right: readonly string[]
): boolean {
  return (
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  );
}

export function sameResourceTree(
  left: ResourceTreeScan,
  right: ResourceTreeScan
): boolean {
  return (
    sameTextList(left.resourceIds, right.resourceIds) &&
    sameTextList(left.directories, right.directories)
  );
}
