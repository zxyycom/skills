import {
  collectDecisionRelationEdges,
  decisionReallocationComponents,
  type DecisionRelationConsistencyRecord,
  type DecisionRelationEdge
} from "./relation-graph.ts";
import type { PreparedSuccessor } from "./decision-relation-transaction-types.ts";
import type { DecisionId } from "./types.ts";

export type RelationStrategy = {
  closureErrors: (
    successors: readonly PreparedSuccessor[],
    previewRecords: readonly DecisionRelationConsistencyRecord[]
  ) => string[];
  shapeErrors: (successors: readonly PreparedSuccessor[]) => string[];
};

function singleSuccessorShapeErrors(
  successors: readonly PreparedSuccessor[]
): string[] {
  if (successors.length === 0) return [];
  if (successors.length !== 1)
    return [
      "Multiple successors are supported only by the closed 拆分 strategy or the closed 重划 strategy."
    ];
  return pureMergeTooSmall(successors[0]!.finalRelations)
    ? ["A pure 归并 relation set requires at least two predecessors."]
    : [];
}
function pureMergeTooSmall(relations: readonly { type: string }[]): boolean {
  return (
    relations.length > 0 &&
    relations.length < 2 &&
    relations.every((relation) => relation.type === "归并")
  );
}
const singleSuccessorStrategy: RelationStrategy = {
  closureErrors: () => [],
  shapeErrors: singleSuccessorShapeErrors
};
const splitStrategy: RelationStrategy = {
  closureErrors: splitSuccessorClosureErrors,
  shapeErrors: splitStrategyShapeErrors
};
const reallocationStrategy: RelationStrategy = {
  closureErrors: reallocationSuccessorClosureErrors,
  shapeErrors: reallocationStrategyShapeErrors
};

export function relationStrategyFor(
  successors: readonly PreparedSuccessor[]
): RelationStrategy {
  return hasRelationType(successors, "拆分")
    ? splitStrategy
    : hasRelationType(successors, "重划")
      ? reallocationStrategy
      : singleSuccessorStrategy;
}
function hasRelationType(
  successors: readonly PreparedSuccessor[],
  type: string
): boolean {
  for (const successor of successors)
    for (const relation of successor.finalRelations)
      if (relation.type === type) return true;
  return false;
}
function splitStrategyShapeErrors(
  successors: readonly PreparedSuccessor[]
): string[] {
  if (successors.length < 2)
    return [
      "The 拆分 strategy requires at least two explicitly selected successors."
    ];
  if (!allSplitSuccessors(successors))
    return [
      "Every successor in a 拆分 transaction must have exactly one 拆分 relation and no other relations."
    ];
  return sameSplitTarget(successors)
    ? []
    : ["Every successor in a 拆分 transaction must use the same predecessor."];
}
function allSplitSuccessors(successors: readonly PreparedSuccessor[]): boolean {
  return successors.every(
    (successor) =>
      successor.finalRelations.length === 1 &&
      successor.finalRelations[0]?.type === "拆分"
  );
}
function sameSplitTarget(successors: readonly PreparedSuccessor[]): boolean {
  return (
    new Set(successors.map((successor) => successor.finalRelations[0]?.target))
      .size === 1
  );
}
function splitSuccessorClosureErrors(
  successors: readonly PreparedSuccessor[],
  previewRecords: readonly DecisionRelationConsistencyRecord[]
): string[] {
  const predecessor =
    successors[0]?.finalRelations[0]?.type === "拆分"
      ? successors[0].finalRelations[0].target
      : null;
  if (predecessor === null) return [];
  return successorSetClosureError(
    successorIds(successors),
    splitFinalIds(previewRecords, predecessor),
    "The selected successor set must equal every final direct 拆分 successor of " +
      predecessor +
      ".",
    " Missing from final graph: "
  );
}
function successorIds(
  successors: readonly PreparedSuccessor[]
): Set<DecisionId> {
  return new Set(successors.map((successor) => successor.record.decisionId));
}
function splitFinalIds(
  records: readonly DecisionRelationConsistencyRecord[],
  predecessor: DecisionId
): Set<DecisionId> {
  const ids = new Set<DecisionId>();
  for (const record of records)
    for (const relation of record.projection.relations)
      if (relation.type === "拆分" && relation.target === predecessor)
        ids.add(record.decisionId);
  return ids;
}
function reallocationStrategyShapeErrors(
  successors: readonly PreparedSuccessor[]
): string[] {
  if (successors.length < 2)
    return [
      "The 重划 strategy requires at least two explicitly selected successors."
    ];
  if (!allReallocationSuccessors(successors))
    return [
      "Every successor in a 重划 transaction must have at least one 重划 relation and no other relations."
    ];
  const predecessors = new Set(
    successors.flatMap((successor) =>
      successor.finalRelations.map((relation) => relation.target)
    )
  );
  if (predecessors.size < 2)
    return ["The 重划 strategy requires at least two distinct predecessors."];
  const overlap = [...successorIds(successors)]
    .filter((id) => predecessors.has(id))
    .sort();
  if (overlap.length > 0)
    return [
      "The 重划 strategy cannot use a decision as both successor and predecessor: " +
        overlap.join(", ")
    ];
  return decisionReallocationComponents(reallocationEdgesFor(successors))
    .length === 1
    ? []
    : ["The 重划 successor-predecessor graph must be connected."];
}
function allReallocationSuccessors(
  successors: readonly PreparedSuccessor[]
): boolean {
  return successors.every(
    (successor) =>
      successor.finalRelations.length > 0 &&
      successor.finalRelations.every((relation) => relation.type === "重划")
  );
}
function reallocationSuccessorClosureErrors(
  successors: readonly PreparedSuccessor[],
  previewRecords: readonly DecisionRelationConsistencyRecord[]
): string[] {
  if (successors.length === 0) return [];
  const selected = successorIds(successors);
  const component = decisionReallocationComponents(
    collectDecisionRelationEdges(previewRecords)
  ).find((candidate) => hasSelectedSuccessor(candidate.successorIds, selected));
  return component === undefined
    ? []
    : successorSetClosureError(
        selected,
        component.successorIds,
        "The selected successor set must equal every final 重划 successor in its connected component.",
        " Outside component: "
      );
}
function hasSelectedSuccessor(
  component: ReadonlySet<DecisionId>,
  selected: ReadonlySet<DecisionId>
): boolean {
  for (const id of selected) if (component.has(id)) return true;
  return false;
}
function successorSetClosureError(
  selected: ReadonlySet<DecisionId>,
  finalIds: ReadonlySet<DecisionId>,
  message: string,
  absentLabel: string
): string[] {
  const omitted = [...finalIds].filter((id) => !selected.has(id)).sort();
  const absent = [...selected].filter((id) => !finalIds.has(id)).sort();
  return omitted.length === 0 && absent.length === 0
    ? []
    : [
        message +
          (omitted.length === 0
            ? ""
            : " Omitted: " + omitted.join(", ") + ".") +
          (absent.length === 0 ? "" : absentLabel + absent.join(", ") + ".")
      ];
}

function reallocationEdgesFor(
  successors: readonly PreparedSuccessor[]
): DecisionRelationEdge[] {
  return successors.flatMap((successor) =>
    successor.finalRelations.map((relation) => ({
      source: successor.record.decisionId,
      target: relation.target,
      type: relation.type,
      ...(relation.summary === undefined ? {} : { summary: relation.summary })
    }))
  );
}
