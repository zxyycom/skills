import assert from "node:assert/strict";
import test from "node:test";
import {
  buildStateIndex,
  defineStateIndexDefinition,
  type JsonObject,
  queryStateIndex
} from "../src/index.ts";
import { baseDefinition, revision, snapshot } from "./protocol-test-support.ts";
test("rejects invalid ids and revision membership before parsing states", async () => {
  let parseCount = 0;
  const invalidId = defineStateIndexDefinition<JsonObject>({
    definitionVersion: 1,
    queryFields: [
      {
        mode: "exact",
        name: "status",
        sources: [{ kind: "state-path", path: ["status"] }]
      }
    ],
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
  const invalidState = await buildStateIndex(invalidStateDefinition, {
    root: "."
  });
  assert.equal(invalidState.status, "error");
  assert.ok(
    invalidState.diagnostics.some(
      (entry) => entry.code === "state-index.state-invalid"
    )
  );

  const closedDefinition = defineStateIndexDefinition<JsonObject>({
    ...baseDefinition("closed-sources"),
    queryFields: [
      {
        mode: "text",
        name: "search",
        sources: [{ kind: "entry-id" }, { kind: "state-path", path: ["title"] }]
      },
      {
        mode: "exact",
        name: "alias",
        sources: [{ kind: "state-path", path: ["aliases"] }]
      },
      {
        mode: "exact",
        name: "relation-type",
        sources: [
          {
            kind: "state-path",
            path: ["relations", { kind: "each" }, "type"]
          }
        ]
      },
      {
        mode: "range",
        name: "formed-at",
        sources: [
          {
            kind: "state-path",
            normalization: "instant",
            path: ["formedAt"]
          }
        ]
      },
      {
        mode: "exact",
        name: "topic",
        sources: [{ kind: "source-path-first-segment" }]
      },
      {
        mode: "exact",
        name: "optional",
        sources: [{ kind: "state-path", path: ["optional"] }]
      }
    ],
    read: async () =>
      snapshot("case-one", {
        aliases: ["beta", "alpha", "alpha"],
        formedAt: "2026-07-22T10:00:00+08:00",
        relations: [{ type: "test" }, { type: "build" }, { type: "test" }],
        sourcePath: "index-runtime/case-one.md",
        title: "Case One"
      })
  });
  const closedIndex = await buildStateIndex(closedDefinition, { root: "." });
  assert.equal(closedIndex.status, "ok");
  assert.equal(Object.hasOwn(closedIndex.value, "keyDefinitions"), false);
  assert.deepEqual(
    Object.keys(closedIndex.value.entries["case-one"] ?? {}).sort(),
    ["aliases", "formedAt", "relations", "sourcePath", "title"]
  );
  const queried = queryStateIndex({
    definition: closedDefinition,
    index: closedIndex.value,
    query: {
      filters: [
        { key: "search", kind: "text", operator: "all", text: "case-one Case" },
        {
          key: "alias",
          kind: "exact",
          operator: "all",
          values: ["alpha", "beta"]
        },
        {
          key: "relation-type",
          kind: "exact",
          operator: "all",
          values: ["build", "test"]
        },
        {
          key: "formed-at",
          kind: "range",
          operator: "eq",
          value: Date.parse("2026-07-22T02:00:00Z")
        },
        {
          key: "topic",
          kind: "exact",
          operator: "all",
          values: ["index-runtime"]
        },
        { key: "optional", kind: "exists", value: false }
      ]
    }
  });
  assert.equal(queried.status, "ok");
  assert.equal(queried.status === "ok" ? queried.value.total : null, 1);

  for (const [state, expectedSource] of [
    [
      {
        aliases: ["alpha"],
        formedAt: "2026-07-22T02:00:00Z",
        relations: {},
        sourcePath: "index-runtime/case.md",
        title: "Case"
      },
      "state-path(relations.[each].type)"
    ],
    [
      {
        aliases: ["alpha"],
        formedAt: "2026-07-22T02:00:00Z",
        relations: [],
        sourcePath: "../outside.md",
        title: "Case"
      },
      "source-path-first-segment(state.sourcePath)"
    ],
    [
      {
        aliases: ["alpha"],
        formedAt: ["2026-07-22T02:00:00Z"],
        relations: [],
        sourcePath: "index-runtime/case.md",
        title: "Case"
      },
      "state-path(formedAt, instant)"
    ]
  ] satisfies Array<[JsonObject, string]>) {
    const invalidDefinition = defineStateIndexDefinition<JsonObject>({
      ...closedDefinition,
      read: async () => snapshot("invalid-source", state)
    });
    const invalid = await buildStateIndex(invalidDefinition, { root: "." });
    assert.equal(invalid.status, "error");
    assert.ok(
      invalid.diagnostics.some(
        (entry) =>
          entry.code === "state-index.query-field-source-invalid" &&
          entry.stateId === "invalid-source" &&
          entry.message.includes(expectedSource)
      )
    );
  }

  const invalidParserOutput = defineStateIndexDefinition<JsonObject>({
    ...baseDefinition("invalid-parser-output"),
    parseState: () => new Date() as never
  });
  const invalidParsedState = await buildStateIndex(invalidParserOutput, {
    root: "."
  });
  assert.equal(invalidParsedState.status, "error");
  assert.ok(
    invalidParsedState.diagnostics.some(
      (entry) => entry.code === "state-index.state-parse-invalid"
    )
  );

  const invalidMetadataParserOutput = defineStateIndexDefinition<JsonObject>({
    ...baseDefinition("invalid-metadata-parser-output"),
    parseMetadata: () => new Date() as never
  });
  const invalidParsedMetadata = await buildStateIndex(
    invalidMetadataParserOutput,
    { root: "." }
  );
  assert.equal(invalidParsedMetadata.status, "error");
  assert.ok(
    invalidParsedMetadata.diagnostics.some(
      (entry) => entry.code === "state-index.metadata-parse-invalid"
    )
  );
});
