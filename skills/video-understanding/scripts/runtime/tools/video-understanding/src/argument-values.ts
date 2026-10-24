/*
 * Synced TypeScript runtime; repository maintenance edits tools/video-understanding/src/argument-values.ts.
 * Installed skill copies may be edited directly; updates overwrite matching files.
 * Repository: https://github.com/zxyycom/skills
 * Source path: tools/video-understanding/src/argument-values.ts
 * Maintained source: https://github.com/zxyycom/skills/blob/main/tools/video-understanding/src/argument-values.ts
 * Skill source directory: https://github.com/zxyycom/skills/tree/main/skills/video-understanding
 * Rebuild: bun run sync:video-understanding-cli
 */
import path from "node:path";
import { seconds } from "./evidence.ts";
import { failure } from "./failure.ts";
import { isAbsoluteLocalPath } from "./media-runtime.ts";

export function invalid(reason: string): never {
  throw failure({
    kind: "input",
    stage: "arguments",
    target: "CLI options",
    reason
  });
}
export function localPath(value: string | undefined, name: string): string {
  if (!value || !isAbsoluteLocalPath(value))
    return invalid(`--${name} requires an absolute local path`);
  return path.resolve(value);
}
export function numberOption(
  value: string | undefined,
  fallback: number,
  name: string,
  integer?: boolean
): number;
export function numberOption(
  value: string | undefined,
  fallback: undefined,
  name: string,
  integer?: boolean
): number | undefined;
export function numberOption(
  value: string | undefined,
  fallback: number | undefined,
  name: string,
  integer = false
): number | undefined {
  if (value === undefined) return fallback;
  const number = Number(value);
  if (
    !value.trim() ||
    !seconds(number) ||
    (integer && !Number.isSafeInteger(number))
  )
    return invalid(`invalid --${name}`);
  return number;
}
export function optionalLocalPath(
  value: string | undefined,
  name: string
): string | undefined {
  return value === undefined ? undefined : localPath(value, name);
}
