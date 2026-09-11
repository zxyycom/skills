import type { UnrecordedHistoryAttentionTarget } from "./decision-history-baseline.ts";
import { findEstablishedRecord } from "./decision-relation-transaction-support.ts";
import type { PreparedSuccessor } from "./decision-relation-transaction-types.ts";
import type {
  DecisionId,
  DecisionRelation,
  DecisionRelationType,
  DecisionScan,
  EstablishedDecisionRecord
} from "./types.ts";

type DirectPredecessorContext = Readonly<{
  activeRecords: Map<DecisionId, EstablishedDecisionRecord>;
  errors: string[];
  historyAttentionTargets: UnrecordedHistoryAttentionTarget[];
  relationTypesByPredecessor: Map<DecisionId, Set<DecisionRelationType>>;
}>;

export function directPredecessors(
  scan: DecisionScan,
  successors: readonly PreparedSuccessor[]
): {
  activeRecords: EstablishedDecisionRecord[];
  errors: string[];
  historyAttentionTargets: UnrecordedHistoryAttentionTarget[];
} {
  const context: DirectPredecessorContext = {
    activeRecords: new Map(),
    errors: [],
    historyAttentionTargets: [],
    relationTypesByPredecessor: new Map()
  };
  for (const successor of successors) {
    const seenTargets = new Set<DecisionId>();
    for (const relation of successor.finalRelations) {
      recordDirectPredecessor(relation, successor, scan, seenTargets, context);
    }
  }
  return {
    activeRecords: [...context.activeRecords.values()],
    errors: context.errors,
    historyAttentionTargets: context.historyAttentionTargets
  };
}

function recordDirectPredecessor(
  relation: DecisionRelation,
  successor: PreparedSuccessor,
  scan: DecisionScan,
  seenTargets: Set<DecisionId>,
  context: DirectPredecessorContext
): void {
  const targetId = relation.target;
  if (targetId === successor.record.decisionId) {
    context.errors.push(
      "Decision relation must not target itself: " + successor.record.decisionId
    );
    return;
  }
  if (seenTargets.has(targetId)) {
    context.errors.push(
      "Decision relation target is repeated for " +
        successor.record.decisionId +
        ": " +
        targetId
    );
    return;
  }
  seenTargets.add(targetId);
  const predecessor = findEstablishedRecord(scan, targetId);
  if (predecessor === null) {
    context.errors.push(
      "Evolution predecessor is not an established decision: " + targetId
    );
    return;
  }
  if (predecessor.source.document.status === "active") {
    context.activeRecords.set(predecessor.decisionId, predecessor);
  }
  const relationTypes = relationTypesForPredecessor(context, predecessor);
  if (relationTypes.has(relation.type)) return;
  relationTypes.add(relation.type);
  context.historyAttentionTargets.push({
    decisionId: predecessor.decisionId,
    kind: "relation",
    relationType: relation.type
  });
}

function relationTypesForPredecessor(
  context: DirectPredecessorContext,
  predecessor: EstablishedDecisionRecord
): Set<DecisionRelationType> {
  let relationTypes = context.relationTypesByPredecessor.get(
    predecessor.decisionId
  );
  if (relationTypes === undefined) {
    relationTypes = new Set();
    context.relationTypesByPredecessor.set(
      predecessor.decisionId,
      relationTypes
    );
  }
  return relationTypes;
}
