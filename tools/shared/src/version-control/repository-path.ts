import path from "node:path";
import { VersionControlError } from "./errors.ts";

export function normalizeRepositoryPath(value: string): string {
  const normalized = value.replaceAll("\\", "/");
  const segments = normalized.split("/");
  if (
    normalized.length === 0
    || normalized.includes("\0")
    || path.posix.isAbsolute(normalized)
    || path.win32.isAbsolute(value)
    || /^[A-Za-z]:/u.test(normalized)
    || segments.some((segment) => segment === "" || segment === "." || segment === "..")
  ) {
    throw new VersionControlError(
      "invalid-path",
      `Version-control paths must be normalized repository-relative paths: ${value}`
    );
  }
  return normalized;
}

export function normalizeRepositoryPaths(values: readonly string[]): string[] {
  return [...new Set(values.map(normalizeRepositoryPath))].sort((left, right) =>
    left.localeCompare(right)
  );
}
