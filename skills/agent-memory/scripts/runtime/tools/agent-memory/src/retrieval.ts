/*
 * Synced TypeScript runtime; repository maintenance edits tools/agent-memory/src/retrieval.ts.
 * Installed skill copies may be edited directly; updates overwrite matching files.
 * Repository: https://github.com/zxyycom/skills
 * Source path: tools/agent-memory/src/retrieval.ts
 * Maintained source: https://github.com/zxyycom/skills/blob/main/tools/agent-memory/src/retrieval.ts
 * Skill source directory: https://github.com/zxyycom/skills/tree/main/skills/agent-memory
 * Rebuild: bun run sync:agent-memory-cli
 */
import { Composition } from "./composition.ts";
import type { ReadOperation } from "./input.ts";
import type { Store } from "./store.ts";

function snapshot(store: Store, id: string, version: number) {
  return {
    ...store.version(id, version),
    tags: store.tags(id, version),
    edges: store.edges(id, version)
  };
}

export function show(
  store: Store,
  data: Extract<ReadOperation, { name: "show" }>["data"]
) {
  const graph = new Composition(store);
  const { id, version } = data;
  const head = graph.head(id);
  if (version !== undefined) {
    const latest = version === head.current_version;
    return {
      status: "historical" as const,
      latest,
      usable: latest && graph.blockers(id).length === 0,
      ...snapshot(store, id, version)
    };
  }
  const blockers = graph.blockers(id);
  if (blockers.length > 0)
    return {
      id,
      status: "blocked" as const,
      reason: head.state === "active" ? "premise" : head.state,
      blockers
    };
  return {
    status: "current" as const,
    ...snapshot(store, id, head.current_version)
  };
}

export function recall(
  store: Store,
  data: Extract<ReadOperation, { name: "recall" }>["data"]
) {
  const graph = new Composition(store);
  const items = [];
  for (const match of store.recall(data.tags, data.terms)) {
    if (graph.blockers(match.id).length !== 0) continue;
    if (items.length === data.limit) return { items, truncated: true };
    items.push(match);
  }
  return { items, truncated: false };
}
