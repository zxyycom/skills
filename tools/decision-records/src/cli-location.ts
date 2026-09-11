import type { DecisionLocation } from "./decision-query-service.ts";
import type { DecisionScanOptions } from "./types.ts";

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
