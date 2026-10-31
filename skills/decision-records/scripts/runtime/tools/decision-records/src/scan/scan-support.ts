/*
 * Synced TypeScript runtime; repository maintenance edits tools/decision-records/src/scan/scan-support.ts.
 * Installed skill copies may be edited directly; updates overwrite matching files.
 * Repository: https://github.com/zxyycom/skills
 * Source path: tools/decision-records/src/scan/scan-support.ts
 * Maintained source: https://github.com/zxyycom/skills/blob/main/tools/decision-records/src/scan/scan-support.ts
 * Skill source directory: https://github.com/zxyycom/skills/tree/main/skills/decision-records
 * Rebuild: bun run sync:decision-records-cli
 */
import { decisionFileSystemErrorText } from "../application-result.ts";

export function addCollectionError(
  collectionErrors: string[],
  sourceErrors: string[],
  error: string
): void {
  collectionErrors.push(error);
  sourceErrors.push(error);
}

export function errorText(error: unknown): string {
  return decisionFileSystemErrorText(error);
}
