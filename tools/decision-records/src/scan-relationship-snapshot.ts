import {
  createDecisionRelationGraphProvider,
  decisionRelationConsistencyIssues,
  type DecisionRelationGraphProvider
} from "./relation-graph.ts";
import { isEstablishedDecisionRecord, type DecisionRecord } from "./types.ts";

type ScannedRelationshipSnapshot = Readonly<{
  records: readonly DecisionRecord[];
  getRelationGraph: DecisionRelationGraphProvider;
}>;

export function createScannedRelationshipSnapshot(
  records: readonly DecisionRecord[]
): ScannedRelationshipSnapshot {
  return {
    records,
    getRelationGraph: createDecisionRelationGraphProvider(
      establishedRelationshipSources(records)
    )
  };
}

export function validateScannedRelationshipSnapshot(
  snapshot: ScannedRelationshipSnapshot,
  sourceErrors: string[]
): void {
  appendEstablishedRelationshipIssues(snapshot, sourceErrors);
  appendCandidateRelationshipIssues(snapshot.records, sourceErrors);
}

function appendEstablishedRelationshipIssues(
  snapshot: ScannedRelationshipSnapshot,
  sourceErrors: string[]
): void {
  const relationshipIssues = decisionRelationConsistencyIssues(
    snapshot.getRelationGraph
  );
  const recordById = new Map(
    snapshot.records.map((record) => [record.decisionId, record])
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
