import {
  syncStateIndex,
  type StateSnapshot
} from "../../index-runtime/src/index.ts";
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
export async function checkScannedDecisionIndex(scan: DecisionScan) {
  const records = scan.records.filter(isEstablishedDecisionRecord);
  const snapshot: StateSnapshot<DecisionIndexState, DecisionIndexMetadata> = {
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
  return await syncStateIndex({
    context: { root: scan.decisionsDirectory },
    definition: {
      ...createDecisionStateIndexDefinition(),
      read: async () => snapshot
    },
    indexPath: decisionIndexFileName,
    mode: "check"
  });
}
