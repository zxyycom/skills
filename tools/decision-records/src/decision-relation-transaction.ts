import {
  decisionFailure,
  type DecisionApplicationFailure
} from "./application-result.ts";
import {
  prepareUnrecordedHistoryAttention,
  type DecisionHistoryBaseline
} from "./decision-history-baseline.ts";
import {
  discardDecisionChange,
  prepareDiscardDecisionEligibility,
  prepareRecordedDiscardAttention
} from "./decision-discard.ts";
import { prepareArchivedDecisionChange } from "./decision-lifecycle-change.ts";
import { serializeDecisionFrontmatter } from "./decision-metadata.ts";
import { directPredecessors } from "./decision-relation-transaction-predecessors.ts";
import {
  discardedDecisionReferenceErrors,
  graphPlanOperationConflicts,
  projectDecisionRelationGraph
} from "./decision-relation-transaction-projection.ts";
import { relationStrategyFor } from "./decision-relation-transaction-strategy.ts";
import { relationsEqual } from "./decision-relation-transaction-support.ts";
import { prepareSuccessors } from "./decision-relation-transaction-successors.ts";
import type {
  DecisionRelationGraphPlan,
  DecisionRelationTransactionPreparation,
  DecisionRelationTransactionRequest
} from "./decision-relation-transaction-types.ts";
import { decisionRelationConsistencyIssues } from "./relation-graph.ts";
import type { DecisionFileChange } from "./decision-transaction.ts";
import type { DecisionScan } from "./types.ts";

export type {
  DecisionRelationTransactionPreparation,
  DecisionRelationTransactionRequest
} from "./decision-relation-transaction-types.ts";
export { decisionRelationTransactionRequiresHistoryBaseline } from "./decision-relation-transaction-support.ts";

export function prepareDecisionRelationTransaction(
  scan: DecisionScan,
  request: DecisionRelationTransactionRequest,
  currentTimestamp: () => string,
  historyBaseline: DecisionHistoryBaseline | null
): DecisionRelationTransactionPreparation {
  const successors = prepareSuccessors(
    scan,
    request.successors,
    request.relationOverride,
    currentTimestamp(),
    request.kind === "discard"
  );
  if (successors.status === "error") return successors;
  const discarded = prepareDiscardDecisionEligibility(scan, request.discardId);
  if (discarded.status === "error") return discarded;
  const predecessorSelection = directPredecessors(scan, successors.records);
  if (predecessorSelection.errors.length > 0)
    return decisionFailure(predecessorSelection.errors);
  const graphPlan: DecisionRelationGraphPlan = {
    archivedPredecessors: predecessorSelection.activeRecords,
    discardedRecord: discarded.record,
    successors: successors.records
  };
  const graphFailure = relationGraphFailure(
    scan,
    graphPlan,
    predecessorSelection.errors
  );
  if (graphFailure !== null) return graphFailure;
  const previewRecords = projectDecisionRelationGraph(scan, graphPlan);
  const strategy = relationStrategyFor(graphPlan.successors);
  const strategyFailure = decisionRelationConsistencyFailure(
    strategy,
    graphPlan,
    previewRecords
  );
  if (strategyFailure !== null) return strategyFailure;
  const attention = relationTransactionAttention(
    predecessorSelection.historyAttentionTargets,
    request,
    graphPlan,
    historyBaseline
  );
  if (attention !== null) return attention;
  return relationTransactionChanges(graphPlan, successors.establishedAt);
}

function relationGraphFailure(
  scan: DecisionScan,
  graphPlan: DecisionRelationGraphPlan,
  predecessorErrors: readonly string[]
): DecisionApplicationFailure | null {
  if (predecessorErrors.length > 0) return decisionFailure(predecessorErrors);
  const operationConflicts = graphPlanOperationConflicts(graphPlan);
  if (operationConflicts.length > 0) return decisionFailure(operationConflicts);
  const discardReferenceErrors = discardedDecisionReferenceErrors(
    scan,
    graphPlan
  );
  return discardReferenceErrors.length === 0
    ? null
    : decisionFailure(discardReferenceErrors);
}

function decisionRelationConsistencyFailure(
  strategy: ReturnType<typeof relationStrategyFor>,
  graphPlan: DecisionRelationGraphPlan,
  previewRecords: ReturnType<typeof projectDecisionRelationGraph>
): DecisionApplicationFailure | null {
  const strategyErrors = strategy.shapeErrors(graphPlan.successors);
  if (strategyErrors.length > 0) return decisionFailure(strategyErrors);
  const previewIssues = decisionRelationConsistencyIssues(previewRecords);
  if (previewIssues.length > 0)
    return decisionFailure(previewIssues.map((issue) => issue.message));
  const closureErrors = strategy.closureErrors(
    graphPlan.successors,
    previewRecords
  );
  return closureErrors.length === 0 ? null : decisionFailure(closureErrors);
}

function relationTransactionAttention(
  historyAttentionTargets: Parameters<
    typeof prepareUnrecordedHistoryAttention
  >[0],
  request: DecisionRelationTransactionRequest,
  graphPlan: DecisionRelationGraphPlan,
  historyBaseline: DecisionHistoryBaseline | null
): DecisionRelationTransactionPreparation | null {
  const unrecordedAttention = prepareUnrecordedHistoryAttention(
    historyAttentionTargets,
    request.keepUnrecordedHistory,
    historyBaseline
  );
  if (unrecordedAttention !== null) return unrecordedAttention;
  return prepareRecordedDiscardAttention(
    graphPlan.discardedRecord,
    request.deleteRecordedDecision,
    historyBaseline
  );
}

function relationTransactionChanges(
  graphPlan: DecisionRelationGraphPlan,
  establishedAt: string
): DecisionRelationTransactionPreparation {
  const changes: DecisionFileChange[] = [];
  for (const predecessor of graphPlan.archivedPredecessors) {
    const prepared = prepareArchivedDecisionChange(predecessor);
    if (prepared.status === "error") return prepared;
    changes.push(prepared.change);
  }
  for (const successor of graphPlan.successors) {
    if (
      !successor.candidate &&
      relationsEqual(successor.sourceRelations, successor.finalRelations)
    )
      continue;
    changes.push(successorRelationChange(successor, establishedAt));
  }
  if (graphPlan.discardedRecord !== null)
    changes.push(discardDecisionChange(graphPlan.discardedRecord));
  return {
    archivedPredecessors: graphPlan.archivedPredecessors,
    changes,
    discardedRecord: graphPlan.discardedRecord,
    status: "ok",
    successors: graphPlan.successors
  };
}

function successorRelationChange(
  successor:
    | Extract<
        DecisionRelationGraphPlan["successors"][number],
        { candidate: true }
      >
    | Extract<
        DecisionRelationGraphPlan["successors"][number],
        { candidate: false }
      >,
  establishedAt: string
): DecisionFileChange {
  const source = successor.record.source;
  const nextProjection = {
    ...source.document,
    relations: successor.finalRelations
  };
  const document = successor.candidate
    ? {
        alignment: successor.alignment,
        createdAt: establishedAt,
        status: "active" as const
      }
    : source.document;
  return {
    decisionPath: successor.record.decisionPath,
    expectedText: source.text,
    nextText:
      serializeDecisionFrontmatter(
        successor.record.decisionId,
        nextProjection,
        nextProjection.tags,
        document
      ) + source.body
  };
}

export function decisionRelationTransactionMessage(
  prefix: string,
  prepared: Extract<DecisionRelationTransactionPreparation, { status: "ok" }>
): string {
  const archived =
    prepared.archivedPredecessors.length === 0
      ? ""
      : " and archived new active predecessors " +
        prepared.archivedPredecessors
          .map((record) => record.decisionId)
          .join(", ");
  const discarded =
    prepared.discardedRecord === null
      ? ""
      : " and discarded decision " + prepared.discardedRecord.decisionId;
  return prefix + archived + discarded + ".";
}
