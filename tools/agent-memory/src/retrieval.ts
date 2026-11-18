import { Composition } from "./composition.ts";
import type { ReadOperation } from "./input.ts";
import type { UnitState } from "./model.ts";
import type { RecallMatch, Store, StoredEdge, Version } from "./store.ts";

type Snapshot = Version & {
  readonly tags: readonly string[];
  readonly edges: readonly StoredEdge[];
};
type ShowResult =
  | (Snapshot & { readonly status: "current" })
  | (Snapshot & {
      readonly status: "historical";
      readonly latest: boolean;
      readonly usable: boolean;
    })
  | Readonly<{
      id: string;
      status: "blocked";
      reason: Exclude<UnitState, "active"> | "premise";
      blockers: readonly string[];
    }>;
type RecallResult = Readonly<{
  items: readonly RecallMatch[];
  truncated: boolean;
}>;

function snapshot(store: Store, id: string, version: number): Snapshot {
  return {
    ...store.version(id, version),
    tags: store.tags(id, version),
    edges: store.edges(id, version)
  };
}

export function show(
  store: Store,
  { id, version }: Extract<ReadOperation, { name: "show" }>["data"]
): ShowResult {
  const graph = new Composition(store);
  const head = graph.head(id);
  if (version !== undefined) {
    const latest = version === head.current_version;
    return {
      status: "historical",
      latest,
      usable: latest && graph.blockers(id).length === 0,
      ...snapshot(store, id, version)
    };
  }
  const blockers = graph.blockers(id);
  if (blockers.length > 0)
    return {
      id,
      status: "blocked",
      reason: head.state === "active" ? "premise" : head.state,
      blockers
    };
  return {
    status: "current",
    ...snapshot(store, id, head.current_version)
  };
}

export function recall(
  store: Store,
  data: Extract<ReadOperation, { name: "recall" }>["data"]
): RecallResult {
  const graph = new Composition(store);
  const items = [];
  for (const match of store.recall(data.tags, data.terms)) {
    if (graph.blockers(match.id).length !== 0) continue;
    if (items.length === data.limit) return { items, truncated: true };
    items.push(match);
  }
  return { items, truncated: false };
}
