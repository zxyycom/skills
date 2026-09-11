import type { DecisionId } from "./types.ts";
import type { DecisionRelationEdge } from "./relation-graph.ts";

/**
 * A connected component in the bipartite graph formed by `重划` relations.
 *
 * A decision ID may appear in both sets. The sets intentionally preserve its
 * relation role instead of flattening source and target identities together.
 */
export type DecisionReallocationComponent = Readonly<{
  predecessorIds: ReadonlySet<DecisionId>;
  successorIds: ReadonlySet<DecisionId>;
}>;

export function decisionReallocationComponents(
  edges: readonly DecisionRelationEdge[]
): DecisionReallocationComponent[] {
  const { predecessorToSuccessors, successorToPredecessors } =
    reallocationRoleMaps(edges);
  const remainingSuccessorIds = new Set(successorToPredecessors.keys());
  const components: DecisionReallocationComponent[] = [];
  while (remainingSuccessorIds.size > 0) {
    const firstSuccessorId = remainingSuccessorIds.values().next().value;
    if (firstSuccessorId === undefined) break;
    components.push(
      collectReallocationComponent(
        firstSuccessorId,
        successorToPredecessors,
        predecessorToSuccessors,
        remainingSuccessorIds
      )
    );
  }
  return components;
}

function reallocationRoleMaps(
  edges: readonly DecisionRelationEdge[]
): Readonly<{
  predecessorToSuccessors: ReadonlyMap<DecisionId, ReadonlySet<DecisionId>>;
  successorToPredecessors: ReadonlyMap<DecisionId, ReadonlySet<DecisionId>>;
}> {
  const successorToPredecessors = new Map<DecisionId, Set<DecisionId>>();
  const predecessorToSuccessors = new Map<DecisionId, Set<DecisionId>>();
  for (const edge of edges) {
    if (edge.type !== "重划") continue;
    addRelationRoleNeighbor(successorToPredecessors, edge.source, edge.target);
    addRelationRoleNeighbor(predecessorToSuccessors, edge.target, edge.source);
  }
  return { predecessorToSuccessors, successorToPredecessors };
}

function collectReallocationComponent(
  firstSuccessorId: DecisionId,
  successorToPredecessors: ReadonlyMap<DecisionId, ReadonlySet<DecisionId>>,
  predecessorToSuccessors: ReadonlyMap<DecisionId, ReadonlySet<DecisionId>>,
  remainingSuccessorIds: Set<DecisionId>
): DecisionReallocationComponent {
  const predecessorIds = new Set<DecisionId>();
  const successorIds = new Set<DecisionId>();
  const pendingSuccessorIds = [firstSuccessorId];
  const pendingPredecessorIds: DecisionId[] = [];
  while (pendingSuccessorIds.length > 0 || pendingPredecessorIds.length > 0) {
    collectSuccessorNeighbors({
      pendingPredecessorIds,
      pendingSuccessorIds,
      remainingSuccessorIds,
      successorIds,
      successorToPredecessors
    });
    collectPredecessorNeighbors({
      pendingPredecessorIds,
      pendingSuccessorIds,
      predecessorIds,
      predecessorToSuccessors
    });
  }
  return { predecessorIds, successorIds };
}

function collectSuccessorNeighbors(options: {
  pendingPredecessorIds: DecisionId[];
  pendingSuccessorIds: DecisionId[];
  remainingSuccessorIds: Set<DecisionId>;
  successorIds: Set<DecisionId>;
  successorToPredecessors: ReadonlyMap<DecisionId, ReadonlySet<DecisionId>>;
}): void {
  const successorId = options.pendingSuccessorIds.pop();
  if (successorId === undefined || options.successorIds.has(successorId))
    return;
  options.successorIds.add(successorId);
  options.remainingSuccessorIds.delete(successorId);
  options.pendingPredecessorIds.push(
    ...(options.successorToPredecessors.get(successorId) ?? [])
  );
}

function collectPredecessorNeighbors(options: {
  pendingPredecessorIds: DecisionId[];
  pendingSuccessorIds: DecisionId[];
  predecessorIds: Set<DecisionId>;
  predecessorToSuccessors: ReadonlyMap<DecisionId, ReadonlySet<DecisionId>>;
}): void {
  const predecessorId = options.pendingPredecessorIds.pop();
  if (
    predecessorId === undefined ||
    options.predecessorIds.has(predecessorId)
  ) {
    return;
  }
  options.predecessorIds.add(predecessorId);
  options.pendingSuccessorIds.push(
    ...(options.predecessorToSuccessors.get(predecessorId) ?? [])
  );
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
