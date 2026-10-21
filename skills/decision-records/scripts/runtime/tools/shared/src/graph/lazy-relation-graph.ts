/*
 * Synced TypeScript runtime; repository maintenance edits tools/shared/src/graph/lazy-relation-graph.ts.
 * Installed skill copies may be edited directly; updates overwrite matching files.
 * Repository: https://github.com/zxyycom/skills
 * Source path: tools/shared/src/graph/lazy-relation-graph.ts
 * Maintained source: https://github.com/zxyycom/skills/blob/main/tools/shared/src/graph/lazy-relation-graph.ts
 * Skill source directory: https://github.com/zxyycom/skills/tree/main/skills/decision-records
 * Rebuild: bun run sync:decision-records-cli
 */
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
