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
