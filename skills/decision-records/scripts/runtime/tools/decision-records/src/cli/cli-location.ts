/*
 * Synced TypeScript runtime; repository maintenance edits tools/decision-records/src/cli/cli-location.ts.
 * Installed skill copies may be edited directly; updates overwrite matching files.
 * Repository: https://github.com/zxyycom/skills
 * Source path: tools/decision-records/src/cli/cli-location.ts
 * Maintained source: https://github.com/zxyycom/skills/blob/main/tools/decision-records/src/cli/cli-location.ts
 * Skill source directory: https://github.com/zxyycom/skills/tree/main/skills/decision-records
 * Rebuild: bun run sync:decision-records-cli
 */
import type { DecisionLocation } from "../query/decision-query-service.ts";
import type { DecisionScanOptions } from "../types.ts";

export type DecisionLocationArgs = {
  decisionsDir: string;
  workspaceRoot: string;
};

export function decisionLocation(args: DecisionLocationArgs): DecisionLocation {
  return {
    decisionsDir: args.decisionsDir,
    workspaceRoot: args.workspaceRoot
  };
}

export function decisionScanOptions(
  args: DecisionLocationArgs
): DecisionScanOptions {
  return decisionLocation(args);
}
