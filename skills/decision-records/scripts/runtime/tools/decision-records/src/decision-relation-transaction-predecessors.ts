/*
 * Synced TypeScript runtime; repository maintenance edits tools/decision-records/src/decision-relation-transaction-predecessors.ts.
 * Installed skill copies may be edited directly; updates overwrite matching files.
 * Repository: https://github.com/zxyycom/skills
 * Source path: tools/decision-records/src/decision-relation-transaction-predecessors.ts
 * Maintained source: https://github.com/zxyycom/skills/blob/main/tools/decision-records/src/decision-relation-transaction-predecessors.ts
 * Skill source directory: https://github.com/zxyycom/skills/tree/main/skills/decision-records
 * Rebuild: bun run sync:decision-records-cli
 */
import type { UnrecordedHistoryAttentionTarget } from "./decision-history-baseline.ts";
import {
  findEstablishedDecisionRecord,
  type DecisionRecordLookup
} from "./decision-record-lookup.ts";
import type { PreparedSuccessor } from "./decision-relation-transaction-types.ts";
import type {
  DecisionId,
  DecisionIndex,
  DecisionRelation,
  DecisionRelationType,
  EstablishedDecisionRecord
} from "./types.ts";

type DirectPredecessorContext = Readonly<{
  records: DecisionRecordLookup;
  baseline: DecisionIndex | undefined;
  activeRecords: Map<DecisionId, EstablishedDecisionRecord>;
  errors: string[];
  historyAttentionTargets: UnrecordedHistoryAttentionTarget[];
  relationTypesByPredecessor: Map<DecisionId, Set<DecisionRelationType>>;
}>;

export function directPredecessors(
  records: DecisionRecordLookup,
  successors: readonly PreparedSuccessor[],
  baseline?: DecisionIndex
): {
  activeRecords: EstablishedDecisionRecord[];
  errors: string[];
  historyAttentionTargets: UnrecordedHistoryAttentionTarget[];
} {
  const context: DirectPredecessorContext = {
    records,
    baseline,
    activeRecords: new Map(),
    errors: [],
    historyAttentionTargets: [],
    relationTypesByPredecessor: new Map()
  };
  for (const successor of successors) {
    const seenTargets = new Set<DecisionId>();
    for (const relation of successor.finalRelations) {
      recordDirectPredecessor(relation, successor, seenTargets, context);
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
  seenTargets: Set<DecisionId>,
  context: DirectPredecessorContext
): void {
  const targetId = relation.target;
  if (!admitPredecessorTarget(targetId, successor, seenTargets, context.errors))
    return;
  const predecessor = findEstablishedDecisionRecord(context.records, targetId);
  const published = context.baseline?.entries[targetId];
  if (predecessor === null && published?.status === "archived") {
    context.historyAttentionTargets.push({
      decisionId: targetId,
      kind: "relation",
      relationType: relation.type
    });
    return;
  }
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

function admitPredecessorTarget(
  targetId: DecisionId,
  successor: PreparedSuccessor,
  seenTargets: Set<DecisionId>,
  errors: string[]
): boolean {
  if (targetId === successor.record.decisionId) {
    errors.push(
      "Decision relation must not target itself: " + successor.record.decisionId
    );
    return false;
  }
  if (seenTargets.has(targetId)) {
    errors.push(
      "Decision relation target is repeated for " +
        successor.record.decisionId +
        ": " +
        targetId
    );
    return false;
  }
  seenTargets.add(targetId);
  return true;
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
