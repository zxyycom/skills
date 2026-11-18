import { Composition } from "./composition.ts";
import { fail } from "./errors.ts";
import { canonical, hash } from "./fingerprint.ts";
import type { ReadOperation, WriteOperation } from "./input.ts";
import type { UnitState } from "./model.ts";
import type { Head, Store } from "./store.ts";

type PreviewInput = Extract<ReadOperation, { name: "forget-preview" }>["data"];

export function preview(store: Store, data: PreviewInput) {
  const { head, result } = plan(store, data);
  if (data.action !== "purge") assertVisibilityState(head.state);
  return result;
}

function plan(store: Store, { id, action }: PreviewInput) {
  const graph = new Composition(store);
  const head = graph.head(id);
  const units =
    action === "purge"
      ? store.affected(id, "history")
      : visibilityScope(store, graph, head);
  const removedReferences =
    action === "purge"
      ? store.removedReferences(units.map((unit) => unit.id))
      : [];
  removedReferences.sort((a, b) => canonical(a).localeCompare(canonical(b)));
  return {
    head,
    result: {
      units,
      removedReferences,
      token: hash({ id, action, units, removedReferences })
    }
  };
}

function visibilityScope(store: Store, graph: Composition, head: Head) {
  const { id, current_version, state } = head;
  if (graph.blockers(id).length !== 0)
    return [{ id, version: current_version, state }];
  return store
    .affected(id, "current")
    .filter((unit) => graph.blockers(unit.id).length === 0);
}

export function forget(
  store: Store,
  data: Extract<WriteOperation, { name: "forget" }>["data"]
) {
  const { head, result } = plan(store, data);
  if (data.confirm !== result.token) fail("forget preview conflict");
  const { id, action, expectedVersion } = data;
  if (expectedVersion !== undefined && head.current_version !== expectedVersion)
    fail("version conflict");
  if (action === "purge") {
    const ids = result.units.map((unit) => unit.id);
    for (const key of store.deleteAffectedRequests(ids)) store.revoke(key);
    store.deleteUnits(ids);
    return { result: { purged: ids }, affected: ids };
  }
  assertVisibilityState(head.state);
  const state: "disabled" | "hidden" =
    action === "disable" ? "disabled" : "hidden";
  store.setHead(id, head.current_version, state);
  return { result: { id, state }, affected: [id] };
}

function assertVisibilityState(state: UnitState): void {
  if (state !== "active" && state !== "pending")
    fail("unit is not active or pending");
}
