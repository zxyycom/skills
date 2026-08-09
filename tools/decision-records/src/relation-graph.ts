import type {
  DecisionDocument,
  DecisionProjection,
  DecisionRecord,
  DecisionRelationType,
  DecisionStatus,
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

export type DecisionRelationConsistencyIssue = {
  message: string;
  sourcePaths: string[];
};

type DecisionRelationGraph = {
  edges: DecisionRelationEdge[];
  edgesBySource: Map<string, DecisionRelationEdge[]>;
  edgesByTarget: Map<string, DecisionRelationEdge[]>;
  recordByPath: Map<string, DecisionRelationConsistencyRecord>;
};

export type DecisionRelationConsistencyRecord = {
  document?: DecisionDocument | null;
  projection: DecisionProjection;
  relativePath: string;
  status: DecisionStatus | null;
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
  records: readonly DecisionRelationConsistencyRecord[]
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
  records: readonly DecisionRelationConsistencyRecord[]
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
  records: readonly DecisionRelationConsistencyRecord[],
  startPath: string,
  options: {
    direction: DecisionTraceDirection;
    maxDepth: number | null;
  }
): DecisionRelationTrace {
  const graph = buildDecisionRelationGraph(records);
  const paths = new Set<string>();
  const traversalQueue = [{ depth: 0, path: startPath }];

  for (let index = 0; index < traversalQueue.length; index += 1) {
    const item = traversalQueue[index];
    if (item === undefined || paths.has(item.path)) {
      continue;
    }

    paths.add(item.path);
    if (options.maxDepth !== null && item.depth >= options.maxDepth) {
      continue;
    }

    if (options.direction !== "successors") {
      traversalQueue.push(...(graph.edgesBySource.get(item.path) ?? []).map((edge) => ({
        depth: item.depth + 1,
        path: edge.target
      })));
    }
    if (options.direction !== "predecessors") {
      traversalQueue.push(...(graph.edgesByTarget.get(item.path) ?? []).map((edge) => ({
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
  return decisionRelationConsistencyIssues(records).map((issue) => issue.message);
}

export function decisionRelationConsistencyIssues(
  records: readonly DecisionRelationConsistencyRecord[]
): DecisionRelationConsistencyIssue[] {
  const graph = buildDecisionRelationGraph(records.map((record) => ({
    ...record,
    projection: record.document ?? record.projection,
    status: record.document?.status ?? record.status
  })));
  const issues: DecisionRelationConsistencyIssue[] = [];

  for (const edge of graph.edges) {
    const target = graph.recordByPath.get(edge.target);
    if (!target) {
      issues.push({
        message: edge.source
          + " relationship target is not a scanned decision: "
          + edge.target,
        sourcePaths: [edge.source]
      });
    } else if (target.status !== "archived") {
      issues.push({
        message: edge.source
        + " relationship " + edge.type
        + " target must be archived: " + edge.target,
        sourcePaths: [edge.source]
      });
    }
  }

  for (const [sourcePath, sourceEdges] of [...graph.edgesBySource.entries()]
    .sort(([left], [right]) => left.localeCompare(right))) {
    const splitEdges = sourceEdges.filter((edge) => edge.type === "拆分");
    if (splitEdges.length > 0 && sourceEdges.length !== 1) {
      issues.push({
        message: "Decision 拆分 successor must have exactly one direct 拆分 "
          + "relation and no other relations: "
          + sourcePath,
        sourcePaths: [sourcePath]
      });
    }
    if (
      sourceEdges.length > 0
      && sourceEdges.every((edge) => edge.type === "归并")
      && sourceEdges.length < 2
    ) {
      issues.push({
        message: "Decision pure 归并 relation set must have at least two direct "
          + "predecessors: "
          + sourcePath,
        sourcePaths: [sourcePath]
      });
    }
  }

  for (const [targetPath, targetEdges] of [...graph.edgesByTarget.entries()]
    .sort(([left], [right]) => left.localeCompare(right))) {
    const splitEdges = targetEdges.filter((edge) => edge.type === "拆分");
    if (splitEdges.length === 1) {
      issues.push({
        message: "Decision split target must have at least two direct 拆分 "
          + "successors: "
          + targetPath,
        sourcePaths: splitEdges.map((edge) => edge.source)
      });
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
        const cyclePaths = pathStack.slice(cycleStart);
        issues.push({
          message: "Decision relations must not form a cycle: "
            + [...cyclePaths, target].join(" -> "),
          sourcePaths: cyclePaths
        });
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

  return issues;
}
