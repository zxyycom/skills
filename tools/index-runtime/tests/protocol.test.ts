import assert from "node:assert/strict";
import test from "node:test";
import {
  buildStateIndex,
  defineStateIndexDefinition,
  type JsonObject,
  queryStateIndex,
  type StateSourceRevision
} from "../src/index.ts";
import { sameQueryFieldDefinitions } from "../src/definition.ts";
import { compareStateIndexKeyScalars } from "../src/ordering.ts";
import type { StateIndexKeyScalar } from "../src/types.ts";

test("orders query scalars and compares ordered field definitions", () => {
  const scalars: StateIndexKeyScalar[] = ["alpha", 10, true, 2, false, "beta"];
  assert.deepEqual(scalars.sort(compareStateIndexKeyScalars), [
    false,
    true,
    2,
    10,
    "alpha",
    "beta"
  ]);

  const definitions = [
    { mode: "exact" as const, name: "status" },
    { mode: "range" as const, name: "created-at" }
  ];
  assert.equal(sameQueryFieldDefinitions(definitions, [...definitions]), true);
  assert.equal(
    sameQueryFieldDefinitions(definitions, [...definitions].reverse()),
    false
  );
  assert.equal(
    sameQueryFieldDefinitions(definitions, [
      definitions[0]!,
      { mode: "text", name: "created-at" }
    ]),
    false
  );
});

test("rejects invalid closed query field descriptors", () => {
  assert.throws(
    () =>
      defineStateIndexDefinition({
        definitionVersion: 1,
        queryFields: [
          { mode: "exact", name: "status", sources: [{ kind: "entry-id" }] },
          { mode: "exact", name: "status", sources: [{ kind: "entry-id" }] }
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
    () =>
      defineStateIndexDefinition({
        definitionVersion: 1,
        queryFields: [
          { mode: "exact", name: "id", sources: [{ kind: "entry-id" }] }
        ],
        namespace: "reserved-key",
        parseMetadata: (metadata) => metadata,
        parseState: (state) => state,
        read: async () => snapshot("state", {}),
        readRevision: async () => revision("state")
      }),
    /reserved id/u
  );
  assert.throws(
    () =>
      defineStateIndexDefinition({
        definitionVersion: 1,
        queryFields: [
          {
            mode: "exact",
            name: "status",
            sources: [{ kind: "state-path", path: ["status"] }]
          }
        ],
        namespace: "missing-parser",
        parseMetadata: (metadata) => metadata,
        parseState: null as never,
        read: async () => snapshot("state", {}),
        readRevision: async () => revision("state")
      }),
    /parseState/u
  );
  assert.throws(
    () =>
      defineStateIndexDefinition({
        ...baseDefinition("invalid-each"),
        queryFields: [
          {
            mode: "exact",
            name: "relation",
            sources: [
              {
                kind: "state-path",
                path: [{ kind: "each" }, "type"]
              }
            ]
          }
        ]
      }),
    /must not start or end with each/u
  );
  assert.throws(
    () =>
      defineStateIndexDefinition({
        ...baseDefinition("invalid-instant"),
        queryFields: [
          {
            mode: "text",
            name: "formed-at",
            sources: [
              {
                kind: "state-path",
                normalization: "instant",
                path: ["formedAt"]
              }
            ]
          }
        ]
      }),
    /instant normalization requires range mode/u
  );
  assert.throws(
    () =>
      defineStateIndexDefinition({
        ...baseDefinition("arbitrary-transform"),
        queryFields: [
          {
            mode: "exact",
            name: "status",
            sources: [
              {
                kind: "state-path",
                path: ["status"],
                transform: () => "active"
              } as never
            ]
          }
        ]
      }),
    /unsupported properties: transform/u
  );
});

test("rejects query field and source properties inherited through prototypes", () => {
  const inheritedField = Object.create({
    mode: "exact",
    name: "status",
    sources: [{ kind: "entry-id" }]
  }) as never;
  assert.throws(
    () =>
      defineStateIndexDefinition({
        ...baseDefinition("inherited-field"),
        queryFields: [inheritedField]
      }),
    /queryFields\[0\] must define own properties: mode, name, sources/u
  );

  const inheritedSource = Object.create({ kind: "entry-id" }) as never;
  assert.throws(
    () =>
      defineStateIndexDefinition({
        ...baseDefinition("inherited-source"),
        queryFields: [
          {
            mode: "exact",
            name: "status",
            sources: [inheritedSource]
          }
        ]
      }),
    /queryFields\[0\]\.sources\[0\] must define own properties: kind/u
  );
});

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

function baseDefinition(namespace: string) {
  return {
    definitionVersion: 1,
    queryFields: [
      {
        mode: "exact" as const,
        name: "status",
        sources: [{ kind: "state-path" as const, path: ["status"] }]
      }
    ],
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
