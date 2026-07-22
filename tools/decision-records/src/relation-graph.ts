import type {
  DecisionRecord,
  DecisionRelationType,
  DecisionTraceDirection
} from "./types.ts";

export type DecisionRelationEdge = {
  source: string;
  target: string;
  type: DecisionRelationType;
};

export type DecisionRelationTrace = {
  edges: DecisionRelationEdge[];
  paths: Set<string>;
};

type DecisionRelationGraph = {
  edges: DecisionRelationEdge[];
  edgesBySource: Map<string, DecisionRelationEdge[]>;
  edgesByTarget: Map<string, DecisionRelationEdge[]>;
  recordByPath: Map<string, DecisionRecord>;
};

function indexEdges(
  edges: DecisionRelationEdge[],
  selectPath: (edge: DecisionRelationEdge) => string
): Map<string, DecisionRelationEdge[]> {
  const index = new Map<string, DecisionRelationEdge[]>();
  for (const edge of edges) {
    const path = selectPath(edge);
    const indexedEdges = index.get(path);
    if (indexedEdges) {
      indexedEdges.push(edge);
    } else {
      index.set(path, [edge]);
    }
  }
  return index;
}

export function collectDecisionRelationEdges(
  records: readonly DecisionRecord[]
): DecisionRelationEdge[] {
  return records.flatMap((record) =>
    record.projection.relations.map((relation) => ({
      source: record.relativePath,
      target: relation.target,
      type: relation.type
    }))
  );
}

function buildDecisionRelationGraph(
  records: readonly DecisionRecord[]
): DecisionRelationGraph {
  const edges = collectDecisionRelationEdges(records);
  return {
    edges,
    edgesBySource: indexEdges(edges, (edge) => edge.source),
    edgesByTarget: indexEdges(edges, (edge) => edge.target),
    recordByPath: new Map(records.map((record) => [record.relativePath, record]))
  };
}

function compareEdges(
  left: DecisionRelationEdge,
  right: DecisionRelationEdge
): number {
  return left.source.localeCompare(right.source)
    || left.type.localeCompare(right.type)
    || left.target.localeCompare(right.target);
}

export function traceDecisionRelations(
  records: readonly DecisionRecord[],
  startPath: string,
  options: {
    direction: DecisionTraceDirection;
    maxDepth: number | null;
  }
): DecisionRelationTrace {
  const graph = buildDecisionRelationGraph(records);
  const paths = new Set<string>();
  const pending = [{ depth: 0, path: startPath }];

  for (let index = 0; index < pending.length; index += 1) {
    const item = pending[index];
    if (item === undefined || paths.has(item.path)) {
      continue;
    }

    paths.add(item.path);
    if (options.maxDepth !== null && item.depth >= options.maxDepth) {
      continue;
    }

    if (options.direction !== "successors") {
      pending.push(...(graph.edgesBySource.get(item.path) ?? []).map((edge) => ({
        depth: item.depth + 1,
        path: edge.target
      })));
    }
    if (options.direction !== "predecessors") {
      pending.push(...(graph.edgesByTarget.get(item.path) ?? []).map((edge) => ({
        depth: item.depth + 1,
        path: edge.source
      })));
    }
  }

  return {
    edges: graph.edges
      .filter((edge) => paths.has(edge.source) && paths.has(edge.target))
      .sort(compareEdges),
    paths
  };
}

export function decisionRelationConsistencyErrors(
  records: readonly DecisionRecord[]
): string[] {
  const graph = buildDecisionRelationGraph(records.map((record) => ({
    ...record,
    projection: record.document ?? record.projection,
    status: record.document?.status ?? record.status
  })));
  const errors: string[] = [];

  for (const edge of graph.edges) {
    const target = graph.recordByPath.get(edge.target);
    if (!target) {
      errors.push(
        edge.source + " relationship target is not a scanned decision: " + edge.target
      );
    } else if (target.status === "active") {
      errors.push(
        edge.source
        + " relationship " + edge.type
        + " target must be archived: " + edge.target
      );
    }
  }

  const visitState = new Map<string, "visiting" | "visited">();
  const pathStack: string[] = [];

  function visit(recordPath: string): void {
    visitState.set(recordPath, "visiting");
    pathStack.push(recordPath);

    const targets = [...new Set(
      (graph.edgesBySource.get(recordPath) ?? []).map((edge) => edge.target)
    )]
      .filter((target) => graph.recordByPath.has(target))
      .sort();
    for (const target of targets) {
      const targetState = visitState.get(target);
      if (targetState === "visiting") {
        const cycleStart = pathStack.indexOf(target);
        errors.push(
          "Decision relations must not form a cycle: "
          + [...pathStack.slice(cycleStart), target].join(" -> ")
        );
      } else if (targetState !== "visited") {
        visit(target);
      }
    }

    pathStack.pop();
    visitState.set(recordPath, "visited");
  }

  for (const recordPath of [...graph.recordByPath.keys()].sort()) {
    if (!visitState.has(recordPath)) {
      visit(recordPath);
    }
  }

  return errors;
}
