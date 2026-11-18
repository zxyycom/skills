import { randomUUID } from "node:crypto";
import * as v from "valibot";
import { Composition } from "./composition.ts";
import { forget } from "./control.ts";
import { fail, MemoryError } from "./errors.ts";
import { hash } from "./fingerprint.ts";
import type {
  Content,
  ContentPatch,
  Edge,
  WriteOperation,
  WriteRequest
} from "./input.ts";
import { positiveInteger, unitState } from "./model.ts";
import {
  readStoredJson,
  type Head,
  type Store,
  type StoredEdge
} from "./store.ts";

const identity = { id: v.string(), version: positiveInteger };
const saved = v.strictObject({ ...identity, generation: positiveInteger });
const writeResult = v.union([
  saved,
  v.strictObject({ items: v.array(saved) }),
  v.strictObject({
    ...identity,
    generation: positiveInteger,
    state: unitState
  }),
  v.strictObject({ ...identity, state: unitState }),
  v.strictObject({ id: v.string(), state: unitState }),
  v.strictObject({ purged: v.array(v.string()) })
]);
type WriteResult = v.InferOutput<typeof writeResult>;
type Mutation = {
  readonly result: WriteResult;
  readonly affected: readonly string[];
};
type ResolvedLinks = {
  readonly edges: readonly StoredEdge[];
  readonly retire: readonly Head[];
};

export function write(
  store: Store,
  { requestId, operation }: WriteRequest,
  fingerprint: string
): WriteResult {
  const requestKey = hash(requestId);
  if (store.revoked(requestKey)) fail("request ID was revoked by purge");
  const existing = store.request(requestKey);
  if (existing) {
    if (existing.fingerprint !== fingerprint) fail("request ID conflict");
    return readStoredJson(writeResult, existing.result);
  }
  if (operation instanceof MemoryError) throw operation;
  const { result, affected } = mutate(store, operation);
  store.saveRequest(requestKey, fingerprint, JSON.stringify(result), [
    ...new Set(affected)
  ]);
  return result;
}

function mutate(store: Store, operation: WriteOperation): Mutation {
  switch (operation.name) {
    case "save":
      return create(store, operation);
    case "revise":
      return revise(store, operation.data);
    case "review":
      return revise(store, operation.data);
    case "close":
      return close(store, operation.data);
    case "forget":
      return forget(store, operation.data);
  }
}

function create(
  store: Store,
  { items, batch }: Extract<WriteOperation, { name: "save" }>
): Mutation {
  const graph = new Composition(store);
  const pending = items.map((data) => {
    const id = randomUUID();
    return { id, data, links: resolveLinks(store, graph, id, data.edges) };
  });
  const retired = new Map<string, Head>();
  const affected = [];
  const results = pending.map(({ id, data, links }) => {
    store.createUnit(id);
    const identity = { id, version: 1, generation: 1 };
    store.writeVersion(identity, data, links.edges);
    for (const target of links.retire) retired.set(target.id, target);
    return identity;
  });
  retireHeads(store, retired.values());
  // Retirement is the only step that can invalidate a validated premise.
  const after = retired.size > 0 ? new Composition(store) : undefined;
  for (const { id, links } of pending) {
    if (after !== undefined && after.blockers(id).length !== 0)
      fail("save would create an unusable unit");
    affected.push(id, ...links.edges.map((edge) => edge.target));
  }
  const [first] = results;
  return {
    result: batch ? { items: results } : (first ?? fail("save needs a unit")),
    affected
  };
}

function revisionTransition(head: Head, patch: ContentPatch) {
  if ("semanticChange" in patch) {
    if (head.state !== "active") fail("only active units may be revised");
    return { pending: false, increment: Number(patch.semanticChange) };
  }
  if (head.state !== "active" && head.state !== "pending") {
    fail("unit cannot be reviewed");
  }
  return {
    pending: patch.outcome === "pending",
    increment: Number(patch.outcome === "changed")
  };
}

function revise(store: Store, patch: ContentPatch): Mutation {
  const head = expectedHead(store, patch);
  const { pending, increment } = revisionTransition(head, patch);
  const state = pending ? "pending" : "active";
  const previous = store.edges(head.id, head.current_version);
  const proposed = patch.edges ?? previous.map(asInputEdge);
  const links = resolveLinks(store, new Composition(store), head.id, proposed, {
    previous,
    pending
  });
  const next = {
    id: head.id,
    version: head.current_version + 1,
    generation: head.generation + increment
  };
  store.writeVersion(next, revisedContent(store, head, patch), links.edges);
  store.setHead(next.id, next.version, state);
  retireHeads(store, links.retire);
  if (!pending && new Composition(store).blockers(next.id).length !== 0) {
    fail("revision would create an unusable unit");
  }
  return {
    result: { ...next, state },
    affected: [head.id, ...links.edges.map((edge) => edge.target)]
  };
}

function asInputEdge(edge: StoredEdge): Edge {
  return {
    target: edge.target,
    version: edge.target_version,
    type: edge.type,
    role: edge.role
  };
}

function retireHeads(store: Store, heads: Iterable<Head>) {
  for (const head of heads)
    store.setHead(head.id, head.current_version, "superseded");
}

function revisedContent(
  store: Store,
  head: Head,
  patch: ContentPatch
): Omit<Content, "edges"> {
  const old = store.version(head.id, head.current_version);
  const tags = patch.tags ?? store.tags(head.id, head.current_version);
  const {
    kind = old.kind,
    title = old.title,
    body = old.body,
    source = old.source,
    conditions = old.conditions,
    reason
  } = patch;
  return { kind, title, body, source, conditions, reason, tags };
}
function close(
  store: Store,
  data: Extract<WriteOperation, { name: "close" }>["data"]
): Mutation {
  const head = expectedHead(store, data);
  if (
    head.kind !== "intent" ||
    (head.state !== "active" && head.state !== "pending")
  )
    fail("only an active or pending intent may be closed");
  const { id, current_version } = head;
  const version = current_version + 1;
  const targets = store.copyForClose(head, data.reason);
  store.setHead(id, version, data.outcome);
  return {
    result: { id, version, state: data.outcome },
    affected: [id, ...targets]
  };
}
function expectedHead(
  store: Store,
  data: Readonly<{ id: string; expectedVersion: number }>
): Head {
  const head = store.head(data.id);
  if (head.current_version !== data.expectedVersion) fail("version conflict");
  return head;
}

function referenceKey(
  target: string,
  type: Edge["type"],
  version: number
): string {
  return JSON.stringify([target, type, version]);
}

type PreviousLinks = {
  readonly pending: boolean;
  readonly previous: readonly StoredEdge[];
};
function resolveLinks(
  store: Store,
  graph: Composition,
  owner: string,
  proposed: readonly Edge[],
  revision?: PreviousLinks
): ResolvedLinks {
  const previous = new Map(
    revision?.previous.map((edge) => [
      referenceKey(edge.target, edge.type, edge.target_version),
      edge
    ])
  );
  const retire = [];
  const edges = [];
  for (const edge of proposed) {
    const retained = previous.get(
      referenceKey(edge.target, edge.type, edge.version)
    );
    const target = graph.head(edge.target);
    if (
      revision !== undefined &&
      edge.type === "composition" &&
      store.reaches(edge.target, owner)
    ) {
      fail("composition cycle");
    }
    const pin = revision?.pending ? retained : undefined;
    const generation = resolveGeneration(store, graph, edge, target, pin);
    if (isEvolution(edge.type) && retained === undefined) {
      assertEvolution(owner, target, edge.version);
      retire.push(target);
    }
    edges.push({
      target: edge.target,
      target_version: edge.version,
      target_generation: generation,
      type: edge.type,
      role: edge.role
    });
  }
  return { edges, retire };
}

function resolveGeneration(
  store: Store,
  graph: Composition,
  edge: Edge,
  target: Head,
  retained: StoredEdge | undefined
): number {
  // A pending review may keep an existing stale premise, but cannot adopt it.
  if (retained !== undefined) return retained.target_generation;
  const latest = target.current_version === edge.version;
  if (edge.type === "composition") {
    if (!latest || graph.blockers(edge.target).length !== 0) {
      fail("premise is not current and usable");
    }
    return target.generation;
  }
  return latest
    ? target.generation
    : store.generation(edge.target, edge.version);
}
function isEvolution(type: Edge["type"]): boolean {
  return type === "replaces" || type === "splits";
}

function assertEvolution(owner: string, target: Head, version: number) {
  if (
    owner === target.id ||
    target.current_version !== version ||
    target.state !== "active"
  )
    fail("evolution target is not current and active");
}
