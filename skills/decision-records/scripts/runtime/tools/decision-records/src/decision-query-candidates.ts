/*
 * Synced TypeScript runtime; repository maintenance edits tools/decision-records/src/decision-query-candidates.ts.
 * Installed skill copies may be edited directly; updates overwrite matching files.
 * Repository: https://github.com/zxyycom/skills
 * Source path: tools/decision-records/src/decision-query-candidates.ts
 * Maintained source: https://github.com/zxyycom/skills/blob/main/tools/decision-records/src/decision-query-candidates.ts
 * Skill source directory: https://github.com/zxyycom/skills/tree/main/skills/decision-records
 * Rebuild: bun run sync:decision-records-cli
 */
import {
  decisionFailure,
  type DecisionApplicationFailure
} from "./application-result.ts";
import { decisionScanOptions } from "./decision-query-context.ts";
import { loadDecisionValidationContext } from "./index.ts";
import { scanDecisionRecords } from "./scan.ts";
import type { DecisionLocation } from "./decision-query-context.ts";
import type { DecisionQueryResult } from "./decision-query-contract.ts";
import { candidateRecords, sourceFailure } from "./decision-query-records.ts";
import type { DecisionScan } from "./types.ts";

export async function listDecisionCandidates(
  location: DecisionLocation
): Promise<DecisionQueryResult> {
  const context = await loadCandidateQueryContext(location);
  if (context.status === "error") return context;
  return {
    command: "candidates",
    records: candidateRecords(context.scan),
    status: "ok",
    warnings: context.warnings
  };
}

export async function checkDecisionRecords(
  location: DecisionLocation
): Promise<DecisionQueryResult> {
  const { result } = await loadDecisionValidationContext(
    decisionScanOptions(location),
    { allowEmptyDecisionSet: true }
  );
  if (result.errors.length > 0) return decisionFailure(result.errors);
  return {
    command: "check",
    status: "ok",
    summary: {
      activeCount: result.activeCount,
      activationCandidateCount: result.activationCandidateCount,
      bodyReadyCandidateCount: result.bodyReadyCandidateCount,
      alignedCount: result.alignedCount,
      archivedCount: result.archivedCount,
      decisionCount: result.decisionCount,
      scaffoldCandidateCount: result.scaffoldCandidateCount,
      unalignedCount: result.unalignedCount
    },
    warnings: []
  };
}

export async function loadCandidateQueryContext(
  location: DecisionLocation
): Promise<
  | DecisionApplicationFailure
  | { scan: DecisionScan; status: "ok"; warnings: string[] }
> {
  const scan = await scanDecisionRecords(decisionScanOptions(location));
  if (!scan.decisionsDirectoryAvailable)
    return sourceFailure(scan.sourceErrors, "Decision collection");
  if (scan.collectionErrors.length > 0)
    return sourceFailure(scan.collectionErrors, "Decision collection");
  return {
    scan,
    status: "ok",
    warnings: scan.sourceErrors.filter(
      (error) => !scan.collectionErrors.includes(error)
    )
  };
}
