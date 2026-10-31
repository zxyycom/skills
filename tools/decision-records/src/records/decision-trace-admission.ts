import type {
  RelationEdge,
  RelationGraph,
  RelationGraphTraceAdmissionAdapter,
  RelationGraphTraceAdmissionUnit
} from "../../../shared/src/graph/relations.ts";
import type { DecisionReallocationComponent } from "../relations/relation-reallocation.ts";
import type { DecisionId, DecisionRelationType } from "../types.ts";

type DecisionRelationEdge = RelationEdge<DecisionId, DecisionRelationType>;
type TraceDirection = "predecessors" | "successors";
type TraceEvent = Readonly<{
  kind: "split" | "merge" | "reallocation";
  recordIds: readonly DecisionId[];
  members: ReadonlySet<DecisionId>;
  units: Map<string, RelationGraphTraceAdmissionUnit<DecisionId>>;
}>;

/** Event facts and stable units belong to this query, never to a global graph. */
export function decisionTraceAdmissionAdapter(
  reallocationComponents: readonly DecisionReallocationComponent[]
): RelationGraphTraceAdmissionAdapter<DecisionId, DecisionRelationType> {
  const splits = new Map<DecisionId, TraceEvent>();
  const merges = new Map<DecisionId, TraceEvent>();
  const reallocations = new Map<DecisionId, TraceEvent>();
  for (const component of reallocationComponents) {
    const event = traceEvent("reallocation", [
      ...component.predecessorIds,
      ...component.successorIds
    ]);
    for (const source of component.successorIds)
      reallocations.set(source, event);
  }
  const eventsByKind = { splits, merges, reallocations };
  return ({ direction, fromId, graph }) => {
    const edges = traceEdges(graph, fromId, direction);
    const directIds = new Set(
      edges.map((edge) => directTraceId(edge, direction))
    );
    const events = new Set<TraceEvent>();
    const units: RelationGraphTraceAdmissionUnit<DecisionId>[] = [];
    for (const edge of edges) {
      const event = eventForEdge(edge, graph, eventsByKind);
      if (event === null) {
        units.push({
          kind: "ordinary",
          recordIds: [edge.source, edge.target],
          traceIds: [directTraceId(edge, direction)]
        });
      } else {
        events.add(event);
      }
    }
    for (const event of events) units.push(eventUnit(event, directIds));
    return units;
  };
}

function eventForEdge(
  edge: DecisionRelationEdge,
  graph: RelationGraph<DecisionId, DecisionRelationType>,
  events: Readonly<{
    splits: Map<DecisionId, TraceEvent>;
    merges: Map<DecisionId, TraceEvent>;
    reallocations: ReadonlyMap<DecisionId, TraceEvent>;
  }>
): TraceEvent | null {
  if (edge.type === "拆分") return splitEvent(edge, graph, events.splits);
  if (edge.type === "归并") return mergeEvent(edge, graph, events.merges);
  if (edge.type === "重划") {
    const event = events.reallocations.get(edge.source);
    if (event === undefined || !event.members.has(edge.target))
      throw new TypeError("Reallocation edge is not part of a component");
    return event;
  }
  return null;
}

function traceEvent(
  kind: TraceEvent["kind"],
  ids: readonly DecisionId[]
): TraceEvent {
  const recordIds = Object.freeze([...new Set(ids)].sort());
  return { kind, recordIds, members: new Set(recordIds), units: new Map() };
}

function eventUnit(
  event: TraceEvent,
  directIds: ReadonlySet<DecisionId>
): RelationGraphTraceAdmissionUnit<DecisionId> {
  // Intersect all direct neighbors, including ordinary edges inside the event.
  // The smaller side avoids rescanning a large star for each single neighbor.
  const traceIds = (
    directIds.size < event.members.size
      ? [...directIds].filter((id) => event.members.has(id))
      : event.recordIds.filter((id) => directIds.has(id))
  ).sort();
  const key = traceIds.join("\u0000");
  let unit = event.units.get(key);
  if (unit === undefined) {
    unit = Object.freeze({
      kind: event.kind,
      recordIds: event.recordIds,
      traceIds: Object.freeze(traceIds)
    });
    event.units.set(key, unit);
  }
  return unit;
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

function splitEvent(
  edge: DecisionRelationEdge,
  graph: RelationGraph<DecisionId, DecisionRelationType>,
  splits: Map<DecisionId, TraceEvent>
): TraceEvent {
  let event = splits.get(edge.target);
  if (event === undefined) {
    event = traceEvent("split", [
      edge.target,
      ...(graph.edgesByTarget.get(edge.target) ?? [])
        .filter((candidate) => candidate.type === "拆分")
        .map((candidate) => candidate.source)
    ]);
    splits.set(edge.target, event);
  }
  return event;
}

function mergeEvent(
  edge: DecisionRelationEdge,
  graph: RelationGraph<DecisionId, DecisionRelationType>,
  merges: Map<DecisionId, TraceEvent>
): TraceEvent {
  let event = merges.get(edge.source);
  if (event === undefined) {
    event = traceEvent("merge", [
      edge.source,
      ...(graph.edgesBySource.get(edge.source) ?? [])
        .filter((candidate) => candidate.type === "归并")
        .map((candidate) => candidate.target)
    ]);
    merges.set(edge.source, event);
  }
  return event;
}
