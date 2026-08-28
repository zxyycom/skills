import {
  buildRelationGraph,
  relationGraphStructuralIssues,
  sortRelationEdges,
  traceRelationGraph,
  type RelationEdge,
  type RelationGraph,
  type RelationGraphTrace,
  type RelationGraphTraceOptions
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
      type: relation.type
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
  options: RelationGraphTraceOptions
): RelationGraphTrace<string, InvestigationRelationType> {
  return traceRelationGraph(
    buildInvestigationRelationGraph(states),
    startId,
    options
  );
}

export function validateInvestigationRelationGraph(
  states: ReadonlyMap<string, InvestigationIndexState>
): string[] {
  const ids = [...states.keys()].sort(compareText);
  const graph = buildInvestigationRelationGraph(states);
  const edges = graph.edges;
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

  for (const id of ids) {
    const sourceEdges = graph.edgesBySource.get(id) ?? [];
    errors.push(...relationShapeIssues(id, sourceEdges));
  }
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

  return uniqueSorted(errors);
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
    return edges.length === 1 && edges[0]?.type === "拆分"
      ? []
      : [
          `${source} 拆分 successor must have exactly one direct 拆分 relation and no other relations`
        ];
  }
  if (types.has("归并")) {
    return types.size === 1 && edges.length >= 2
      ? []
      : [
          `${source} 归并 report must use a pure relation set with at least two direct predecessors`
        ];
  }
  if (edges.length !== 1 || !ordinaryRelationTypes.has(edges[0]!.type)) {
    return [
      `${source} ordinary relation report must have exactly one 补充、复查、修正 or 推翻 predecessor`
    ];
  }
  return [];
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
