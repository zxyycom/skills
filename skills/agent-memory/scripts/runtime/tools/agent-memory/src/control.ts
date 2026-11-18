/*
 * Synced TypeScript runtime; repository maintenance edits tools/agent-memory/src/control.ts.
 * Installed skill copies may be edited directly; updates overwrite matching files.
 * Repository: https://github.com/zxyycom/skills
 * Source path: tools/agent-memory/src/control.ts
 * Maintained source: https://github.com/zxyycom/skills/blob/main/tools/agent-memory/src/control.ts
 * Skill source directory: https://github.com/zxyycom/skills/tree/main/skills/agent-memory
 * Rebuild: bun run sync:agent-memory-cli
 */
import { Composition } from "./composition.ts";
import { fail } from "./errors.ts";
import { canonical, hash } from "./fingerprint.ts";
import type { ReadOperation, WriteOperation } from "./input.ts";
import type { UnitState } from "./model.ts";
import type { AffectedUnit, Head, RemovedReference, Store } from "./store.ts";

type PreviewInput = Extract<ReadOperation, { name: "forget-preview" }>["data"];
type Preview = Readonly<{
  units: readonly AffectedUnit[];
  removedReferences: readonly RemovedReference[];
  token: string;
}>;
type ForgetMutation = Readonly<{
  result: { purged: string[] } | { id: string; state: "disabled" | "hidden" };
  affected: readonly string[];
}>;

export function preview(store: Store, data: PreviewInput): Preview {
  const { head, result } = plan(store, data);
  if (data.action !== "purge") assertVisibilityState(head.state);
  return result;
}

function plan(
  store: Store,
  { id, action }: PreviewInput
): Readonly<{ head: Head; result: Preview }> {
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

function visibilityScope(
  store: Store,
  graph: Composition,
  head: Head
): readonly AffectedUnit[] {
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
): ForgetMutation {
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
