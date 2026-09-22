import { Buffer } from "node:buffer";
import type { VersionControlFile } from "./types.ts";

function sameFileBytes(left: Uint8Array, right: Uint8Array): boolean {
  return Buffer.from(left).equals(Buffer.from(right));
}

function comparePaths(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

/**
 * Computes the repository paths whose bytes differ between the expected
 * baseline and the replacement target of one pending replacement, including
 * additions and deletions on either side, in ascending path order.
 */
export function changedPendingPaths(
  previous: readonly VersionControlFile[],
  files: readonly VersionControlFile[]
): string[] {
  const previousByPath = new Map(
    previous.map((file) => [file.path, file.data] as const)
  );
  const targetByPath = new Map(
    files.map((file) => [file.path, file.data] as const)
  );
  const paths = new Set([...previousByPath.keys(), ...targetByPath.keys()]);
  const changed: string[] = [];
  for (const filePath of paths) {
    const before = previousByPath.get(filePath);
    const after = targetByPath.get(filePath);
    if (before === undefined || after === undefined) {
      changed.push(filePath);
      continue;
    }
    if (!sameFileBytes(before, after)) changed.push(filePath);
  }
  return changed.sort(comparePaths);
}
