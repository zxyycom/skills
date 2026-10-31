import assert from "node:assert/strict";
import test from "node:test";
import {
  buildStateIndex,
  createStateIndexReader,
  defineStateIndexDefinition,
  queryStateIndex,
  type JsonObject,
  type StateIndexKeyScalar
} from "../../src/index.ts";
import { compileFilter } from "../../src/query/query-matching.ts";
import { baseDefinition } from "../protocol/protocol-test-support.ts";
import { resultValue } from "./support.ts";

async function membershipFixture() {
  const states: Record<string, JsonObject> = {
    a: { tokens: [true, 1, "1", -0], extras: [true, "other"] },
    b: { tokens: [false, "true", 1] },
    empty: { tokens: [] },
    missing: {}
  };
  const revision = {
    metadata: "metadata",
    entries: Object.fromEntries(Object.keys(states).map((id) => [id, id]))
  };
  const definition = defineStateIndexDefinition<JsonObject>({
    ...baseDefinition("exact-membership"),
    queryFields: [
      {
        name: "tokens",
        mode: "exact",
        sources: [
          { kind: "state-path", path: ["tokens"] },
          { kind: "state-path", path: ["extras"] }
        ]
      }
    ],
    read: async () => ({ metadata: {}, sourceRevision: revision, states }),
    readRevision: async () => revision
  });
  return {
    definition,
    index: resultValue(await buildStateIndex(definition, { root: "." }))
  };
}

test("exact membership preserves typed identities duplicate values and empty quantifiers", async () => {
  const { definition, index } = await membershipFixture();
  const cases: readonly Readonly<{
    operator: "all" | "any" | "none";
    values: readonly StateIndexKeyScalar[];
    ids: readonly string[];
  }>[] = [
    { operator: "all", values: [true, true, 1, -0, 0], ids: ["a"] },
    { operator: "any", values: [true], ids: ["a"] },
    { operator: "none", values: [true], ids: ["b", "empty", "missing"] },
    { operator: "all", values: [true, "true"], ids: [] },
    { operator: "any", values: [true, "true"], ids: ["a", "b"] },
    { operator: "any", values: ["1"], ids: ["a"] },
    { operator: "any", values: [false], ids: ["b"] }
  ];
  for (const operator of ["all", "any", "none"] as const) {
    const matches = compileFilter({
      kind: "exact",
      key: "tokens",
      operator,
      values: []
    });
    assert.equal(
      matches({ id: "empty", state: {}, queryValues: { tokens: [] } }),
      operator !== "any"
    );
    assert.equal(
      matches({ id: "actual", state: {}, queryValues: { tokens: [true] } }),
      operator !== "any"
    );
  }
  for (const { operator, values, ids } of cases) {
    const output = resultValue(
      queryStateIndex({
        definition,
        index,
        query: {
          filters: [
            { kind: "exact", key: "tokens", operator, values: [...values] }
          ]
        }
      })
    );
    assert.deepEqual(
      output.entries.map((entry) => entry.id),
      ids
    );
    assert.equal(output.total, ids.length);
  }
});

test("exact membership is query-local for readers overlays sorting and pagination", async () => {
  const { definition, index } = await membershipFixture();
  const reader = createStateIndexReader({
    definition,
    index,
    indexPath: "membership.json"
  });
  for (const id of ["a", "b", "a"]) {
    assert.deepEqual(
      resultValue(
        reader.query({
          filters: [
            {
              kind: "exact",
              key: "id",
              operator: "any",
              values: [id, id]
            }
          ]
        })
      ).entries.map((entry) => entry.id),
      [id]
    );
  }
  const result = resultValue(
    reader.query({
      filters: [{ kind: "exact", key: "tokens", operator: "any", values: [1] }],
      sort: [{ key: "id", direction: "desc" }],
      offset: 1,
      limit: 1
    })
  );
  assert.equal(result.total, 2);
  assert.deepEqual(
    result.entries.map((entry) => entry.id),
    ["a"]
  );
  const overlay = resultValue(
    queryStateIndex({
      definition,
      index,
      runtimeStates: { a: { tokens: [false] }, added: { tokens: [false] } },
      query: {
        filters: [
          { kind: "exact", key: "tokens", operator: "any", values: [false] }
        ]
      }
    })
  );
  assert.deepEqual(
    overlay.entries.map((entry) => entry.id),
    ["a", "added", "b"]
  );
  assert.deepEqual(
    resultValue(
      reader.query({
        filters: [
          {
            kind: "exact",
            key: "tokens",
            operator: "any",
            values: [true]
          }
        ]
      })
    ).entries.map((entry) => entry.id),
    ["a"]
  );
});

test("exact membership keeps invalid scalar and reserved identity diagnostics", async () => {
  const { definition, index } = await membershipFixture();
  for (const values of [[], [null], [Number.NaN], [Number.POSITIVE_INFINITY]]) {
    const output = queryStateIndex({
      definition,
      index,
      query: {
        filters: [{ kind: "exact", key: "tokens", operator: "any", values }]
      } as never
    });
    assert.equal(output.status, "error");
    assert.ok(
      output.diagnostics.every(
        (entry) => entry.code === "state-index.query-invalid"
      )
    );
  }
  const output = queryStateIndex({
    definition,
    index,
    query: {
      filters: [{ kind: "exact", key: "id", operator: "any", values: [true] }]
    }
  });
  assert.equal(output.status, "error");
  assert.equal(
    output.diagnostics[0]?.code,
    "state-index.query-key-value-invalid"
  );
});
