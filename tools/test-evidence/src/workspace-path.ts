import path from "node:path";

export function normalizePathSeparators(value: string): string {
  return value.replaceAll("\\", "/");
}

export function normalizeWorkspaceRelative(value: string): string | null {
  const normalized = normalizePathSeparators(value).trim();
  if (
    normalized.length === 0
    || path.posix.isAbsolute(normalized)
    || path.win32.isAbsolute(normalized)
    || /^[A-Za-z]:/u.test(normalized)
    || normalized.split("/").includes("..")
  ) {
    return null;
  }
  return normalized;
}
