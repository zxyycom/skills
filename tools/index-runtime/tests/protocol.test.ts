import assert from "node:assert/strict";
import test from "node:test";
import {
  buildStateIndex,
  defineStateIndexDefinition,
  type JsonObject
} from "../src/index.ts";
import { sameKeyDefinitions } from "../src/definition.ts";
import { compareStateIndexKeyScalars } from "../src/ordering.ts";
import type { StateIndexKeyScalar } from "../src/types.ts";

test("orders key scalars and compares ordered key definitions", () => {
  const scalars: StateIndexKeyScalar[] = [
    "alpha",
    10,
    true,
    2,
    false,
    "beta"
  ];
  assert.deepEqual(
    scalars.sort(compareStateIndexKeyScalars),
    [false, true, 2, 10, "alpha", "beta"]
  );

  const definitions = [
    { mode: "exact" as const, name: "status" },
    { mode: "range" as const, name: "created-at" }
  ];
  assert.equal(sameKeyDefinitions(definitions, [...definitions]), true);
  assert.equal(sameKeyDefinitions(definitions, [...definitions].reverse()), false);
  assert.equal(sameKeyDefinitions(definitions, [
    definitions[0]!,
    { mode: "text", name: "created-at" }
  ]), false);
});

test("rejects duplicate, reserved, or missing key definition inputs", () => {
  assert.throws(
    () => defineStateIndexDefinition({
      definitionVersion: 1,
      identify: () => "state",
      keyStrategies: [
        { derive: () => "a", mode: "exact", name: "status" },
        { derive: () => "b", mode: "exact", name: "status" }
      ],
      namespace: "duplicate-keys",
      parseMetadata: (metadata) => metadata,
      parseState: (state) => state,
      read: async () => ({ metadata: {}, revision: "one", states: [{}] }),
      readRevision: async () => "one"
    }),
    /appears more than once/u
  );
  assert.throws(
    () => defineStateIndexDefinition({
      definitionVersion: 1,
      identify: () => "state",
      keyStrategies: [
        { derive: () => "state", mode: "exact", name: "id" }
      ],
      namespace: "reserved-key",
      parseMetadata: (metadata) => metadata,
      parseState: (state) => state,
      read: async () => ({ metadata: {}, revision: "one", states: [{}] }),
      readRevision: async () => "one"
    }),
    /reserved id/u
  );
  assert.throws(
    () => defineStateIndexDefinition({
      definitionVersion: 1,
      identify: () => "state",
      keyStrategies: [
        { derive: () => "active", mode: "exact", name: "status" }
      ],
      namespace: "missing-parser",
      parseMetadata: (metadata) => metadata,
      parseState: null as never,
      read: async () => ({ metadata: {}, revision: "one", states: [{}] }),
      readRevision: async () => "one"
    }),
    /parseState/u
  );
});

test("rejects duplicate state identifiers during materialization", async () => {
  const definition = defineStateIndexDefinition({
    definitionVersion: 1,
    identify: () => "same-id",
    keyStrategies: [{
      derive: () => "active",
      mode: "exact",
      name: "status"
    }],
    namespace: "duplicate-id",
    parseMetadata: (metadata) => metadata,
    parseState: (state) => state,
    read: async () => ({
      metadata: {},
      revision: "one",
      states: [{ a: 1 }, { a: 2 }]
    }),
    readRevision: async () => "one"
  });
  const result = await buildStateIndex(definition, { root: "." });
  assert.equal(result.status, "error");
  assert.ok(result.diagnostics.some((entry) => (
    entry.code === "state-index.id-duplicate"
  )));
});

test("rejects non-JSON states and parser outputs", async () => {
  const invalidStateDefinition = defineStateIndexDefinition<JsonObject>({
    definitionVersion: 1,
    identify: () => "invalid",
    keyStrategies: [{
      derive: () => "active",
      mode: "exact",
      name: "status"
    }],
    namespace: "invalid-state",
    parseMetadata: (metadata) => metadata,
    parseState: (state) => state,
    read: async () => ({
      metadata: {},
      revision: "one",
      states: [{ value: Number.NaN }]
    }),
    readRevision: async () => "one"
  });
  const invalidState = await buildStateIndex(invalidStateDefinition, { root: "." });
  assert.equal(invalidState.status, "error");
  assert.ok(invalidState.diagnostics.some((entry) => (
    entry.code === "state-index.state-invalid"
  )));

  const invalidParserOutput = defineStateIndexDefinition<JsonObject>({
    definitionVersion: 1,
    identify: () => "invalid-parser-output",
    keyStrategies: [{
      derive: () => "active",
      mode: "exact",
      name: "status"
    }],
    namespace: "invalid-parser-output",
    parseMetadata: (metadata) => metadata,
    parseState: () => new Date() as never,
    read: async () => ({ metadata: {}, revision: "one", states: [{}] }),
    readRevision: async () => "one"
  });
  const invalidParsedState = await buildStateIndex(invalidParserOutput, {
    root: "."
  });
  assert.equal(invalidParsedState.status, "error");
  assert.ok(invalidParsedState.diagnostics.some((entry) => (
    entry.code === "state-index.state-parse-invalid"
  )));

  const invalidMetadataParserOutput = defineStateIndexDefinition<JsonObject>({
    definitionVersion: 1,
    identify: () => "invalid-metadata-parser-output",
    keyStrategies: [{
      derive: () => "active",
      mode: "exact",
      name: "status"
    }],
    namespace: "invalid-metadata-parser-output",
    parseMetadata: () => new Date() as never,
    parseState: (state) => state,
    read: async () => ({ metadata: {}, revision: "one", states: [{}] }),
    readRevision: async () => "one"
  });
  const invalidParsedMetadata = await buildStateIndex(
    invalidMetadataParserOutput,
    { root: "." }
  );
  assert.equal(invalidParsedMetadata.status, "error");
  assert.ok(invalidParsedMetadata.diagnostics.some((entry) => (
    entry.code === "state-index.metadata-parse-invalid"
  )));
});

test("rejects key values incompatible with the declared mode", async () => {
  const definition = defineStateIndexDefinition({
    definitionVersion: 1,
    identify: () => "invalid-key",
    keyStrategies: [{
      derive: () => true,
      mode: "text",
      name: "text"
    }],
    namespace: "invalid-text-key",
    parseMetadata: (metadata) => metadata,
    parseState: (state) => state,
    read: async () => ({ metadata: {}, revision: "one", states: [{}] }),
    readRevision: async () => "one"
  });
  const result = await buildStateIndex(definition, { root: "." });
  assert.equal(result.status, "error");
  assert.ok(result.diagnostics.some((entry) => (
    entry.code === "state-index.key-value-invalid"
  )));
});

function malformedReadDefinition() {
  return defineStateIndexDefinition({
    definitionVersion: 1,
    identify: () => "state",
    keyStrategies: [{
      derive: () => "active",
      mode: "exact",
      name: "status"
    }],
    namespace: "malformed-read",
    parseMetadata: (metadata) => metadata,
    parseState: (state) => state,
    read: async () => null as never,
    readRevision: async () => "one"
  });
}

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
  assert.ok(result.diagnostics.some((entry) => (
    entry.code === "state-index.operation-aborted"
  )));
});
