import fs from "node:fs/promises";
import path from "node:path";
import { readRecordText } from "../../record-operations/src/source.ts";
import type { ResourceTreeScan } from "./discard-history.ts";

export { writeInvestigationTextAtomically as writeTextAtomically } from "./transaction-files.ts";

export async function readRegularText(filePath: string): Promise<string> {
  return await readRecordText(path.dirname(filePath), path.basename(filePath));
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
