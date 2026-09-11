import {
  prepareUnrecordedHistoryAttention,
  type DecisionHistoryBaseline
} from "./decision-history-baseline.ts";
import { prepareArchivedDecisionChange } from "./decision-lifecycle-change.ts";
import {
  prepareDecisionRelationTransaction,
  type DecisionRelationTransactionRequest
} from "./decision-relation-transaction.ts";
import {
  currentDecisionTimestamp,
  findEstablishedRecord,
  plainFailure
} from "./decision-lifecycle-support.ts";
import type {
  DecisionLifecyclePreparation,
  DecisionLifecycleRequest
} from "./decision-lifecycle-service.ts";
import type { DecisionFileChange } from "./decision-transaction.ts";
import type {
  DecisionId,
  DecisionScan,
  EstablishedDecisionRecord
} from "./types.ts";

export function prepareArchive(
  scan: DecisionScan,
  decisionIds: readonly DecisionId[],
  keepUnrecordedHistory: boolean,
  historyBaseline: DecisionHistoryBaseline | null
): DecisionLifecyclePreparation {
  const records = archiveRecords(scan, decisionIds);
  if (!Array.isArray(records)) return records;
  const attention = archiveHistoryAttention(
    records,
    keepUnrecordedHistory,
    historyBaseline
  );
  if (attention !== null) return attention;
  const changes = archiveChanges(records);
  if (!Array.isArray(changes)) return changes;
  return {
    changes,
    message:
      "Archived " + records.map((record) => record.decisionId).join(", ") + ".",
    status: "ok"
  };
}

function archiveRecords(
  scan: DecisionScan,
  decisionIds: readonly DecisionId[]
): EstablishedDecisionRecord[] | DecisionLifecyclePreparation {
  if (decisionIds.length === 0) {
    return plainFailure("At least one established Decision ID is required.");
  }
  const archivedIds = new Set<DecisionId>();
  const records: EstablishedDecisionRecord[] = [];
  for (const decisionId of decisionIds) {
    const record = archiveRecord(scan, decisionId, archivedIds);
    if (!("source" in record)) return record;
    records.push(record);
  }
  return records;
}

function archiveRecord(
  scan: DecisionScan,
  decisionId: DecisionId,
  archivedIds: Set<DecisionId>
): EstablishedDecisionRecord | DecisionLifecyclePreparation {
  const record = findEstablishedRecord(scan, decisionId);
  if (record === null)
    return plainFailure("Established decision does not exist: " + decisionId);
  if (record.source.document.status === "archived")
    return plainFailure("Decision is already archived: " + record.sourcePath);
  if (archivedIds.has(record.decisionId))
    return plainFailure("Decision ID is repeated: " + record.decisionId);
  archivedIds.add(record.decisionId);
  return record;
}

function archiveHistoryAttention(
  records: readonly EstablishedDecisionRecord[],
  keepUnrecordedHistory: boolean,
  historyBaseline: DecisionHistoryBaseline | null
): DecisionLifecyclePreparation | null {
  return prepareUnrecordedHistoryAttention(
    records.map((record) => ({
      decisionId: record.decisionId,
      kind: "archive"
    })),
    keepUnrecordedHistory,
    historyBaseline
  );
}

function archiveChanges(
  records: readonly EstablishedDecisionRecord[]
): DecisionFileChange[] | DecisionLifecyclePreparation {
  const changes: DecisionFileChange[] = [];
  for (const record of records) {
    const prepared = prepareArchivedDecisionChange(record);
    if (prepared.status === "error") return prepared;
    changes.push(prepared.change);
  }
  return changes;
}

export function prepareDiscard(
  scan: DecisionScan,
  decisionId: DecisionId,
  deleteRecordedDecision: boolean,
  historyBaseline: DecisionHistoryBaseline | null
): DecisionLifecyclePreparation {
  const prepared = prepareDecisionRelationTransaction(
    scan,
    discardRelationTransactionRequest({
      action: "discard",
      decisionId,
      deleteRecordedDecision
    }),
    currentDecisionTimestamp,
    historyBaseline
  );
  if (prepared.status !== "ok") return prepared;
  return {
    changes: prepared.changes,
    message: "Discarded decision " + prepared.discardedRecord?.sourcePath + ".",
    status: "ok"
  };
}

export function discardRelationTransactionRequest(
  request: Extract<DecisionLifecycleRequest, { action: "discard" }>
): DecisionRelationTransactionRequest {
  return {
    discardId: request.decisionId,
    deleteRecordedDecision: request.deleteRecordedDecision,
    kind: "discard",
    keepUnrecordedHistory: false,
    relationOverride: { kind: "source" },
    successors: []
  };
}
