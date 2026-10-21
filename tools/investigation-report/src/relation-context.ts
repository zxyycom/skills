import { createLazyRelationGraph } from "../../shared/src/graph/lazy-relation-graph.ts";
import {
  buildRelationGraph,
  type RelationGraph
} from "../../shared/src/graph/relations.ts";
import type { InvestigationSnapshotEntry } from "./query.ts";
import type {
  InvestigationIndexState,
  InvestigationRelationType
} from "./types.ts";

export type InvestigationRelationGraph = RelationGraph<
  string,
  InvestigationRelationType
> &
  Readonly<{ states: ReadonlyMap<string, InvestigationIndexState> }>;

/** 同一不可变投影拥有独立关系上下文；状态改变时另建上下文。 */
export type InvestigationRelationContext = Readonly<{
  entries: readonly InvestigationSnapshotEntry[];
  graph: () => InvestigationRelationGraph;
}>;

export function createInvestigationRelationContext(
  states: Iterable<readonly [string, InvestigationIndexState]>
): InvestigationRelationContext {
  const entries = Array.from(states, ([id, state]) => ({ id, state }));
  return {
    entries,
    graph: createLazyRelationGraph(() => {
      const statesById = new Map(entries.map(({ id, state }) => [id, state]));
      const edges = entries.flatMap(({ id, state }) =>
        state.relations.map((relation) => ({ source: id, ...relation }))
      );
      return {
        ...buildRelationGraph(statesById.keys(), edges),
        states: statesById
      };
    })
  };
}
