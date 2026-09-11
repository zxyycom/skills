import path from "node:path";
import { isDecisionId } from "./decision-path.ts";
import { decisionRelationConsistencyIssues } from "./relation-graph.ts";
import type {
  DecisionScanLocation,
  DecisionStoredIndexEntry
} from "./scan-contracts.ts";
import type {
  DecisionId,
  DecisionIndex,
  DecisionProjection,
  DecisionRecord
} from "./types.ts";
import { isEstablishedDecisionRecord } from "./types.ts";
export function unindexedDecisionError(
  indexRelativePath: string,
  decisionId: string
): string {
  return indexRelativePath + " does not include Decision ID " + decisionId;
}

export function missingIndexedDecisionError(
  indexRelativePath: string,
  decisionId: string
): string {
  return indexRelativePath + " references missing Decision ID " + decisionId;
}

export function appendMissingIndexedRecords(
  records: DecisionRecord[],
  index: DecisionIndex | null,
  location: DecisionScanLocation,
  indexErrors: string[]
): void {
  if (index === null) {
    return;
  }
  const recordIds = new Set(records.map((record) => record.decisionId));
  for (const [rawDecisionId, storedEntry] of Object.entries(index.entries)) {
    if (recordIds.has(rawDecisionId)) {
      continue;
    }
    if (!isDecisionId(rawDecisionId)) {
      indexErrors.push(
        location.indexRelativePath +
          " contains invalid Decision ID " +
          rawDecisionId
      );
      continue;
    }
    indexErrors.push(
      missingIndexedDecisionError(location.indexRelativePath, rawDecisionId)
    );
    records.push(
      recordFromIndexEntry({
        decisionsDirectory: location.decisionsDirectory,
        decisionId: rawDecisionId,
        entry: storedEntry
      })
    );
  }
}

function recordFromIndexEntry(options: {
  decisionsDirectory: string;
  decisionId: DecisionId;
  entry: DecisionStoredIndexEntry;
}): DecisionRecord {
  const { decisionsDirectory, decisionId, entry } = options;
  const state = entry;
  return {
    activationCandidate: false,
    bodyReady: false,
    scaffoldValid: false,
    alignment: state.alignment ?? null,
    createdAt: state.createdAt,
    decisionId,
    decisionPath: path.join(decisionsDirectory, ...state.sourcePath.split("/")),
    document: null,
    markdownExists: false,
    projection: selectProjection(state),
    relationshipErrors: [],
    source: { kind: "missing" },
    sourcePath: state.sourcePath,
    status: state.status,
    tags: [...state.tags]
  };
}

export function validateScannedRelationships(
  records: readonly DecisionRecord[],
  sourceErrors: string[]
): void {
  appendEstablishedRelationshipIssues(records, sourceErrors);
  appendCandidateRelationshipIssues(records, sourceErrors);
}

function appendEstablishedRelationshipIssues(
  records: readonly DecisionRecord[],
  sourceErrors: string[]
): void {
  const relationshipIssues = decisionRelationConsistencyIssues(
    establishedRelationshipSources(records)
  );
  const recordById = new Map(
    records.map((record) => [record.decisionId, record])
  );
  for (const issue of relationshipIssues) {
    sourceErrors.push(issue.message);
    for (const decisionId of issue.sourceIds) {
      recordById.get(decisionId)?.relationshipErrors.push(issue.message);
    }
  }
}

function establishedRelationshipSources(records: readonly DecisionRecord[]) {
  return records.flatMap((record) =>
    isEstablishedDecisionRecord(record)
      ? [
          {
            decisionId: record.decisionId,
            projection: record.source.document,
            sourcePath: record.sourcePath,
            status: record.source.document.status
          }
        ]
      : []
  );
}

function appendCandidateRelationshipIssues(
  records: readonly DecisionRecord[],
  sourceErrors: string[]
): void {
  const recordById = new Map(
    records.map((record) => [record.decisionId, record])
  );
  for (const candidate of records.filter(
    (record) => record.activationCandidate
  )) {
    appendInvalidCandidateRelations(candidate, recordById, sourceErrors);
  }
}

function appendInvalidCandidateRelations(
  candidate: DecisionRecord,
  recordById: ReadonlyMap<string, DecisionRecord>,
  sourceErrors: string[]
): void {
  for (const relation of candidate.projection.relations) {
    const target = recordById.get(relation.target);
    if (
      target !== undefined &&
      (isEstablishedDecisionRecord(target) || target.activationCandidate)
    )
      continue;
    const error =
      candidate.sourcePath +
      " relationship " +
      relation.type +
      " target is not a valid scanned decision: " +
      relation.target;
    sourceErrors.push(error);
    candidate.relationshipErrors.push(error);
  }
}

export function selectProjection(
  source: DecisionProjection
): DecisionProjection {
  return {
    background: source.background,
    decision: source.decision,
    purpose: source.purpose,
    relations: source.relations,
    title: source.title
  };
}

export function emptyDecisionProjection(): DecisionProjection {
  return {
    background: "",
    decision: "",
    purpose: "",
    relations: [],
    title: ""
  };
}
