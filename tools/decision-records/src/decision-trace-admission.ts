import type {
  RelationEdge,
  RelationGraph,
  RelationGraphTraceAdmissionAdapter,
  RelationGraphTraceAdmissionUnit
} from "../../shared/src/graph/relations.ts";
import type { DecisionReallocationComponent } from "./relation-reallocation.ts";
import type { DecisionId, DecisionRelationType } from "./types.ts";

type DecisionRelationEdge = RelationEdge<DecisionId, DecisionRelationType>;
type TraceDirection = "predecessors" | "successors";

export function decisionTraceAdmissionAdapter(
  reallocationComponents: readonly DecisionReallocationComponent[]
): RelationGraphTraceAdmissionAdapter<DecisionId, DecisionRelationType> {
  return ({ direction, fromId, graph }) =>
    traceEdges(graph, fromId, direction).map((edge) =>
      decisionTraceAdmissionUnit(edge, direction, graph, reallocationComponents)
    );
}

function decisionTraceAdmissionUnit(
  edge: DecisionRelationEdge,
  direction: TraceDirection,
  graph: RelationGraph<DecisionId, DecisionRelationType>,
  reallocationComponents: readonly DecisionReallocationComponent[]
): RelationGraphTraceAdmissionUnit<DecisionId> {
  switch (edge.type) {
    case "拆分":
      return traceEventUnit(
        "split",
        splitRecordIds(edge, graph),
        edge,
        direction,
        graph
      );
    case "归并":
      return traceEventUnit(
        "merge",
        mergeRecordIds(edge, graph),
        edge,
        direction,
        graph
      );
    case "重划":
      return traceEventUnit(
        "reallocation",
        reallocationRecordIds(edge, reallocationComponents),
        edge,
        direction,
        graph
      );
    default:
      return {
        kind: "ordinary",
        recordIds: [edge.source, edge.target],
        traceIds: [directTraceId(edge, direction)]
      };
  }
}

function traceEventUnit(
  kind: "split" | "merge" | "reallocation",
  recordIds: readonly DecisionId[],
  edge: DecisionRelationEdge,
  direction: TraceDirection,
  graph: RelationGraph<DecisionId, DecisionRelationType>
): RelationGraphTraceAdmissionUnit<DecisionId> {
  return {
    kind,
    recordIds,
    traceIds: eventDirectTraceIds(recordIds, edge, direction, graph)
  };
}

function splitRecordIds(
  edge: DecisionRelationEdge,
  graph: RelationGraph<DecisionId, DecisionRelationType>
): DecisionId[] {
  return [
    edge.target,
    ...(graph.edgesByTarget.get(edge.target) ?? [])
      .filter((candidate) => candidate.type === "拆分")
      .map((candidate) => candidate.source)
  ];
}

function mergeRecordIds(
  edge: DecisionRelationEdge,
  graph: RelationGraph<DecisionId, DecisionRelationType>
): DecisionId[] {
  return [
    edge.source,
    ...(graph.edgesBySource.get(edge.source) ?? [])
      .filter((candidate) => candidate.type === "归并")
      .map((candidate) => candidate.target)
  ];
}

function reallocationRecordIds(
  edge: DecisionRelationEdge,
  reallocationComponents: readonly DecisionReallocationComponent[]
): DecisionId[] {
  const component = reallocationComponents.find(
    (candidate) =>
      candidate.successorIds.has(edge.source) &&
      candidate.predecessorIds.has(edge.target)
  );
  if (component === undefined) {
    throw new TypeError("Reallocation edge is not part of a component");
  }
  return [...component.predecessorIds, ...component.successorIds];
}

function eventDirectTraceIds(
  recordIds: readonly DecisionId[],
  edge: DecisionRelationEdge,
  direction: TraceDirection,
  graph: RelationGraph<DecisionId, DecisionRelationType>
): DecisionId[] {
  const eventIds = new Set(recordIds);
  return traceEdges(graph, traceFromId(edge, direction), direction)
    .map((candidate) => directTraceId(candidate, direction))
    .filter((candidate) => eventIds.has(candidate));
}

function traceEdges(
  graph: RelationGraph<DecisionId, DecisionRelationType>,
  fromId: DecisionId,
  direction: TraceDirection
): readonly DecisionRelationEdge[] {
  return direction === "predecessors"
    ? (graph.edgesBySource.get(fromId) ?? [])
    : (graph.edgesByTarget.get(fromId) ?? []);
}

function directTraceId(
  edge: DecisionRelationEdge,
  direction: TraceDirection
): DecisionId {
  return direction === "predecessors" ? edge.target : edge.source;
}

function traceFromId(
  edge: DecisionRelationEdge,
  direction: TraceDirection
): DecisionId {
  return direction === "predecessors" ? edge.source : edge.target;
}
