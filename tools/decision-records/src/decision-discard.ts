import {
  decisionAttention,
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
  decisionId: DecisionId | null
): DiscardDecisionEligibility {
  if (decisionId === null) {
    return { record: null, status: "ok" };
  }
  const record = scan.records.find(
    (candidate) => candidate.decisionId === decisionId
  );
  if (
    record === undefined ||
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
  deleteRecordedDecision: boolean,
  historyBaseline: DecisionHistoryBaseline | null
): DecisionApplicationAttention | null {
  if (
    record === null ||
    deleteRecordedDecision ||
    historyBaseline?.kind !== "git-head" ||
    !historyBaseline.recordedDecisionIds.has(record.decisionId)
  ) {
    return null;
  }
  return decisionAttention([
    "Decision " +
      record.decisionId +
      " has entered Git HEAD; confirm that its recorded history should be deleted.",
    "Re-run with --delete-recorded-decision only after confirming deletion; no files were changed."
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
  return decisionFailure([error], { presentation: "plain" });
}
