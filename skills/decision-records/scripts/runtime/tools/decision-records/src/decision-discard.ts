/*
 * Synced TypeScript runtime; repository maintenance edits tools/decision-records/src/decision-discard.ts.
 * Installed skill copies may be edited directly; updates overwrite matching files.
 * Repository: https://github.com/zxyycom/skills
 * Source path: tools/decision-records/src/decision-discard.ts
 * Maintained source: https://github.com/zxyycom/skills/blob/main/tools/decision-records/src/decision-discard.ts
 * Skill source directory: https://github.com/zxyycom/skills/tree/main/skills/decision-records
 * Rebuild: bun run sync:decision-records-cli
 */
import {
  findDecisionRecord,
  type DecisionRecordLookup
} from "./decision-record-lookup.ts";
import {
  decisionAttention,
  decisionDiagnostic,
  decisionFailure,
  type DecisionApplicationAttention,
  type DecisionApplicationFailure
} from "./application-result.ts";
import type { DecisionHistoryBaseline } from "./decision-history-baseline.ts";
import type { DecisionFileChange } from "./decision-transaction.ts";
import {
  isDecisionCandidateRecord,
  isEstablishedDecisionRecord,
  type DecisionCandidateRecord,
  type DecisionId,
  type DecisionScan,
  type EstablishedDecisionRecord
} from "./types.ts";

export type DiscardableDecisionRecord =
  | DecisionCandidateRecord
  | EstablishedDecisionRecord;

export type DiscardDecisionEligibility =
  | DecisionApplicationFailure
  | { record: DiscardableDecisionRecord | null; status: "ok" };

export function prepareDiscardDecisionEligibility(
  scan: DecisionScan,
  decisionId: DecisionId | null,
  records?: DecisionRecordLookup
): DiscardDecisionEligibility {
  if (decisionId === null) {
    return { record: null, status: "ok" };
  }
  const record =
    records === undefined
      ? scan.records.find((candidate) => candidate.decisionId === decisionId)
      : findDecisionRecord(records, decisionId);
  if (
    record == null ||
    !record.markdownExists ||
    (!isDecisionCandidateRecord(record) && !isEstablishedDecisionRecord(record))
  ) {
    return plainFailure("Discarded Decision ID is unavailable: " + decisionId);
  }
  if (record.relationshipErrors.length > 0) {
    return decisionFailure([
      "Discard requires structurally valid decision relationships: " +
        record.sourcePath,
      ...record.relationshipErrors
    ]);
  }
  return { record, status: "ok" };
}

export function prepareRecordedDiscardAttention(
  record: DiscardableDecisionRecord | null,
  deleteRecorded: boolean,
  historyBaseline: DecisionHistoryBaseline | null
): DecisionApplicationAttention | null {
  if (
    record === null ||
    deleteRecorded ||
    historyBaseline?.kind !== "git-head" ||
    !historyBaseline.recordedDecisionIds.has(record.decisionId)
  ) {
    return null;
  }
  return decisionAttention([
    "Decision " +
      record.decisionId +
      " has entered Git HEAD; confirm that its recorded history should be deleted.",
    "Re-run with --delete-recorded only after confirming deletion; no files were changed."
  ]);
}

export function discardDecisionChange(
  record: DiscardableDecisionRecord
): DecisionFileChange {
  return {
    decisionPath: record.decisionPath,
    expectedText: record.source.text,
    nextText: null
  };
}

function plainFailure(error: string): DecisionApplicationFailure {
  return decisionFailure(
    [
      decisionDiagnostic({
        code: "decision-records.discard-invalid",
        reason: error,
        recovery:
          "Correct the discard selection or decision state, then retry the command.",
        target: "Decision discard"
      })
    ],
    { presentation: "plain" }
  );
}
