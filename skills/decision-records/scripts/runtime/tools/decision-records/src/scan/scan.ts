/*
 * Synced TypeScript runtime; repository maintenance edits tools/decision-records/src/scan/scan.ts.
 * Installed skill copies may be edited directly; updates overwrite matching files.
 * Repository: https://github.com/zxyycom/skills
 * Source path: tools/decision-records/src/scan/scan.ts
 * Maintained source: https://github.com/zxyycom/skills/blob/main/tools/decision-records/src/scan/scan.ts
 * Skill source directory: https://github.com/zxyycom/skills/tree/main/skills/decision-records
 * Rebuild: bun run sync:decision-records-cli
 */
import {
  decisionIndexRequiredError as requiredDecisionIndexError,
  scanDecisionSnapshot
} from "./scan-snapshot.ts";
import type { DecisionScan, DecisionScanOptions } from "../types.ts";

export {
  missingIndexedDecisionError,
  unindexedDecisionError
} from "./scan-relations.ts";

export function decisionIndexRequiredError(indexRelativePath: string): string {
  return requiredDecisionIndexError(indexRelativePath);
}

export async function scanDecisionRecords(
  options: DecisionScanOptions = {}
): Promise<DecisionScan> {
  return (await scanDecisionSnapshot(options)).scan;
}
