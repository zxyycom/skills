import assert from "node:assert/strict";
import test from "node:test";
import {
  defineStateIndexDefinition,
  parseStateIndex,
  serializeStateIndex,
  type JsonObject
} from "../src/index.ts";
import { parseStateIndexEnvelope } from "../src/snapshot-parser.ts";
import { baseDefinition } from "./protocol-test-support.ts";

const sourcePath = "owned-envelope.json";
const expectation = { namespace: "owned-envelope", definitionVersion: 1 };

function envelope() {
  return {
    schemaVersion: 4,
    ...expectation,
    metadata: { nested: [{ label: "metadata" }], empty: {} },
    sourceRevision: {
      metadata: "metadata-revision",
      entries: { item: "item-revision" }
    },
    entries: {
      item: { status: "active", nested: [{ label: "state" }] }
    }
  };
}

function recursivelyFrozen(value: unknown): boolean {
  return (
    value === null ||
    typeof value !== "object" ||
    (Object.isFrozen(value) && Object.values(value).every(recursivelyFrozen))
  );
}

test("seals decoded envelopes without changing JSON values or prototype-like own keys", () => {
  const input = envelope();
  const specialValue = Object.fromEntries([
    ["__proto__", { label: "own-prototype" }],
    ["constructor", [null, false, 0, "", [], {}]],
    ["negativeZero", -0]
  ]);
  const entries = Object.fromEntries(
    ["__proto__", "constructor", "item"].map((id) => [id, specialValue])
  );
  const text = JSON.stringify({
    ...input,
    entries,
    sourceRevision: {
      ...input.sourceRevision,
      entries: Object.fromEntries(Object.keys(entries).map((id) => [id, "r"]))
    }
  }).replaceAll('"negativeZero":0', '"negativeZero":1,"negativeZero":-0');
  const result = parseStateIndexEnvelope({ text, sourcePath, expectation });
  assert.equal(result.status, "ok");
  assert.deepEqual(result.value, {
    ...input,
    entries,
    sourceRevision: {
      ...input.sourceRevision,
      entries: Object.fromEntries(Object.keys(entries).map((id) => [id, "r"]))
    }
  });
  assert.equal(recursivelyFrozen(result.value), true);
  for (const id of ["__proto__", "constructor", "item"]) {
    assert.equal(Object.hasOwn(result.value.entries, id), true);
    const state: JsonObject | undefined = result.value.entries[id];
    assert.ok(state);
    assert.equal(Object.hasOwn(state, "__proto__"), true);
    assert.equal(Object.hasOwn(state, "constructor"), true);
    assert.equal(Object.is(state.negativeZero, -0), true);
    assert.equal(Reflect.set(state, "negativeZero", 7), false);
  }
  assert.equal(Object.getPrototypeOf(result.value.entries), Object.prototype);
  assert.equal(Object.hasOwn(Object.prototype, "label"), false);
});

test("freezes nested envelope inputs before metadata and state callbacks", () => {
  const observations: unknown[] = [];
  const definition = defineStateIndexDefinition<JsonObject>({
    ...baseDefinition(expectation.namespace),
    parseMetadata(input) {
      observations.push(["metadata", recursivelyFrozen(input)]);
      const nested = input.nested;
      if (Array.isArray(nested) && typeof nested[0] === "object" && nested[0]) {
        observations.push([
          "metadata-write",
          Reflect.set(nested[0], "label", "changed")
        ]);
      }
      return input;
    },
    parseState(input, context) {
      observations.push([
        "state",
        context.id,
        recursivelyFrozen(input),
        recursivelyFrozen(context)
      ]);
      const nested = input.nested;
      if (Array.isArray(nested) && typeof nested[0] === "object" && nested[0]) {
        observations.push([
          "state-write",
          Reflect.set(nested[0], "label", "changed")
        ]);
      }
      return input;
    },
    validateIndex(index) {
      observations.push(["validate", recursivelyFrozen(index)]);
    }
  });
  const input = envelope();
  const result = parseStateIndex({
    definition,
    sourcePath,
    text: JSON.stringify(input)
  });
  assert.equal(result.status, "ok");
  assert.deepEqual(observations, [
    ["metadata", true],
    ["metadata-write", false],
    ["state", "item", true, true],
    ["state-write", false],
    ["validate", true]
  ]);
  assert.deepEqual(result.value, input);
  assert.deepEqual(
    JSON.parse(serializeStateIndex(result.value, definition)),
    input
  );
});

test("isolates mutable parser returns from recursively frozen snapshots", () => {
  const metadata = { nested: [{ label: "external-metadata" }] };
  const state = { status: "active", nested: [{ label: "external-state" }] };
  const definition = defineStateIndexDefinition<JsonObject>({
    ...baseDefinition(expectation.namespace),
    parseMetadata: () => metadata,
    parseState: () => state
  });
  const input = envelope();
  const text = JSON.stringify({
    ...input,
    entries: { first: input.entries.item, second: input.entries.item },
    sourceRevision: { metadata: "m", entries: { first: "a", second: "b" } }
  });
  const result = parseStateIndex({ definition, sourcePath, text });
  assert.equal(result.status, "ok");
  assert.equal(recursivelyFrozen(result.value), true);
  assert.notEqual(result.value.metadata, metadata);
  assert.notEqual(result.value.entries.first, state);
  assert.equal(Object.isFrozen(metadata), false);
  assert.equal(Object.isFrozen(metadata.nested[0]), false);
  assert.equal(Object.isFrozen(state), false);
  assert.equal(Object.isFrozen(state.nested[0]), false);
  metadata.nested[0]!.label = "later-metadata";
  state.nested[0]!.label = "later-state";
  assert.deepEqual(result.value.metadata, {
    nested: [{ label: "external-metadata" }]
  });
  assert.deepEqual(result.value.entries, {
    first: { status: "active", nested: [{ label: "external-state" }] },
    second: { status: "active", nested: [{ label: "external-state" }] }
  });
});

test("rejects invalid raw envelopes before domain callbacks with stable diagnostic categories", () => {
  const calls: string[] = [];
  const definition = defineStateIndexDefinition<JsonObject>({
    ...baseDefinition(expectation.namespace),
    parseMetadata: (input) => {
      calls.push("metadata");
      return input;
    },
    parseState: (input) => {
      calls.push("state");
      return input;
    },
    validateIndex: () => {
      calls.push("validate");
    }
  });
  const input = envelope();
  const invalid: Array<{ text: string; code: string; field?: string }> = [
    { text: "{", code: "state-index.json-invalid" },
    { text: "null", code: "state-index.schema-invalid" },
    {
      text: JSON.stringify({ ...input, schemaVersion: 3 }),
      code: "state-index.schema-version-unsupported"
    },
    {
      text: JSON.stringify({ ...input, extra: true }),
      code: "state-index.schema-invalid",
      field: "extra"
    },
    {
      text: JSON.stringify({ ...input, namespace: "other" }),
      code: "state-index.namespace-mismatch"
    },
    {
      text: JSON.stringify({ ...input, definitionVersion: 2 }),
      code: "state-index.definition-version-mismatch"
    },
    {
      text: JSON.stringify({ ...input, metadata: [] }),
      code: "state-index.schema-invalid",
      field: "metadata"
    },
    {
      text: JSON.stringify({ ...input, entries: { item: null } }),
      code: "state-index.schema-invalid",
      field: "entries.item"
    },
    {
      text: JSON.stringify({ ...input, entries: { " invalid ": {} } }),
      code: "state-index.id-invalid"
    },
    {
      text: JSON.stringify({
        ...input,
        sourceRevision: { metadata: "m", entries: {} }
      }),
      code: "state-index.source-revision-members-mismatch"
    },
    {
      text: JSON.stringify({
        ...input,
        sourceRevision: { metadata: "m", entries: { item: 1 } }
      }),
      code: "state-index.source-revision-invalid",
      field: "sourceRevision.entries.item"
    },
    {
      text: JSON.stringify(input).replace('"state"', "1e999"),
      code: "state-index.schema-invalid",
      field: "entries.item"
    },
    {
      text: JSON.stringify(input).replace(
        '"label":"metadata"',
        '"label":1e999'
      ),
      code: "state-index.schema-invalid",
      field: "metadata"
    }
  ];
  for (const scenario of invalid) {
    const result = parseStateIndex({
      definition,
      sourcePath,
      text: scenario.text
    });
    assert.equal(result.status, "error", scenario.text);
    assert.equal(result.value, null);
    assert.equal(result.diagnostics[0]?.code, scenario.code, scenario.text);
    assert.equal(result.diagnostics[0]?.path, sourcePath);
    if (scenario.field)
      assert.ok(
        result.diagnostics[0]?.message.includes(scenario.field),
        result.diagnostics[0]?.message
      );
    assert.deepEqual(calls, []);
  }
});

test("independent parses retain separate owned graphs and observe changed input", () => {
  const input = envelope();
  const first = parseStateIndexEnvelope({
    expectation,
    sourcePath,
    text: JSON.stringify(input)
  });
  const same = parseStateIndexEnvelope({
    expectation,
    sourcePath,
    text: JSON.stringify(input)
  });
  input.entries.item.nested[0]!.label = "fresh-state";
  const fresh = parseStateIndexEnvelope({
    expectation,
    sourcePath,
    text: JSON.stringify(input)
  });
  assert.equal(first.status, "ok");
  assert.equal(same.status, "ok");
  assert.equal(fresh.status, "ok");
  assert.notEqual(first.value, same.value);
  assert.notEqual(first.value.entries.item, same.value.entries.item);
  assert.deepEqual(first.value.entries.item, {
    status: "active",
    nested: [{ label: "state" }]
  });
  assert.deepEqual(fresh.value.entries.item, {
    status: "active",
    nested: [{ label: "fresh-state" }]
  });
  assert.equal(recursivelyFrozen(fresh.value), true);
});
