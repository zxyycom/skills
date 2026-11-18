import { fail } from "./errors.ts";
import { canonical, hash } from "./fingerprint.ts";
import type { ReadOperation, WriteOperation } from "./input.ts";
import type { ForgetAction } from "./model.ts";
import type { Store } from "./store.ts";

export function preview(
  store: Store,
  data: Extract<ReadOperation, { name: "forget-preview" }>["data"]
) {
  const units = store.affected(data.id);
  if (units.length === 0) fail("unknown memory id");
  const removedReferences =
    data.action === "purge"
      ? store.removedReferences(units.map((unit) => unit.id))
      : [];
  removedReferences.sort((a, b) => canonical(a).localeCompare(canonical(b)));
  return {
    units,
    removedReferences,
    token: hash({ action: data.action, units, removedReferences })
  };
}

export function forget(
  store: Store,
  data: Extract<WriteOperation, { name: "forget" }>["data"]
) {
  const plan = preview(store, data);
  if (data.confirm !== plan.token) fail("forget preview conflict");
  if (data.action === "purge") {
    const ids = plan.units.map((unit) => unit.id);
    for (const key of store.deleteAffectedRequests(ids)) store.revoke(key);
    store.deleteUnits(ids);
    return { result: { purged: ids }, affected: ids };
  }
  return changeVisibility(store, data);
}

function changeVisibility(
  store: Store,
  data: Readonly<{
    id: string;
    expectedVersion: number;
    action: Exclude<ForgetAction, "purge">;
  }>
) {
  const head = store.head(data.id);
  if (head.current_version !== data.expectedVersion) fail("version conflict");
  if (head.state !== "active" && head.state !== "pending")
    fail("unit is not active or pending");
  const state: "disabled" | "hidden" =
    data.action === "disable" ? "disabled" : "hidden";
  store.setHead(data.id, head.current_version, state);
  return { result: { id: data.id, state }, affected: [data.id] };
}
