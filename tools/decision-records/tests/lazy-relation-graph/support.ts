import assert from "node:assert/strict";
import type { DecisionQueryRequest } from "../../src/decision-query-contract.ts";

/** 记录真正进入领域构图器的 records map，不替换构图或任何图操作。 */
export async function withGraphBuildCount(
  operation: (count: () => number) => Promise<void>
): Promise<void> {
  const descriptor = Object.getOwnPropertyDescriptor(Map.prototype, "keys");
  assert.ok(descriptor);
  const keys: unknown = descriptor.value;
  assert.ok(typeof keys === "function");
  let builds = 0;
  Object.defineProperty(Map.prototype, "keys", {
    ...descriptor,
    value: function (this: ReadonlyMap<unknown, unknown>): unknown {
      const record = this.values().next().value;
      if (
        typeof record === "object" &&
        record !== null &&
        "decisionId" in record &&
        "projection" in record &&
        "sourcePath" in record &&
        "status" in record &&
        this.has(record.decisionId)
      ) {
        builds += 1;
      }
      return Reflect.apply(keys, this, []);
    }
  });
  try {
    await operation(() => builds);
  } finally {
    Object.defineProperty(Map.prototype, "keys", descriptor);
  }
}

export function listRequest(
  root: string
): Extract<DecisionQueryRequest, { command: "list" }> {
  return {
    alignment: "all",
    command: "list",
    limit: 10,
    location: { decisionsDir: "docs/decisions", workspaceRoot: root },
    offset: 0,
    status: "all",
    tags: []
  };
}
