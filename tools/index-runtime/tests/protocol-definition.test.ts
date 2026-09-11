import assert from "node:assert/strict";
import test from "node:test";
import { defineStateIndexDefinition } from "../src/index.ts";
import { sameQueryFieldDefinitions } from "../src/definition.ts";
import { compareStateIndexKeyScalars } from "../src/ordering.ts";
import type { StateIndexKeyScalar } from "../src/types.ts";
import { baseDefinition, revision, snapshot } from "./protocol-test-support.ts";
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

  const inheritedNormalization = Object.create({
    normalization: "instant"
  }) as {
    kind: "state-path";
    path: string[];
  };
  inheritedNormalization.kind = "state-path";
  inheritedNormalization.path = ["status"];
  assert.doesNotThrow(() =>
    defineStateIndexDefinition({
      ...baseDefinition("inherited-normalization"),
      queryFields: [
        { mode: "exact", name: "status", sources: [inheritedNormalization] }
      ]
    })
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
