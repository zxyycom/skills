import {
  decisionFailure,
  type DecisionApplicationAttention,
  type DecisionApplicationFailure
} from "./application-result.ts";
import {
  prepareUnrecordedHistoryAttention,
  type DecisionHistoryBaseline,
  type UnrecordedHistoryAttentionTarget
} from "./decision-history-baseline.ts";
import {
  discardDecisionChange,
  prepareDiscardDecisionEligibility,
  prepareRecordedDiscardAttention,
  type DiscardableDecisionRecord
} from "./decision-discard.ts";
import { prepareArchivedDecisionChange } from "./decision-lifecycle-change.ts";
import { serializeDecisionFrontmatter } from "./decision-metadata.ts";
import {
  collectDecisionRelationEdges,
  decisionReallocationComponents,
  decisionRelationConsistencyIssues,
  type DecisionRelationConsistencyRecord,
  type DecisionRelationEdge
} from "./relation-graph.ts";
import type { DecisionFileChange } from "./decision-transaction.ts";
import {
  isDecisionCandidateRecord,
  isEstablishedDecisionRecord,
  type DecisionAlignment,
  type DecisionCandidateRecord,
  type DecisionId,
  type DecisionRecord,
  type DecisionRelation,
  type DecisionRelationType,
  type DecisionRelationOverride,
  type DecisionScan,
  type DecisionSuccessor,
  type EstablishedDecisionRecord
} from "./types.ts";

type PreparedSuccessorFields = {
  alignment: DecisionAlignment;
  finalRelations: DecisionRelation[];
  sourceRelations: DecisionRelation[];
};

type PreparedSuccessor =
  | (PreparedSuccessorFields & {
      candidate: true;
      record: DecisionCandidateRecord;
    })
  | (PreparedSuccessorFields & {
      candidate: false;
      record: EstablishedDecisionRecord;
    });

type DecisionRelationGraphPlan = {
  archivedPredecessors: EstablishedDecisionRecord[];
  discardedRecord: DiscardableDecisionRecord | null;
  successors: PreparedSuccessor[];
};

export type DecisionRelationTransactionPreparation =
  | DecisionApplicationAttention
  | DecisionApplicationFailure
  | {
      archivedPredecessors: EstablishedDecisionRecord[];
      changes: DecisionFileChange[];
      discardedRecord: DiscardableDecisionRecord | null;
      status: "ok";
      successors: PreparedSuccessor[];
    };

export type DecisionRelationTransactionRequest =
  | {
      discardId: DecisionId | null;
      deleteRecordedDecision: boolean;
      kind: "evolve";
      keepUnrecordedHistory: boolean;
      relationOverride: DecisionRelationOverride;
      successors: readonly DecisionSuccessor[];
    }
  | {
      discardId: DecisionId;
      deleteRecordedDecision: boolean;
      kind: "discard";
      keepUnrecordedHistory: false;
      relationOverride: { kind: "source" };
      successors: readonly [];
    };

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
  if (successors.status === "error") {
    return successors;
  }
  const discarded = prepareDiscardDecisionEligibility(scan, request.discardId);
  if (discarded.status === "error") {
    return discarded;
  }
  const predecessorSelection = directPredecessors(scan, successors.records);
  if (predecessorSelection.errors.length > 0) {
    return decisionFailure(predecessorSelection.errors);
  }
  const graphPlan: DecisionRelationGraphPlan = {
    archivedPredecessors: predecessorSelection.activeRecords,
    discardedRecord: discarded.record,
    successors: successors.records
  };
  const operationConflicts = graphPlanOperationConflicts(graphPlan);
  if (operationConflicts.length > 0) {
    return decisionFailure(operationConflicts);
  }
  const discardReferenceErrors = discardedDecisionReferenceErrors(
    scan,
    graphPlan
  );
  if (discardReferenceErrors.length > 0) {
    return decisionFailure(discardReferenceErrors);
  }
  const previewRecords = projectDecisionRelationGraph(scan, graphPlan);
  const strategy = relationStrategyFor(graphPlan.successors);
  const strategyErrors = strategy.shapeErrors(graphPlan.successors);
  if (strategyErrors.length > 0) {
    return decisionFailure(strategyErrors);
  }
  const previewIssues = decisionRelationConsistencyIssues(previewRecords);
  if (previewIssues.length > 0) {
    return decisionFailure(previewIssues.map((issue) => issue.message));
  }
  const closureErrors = strategy.closureErrors(
    graphPlan.successors,
    previewRecords
  );
  if (closureErrors.length > 0) {
    return decisionFailure(closureErrors);
  }

  const unrecordedAttention = prepareUnrecordedHistoryAttention(
    predecessorSelection.historyAttentionTargets,
    request.keepUnrecordedHistory,
    historyBaseline
  );
  if (unrecordedAttention !== null) {
    return unrecordedAttention;
  }

  const recordedDiscardAttention = prepareRecordedDiscardAttention(
    discarded.record,
    request.deleteRecordedDecision,
    historyBaseline
  );
  if (recordedDiscardAttention !== null) {
    return recordedDiscardAttention;
  }

  const changes: DecisionFileChange[] = [];
  for (const predecessor of graphPlan.archivedPredecessors) {
    const prepared = prepareArchivedDecisionChange(predecessor);
    if (prepared.status === "error") {
      return prepared;
    }
    changes.push(prepared.change);
  }
  for (const successor of graphPlan.successors) {
    if (
      !successor.candidate &&
      relationsEqual(successor.sourceRelations, successor.finalRelations)
    ) {
      continue;
    }
    const source = successor.record.source;
    const nextProjection = {
      ...source.document,
      relations: successor.finalRelations
    };
    const nextText = successor.candidate
      ? serializeDecisionFrontmatter(nextProjection, nextProjection.tags, {
          alignment: successor.alignment,
          createdAt: successors.establishedAt,
          status: "active"
        }) + source.body
      : serializeDecisionFrontmatter(
          nextProjection,
          nextProjection.tags,
          source.document
        ) + source.body;
    changes.push({
      decisionPath: successor.record.decisionPath,
      expectedText: source.text,
      nextText
    });
  }
  if (graphPlan.discardedRecord !== null) {
    changes.push(discardDecisionChange(graphPlan.discardedRecord));
  }

  return {
    archivedPredecessors: graphPlan.archivedPredecessors,
    changes,
    discardedRecord: graphPlan.discardedRecord,
    status: "ok",
    successors: graphPlan.successors
  };
}

type PreparedSuccessors =
  | DecisionApplicationFailure
  | {
      establishedAt: string;
      records: PreparedSuccessor[];
      status: "ok";
    };

function prepareSuccessors(
  scan: DecisionScan,
  requestedSuccessors: readonly DecisionSuccessor[],
  relationOverride: DecisionRelationOverride,
  establishedAt: string,
  allowsEmptySuccessors: boolean
): PreparedSuccessors {
  if (requestedSuccessors.length === 0) {
    return allowsEmptySuccessors
      ? { establishedAt, records: [], status: "ok" }
      : plainFailure("evolve requires at least one --successor value.");
  }

  const selectedIds = new Set<DecisionId>();
  const records: PreparedSuccessor[] = [];
  for (const requested of requestedSuccessors) {
    const requestedId = requested.decisionId;
    const record = findRecord(scan, requestedId);
    if (record === null || !record.markdownExists) {
      return plainFailure(
        "Successor decision does not exist: " + requested.decisionId
      );
    }
    if (selectedIds.has(requestedId)) {
      return plainFailure(
        "Successor Decision ID is repeated: " + record.decisionId
      );
    }
    selectedIds.add(requestedId);

    if (isDecisionCandidateRecord(record)) {
      const sourceRelations = cloneRelations(record.source.document.relations);
      records.push({
        alignment: requested.alignment,
        candidate: true,
        finalRelations: resolveEffectiveRelations(
          sourceRelations,
          relationOverride
        ),
        record,
        sourceRelations
      });
      continue;
    }
    if (!isEstablishedDecisionRecord(record)) {
      return decisionFailure(
        scan.sourceErrors.length > 0
          ? scan.sourceErrors
          : ["Validated successor source is unavailable: " + record.decisionId]
      );
    }

    const source = record.source;
    if (source.document.alignment === null) {
      return plainFailure(
        "Established successor must have a non-null alignment: " +
          record.decisionId
      );
    }
    if (source.document.alignment !== requested.alignment) {
      return plainFailure(
        "Established successor alignment confirmation does not match " +
          record.decisionId +
          ": expected " +
          source.document.alignment +
          "."
      );
    }

    const sourceRelations = cloneRelations(source.document.relations);
    const finalRelations = resolveEffectiveRelations(
      sourceRelations,
      relationOverride
    );
    records.push({
      alignment: source.document.alignment,
      candidate: false,
      finalRelations,
      record,
      sourceRelations
    });
  }
  return { establishedAt, records, status: "ok" };
}

type RelationStrategy = {
  closureErrors: (
    successors: readonly PreparedSuccessor[],
    previewRecords: readonly DecisionRelationConsistencyRecord[]
  ) => string[];
  shapeErrors: (successors: readonly PreparedSuccessor[]) => string[];
};

const singleSuccessorStrategy: RelationStrategy = {
  closureErrors: () => [],
  shapeErrors: (successors) => {
    if (successors.length === 0) {
      return [];
    }
    if (successors.length !== 1) {
      return [
        "Multiple successors are supported only by the closed 拆分 strategy " +
          "or the closed 重划 strategy."
      ];
    }
    const relations = successors[0]?.finalRelations ?? [];
    return relations.length > 0 &&
      relations.every((relation) => relation.type === "归并") &&
      relations.length < 2
      ? ["A pure 归并 relation set requires at least two predecessors."]
      : [];
  }
};

const splitStrategy: RelationStrategy = {
  closureErrors: splitSuccessorClosureErrors,
  shapeErrors: splitStrategyShapeErrors
};

const reallocationStrategy: RelationStrategy = {
  closureErrors: reallocationSuccessorClosureErrors,
  shapeErrors: reallocationStrategyShapeErrors
};

function relationStrategyFor(
  successors: readonly PreparedSuccessor[]
): RelationStrategy {
  if (
    successors.some((successor) =>
      successor.finalRelations.some((relation) => relation.type === "拆分")
    )
  ) {
    return splitStrategy;
  }
  if (
    successors.some((successor) =>
      successor.finalRelations.some((relation) => relation.type === "重划")
    )
  ) {
    return reallocationStrategy;
  }
  return singleSuccessorStrategy;
}

function splitStrategyShapeErrors(
  successors: readonly PreparedSuccessor[]
): string[] {
  if (successors.length < 2) {
    return [
      "The 拆分 strategy requires at least two explicitly selected successors."
    ];
  }
  if (
    successors.some(
      (successor) =>
        successor.finalRelations.length !== 1 ||
        successor.finalRelations[0]?.type !== "拆分"
    )
  ) {
    return [
      "Every successor in a 拆分 transaction must have exactly one 拆分 " +
        "relation and no other relations."
    ];
  }
  const splitTargets = new Set(
    successors.map((successor) => successor.finalRelations[0]?.target)
  );
  return splitTargets.size === 1
    ? []
    : ["Every successor in a 拆分 transaction must use the same predecessor."];
}

function splitSuccessorClosureErrors(
  successors: readonly PreparedSuccessor[],
  previewRecords: readonly DecisionRelationConsistencyRecord[]
): string[] {
  const splitPredecessor =
    successors[0]?.finalRelations[0]?.type === "拆分"
      ? successors[0].finalRelations[0].target
      : null;
  if (splitPredecessor === null) {
    return [];
  }
  const selectedIds = new Set(
    successors.map((successor) => successor.record.decisionId)
  );
  const finalIds = new Set(
    previewRecords
      .filter((record) =>
        record.projection.relations.some(
          (relation) =>
            relation.type === "拆分" && relation.target === splitPredecessor
        )
      )
      .map((record) => record.decisionId)
  );
  const omitted = [...finalIds]
    .filter((decisionId) => !selectedIds.has(decisionId))
    .sort();
  const absent = [...selectedIds]
    .filter((decisionId) => !finalIds.has(decisionId))
    .sort();
  return omitted.length === 0 && absent.length === 0
    ? []
    : [
        "The selected successor set must equal every final direct 拆分 " +
          "successor of " +
          splitPredecessor +
          "." +
          (omitted.length === 0
            ? ""
            : " Omitted: " + omitted.join(", ") + ".") +
          (absent.length === 0
            ? ""
            : " Missing from final graph: " + absent.join(", ") + ".")
      ];
}

function reallocationStrategyShapeErrors(
  successors: readonly PreparedSuccessor[]
): string[] {
  if (successors.length < 2) {
    return [
      "The 重划 strategy requires at least two explicitly selected successors."
    ];
  }
  if (
    successors.some(
      (successor) =>
        successor.finalRelations.length === 0 ||
        successor.finalRelations.some((relation) => relation.type !== "重划")
    )
  ) {
    return [
      "Every successor in a 重划 transaction must have at least one 重划 " +
        "relation and no other relations."
    ];
  }
  const predecessorIds = new Set(
    successors.flatMap((successor) =>
      successor.finalRelations.map((relation) => relation.target)
    )
  );
  if (predecessorIds.size < 2) {
    return ["The 重划 strategy requires at least two distinct predecessors."];
  }
  const successorIds = new Set(
    successors.map((successor) => successor.record.decisionId)
  );
  const roleOverlap = [...successorIds]
    .filter((decisionId) => predecessorIds.has(decisionId))
    .sort();
  if (roleOverlap.length > 0) {
    return [
      "The 重划 strategy cannot use a decision as both successor and " +
        "predecessor: " +
        roleOverlap.join(", ")
    ];
  }
  return decisionReallocationComponents(reallocationEdgesFor(successors))
    .length === 1
    ? []
    : ["The 重划 successor-predecessor graph must be connected."];
}

function reallocationSuccessorClosureErrors(
  successors: readonly PreparedSuccessor[],
  previewRecords: readonly DecisionRelationConsistencyRecord[]
): string[] {
  if (successors.length === 0) {
    return [];
  }
  const selectedIds = new Set(
    successors.map((successor) => successor.record.decisionId)
  );
  const components = decisionReallocationComponents(
    collectDecisionRelationEdges(previewRecords)
  );
  const selectedComponent = components.find((component) =>
    [...selectedIds].some((decisionId) =>
      component.successorIds.has(decisionId)
    )
  );
  if (selectedComponent === undefined) {
    return [];
  }
  const omitted = [...selectedComponent.successorIds]
    .filter((decisionId) => !selectedIds.has(decisionId))
    .sort();
  const absent = [...selectedIds]
    .filter((decisionId) => !selectedComponent.successorIds.has(decisionId))
    .sort();
  return omitted.length === 0 && absent.length === 0
    ? []
    : [
        "The selected successor set must equal every final 重划 successor " +
          "in its connected component." +
          (omitted.length === 0
            ? ""
            : " Omitted: " + omitted.join(", ") + ".") +
          (absent.length === 0
            ? ""
            : " Outside component: " + absent.join(", ") + ".")
      ];
}

function reallocationEdgesFor(
  successors: readonly PreparedSuccessor[]
): DecisionRelationEdge[] {
  return successors.flatMap((successor) =>
    successor.finalRelations.map((relation) => ({
      source: successor.record.decisionId,
      target: relation.target,
      type: relation.type
    }))
  );
}

function directPredecessors(
  scan: DecisionScan,
  successors: readonly PreparedSuccessor[]
): {
  activeRecords: EstablishedDecisionRecord[];
  errors: string[];
  historyAttentionTargets: UnrecordedHistoryAttentionTarget[];
} {
  const activeRecords = new Map<DecisionId, EstablishedDecisionRecord>();
  const historyAttentionTargets: UnrecordedHistoryAttentionTarget[] = [];
  const relationTypesByPredecessor = new Map<
    DecisionId,
    Set<DecisionRelationType>
  >();
  const errors: string[] = [];
  for (const successor of successors) {
    const seenTargets = new Set<DecisionId>();
    for (const relation of successor.finalRelations) {
      const targetId = relation.target;
      if (targetId === successor.record.decisionId) {
        errors.push(
          "Decision relation must not target itself: " +
            successor.record.decisionId
        );
        continue;
      }
      if (seenTargets.has(targetId)) {
        errors.push(
          "Decision relation target is repeated for " +
            successor.record.decisionId +
            ": " +
            targetId
        );
        continue;
      }
      seenTargets.add(targetId);
      const predecessor = findEstablishedRecord(scan, targetId);
      if (predecessor === null) {
        errors.push(
          "Evolution predecessor is not an established decision: " + targetId
        );
        continue;
      }
      if (predecessor.source.document.status === "active") {
        activeRecords.set(predecessor.decisionId, predecessor);
      }
      let relationTypes = relationTypesByPredecessor.get(
        predecessor.decisionId
      );
      if (relationTypes === undefined) {
        relationTypes = new Set<DecisionRelationType>();
        relationTypesByPredecessor.set(predecessor.decisionId, relationTypes);
      }
      if (!relationTypes.has(relation.type)) {
        relationTypes.add(relation.type);
        historyAttentionTargets.push({
          decisionId: predecessor.decisionId,
          kind: "relation",
          relationType: relation.type
        });
      }
    }
  }
  return {
    activeRecords: [...activeRecords.values()],
    errors,
    historyAttentionTargets
  };
}

function projectDecisionRelationGraph(
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
  const preview: DecisionRelationConsistencyRecord[] = [];
  for (const record of scan.records) {
    const domainRecord =
      isDecisionCandidateRecord(record) || isEstablishedDecisionRecord(record)
        ? record
        : null;
    const successor =
      domainRecord === null
        ? undefined
        : successorById.get(domainRecord.decisionId);
    const establishedRecord = isEstablishedDecisionRecord(record)
      ? record
      : null;
    if (
      record.decisionId === graphPlan.discardedRecord?.decisionId ||
      (establishedRecord === null && successor === undefined)
    ) {
      continue;
    }
    const status =
      successor?.candidate === true
        ? "active"
        : domainRecord !== null && archivedIds.has(domainRecord.decisionId)
          ? "archived"
          : successor?.candidate === false
            ? successor.record.source.document.status
            : establishedRecord?.source.document.status;
    if (status === undefined) {
      continue;
    }
    const projection =
      successor === undefined
        ? establishedRecord?.source.document
        : {
            ...successor.record.source.document,
            relations: successor.finalRelations
          };
    if (projection === undefined) {
      continue;
    }
    const decisionId =
      successor?.record.decisionId ?? establishedRecord?.decisionId;
    if (decisionId === undefined) {
      continue;
    }
    preview.push({
      sourcePath: record.sourcePath,
      projection,
      decisionId,
      status
    });
  }
  return preview;
}

function discardedDecisionReferenceErrors(
  scan: DecisionScan,
  graphPlan: DecisionRelationGraphPlan
): string[] {
  const discardedDecisionId = graphPlan.discardedRecord?.decisionId;
  if (discardedDecisionId === undefined) {
    return [];
  }
  const successorsById = new Map(
    graphPlan.successors.map((successor) => [
      successor.record.decisionId,
      successor
    ])
  );
  const referencingIds = scan.records
    .flatMap((record) => {
      if (
        record.decisionId === discardedDecisionId ||
        (!isDecisionCandidateRecord(record) &&
          !isEstablishedDecisionRecord(record))
      ) {
        return [];
      }
      const relations =
        successorsById.get(record.decisionId)?.finalRelations ??
        record.source.document.relations;
      return relations.some(
        (relation) => relation.target === discardedDecisionId
      )
        ? [record.decisionId]
        : [];
    })
    .sort();
  return referencingIds.length === 0
    ? []
    : [
        "Cannot discard decision while it is still referenced: " +
          discardedDecisionId,
        "Remove or replace references from: " + referencingIds.join(", ")
      ];
}

function graphPlanOperationConflicts(
  graphPlan: DecisionRelationGraphPlan
): string[] {
  const discardedDecisionId = graphPlan.discardedRecord?.decisionId;
  if (discardedDecisionId === undefined) {
    return [];
  }
  return graphPlan.successors.some(
    (successor) => successor.record.decisionId === discardedDecisionId
  )
    ? [
        "Discarded Decision ID must not also be a successor: " +
          discardedDecisionId
      ]
    : [];
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

export function decisionRelationTransactionRequiresHistoryBaseline(
  scan: DecisionScan,
  request: DecisionRelationTransactionRequest
): boolean {
  const successors = request.successors.flatMap((successor) => {
    const record = findRecord(scan, successor.decisionId);
    if (
      record === null ||
      (!isDecisionCandidateRecord(record) &&
        !isEstablishedDecisionRecord(record))
    ) {
      return [];
    }
    return [
      {
        decisionId: record.decisionId,
        finalRelations: resolveEffectiveRelations(
          record.source.document.relations,
          request.relationOverride
        )
      }
    ];
  });
  if (successors.length !== request.successors.length) {
    return false;
  }
  const relations = successors.flatMap((successor) => successor.finalRelations);
  if (
    relations.some(
      (relation) => findEstablishedRecord(scan, relation.target) !== null
    )
  ) {
    return true;
  }
  if (request.deleteRecordedDecision) {
    return false;
  }
  const discarded = prepareDiscardDecisionEligibility(scan, request.discardId);
  return discarded.status === "ok" && discarded.record !== null;
}

function findRecord(
  scan: DecisionScan,
  value: DecisionId
): DecisionRecord | null {
  return scan.records.find((record) => record.decisionId === value) ?? null;
}

function findEstablishedRecord(
  scan: DecisionScan,
  value: DecisionId
): EstablishedDecisionRecord | null {
  const record = findRecord(scan, value);
  return record !== null && isEstablishedDecisionRecord(record) ? record : null;
}

function cloneRelations(
  relations: readonly DecisionRelation[]
): DecisionRelation[] {
  return relations.map(({ type, target }) => ({
    type,
    target: target
  }));
}

function resolveEffectiveRelations(
  sourceRelations: readonly DecisionRelation[],
  relationOverride: DecisionRelationOverride
): DecisionRelation[] {
  return cloneRelations(
    relationOverride.kind === "source"
      ? sourceRelations
      : relationOverride.relations
  );
}

function relationsEqual(
  left: readonly DecisionRelation[],
  right: readonly DecisionRelation[]
): boolean {
  return (
    left.length === right.length &&
    left.every(
      (relation, index) =>
        relation.type === right[index]?.type &&
        relation.target === right[index]?.target
    )
  );
}

function plainFailure(error: string): DecisionApplicationFailure {
  return decisionFailure([error], { presentation: "plain" });
}
