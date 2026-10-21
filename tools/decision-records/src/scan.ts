import {
  decisionIndexRequiredError as requiredDecisionIndexError,
  scanDecisionSnapshot
} from "./scan-snapshot.ts";
import type { DecisionScan, DecisionScanOptions } from "./types.ts";

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
