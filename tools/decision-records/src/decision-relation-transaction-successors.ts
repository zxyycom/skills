import {
  decisionFailure,
  type DecisionApplicationFailure
} from "./application-result.ts";
import {
  plainRelationFailure,
  cloneRelations,
  findRecord,
  resolveEffectiveRelations
} from "./decision-relation-transaction-support.ts";
import type { PreparedSuccessor } from "./decision-relation-transaction-types.ts";
import {
  isActivationCandidateRecord,
  isEstablishedDecisionRecord,
  type DecisionCandidateRecord,
  type DecisionRecord,
  type DecisionRelationOverride,
  type DecisionScan,
  type DecisionSuccessor,
  type EstablishedDecisionRecord
} from "./types.ts";

type PreparedSuccessors =
  | DecisionApplicationFailure
  | { establishedAt: string; records: PreparedSuccessor[]; status: "ok" };

export function prepareSuccessors(
  scan: DecisionScan,
  requestedSuccessors: readonly DecisionSuccessor[],
  relationOverride: DecisionRelationOverride,
  establishedAt: string,
  allowsEmptySuccessors: boolean
): PreparedSuccessors {
  if (requestedSuccessors.length === 0) {
    return allowsEmptySuccessors
      ? { establishedAt, records: [], status: "ok" }
      : plainRelationFailure("evolve requires at least one --successor value.");
  }
  const selectedIds = new Set();
  const records: PreparedSuccessor[] = [];
  for (const requested of requestedSuccessors) {
    const requestedId = requested.decisionId;
    const record = findRecord(scan, requestedId);
    if (record === null || !record.markdownExists) {
      return plainRelationFailure(
        "Successor decision does not exist: " + requested.decisionId
      );
    }
    if (selectedIds.has(requestedId)) {
      return plainRelationFailure(
        "Successor Decision ID is repeated: " + record.decisionId
      );
    }
    selectedIds.add(requestedId);
    const prepared = prepareSuccessorRecord(
      scan,
      record,
      requested,
      relationOverride
    );
    if ("status" in prepared) return prepared;
    records.push(prepared);
  }
  return { establishedAt, records, status: "ok" };
}

function prepareSuccessorRecord(
  scan: DecisionScan,
  record: DecisionRecord,
  requested: DecisionSuccessor,
  relationOverride: DecisionRelationOverride
): PreparedSuccessor | DecisionApplicationFailure {
  if (isActivationCandidateRecord(record)) {
    return activationSuccessorRecord(record, requested, relationOverride);
  }
  if (!isEstablishedDecisionRecord(record)) {
    return decisionFailure(
      scan.sourceErrors.length > 0
        ? scan.sourceErrors
        : ["Validated successor source is unavailable: " + record.decisionId]
    );
  }
  return establishedSuccessorRecord(record, requested, relationOverride);
}

function activationSuccessorRecord(
  record: DecisionCandidateRecord,
  requested: DecisionSuccessor,
  relationOverride: DecisionRelationOverride
): PreparedSuccessor {
  const sourceRelations = cloneRelations(record.source.document.relations);
  return {
    alignment: requested.alignment,
    candidate: true,
    finalRelations: resolveEffectiveRelations(
      sourceRelations,
      requested.relationOverride ?? relationOverride
    ),
    record,
    sourceRelations
  };
}

function establishedSuccessorRecord(
  record: EstablishedDecisionRecord,
  requested: DecisionSuccessor,
  relationOverride: DecisionRelationOverride
): PreparedSuccessor | DecisionApplicationFailure {
  const source = record.source;
  if (source.document.alignment === null) {
    return plainRelationFailure(
      "Established successor must have a non-null alignment: " +
        record.decisionId
    );
  }
  if (source.document.alignment !== requested.alignment) {
    return plainRelationFailure(
      "Established successor alignment confirmation does not match " +
        record.decisionId +
        ": expected " +
        source.document.alignment +
        "."
    );
  }
  const sourceRelations = cloneRelations(source.document.relations);
  return {
    alignment: source.document.alignment,
    candidate: false,
    finalRelations: resolveEffectiveRelations(
      sourceRelations,
      requested.relationOverride ?? relationOverride
    ),
    record,
    sourceRelations
  };
}
