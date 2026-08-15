import type {
  EstablishedDecisionStatus,
  DecisionId,
  DecisionProjection,
  DecisionRecord,
  DecisionRelationType,
  DecisionTraceDirection
} from "./types.ts";
import { isEstablishedDecisionRecord } from "./types.ts";

export type DecisionRelationEdge = {
  source: DecisionId;
  target: DecisionId;
  type: DecisionRelationType;
};

export type DecisionRelationTrace = {
  edges: DecisionRelationEdge[];
  decisionIds: Set<DecisionId>;
};

export type DecisionRelationConsistencyIssue = {
  message: string;
  sourceIds: DecisionId[];
};

type DecisionRelationGraph = {
  edges: DecisionRelationEdge[];
  edgesBySource: Map<DecisionId, DecisionRelationEdge[]>;
  edgesByTarget: Map<DecisionId, DecisionRelationEdge[]>;
  recordById: Map<DecisionId, DecisionRelationConsistencyRecord>;
};

export type DecisionRelationConsistencyRecord = {
  decisionId: DecisionId;
  projection: DecisionProjection;
  sourcePath: string;
  status: EstablishedDecisionStatus;
};

function indexEdges(
  edges: DecisionRelationEdge[],
  selectId: (edge: DecisionRelationEdge) => DecisionId
): Map<DecisionId, DecisionRelationEdge[]> {
  const index = new Map<DecisionId, DecisionRelationEdge[]>();
  for (const edge of edges) {
    const decisionId = selectId(edge);
    const indexedEdges = index.get(decisionId);
    if (indexedEdges) {
      indexedEdges.push(edge);
    } else {
      index.set(decisionId, [edge]);
    }
  }
  return index;
}

export function collectDecisionRelationEdges(
  records: readonly DecisionRelationConsistencyRecord[]
): DecisionRelationEdge[] {
  return records.flatMap((record) =>
    record.projection.relations.map((relation) => ({
      source: record.decisionId,
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
    recordById: new Map(records.map((record) => [record.decisionId, record]))
  };
}

function compareEdges(
  left: DecisionRelationEdge,
  right: DecisionRelationEdge
): number {
  return (
    left.source.localeCompare(right.source) ||
    left.type.localeCompare(right.type) ||
    left.target.localeCompare(right.target)
  );
}

export function traceDecisionRelations(
  records: readonly DecisionRelationConsistencyRecord[],
  startDecisionId: DecisionId,
  options: {
    direction: DecisionTraceDirection;
    maxDepth: number | null;
  }
): DecisionRelationTrace {
  const graph = buildDecisionRelationGraph(records);
  const decisionIds = new Set<DecisionId>();
  const traversalQueue = [{ decisionId: startDecisionId, depth: 0 }];

  for (let index = 0; index < traversalQueue.length; index += 1) {
    const item = traversalQueue[index];
    if (item === undefined || decisionIds.has(item.decisionId)) {
      continue;
    }

    decisionIds.add(item.decisionId);
    if (options.maxDepth !== null && item.depth >= options.maxDepth) {
      continue;
    }

    if (options.direction !== "successors") {
      traversalQueue.push(
        ...(graph.edgesBySource.get(item.decisionId) ?? []).map((edge) => ({
          decisionId: edge.target,
          depth: item.depth + 1
        }))
      );
    }
    if (options.direction !== "predecessors") {
      traversalQueue.push(
        ...(graph.edgesByTarget.get(item.decisionId) ?? []).map((edge) => ({
          decisionId: edge.source,
          depth: item.depth + 1
        }))
      );
    }
  }

  return {
    edges: graph.edges
      .filter(
        (edge) => decisionIds.has(edge.source) && decisionIds.has(edge.target)
      )
      .sort(compareEdges),
    decisionIds
  };
}

export function decisionRelationConsistencyErrors(
  records: readonly DecisionRecord[]
): string[] {
  return decisionRelationConsistencyIssues(
    records.flatMap((record) =>
      isEstablishedDecisionRecord(record)
        ? [
            {
              decisionId: record.decisionId,
              projection: record.source.document,
              sourcePath: record.sourcePath,
              status: record.source.document.status
            }
          ]
        : []
    )
  ).map((issue) => issue.message);
}

export function decisionRelationConsistencyIssues(
  records: readonly DecisionRelationConsistencyRecord[]
): DecisionRelationConsistencyIssue[] {
  const graph = buildDecisionRelationGraph(records);
  const issues: DecisionRelationConsistencyIssue[] = [];

  for (const edge of graph.edges) {
    const source = graph.recordById.get(edge.source);
    const target = graph.recordById.get(edge.target);
    if (!target) {
      issues.push({
        message:
          (source?.sourcePath ?? edge.source) +
          " relationship target is not a scanned decision: " +
          edge.target,
        sourceIds: [edge.source]
      });
    } else if (target.status !== "archived") {
      issues.push({
        message:
          (source?.sourcePath ?? edge.source) +
          " relationship " +
          edge.type +
          " target must be archived: " +
          edge.target,
        sourceIds: [edge.source]
      });
    }
  }

  for (const [sourceId, sourceEdges] of [...graph.edgesBySource.entries()].sort(
    ([left], [right]) => left.localeCompare(right)
  )) {
    const splitEdges = sourceEdges.filter((edge) => edge.type === "拆分");
    if (splitEdges.length > 0 && sourceEdges.length !== 1) {
      issues.push({
        message:
          "Decision 拆分 successor must have exactly one direct 拆分 " +
          "relation and no other relations: " +
          sourceId,
        sourceIds: [sourceId]
      });
    }
    if (
      sourceEdges.length > 0 &&
      sourceEdges.every((edge) => edge.type === "归并") &&
      sourceEdges.length < 2
    ) {
      issues.push({
        message:
          "Decision pure 归并 relation set must have at least two direct " +
          "predecessors: " +
          sourceId,
        sourceIds: [sourceId]
      });
    }
  }

  for (const [targetId, targetEdges] of [...graph.edgesByTarget.entries()].sort(
    ([left], [right]) => left.localeCompare(right)
  )) {
    const splitEdges = targetEdges.filter((edge) => edge.type === "拆分");
    if (splitEdges.length === 1) {
      issues.push({
        message:
          "Decision split target must have at least two direct 拆分 " +
          "successors: " +
          targetId,
        sourceIds: splitEdges.map((edge) => edge.source)
      });
    }
  }

  const visitState = new Map<DecisionId, "visiting" | "visited">();
  const idStack: DecisionId[] = [];

  function visit(decisionId: DecisionId): void {
    visitState.set(decisionId, "visiting");
    idStack.push(decisionId);

    const targets = [
      ...new Set(
        (graph.edgesBySource.get(decisionId) ?? []).map((edge) => edge.target)
      )
    ]
      .filter((target) => graph.recordById.has(target))
      .sort();
    for (const target of targets) {
      const targetState = visitState.get(target);
      if (targetState === "visiting") {
        const cycleStart = idStack.indexOf(target);
        const cycleIds = idStack.slice(cycleStart);
        issues.push({
          message:
            "Decision relations must not form a cycle: " +
            [...cycleIds, target].join(" -> "),
          sourceIds: cycleIds
        });
      } else if (targetState !== "visited") {
        visit(target);
      }
    }

    idStack.pop();
    visitState.set(decisionId, "visited");
  }

  for (const decisionId of [...graph.recordById.keys()].sort()) {
    if (!visitState.has(decisionId)) {
      visit(decisionId);
    }
  }

  return issues;
}
