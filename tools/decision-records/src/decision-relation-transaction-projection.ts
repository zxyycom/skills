import type { DecisionRelationConsistencyRecord } from "./relation-graph.ts";
import type {
  DecisionRelationGraphPlan,
  PreparedSuccessor
} from "./decision-relation-transaction-types.ts";
import {
  isDecisionCandidateRecord,
  isEstablishedDecisionRecord,
  type DecisionCandidateRecord,
  type DecisionId,
  type DecisionRecord,
  type EstablishedDecisionRecord,
  type DecisionScan
} from "./types.ts";

export function projectDecisionRelationGraph(
  scan: DecisionScan,
  graphPlan: DecisionRelationGraphPlan
): DecisionRelationConsistencyRecord[] {
  const successorById = new Map<DecisionId, PreparedSuccessor>(
    graphPlan.successors.map((successor) => [
      successor.record.decisionId,
      successor
    ])
  );
  const archivedIds = new Set<DecisionId>(
    graphPlan.archivedPredecessors.map((record) => record.decisionId)
  );
  return scan.records.flatMap((record) => {
    const projected = projectDecisionRelationRecord(
      record,
      graphPlan,
      successorById,
      archivedIds
    );
    return projected === null ? [] : [projected];
  });
}

function projectDecisionRelationRecord(
  record: DecisionRecord,
  graphPlan: DecisionRelationGraphPlan,
  successorById: ReadonlyMap<DecisionId, PreparedSuccessor>,
  archivedIds: ReadonlySet<DecisionId>
): DecisionRelationConsistencyRecord | null {
  const context = projectedRecordContext(record, successorById);
  if (
    shouldOmitProjectedRecord(
      record,
      graphPlan,
      context.establishedRecord,
      context.successor
    )
  )
    return null;
  return projectedRecordFromContext(record, context, archivedIds);
}
type ProjectedRecordContext = {
  domainRecord: DecisionCandidateRecord | EstablishedDecisionRecord | null;
  establishedRecord: EstablishedDecisionRecord | null;
  successor: PreparedSuccessor | undefined;
};
function projectedRecordContext(
  record: DecisionRecord,
  successorById: ReadonlyMap<DecisionId, PreparedSuccessor>
): ProjectedRecordContext {
  const domainRecord =
    isDecisionCandidateRecord(record) || isEstablishedDecisionRecord(record)
      ? record
      : null;
  return {
    domainRecord,
    establishedRecord: isEstablishedDecisionRecord(record) ? record : null,
    successor:
      domainRecord === null
        ? undefined
        : successorById.get(domainRecord.decisionId)
  };
}
function projectedRecordFromContext(
  record: DecisionRecord,
  context: ProjectedRecordContext,
  archivedIds: ReadonlySet<DecisionId>
): DecisionRelationConsistencyRecord | null {
  const status = projectedRelationStatus(
    context.successor,
    context.domainRecord,
    context.establishedRecord,
    archivedIds
  );
  const projection = projectedRelationDocument(
    context.successor,
    context.establishedRecord
  );
  const decisionId = projectedRelationDecisionId(
    context.successor,
    context.establishedRecord
  );
  return status === undefined ||
    projection === undefined ||
    decisionId === undefined
    ? null
    : { sourcePath: record.sourcePath, projection, decisionId, status };
}

function shouldOmitProjectedRecord(
  record: DecisionRecord,
  graphPlan: DecisionRelationGraphPlan,
  establishedRecord: EstablishedDecisionRecord | null,
  successor: PreparedSuccessor | undefined
): boolean {
  return (
    record.decisionId === graphPlan.discardedRecord?.decisionId ||
    (establishedRecord === null && successor === undefined)
  );
}

function projectedRelationStatus(
  successor: PreparedSuccessor | undefined,
  domainRecord: DecisionCandidateRecord | EstablishedDecisionRecord | null,
  establishedRecord: EstablishedDecisionRecord | null,
  archivedIds: ReadonlySet<DecisionId>
): "active" | "archived" | undefined {
  if (successor?.candidate === true) return "active";
  if (domainRecord !== null && archivedIds.has(domainRecord.decisionId))
    return "archived";
  if (successor?.candidate === false)
    return successor.record.source.document.status;
  return establishedRecord?.source.document.status;
}

function projectedRelationDocument(
  successor: PreparedSuccessor | undefined,
  establishedRecord: EstablishedDecisionRecord | null
): DecisionRelationConsistencyRecord["projection"] | undefined {
  if (successor === undefined) return establishedRecord?.source.document;
  return {
    ...successor.record.source.document,
    relations: successor.finalRelations
  };
}

function projectedRelationDecisionId(
  successor: PreparedSuccessor | undefined,
  establishedRecord: EstablishedDecisionRecord | null
): DecisionId | undefined {
  return successor?.record.decisionId ?? establishedRecord?.decisionId;
}

export function discardedDecisionReferenceErrors(
  scan: DecisionScan,
  graphPlan: DecisionRelationGraphPlan
): string[] {
  const discardedDecisionId = graphPlan.discardedRecord?.decisionId;
  if (discardedDecisionId === undefined) return [];
  const successorsById = new Map(
    graphPlan.successors.map((successor) => [
      successor.record.decisionId,
      successor
    ])
  );
  const referencingIds = scan.records
    .flatMap((record) =>
      referencedDiscardedId(record, successorsById, discardedDecisionId)
    )
    .sort();
  return referencingIds.length === 0
    ? []
    : [
        "Cannot discard decision while it is still referenced: " +
          discardedDecisionId,
        "Remove or replace references from: " + referencingIds.join(", ")
      ];
}

function referencedDiscardedId(
  record: DecisionRecord,
  successorsById: ReadonlyMap<DecisionId, PreparedSuccessor>,
  discardedDecisionId: DecisionId
): DecisionId[] {
  if (
    record.decisionId === discardedDecisionId ||
    (!isDecisionCandidateRecord(record) && !isEstablishedDecisionRecord(record))
  ) {
    return [];
  }
  const relations =
    successorsById.get(record.decisionId)?.finalRelations ??
    record.source.document.relations;
  return relations.some((relation) => relation.target === discardedDecisionId)
    ? [record.decisionId]
    : [];
}

export function graphPlanOperationConflicts(
  graphPlan: DecisionRelationGraphPlan
): string[] {
  const discardedDecisionId = graphPlan.discardedRecord?.decisionId;
  if (discardedDecisionId === undefined) return [];
  return graphPlan.successors.some(
    (successor) => successor.record.decisionId === discardedDecisionId
  )
    ? [
        "Discarded Decision ID must not also be a successor: " +
          discardedDecisionId
      ]
    : [];
}
