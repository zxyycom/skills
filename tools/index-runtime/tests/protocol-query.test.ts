import assert from "node:assert/strict";
import test from "node:test";
import {
  buildStateIndex,
  defineStateIndexDefinition,
  type JsonObject,
  type StateSourceRevision
} from "../src/index.ts";
import {
  baseDefinition,
  malformedReadDefinition,
  snapshot
} from "./protocol-test-support.ts";
test("extracts closed query sources and rejects invalid source values", async () => {
  const definition = defineStateIndexDefinition<JsonObject>({
    ...baseDefinition("invalid-text-key"),
    queryFields: [
      {
        mode: "text",
        name: "text",
        sources: [{ kind: "state-path", path: ["value"] }]
      }
    ],
    read: async () => snapshot("state", { value: true })
  });
  const result = await buildStateIndex(definition, { root: "." });
  assert.equal(result.status, "error");
  assert.ok(
    result.diagnostics.some(
      (entry) =>
        entry.code === "state-index.query-field-source-invalid" &&
        entry.stateId === "state" &&
        entry.message.includes("query field text source state-path(value)")
    )
  );
});

test("materializes an empty state and source-revision record", async () => {
  const emptyRevision: StateSourceRevision = {
    entries: {},
    metadata: "source:metadata"
  };
  const definition = defineStateIndexDefinition<JsonObject>({
    ...baseDefinition("empty-record"),
    read: async () => ({
      metadata: {},
      sourceRevision: emptyRevision,
      states: {}
    }),
    readRevision: async () => emptyRevision
  });
  const result = await buildStateIndex(definition, { root: "." });
  assert.equal(result.status, "ok");
  assert.deepEqual(result.status === "ok" ? result.value.entries : null, {});
});

test("reports malformed source snapshots", async () => {
  assert.equal(
    (await buildStateIndex(malformedReadDefinition(), { root: "." })).status,
    "error"
  );
});

test("honors an already-aborted build signal", async () => {
  const controller = new AbortController();
  controller.abort();
  const result = await buildStateIndex(malformedReadDefinition(), {
    root: ".",
    signal: controller.signal
  });
  assert.equal(result.status, "error");
  assert.ok(
    result.diagnostics.some(
      (entry) => entry.code === "state-index.operation-aborted"
    )
  );
});
