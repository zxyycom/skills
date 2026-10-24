/*
 * Synced TypeScript runtime; repository maintenance edits tools/decision-records/src/scan-index-check.ts.
 * Installed skill copies may be edited directly; updates overwrite matching files.
 * Repository: https://github.com/zxyycom/skills
 * Source path: tools/decision-records/src/scan-index-check.ts
 * Maintained source: https://github.com/zxyycom/skills/blob/main/tools/decision-records/src/scan-index-check.ts
 * Skill source directory: https://github.com/zxyycom/skills/tree/main/skills/decision-records
 * Rebuild: bun run sync:decision-records-cli
 */
import type { StateSnapshot } from "../../index-runtime/src/index.ts";
import { checkCollectedRecordIndex } from "../../record-operations/src/check.ts";
import {
  createDecisionStateIndexDefinition,
  decisionIndexFileName
} from "./decision-index-definition.ts";
import { decisionSourceRevision } from "./decision-source-revision.ts";
import { decisionIndexState } from "./decision-state-snapshot.ts";
import {
  isEstablishedDecisionRecord,
  type DecisionIndexMetadata,
  type DecisionIndexState,
  type DecisionScan
} from "./types.ts";

/** Called only with the fresh, source-valid scan owned by this validation call. */
export function decisionSnapshotFromScan(
  scan: DecisionScan
): StateSnapshot<DecisionIndexState, DecisionIndexMetadata> {
  const records = scan.records.filter(isEstablishedDecisionRecord);
  return {
    metadata: {},
    sourceRevision: decisionSourceRevision(
      records.map((record) => ({
        decisionId: record.decisionId,
        sourcePath: record.sourcePath,
        text: record.source.text
      }))
    ),
    states: Object.fromEntries(
      records.map((record) => [
        record.decisionId,
        decisionIndexState(
          record.sourcePath,
          record.source.document,
          record.decisionId
        )
      ])
    )
  };
}

export async function checkScannedDecisionIndex(scan: DecisionScan) {
  const snapshot = decisionSnapshotFromScan(scan);
  return await checkCollectedRecordIndex({
    context: { root: scan.decisionsDirectory },
    definition: createDecisionStateIndexDefinition(),
    indexPath: decisionIndexFileName,
    snapshot
  });
}
