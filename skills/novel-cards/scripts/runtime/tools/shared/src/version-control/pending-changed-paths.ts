/*
 * Synced TypeScript runtime; repository maintenance edits tools/shared/src/version-control/pending-changed-paths.ts.
 * Installed skill copies may be edited directly; updates overwrite matching files.
 * Repository: https://github.com/zxyycom/skills
 * Source path: tools/shared/src/version-control/pending-changed-paths.ts
 * Maintained source: https://github.com/zxyycom/skills/blob/main/tools/shared/src/version-control/pending-changed-paths.ts
 * Skill source directory: https://github.com/zxyycom/skills/tree/main/skills/novel-cards
 * Rebuild: bun run sync:novel-cards-cli
 */
import { sameBytes } from "../node/bytes.ts";
import type { VersionControlFile } from "./types.ts";

function comparePaths(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

/**
 * Computes the repository paths whose bytes or representation differ between the expected
 * baseline and the replacement target of one pending replacement, including
 * additions and deletions on either side, in ascending path order.
 */
export function changedPendingPaths(
  previous: readonly VersionControlFile[],
  files: readonly VersionControlFile[]
): string[] {
  const previousByPath = new Map(
    previous.map((file) => [file.path, file] as const)
  );
  const targetByPath = new Map(files.map((file) => [file.path, file] as const));
  const paths = new Set([...previousByPath.keys(), ...targetByPath.keys()]);
  const changed: string[] = [];
  for (const filePath of paths) {
    const before = previousByPath.get(filePath);
    const after = targetByPath.get(filePath);
    if (before === undefined || after === undefined) {
      changed.push(filePath);
      continue;
    }
    if (before.kind !== after.kind || !sameBytes(before.data, after.data))
      changed.push(filePath);
  }
  return changed.sort(comparePaths);
}
