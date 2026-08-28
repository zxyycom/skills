import {
  buildRelationGraph,
  relationGraphStructuralIssues,
  sortRelationEdges,
  traceRelationGraph,
  type RelationEdge,
  type RelationGraph
} from "../../shared/src/graph/relations.ts";
import type {
  EstablishedDecisionStatus,
  DecisionId,
  DecisionProjection,
  DecisionRecord,
  DecisionRelationType,
  DecisionTraceDirection
} from "./types.ts";
import { isEstablishedDecisionRecord } from "./types.ts";

export type DecisionRelationEdge = RelationEdge<
  DecisionId,
  DecisionRelationType
>;

export type DecisionRelationTrace = {
  edges: DecisionRelationEdge[];
  decisionIds: Set<DecisionId>;
};

export type DecisionRelationConsistencyIssue = {
  message: string;
  sourceIds: DecisionId[];
};

type DecisionRelationGraph = RelationGraph<DecisionId, DecisionRelationType> & {
  recordById: Map<DecisionId, DecisionRelationConsistencyRecord>;
};

export type DecisionRelationConsistencyRecord = {
  decisionId: DecisionId;
  projection: DecisionProjection;
  sourcePath: string;
  status: EstablishedDecisionStatus;
};

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
  const recordById = new Map(
    records.map((record) => [record.decisionId, record])
  );
  return {
    ...buildRelationGraph(
      recordById.keys(),
      sortRelationEdges(collectDecisionRelationEdges(records))
    ),
    recordById
  };
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
  const trace = traceRelationGraph(graph, startDecisionId, options);
  return {
    edges: [...trace.edges],
    decisionIds: new Set(trace.ids)
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
  const structuralIssues = relationGraphStructuralIssues(graph);
  const missingTargetEdges = new Set(
    structuralIssues.flatMap((issue) =>
      issue.kind === "missing-target" ? [issue.edge] : []
    )
  );
  const issues: DecisionRelationConsistencyIssue[] = [];

  for (const edge of graph.edges) {
    const source = graph.recordById.get(edge.source);
    const target = graph.recordById.get(edge.target);
    if (missingTargetEdges.has(edge)) {
      issues.push({
        message:
          (source?.sourcePath ?? edge.source) +
          " relationship target is not a scanned decision: " +
          edge.target,
        sourceIds: [edge.source]
      });
    } else if (target?.status !== "archived") {
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

  for (const issue of structuralIssues) {
    switch (issue.kind) {
      case "missing-target":
        break;
      case "self-edge": {
        const source = graph.recordById.get(issue.edge.source);
        issues.push({
          message:
            (source?.sourcePath ?? issue.edge.source) +
            " must not relate to itself",
          sourceIds: [issue.edge.source]
        });
        break;
      }
      case "duplicate-edge": {
        const source = graph.recordById.get(issue.edge.source);
        issues.push({
          message:
            (source?.sourcePath ?? issue.edge.source) +
            " repeats relationship target " +
            issue.edge.target,
          sourceIds: [issue.edge.source]
        });
        break;
      }
      case "cycle":
        issues.push({
          message:
            "Decision relations must not form a cycle: " +
            issue.cycle.join(" -> "),
          sourceIds: issue.cycle.slice(0, -1)
        });
        break;
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

  return issues;
}
