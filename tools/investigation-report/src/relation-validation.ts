import {
  buildRelationGraph,
  relationGraphStructuralIssues,
  selectRelationGraphTrace,
  sortRelationEdges,
  type RelationEdge,
  type RelationGraph,
  type RelationGraphTraceAdmissionAdapter,
  type RelationGraphTraceAdmissionUnit,
  type RelationGraphTraceExpansionDirection,
  type RelationGraphTraceSelection,
  type RelationGraphTraceSelectionOptions
} from "../../shared/src/graph/relations.ts";
import { investigationTimestampMilliseconds } from "./timestamp.ts";
import {
  investigationRelationTypes,
  type InvestigationIndexState,
  type InvestigationRelationEdge,
  type InvestigationRelationType
} from "./types.ts";

const ordinaryRelationTypes = new Set<InvestigationRelationType>([
  "补充",
  "复查",
  "修正",
  "推翻"
]);

function investigationRelationEdges(
  states: ReadonlyMap<string, InvestigationIndexState>
): InvestigationRelationEdge[] {
  return [...states.entries()].flatMap(([source, state]) =>
    state.relations.map((relation) => ({
      source,
      target: relation.target,
      type: relation.type,
      ...(relation.summary === undefined ? {} : { summary: relation.summary })
    }))
  );
}

function buildInvestigationRelationGraph(
  states: ReadonlyMap<string, InvestigationIndexState>
): RelationGraph<string, InvestigationRelationType> {
  return buildRelationGraph(
    states.keys(),
    sortRelationEdges(investigationRelationEdges(states))
  );
}

/** Traces Investigation report relations through the shared graph traversal. */
export function traceInvestigationRelations(
  states: ReadonlyMap<string, InvestigationIndexState>,
  startId: string,
  options: RelationGraphTraceSelectionOptions
): RelationGraphTraceSelection<string> {
  const graph = buildInvestigationRelationGraph(states);
  return selectRelationGraphTrace(
    graph,
    startId,
    options,
    investigationTraceAdmissionUnits(graph)
  );
}

type InvestigationTraceEvent = Readonly<
  Record<
    RelationGraphTraceExpansionDirection,
    RelationGraphTraceAdmissionUnit<string>
  >
>;

function investigationTraceAdmissionUnits(
  graph: InvestigationRelationGraph
): RelationGraphTraceAdmissionAdapter<string, InvestigationRelationType> {
  const splits = new Map<string, InvestigationTraceEvent>();
  const merges = new Map<string, InvestigationTraceEvent>();
  return ({ direction, fromId }) => {
    const edges =
      direction === "predecessors"
        ? (graph.edgesBySource.get(fromId) ?? [])
        : (graph.edgesByTarget.get(fromId) ?? []);
    return [
      ...new Set(
        edges.map((edge) =>
          investigationTraceAdmissionUnit(
            edge,
            direction,
            graph,
            splits,
            merges
          )
        )
      )
    ];
  };
}

function investigationTraceAdmissionUnit(
  edge: RelationEdge<string, InvestigationRelationType>,
  direction: RelationGraphTraceExpansionDirection,
  graph: InvestigationRelationGraph,
  splits: Map<string, InvestigationTraceEvent>,
  merges: Map<string, InvestigationTraceEvent>
): RelationGraphTraceAdmissionUnit<string> {
  if (edge.type === "拆分") {
    let event = splits.get(edge.target);
    if (event === undefined) {
      event = splitTraceEvent(edge, graph);
      splits.set(edge.target, event);
    }
    return event[direction];
  }
  if (edge.type === "归并") {
    let event = merges.get(edge.source);
    if (event === undefined) {
      event = mergeTraceEvent(edge, graph);
      merges.set(edge.source, event);
    }
    return event[direction];
  }
  return {
    kind: "ordinary",
    recordIds: [edge.source, edge.target],
    traceIds: [direction === "predecessors" ? edge.target : edge.source]
  };
}

function splitTraceEvent(
  edge: RelationEdge<string, InvestigationRelationType>,
  graph: InvestigationRelationGraph
): InvestigationTraceEvent {
  const successors = (graph.edgesByTarget.get(edge.target) ?? [])
    .filter((candidate) => candidate.type === "拆分")
    .map((candidate) => candidate.source);
  return frozenTraceEvent(
    "split",
    [edge.target, ...successors],
    [edge.target],
    successors
  );
}

function mergeTraceEvent(
  edge: RelationEdge<string, InvestigationRelationType>,
  graph: InvestigationRelationGraph
): InvestigationTraceEvent {
  const predecessors = (graph.edgesBySource.get(edge.source) ?? [])
    .filter((candidate) => candidate.type === "归并")
    .map((candidate) => candidate.target);
  return frozenTraceEvent(
    "merge",
    [edge.source, ...predecessors],
    predecessors,
    [edge.source]
  );
}

function frozenTraceEvent(
  kind: "split" | "merge",
  recordIds: string[],
  predecessors: string[],
  successors: string[]
): InvestigationTraceEvent {
  Object.freeze(recordIds);
  return Object.freeze({
    predecessors: Object.freeze({
      kind,
      recordIds,
      traceIds: Object.freeze(predecessors)
    }),
    successors: Object.freeze({
      kind,
      recordIds,
      traceIds: Object.freeze(successors)
    })
  });
}

export function validateInvestigationRelationGraph(
  states: ReadonlyMap<string, InvestigationIndexState>
): string[] {
  const ids = [...states.keys()].sort(compareText);
  const graph = buildInvestigationRelationGraph(states);
  return uniqueSorted([
    ...structuralRelationErrors(graph),
    ...chronologicalRelationErrors(states, graph.edges),
    ...ids.flatMap((id) =>
      relationShapeIssues(id, graph.edgesBySource.get(id) ?? [])
    ),
    ...splitPredecessorErrors(ids, graph)
  ]);
}

type InvestigationRelationGraph = ReturnType<
  typeof buildInvestigationRelationGraph
>;

function structuralRelationErrors(graph: InvestigationRelationGraph): string[] {
  const errors: string[] = [];
  for (const issue of relationGraphStructuralIssues(graph)) {
    switch (issue.kind) {
      case "missing-target":
        errors.push(
          `${issue.edge.source} relation ${issue.edge.type} target does not exist: ${issue.edge.target}`
        );
        break;
      case "self-edge":
        errors.push(
          `${issue.edge.source} relation ${issue.edge.type} must not target itself`
        );
        break;
      case "duplicate-edge":
        errors.push(
          `${issue.edge.source} relations must not repeat target ${issue.edge.target}`
        );
        break;
      case "cycle":
        errors.push(
          `investigation relations must not form a cycle: ${issue.cycle.join(" -> ")}`
        );
        break;
    }
  }
  return errors;
}

function chronologicalRelationErrors(
  states: ReadonlyMap<string, InvestigationIndexState>,
  edges: readonly InvestigationRelationEdge[]
): string[] {
  const errors: string[] = [];
  for (const edge of edges) {
    if (!isRelationType(edge.type)) {
      errors.push(
        `${edge.source} relation type is not supported: ${String(edge.type)}`
      );
      continue;
    }
    const source = states.get(edge.source);
    const target = states.get(edge.target);
    if (source === undefined || target === undefined) {
      continue;
    }
    const sourceTime = investigationTimestampMilliseconds(source.formedAt);
    const targetTime = investigationTimestampMilliseconds(target.formedAt);
    if (sourceTime === null || targetTime === null) {
      continue;
    }
    if (targetTime > sourceTime) {
      errors.push(
        `${edge.source} relation ${edge.type} target ${edge.target} must not be formed later than its source`
      );
    }
  }
  return errors;
}

function splitPredecessorErrors(
  ids: readonly string[],
  graph: InvestigationRelationGraph
): string[] {
  const errors: string[] = [];
  for (const id of ids) {
    const splitSuccessors = (graph.edgesByTarget.get(id) ?? []).filter(
      (edge) => edge.type === "拆分"
    );
    if (splitSuccessors.length === 1) {
      errors.push(
        `${id} split predecessor must have at least two direct 拆分 successors; found ${splitSuccessors[0]!.source}`
      );
    }
  }
  return errors;
}

function relationShapeIssues(
  source: string,
  edges: readonly RelationEdge<string, InvestigationRelationType>[]
): string[] {
  if (edges.length === 0) {
    return [];
  }
  const types = new Set(edges.map((edge) => edge.type));
  if (types.has("拆分")) {
    return splitRelationShapeIssues(source, edges);
  }
  if (types.has("归并")) {
    return mergeRelationShapeIssues(source, edges, types);
  }
  return ordinaryRelationShapeIssues(source, edges);
}

function splitRelationShapeIssues(
  source: string,
  edges: readonly RelationEdge<string, InvestigationRelationType>[]
): string[] {
  if (edges.length === 1 && edges[0]?.type === "拆分") return [];
  return [
    `${source} 拆分 successor must have exactly one direct 拆分 relation and no other relations`
  ];
}
function mergeRelationShapeIssues(
  source: string,
  edges: readonly RelationEdge<string, InvestigationRelationType>[],
  types: ReadonlySet<InvestigationRelationType>
): string[] {
  if (types.size === 1 && edges.length >= 2) return [];
  return [
    `${source} 归并 report must use a pure relation set with at least two direct predecessors`
  ];
}
function ordinaryRelationShapeIssues(
  source: string,
  edges: readonly RelationEdge<string, InvestigationRelationType>[]
): string[] {
  if (edges.length === 1 && ordinaryRelationTypes.has(edges[0]!.type))
    return [];
  return [
    `${source} ordinary relation report must have exactly one 补充、复查、修正 or 推翻 predecessor`
  ];
}

function isRelationType(value: string): value is InvestigationRelationType {
  return (investigationRelationTypes as readonly string[]).includes(value);
}

function uniqueSorted(values: readonly string[]): string[] {
  return [...new Set(values)].sort(compareText);
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
