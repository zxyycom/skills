/** A directed, typed relationship from a successor to a direct predecessor. */
export type RelationEdge<Id extends string, Type extends string> = {
  source: Id;
  target: Id;
  type: Type;
};

export type RelationGraph<Id extends string, Type extends string> = {
  edges: readonly RelationEdge<Id, Type>[];
  edgesBySource: ReadonlyMap<Id, readonly RelationEdge<Id, Type>[]>;
  edgesByTarget: ReadonlyMap<Id, readonly RelationEdge<Id, Type>[]>;
  ids: ReadonlySet<Id>;
};

export type RelationGraphTraceDirection =
  | "both"
  | "predecessors"
  | "successors";

export type RelationGraphTraceOptions = {
  direction: RelationGraphTraceDirection;
  maxDepth: number | null;
};

export type RelationGraphTrace<Id extends string, Type extends string> = {
  edges: readonly RelationEdge<Id, Type>[];
  ids: ReadonlySet<Id>;
};

export type RelationGraphStructuralIssue<
  Id extends string,
  Type extends string
> =
  | {
      edge: RelationEdge<Id, Type>;
      kind: "missing-target";
    }
  | {
      edge: RelationEdge<Id, Type>;
      kind: "self-edge";
    }
  | {
      edge: RelationEdge<Id, Type>;
      kind: "duplicate-edge";
      repeatedEdge: RelationEdge<Id, Type>;
    }
  | {
      cycle: readonly Id[];
      kind: "cycle";
    };

/**
 * Returns a new edge collection in source, type, then target UTF-16 code-unit
 * order. Building a graph preserves its supplied edge order; callers opt into
 * this ordering when their output contract requires it.
 */
export function sortRelationEdges<Id extends string, Type extends string>(
  edges: Iterable<RelationEdge<Id, Type>>
): RelationEdge<Id, Type>[] {
  return [...edges].sort(compareRelationEdges);
}

/**
 * Normalizes a relationship collection into forward and reverse indexes while
 * preserving its supplied edge order. Domain validation remains responsible
 * for relation-type meaning and any lifecycle or chronology rules.
 */
export function buildRelationGraph<Id extends string, Type extends string>(
  ids: Iterable<Id>,
  edges: Iterable<RelationEdge<Id, Type>>
): RelationGraph<Id, Type> {
  const graphIds = new Set(ids);
  const graphEdges = [...edges].map(({ source, target, type }) => ({
    source,
    target,
    type
  }));
  return {
    edges: graphEdges,
    edgesBySource: indexEdges(graphEdges, (edge) => edge.source),
    edgesByTarget: indexEdges(graphEdges, (edge) => edge.target),
    ids: graphIds
  };
}

/** Returns the subgraph reachable from one node in the requested direction. */
export function traceRelationGraph<Id extends string, Type extends string>(
  graph: RelationGraph<Id, Type>,
  startId: Id,
  options: RelationGraphTraceOptions
): RelationGraphTrace<Id, Type> {
  const ids = new Set<Id>();
  const traversalQueue = [{ id: startId, depth: 0 }];

  for (let index = 0; index < traversalQueue.length; index += 1) {
    const item = traversalQueue[index];
    if (item === undefined || !graph.ids.has(item.id) || ids.has(item.id)) {
      continue;
    }

    ids.add(item.id);
    if (options.maxDepth !== null && item.depth >= options.maxDepth) {
      continue;
    }

    if (options.direction !== "successors") {
      traversalQueue.push(
        ...(graph.edgesBySource.get(item.id) ?? []).map((edge) => ({
          depth: item.depth + 1,
          id: edge.target
        }))
      );
    }
    if (options.direction !== "predecessors") {
      traversalQueue.push(
        ...(graph.edgesByTarget.get(item.id) ?? []).map((edge) => ({
          depth: item.depth + 1,
          id: edge.source
        }))
      );
    }
  }

  return {
    edges: graph.edges.filter(
      (edge) =>
        graph.ids.has(edge.source) &&
        graph.ids.has(edge.target) &&
        ids.has(edge.source) &&
        ids.has(edge.target)
    ),
    ids
  };
}

/**
 * Detects graph-wide structural defects without assigning domain-specific
 * meaning or formatting diagnostics.
 */
export function relationGraphStructuralIssues<
  Id extends string,
  Type extends string
>(graph: RelationGraph<Id, Type>): RelationGraphStructuralIssue<Id, Type>[] {
  const missingTargetIssues: RelationGraphStructuralIssue<Id, Type>[] = [];
  const selfEdgeIssues: RelationGraphStructuralIssue<Id, Type>[] = [];
  const duplicateEdgeIssues: RelationGraphStructuralIssue<Id, Type>[] = [];
  const firstEdgeBySourceAndTarget = new Map<
    Id,
    Map<Id, RelationEdge<Id, Type>>
  >();

  for (const edge of graph.edges) {
    if (!graph.ids.has(edge.target)) {
      missingTargetIssues.push({ edge, kind: "missing-target" });
    }
    if (edge.source === edge.target) {
      selfEdgeIssues.push({ edge, kind: "self-edge" });
    }

    const firstEdgeByTarget = firstEdgeBySourceAndTarget.get(edge.source);
    const repeatedEdge = firstEdgeByTarget?.get(edge.target);
    if (repeatedEdge === undefined) {
      if (firstEdgeByTarget === undefined) {
        firstEdgeBySourceAndTarget.set(
          edge.source,
          new Map([[edge.target, edge]])
        );
      } else {
        firstEdgeByTarget.set(edge.target, edge);
      }
    } else {
      duplicateEdgeIssues.push({ edge, kind: "duplicate-edge", repeatedEdge });
    }
  }

  return [
    ...missingTargetIssues,
    ...selfEdgeIssues,
    ...duplicateEdgeIssues,
    ...relationGraphCycleIssues(graph)
  ];
}

function indexEdges<Id extends string, Type extends string>(
  edges: readonly RelationEdge<Id, Type>[],
  selectId: (edge: RelationEdge<Id, Type>) => Id
): ReadonlyMap<Id, readonly RelationEdge<Id, Type>[]> {
  const index = new Map<Id, RelationEdge<Id, Type>[]>();
  for (const edge of edges) {
    const id = selectId(edge);
    const indexedEdges = index.get(id);
    if (indexedEdges === undefined) {
      index.set(id, [edge]);
    } else {
      indexedEdges.push(edge);
    }
  }
  return index;
}

function compareRelationEdges<Id extends string, Type extends string>(
  left: RelationEdge<Id, Type>,
  right: RelationEdge<Id, Type>
): number {
  return (
    compareStrings(left.source, right.source) ||
    compareStrings(left.type, right.type) ||
    compareStrings(left.target, right.target)
  );
}

/** Compares text by locale-independent UTF-16 code-unit order. */
function compareStrings(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function relationGraphCycleIssues<Id extends string, Type extends string>(
  graph: RelationGraph<Id, Type>
): RelationGraphStructuralIssue<Id, Type>[] {
  const issues: RelationGraphStructuralIssue<Id, Type>[] = [];
  const visitState = new Map<Id, "visiting" | "visited">();
  const idStack: Id[] = [];

  function visit(id: Id): void {
    visitState.set(id, "visiting");
    idStack.push(id);

    const targets = [
      ...new Set(
        (graph.edgesBySource.get(id) ?? [])
          .filter((edge) => edge.source !== edge.target)
          .map((edge) => edge.target)
      )
    ]
      .filter((target) => graph.ids.has(target))
      .sort(compareStrings);
    for (const target of targets) {
      const targetState = visitState.get(target);
      if (targetState === "visiting") {
        const cycleStart = idStack.indexOf(target);
        issues.push({
          cycle: [...idStack.slice(cycleStart), target],
          kind: "cycle"
        });
      } else if (targetState !== "visited") {
        visit(target);
      }
    }

    idStack.pop();
    visitState.set(id, "visited");
  }

  for (const id of [...graph.ids].sort(compareStrings)) {
    if (!visitState.has(id)) {
      visit(id);
    }
  }
  return issues;
}
