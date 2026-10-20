/*
 * Synced TypeScript runtime; repository maintenance edits tools/shared/src/version-control/repository-path.ts.
 * Installed skill copies may be edited directly; updates overwrite matching files.
 * Repository: https://github.com/zxyycom/skills
 * Source path: tools/shared/src/version-control/repository-path.ts
 * Maintained source: https://github.com/zxyycom/skills/blob/main/tools/shared/src/version-control/repository-path.ts
 * Skill source directory: https://github.com/zxyycom/skills/tree/main/skills/decision-records
 * Rebuild: bun run sync:decision-records-cli
 */
import path from "node:path";
import { VersionControlError } from "./errors.ts";

export function normalizeRepositoryPath(value: string): string {
  const normalized = value.replaceAll("\\", "/");
  const segments = normalized.split("/");
  if (isInvalidRepositoryPath(value, normalized, segments)) {
    throw new VersionControlError({
      causeCategory: "unknown",
      code: "invalid-path",
      detail: "a path is not a normalized repository-relative path",
      operation: "validate a repository path"
    });
  }
  return normalized;
}

function isInvalidRepositoryPath(
  value: string,
  normalized: string,
  segments: readonly string[]
): boolean {
  return [
    normalized.length === 0,
    normalized.includes("\0"),
    path.posix.isAbsolute(normalized),
    path.win32.isAbsolute(value),
    /^[A-Za-z]:/u.test(normalized),
    segments.some(isInvalidRepositorySegment)
  ].some(Boolean);
}

function isInvalidRepositorySegment(segment: string): boolean {
  return segment === "" || segment === "." || segment === "..";
}

export function normalizeRepositoryPaths(values: readonly string[]): string[] {
  return [...new Set(values.map(normalizeRepositoryPath))].sort((left, right) =>
    left.localeCompare(right)
  );
}
