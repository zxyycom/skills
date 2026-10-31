import fs from "node:fs/promises";
import path from "node:path";

export function hasAsciiControlCharacter(value: string): boolean {
  for (const character of value) {
    const code = character.codePointAt(0) ?? 0;
    if (code < 32 || code === 127) return true;
  }
  return false;
}

export function isOpaqueToken(value: string): boolean {
  return (
    value.length > 0 &&
    value.trim() === value &&
    !/[\s`]/u.test(value) &&
    !hasAsciiControlCharacter(value)
  );
}

export function isSingleLine(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.trim() === value &&
    !/[\r\n]/u.test(value)
  );
}

export function isProjectRelativePath(value: string): boolean {
  return (
    !path.posix.isAbsolute(value) &&
    !value.split("/").includes("..") &&
    !value.includes("\\") &&
    value !== ""
  );
}

export function compare(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

export function uniqueSorted(values: readonly string[]): string[] {
  return [...new Set(values)].sort(compare);
}

export function isSorted(values: readonly string[]): boolean {
  return values.every(
    (value, index) => index === 0 || (values[index - 1] ?? "") < value
  );
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function keys(value: Record<string, unknown>): string {
  return Object.keys(value).sort(compare).join(",");
}

export function exists(filePath: string): Promise<boolean> {
  return fs
    .lstat(filePath)
    .then(() => true)
    .catch((error: unknown) =>
      isRecord(error) && error.code === "ENOENT" ? false : Promise.reject(error)
    );
}

export function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
