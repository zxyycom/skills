import assert from "node:assert/strict";
import test from "node:test";
import {
  buildStateIndex,
  defineStateIndexDefinition,
  type JsonObject,
  type StateSourceRevision
} from "../src/index.ts";
import { sameKeyDefinitions } from "../src/definition.ts";
import { compareStateIndexKeyScalars } from "../src/ordering.ts";
import type { StateIndexKeyScalar } from "../src/types.ts";

test("orders key scalars and compares ordered key definitions", () => {
  const scalars: StateIndexKeyScalar[] = ["alpha", 10, true, 2, false, "beta"];
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
      keyStrategies: [
        { derive: () => "a", mode: "exact", name: "status" },
        { derive: () => "b", mode: "exact", name: "status" }
      ],
      namespace: "duplicate-keys",
      parseMetadata: (metadata) => metadata,
      parseState: (state) => state,
      read: async () => snapshot("state", {}),
      readRevision: async () => revision("state")
    }),
    /appears more than once/u
  );
  assert.throws(
    () => defineStateIndexDefinition({
      definitionVersion: 1,
      keyStrategies: [{ derive: () => "state", mode: "exact", name: "id" }],
      namespace: "reserved-key",
      parseMetadata: (metadata) => metadata,
      parseState: (state) => state,
      read: async () => snapshot("state", {}),
      readRevision: async () => revision("state")
    }),
    /reserved id/u
  );
  assert.throws(
    () => defineStateIndexDefinition({
      definitionVersion: 1,
      keyStrategies: [{ derive: () => "active", mode: "exact", name: "status" }],
      namespace: "missing-parser",
      parseMetadata: (metadata) => metadata,
      parseState: null as never,
      read: async () => snapshot("state", {}),
      readRevision: async () => revision("state")
    }),
    /parseState/u
  );
});

test("rejects invalid ids and revision membership before parsing states", async () => {
  let parseCount = 0;
  const invalidId = defineStateIndexDefinition<JsonObject>({
    definitionVersion: 1,
    keyStrategies: [{ derive: () => "active", mode: "exact", name: "status" }],
    namespace: "invalid-id",
    parseMetadata: (metadata) => metadata,
    parseState: (state) => {
      parseCount += 1;
      return state;
    },
    read: async () => ({
      metadata: {},
      sourceRevision: revision(" invalid "),
      states: { " invalid ": {} }
    }),
    readRevision: async () => revision(" invalid ")
  });
  const invalidIdResult = await buildStateIndex(invalidId, { root: "." });
  assert.equal(invalidIdResult.status, "error");
  assert.equal(invalidIdResult.diagnostics[0]?.code, "state-index.id-invalid");
  assert.equal(parseCount, 0);

  const mismatched = defineStateIndexDefinition<JsonObject>({
    ...invalidId,
    namespace: "mismatched-members",
    read: async () => ({
      metadata: {},
      sourceRevision: revision("other"),
      states: { state: {} }
    })
  });
  const mismatchResult = await buildStateIndex(mismatched, { root: "." });
  assert.equal(mismatchResult.status, "error");
  assert.equal(
    mismatchResult.diagnostics[0]?.code,
    "state-index.source-revision-members-mismatch"
  );
  assert.equal(parseCount, 0);
});

test("rejects non-JSON states and parser outputs", async () => {
  const invalidStateDefinition = defineStateIndexDefinition<JsonObject>({
    ...baseDefinition("invalid-state"),
    read: async () => snapshot("invalid", { value: Number.NaN })
  });
  const invalidState = await buildStateIndex(invalidStateDefinition, { root: "." });
  assert.equal(invalidState.status, "error");
  assert.ok(invalidState.diagnostics.some((entry) => (
    entry.code === "state-index.state-invalid"
  )));

  const invalidParserOutput = defineStateIndexDefinition<JsonObject>({
    ...baseDefinition("invalid-parser-output"),
    parseState: () => new Date() as never
  });
  const invalidParsedState = await buildStateIndex(invalidParserOutput, { root: "." });
  assert.equal(invalidParsedState.status, "error");
  assert.ok(invalidParsedState.diagnostics.some((entry) => (
    entry.code === "state-index.state-parse-invalid"
  )));

  const invalidMetadataParserOutput = defineStateIndexDefinition<JsonObject>({
    ...baseDefinition("invalid-metadata-parser-output"),
    parseMetadata: () => new Date() as never
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
  const definition = defineStateIndexDefinition<JsonObject>({
    ...baseDefinition("invalid-text-key"),
    keyStrategies: [{ derive: () => true, mode: "text", name: "text" }]
  });
  const result = await buildStateIndex(definition, { root: "." });
  assert.equal(result.status, "error");
  assert.ok(result.diagnostics.some((entry) => (
    entry.code === "state-index.key-value-invalid"
  )));
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
  assert.ok(result.diagnostics.some((entry) => (
    entry.code === "state-index.operation-aborted"
  )));
});

function baseDefinition(namespace: string) {
  return {
    definitionVersion: 1,
    keyStrategies: [{ derive: () => "active", mode: "exact" as const, name: "status" }],
    namespace,
    parseMetadata: (metadata: JsonObject) => metadata,
    parseState: (state: JsonObject) => state,
    read: async () => snapshot("state", {}),
    readRevision: async () => revision("state")
  };
}

function malformedReadDefinition() {
  return defineStateIndexDefinition<JsonObject>({
    ...baseDefinition("malformed-read"),
    read: async () => null as never
  });
}

function snapshot(id: string, state: JsonObject) {
  return {
    metadata: {},
    sourceRevision: revision(id),
    states: Object.fromEntries([[id, state]])
  };
}

function revision(id: string): StateSourceRevision {
  return {
    entries: Object.fromEntries([[id, `source:${id}`]]),
    metadata: "source:metadata"
  };
}
