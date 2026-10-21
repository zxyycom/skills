import type { RelationGraph } from "./relations.ts";

/** 同一不可变关系快照内按需构图；新的操作阶段使用独立访问器。 */
export function createLazyRelationGraph<
  Graph extends RelationGraph<string, string>
>(build: () => Graph): () => Graph {
  let graph: Graph | undefined;
  return () => {
    graph ??= build();
    return graph;
  };
}
