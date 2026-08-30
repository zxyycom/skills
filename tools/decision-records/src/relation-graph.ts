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

/**
 * A connected component in the bipartite graph formed by `重划` relations.
 *
 * A decision ID may appear in both sets. The sets intentionally preserve its
 * relation role instead of flattening source and target identities together.
 */
export type DecisionReallocationComponent = {
  predecessorIds: ReadonlySet<DecisionId>;
  successorIds: ReadonlySet<DecisionId>;
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
    const reallocationEdges = sourceEdges.filter(
      (edge) => edge.type === "重划"
    );
    if (
      reallocationEdges.length > 0 &&
      sourceEdges.length !== reallocationEdges.length
    ) {
      issues.push({
        message:
          "Decision 重划 successor must have at least one direct 重划 " +
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

  const reallocationComponents = decisionReallocationComponents(graph.edges);
  for (const component of reallocationComponents) {
    if (component.successorIds.size < 2) {
      issues.push({
        message:
          "Decision 重划 component must have at least two direct successors: " +
          [...component.predecessorIds].sort().join(", "),
        sourceIds: [...component.successorIds].sort()
      });
    }
    if (component.predecessorIds.size < 2) {
      issues.push({
        message:
          "Decision 重划 component must have at least two distinct direct " +
          "predecessors: " +
          [...component.successorIds].sort().join(", "),
        sourceIds: [...component.successorIds].sort()
      });
    }
    const roleOverlap = [...component.successorIds]
      .filter((decisionId) => component.predecessorIds.has(decisionId))
      .sort();
    if (roleOverlap.length > 0) {
      issues.push({
        message:
          "Decision 重划 component cannot use a decision as both successor " +
          "and predecessor: " +
          roleOverlap.join(", "),
        sourceIds: [...component.successorIds].sort()
      });
    }
  }

  return issues;
}

export function decisionReallocationComponents(
  edges: readonly DecisionRelationEdge[]
): DecisionReallocationComponent[] {
  const successorToPredecessors = new Map<DecisionId, Set<DecisionId>>();
  const predecessorToSuccessors = new Map<DecisionId, Set<DecisionId>>();
  for (const edge of edges) {
    if (edge.type !== "重划") {
      continue;
    }
    addRelationRoleNeighbor(successorToPredecessors, edge.source, edge.target);
    addRelationRoleNeighbor(predecessorToSuccessors, edge.target, edge.source);
  }

  const remainingSuccessorIds = new Set(successorToPredecessors.keys());
  const components: DecisionReallocationComponent[] = [];
  while (remainingSuccessorIds.size > 0) {
    const firstSuccessorId = remainingSuccessorIds.values().next().value;
    if (firstSuccessorId === undefined) {
      break;
    }
    const predecessorIds = new Set<DecisionId>();
    const successorIds = new Set<DecisionId>();
    const pendingSuccessorIds = [firstSuccessorId];
    const pendingPredecessorIds: DecisionId[] = [];
    while (pendingSuccessorIds.length > 0 || pendingPredecessorIds.length > 0) {
      const successorId = pendingSuccessorIds.pop();
      if (successorId !== undefined && !successorIds.has(successorId)) {
        successorIds.add(successorId);
        remainingSuccessorIds.delete(successorId);
        pendingPredecessorIds.push(
          ...(successorToPredecessors.get(successorId) ?? [])
        );
      }
      const predecessorId = pendingPredecessorIds.pop();
      if (predecessorId !== undefined && !predecessorIds.has(predecessorId)) {
        predecessorIds.add(predecessorId);
        pendingSuccessorIds.push(
          ...(predecessorToSuccessors.get(predecessorId) ?? [])
        );
      }
    }
    components.push({ predecessorIds, successorIds });
  }
  return components;
}

function addRelationRoleNeighbor(
  adjacent: Map<DecisionId, Set<DecisionId>>,
  from: DecisionId,
  to: DecisionId
): void {
  let neighbors = adjacent.get(from);
  if (neighbors === undefined) {
    neighbors = new Set<DecisionId>();
    adjacent.set(from, neighbors);
  }
  neighbors.add(to);
}
