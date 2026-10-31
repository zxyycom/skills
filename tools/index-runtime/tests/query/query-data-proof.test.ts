import assert from "node:assert/strict";
import test from "node:test";
import { defineStateIndexDefinition } from "../../src/index.ts";
import { materializeStateIndexEntry } from "../../src/query/query-fields.ts";
import { projectStateIndexState } from "../../src/protocol/projection.ts";
import { baseDefinition } from "../protocol/protocol-test-support.ts";

test("raw frozen getter input is revalidated for each query source", () => {
  let reads = 0;
  const nested = Object.freeze({
    value: "valid",
    get hidden() {
      return ++reads <= 2 ? "valid" : Number.NaN;
    }
  });
  const state = Object.freeze({ nested });
  const definition = defineStateIndexDefinition({
    ...baseDefinition("getter-query"),
    queryFields: [
      {
        mode: "text",
        name: "first",
        sources: [{ kind: "state-path", path: ["nested", "value"] }]
      },
      {
        mode: "text",
        name: "second",
        sources: [{ kind: "state-path", path: ["nested", "value"] }]
      }
    ]
  });
  const result = materializeStateIndexEntry(definition, "state", state);
  assert.equal(result.status, "error");
  assert.equal(
    result.diagnostics[0]?.code,
    "state-index.query-field-source-invalid"
  );
  assert.match(result.diagnostics[0]?.message ?? "", /query field second/u);
  assert.equal(reads, 3);
  reads = 0;
  let prototypeReads = 0;
  const proxy = new Proxy(nested, {
    getPrototypeOf(target) {
      prototypeReads += 1;
      return Reflect.getPrototypeOf(target);
    }
  });
  const proxyResult = materializeStateIndexEntry(
    definition,
    "state",
    Object.freeze({ nested: proxy })
  );
  assert.equal(proxyResult.status, "error");
  assert.match(
    proxyResult.diagnostics[0]?.message ?? "",
    /query field second/u
  );
  assert.ok(prototypeReads >= 2);
  assert.equal(reads, 3);
});

function dynamicRelationsDefinition(relations: Array<{ type: string }>) {
  return defineStateIndexDefinition({
    ...baseDefinition("clone-query"),
    parseState: () => ({ relations }),
    queryFields: ["first", "second"].map((name) => ({
      mode: "exact" as const,
      name,
      sources: [
        {
          kind: "state-path" as const,
          path: ["relations", { kind: "each" as const }, "type"]
        }
      ]
    }))
  });
}

test("projection falls back when caller map produces dynamic cloned data", () => {
  let reads = 0;
  let useProxy = false;
  const relations = [{ type: "expected" }];
  Object.defineProperty(relations, "map", {
    value: () => {
      const dynamic = Object.freeze({
        type: "spoofed",
        get hidden() {
          return ++reads <= 2 ? "ok" : Number.NaN;
        }
      });
      return [useProxy ? new Proxy(dynamic, {}) : dynamic];
    }
  });
  const definition = dynamicRelationsDefinition(relations);
  for (const proxy of [false, true]) {
    reads = 0;
    useProxy = proxy;
    const result = projectStateIndexState(
      definition,
      {},
      { id: "state", metadata: {} }
    );
    assert.equal(result.status, "error");
    assert.match(result.diagnostics[0]?.message ?? "", /query field second/u);
    assert.equal(reads, 3);
  }
  const replacementSource = [{ type: "original" }];
  Object.defineProperty(replacementSource, "map", {
    value: () => [{ type: "replacement" }]
  });
  const entries: Array<
    import("../../src/query/query-fields.ts").MaterializedStateIndexEntry<{
      relations: typeof replacementSource;
    }>
  > = [];
  const replacement = projectStateIndexState(
    dynamicRelationsDefinition(replacementSource),
    {},
    { id: "state", metadata: {} },
    entries
  );
  assert.equal(replacement.status, "ok");
  assert.deepEqual(entries[0]?.queryValues.first, ["replacement"]);
});

test("projection never trusts a frozen proxy returned by caller map", () => {
  let primitiveEveryReads = 0;
  const primitiveProxy = new Proxy(["ok"], {
    get(target, key, receiver) {
      if (key === "every" && ++primitiveEveryReads > 1) return () => false;
      return Reflect.get(target, key, receiver);
    }
  });
  const primitiveSource = ["source"];
  Object.defineProperty(primitiveSource, "map", {
    value: () => primitiveProxy
  });
  const primitiveDefinition = defineStateIndexDefinition({
    ...baseDefinition("proxy-array-query"),
    parseState: () => ({ relations: primitiveSource }),
    queryFields: ["first", "second"].map((name) => ({
      mode: "exact" as const,
      name,
      sources: [{ kind: "state-path" as const, path: ["relations"] }]
    }))
  });
  const primitiveResult = projectStateIndexState(
    primitiveDefinition,
    {},
    { id: "state", metadata: {} }
  );
  assert.equal(primitiveResult.status, "error");
  assert.match(
    primitiveResult.diagnostics[0]?.message ?? "",
    /query field second/u
  );
  assert.equal(primitiveEveryReads, 2);
});

test("projection revalidates a caller-map value that freezes itself", () => {
  let changingReads = 0;
  const changing: { type: string; hidden?: unknown } = { type: "ok" };
  Object.defineProperty(changing, "hidden", {
    configurable: true,
    enumerable: true,
    get() {
      changingReads++;
      if (changingReads === 2) {
        Object.defineProperty(changing, "hidden", {
          value: Number.NaN,
          enumerable: true
        });
        Object.freeze(changing);
      }
      return "ok";
    }
  });
  const changingSource = [{ type: "source" }];
  Object.defineProperty(changingSource, "map", { value: () => [changing] });
  const changingDefinition = dynamicRelationsDefinition(changingSource);
  const changingResult = projectStateIndexState(
    changingDefinition,
    {},
    { id: "state", metadata: {} }
  );
  assert.equal(changingResult.status, "error");
  assert.match(
    changingResult.diagnostics[0]?.message ?? "",
    /query field second/u
  );
  assert.equal(changingReads, 2);
});

test("projection reuses subtree validation only inside each cloned projection", () => {
  const definition = defineStateIndexDefinition({
    ...baseDefinition("memo-query"),
    parseState: (state) => state,
    queryFields: ["type", "target"].map((name) => ({
      mode: "exact" as const,
      name,
      sources: [
        {
          kind: "state-path" as const,
          path: ["relations", { kind: "each" as const }, name]
        }
      ]
    }))
  });
  const state = { relations: [{ type: "first", target: "other" }] };
  const originalValues = Object.values;
  const counts: number[] = [];
  const projected = [];
  try {
    for (const type of ["first", "second"]) {
      state.relations[0]!.type = type;
      let relationVisits = 0;
      Object.values = (value: object) => {
        if (Object.hasOwn(value, "type") && Object.hasOwn(value, "target"))
          relationVisits += 1;
        return originalValues(value);
      };
      const entries: Array<
        import("../../src/query/query-fields.ts").MaterializedStateIndexEntry<
          typeof state
        >
      > = [];
      const result = projectStateIndexState(
        definition,
        state,
        { id: "state", metadata: {} },
        entries
      );
      Object.values = originalValues;
      counts.push(relationVisits);
      projected.push({ result, values: entries[0]?.queryValues });
    }
  } finally {
    Object.values = originalValues;
  }
  assert.deepEqual(counts, [5, 5]);
  assert.deepEqual(
    projected.map(({ values }) => values?.type),
    [["first"], ["second"]]
  );
  assert.ok(projected.every(({ result }) => result.status === "ok"));
});

test("single query source does not inspect the cloned tree for memoization", () => {
  const definition = defineStateIndexDefinition({
    ...baseDefinition("single-query"),
    parseState: (state) => state,
    queryFields: [
      {
        mode: "exact",
        name: "type",
        sources: [
          {
            kind: "state-path",
            path: ["relations", { kind: "each" }, "type"]
          }
        ]
      }
    ]
  });
  const original = Reflect.ownKeys;
  let inspections = 0;
  let result: ReturnType<typeof projectStateIndexState>;
  try {
    Reflect.ownKeys = (value) => {
      inspections++;
      return original(value);
    };
    result = projectStateIndexState(
      definition,
      { relations: [{ type: "one" }] },
      { id: "state", metadata: {} }
    );
  } finally {
    Reflect.ownKeys = original;
  }
  assert.equal(result.status, "ok");
  assert.equal(inspections, 0);
});

test("dynamic field descriptors keep their original access sequence", () => {
  const accesses: string[] = [];
  const fields = ["first", "second"].map((name) =>
    Object.freeze({
      name,
      mode: "exact" as const,
      get sources() {
        accesses.push(name);
        return [{ kind: "state-path" as const, path: ["value"] }];
      }
    })
  );
  const definition: import("../../src/types.ts").StateIndexDefinition<
    { value: string },
    {}
  > = Object.freeze({
    ...baseDefinition("dynamic-fields"),
    parseState: () => ({ value: "ok" }),
    read: async () => ({
      metadata: {},
      sourceRevision: { metadata: "m", entries: {} },
      states: {}
    }),
    queryFields: Object.freeze(fields)
  });
  const entries: Array<
    import("../../src/query/query-fields.ts").MaterializedStateIndexEntry<{
      value: string;
    }>
  > = [];
  const result = projectStateIndexState(
    definition,
    { value: "ok" },
    { id: "state", metadata: {} },
    entries
  );
  assert.equal(result.status, "ok");
  assert.deepEqual(accesses, ["first", "second"]);
  assert.deepEqual(entries[0]?.queryValues, { first: ["ok"], second: ["ok"] });
});
