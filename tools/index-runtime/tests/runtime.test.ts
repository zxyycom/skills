import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { toJsonSchema } from "@valibot/to-json-schema";
import * as v from "valibot";
import {
  buildStateIndex,
  createStateIndexReader,
  createStateIndexRuntime,
  createStateIndexSchema,
  defineStateIndexDefinition,
  parseStateIndex,
  serializeStateIndex,
  stateIndexTextSchema
} from "../src/index.ts";
import {
  decisionDefinition,
  decisionStates,
  resultValue,
  type DecisionState,
  type MemoryStateSource
} from "./support.ts";

type RuntimeMetadata = {
  groups: string[];
  nested: {
    a: number;
    z: number;
  };
  tenant: string;
};

async function withTempRoot(
  run: (tempRoot: string) => Promise<void>
): Promise<void> {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "state-index-runtime-"));
  try {
    await run(tempRoot);
  } finally {
    await fs.rm(tempRoot, { force: true, recursive: true });
  }
}

function createMetadataFixture() {
  const metadataSchema = v.strictObject({
    groups: v.array(v.string()),
    nested: v.strictObject({
      a: v.number(),
      z: v.number()
    }),
    tenant: v.string()
  });
  const stateSchema = v.strictObject({
    id: v.string(),
    label: v.string()
  });
  const sourceMetadata: RuntimeMetadata = {
    tenant: "tenant-a",
    nested: { z: 2, a: 1 },
    groups: ["second", "first"]
  };
  const sourceState = { id: "one", label: "First" };
  const control = {
    rejectCompleteIndex: false,
    validations: 0
  };
  const definition = defineStateIndexDefinition({
    definitionVersion: 1,
    identify: (state, { metadata }) => `${metadata.tenant}:${state.id}`,
    keyStrategies: [{
      derive: (state, { metadata }) => [
        state.label,
        ...metadata.groups
      ],
      mode: "text",
      name: "text"
    }],
    namespace: "typed-metadata",
    parseMetadata: (input) => v.parse(metadataSchema, input),
    parseState: (input, context) => {
      assert.equal(context.metadata.tenant, "tenant-a");
      if (false) {
        // @ts-expect-error The projection context cannot replace metadata.
        context.metadata = {};
        // @ts-expect-error Parsed metadata fields are readonly to projections.
        context.metadata.tenant = "tenant-b";
        // @ts-expect-error Nested metadata fields are recursively readonly.
        context.metadata.nested.a = 3;
        // @ts-expect-error Metadata arrays are recursively readonly.
        context.metadata.groups.push("third");
      }
      return v.parse(stateSchema, input);
    },
    read: async () => ({
      metadata: sourceMetadata,
      revision: "typed-metadata-revision-1",
      states: [sourceState]
    }),
    readRevision: async () => "typed-metadata-revision-1",
    validateIndex: (index) => {
      control.validations += 1;
      assert.deepEqual(index.entries.map((entry) => entry.id), ["tenant-a:one"]);
      assert.deepEqual(Object.keys(index.metadata), ["groups", "nested", "tenant"]);
      if (false) {
        // @ts-expect-error Complete index entries are recursively readonly.
        index.entries.push(index.entries[0]!);
        // @ts-expect-error Complete index state is recursively readonly.
        index.entries[0]!.state.label = "Mutated";
        // @ts-expect-error Complete index key arrays are recursively readonly.
        index.entries[0]!.keys.text!.push("mutated");
        // @ts-expect-error Complete index metadata objects are recursively readonly.
        index.metadata.nested.a = 3;
        // @ts-expect-error Complete index metadata arrays are recursively readonly.
        index.metadata.groups.push("mutated");
      }
      assert.ok(Object.isFrozen(index));
      assert.ok(Object.isFrozen(index.entries));
      assert.ok(Object.isFrozen(index.entries[0]));
      assert.ok(Object.isFrozen(index.entries[0]!.state));
      assert.ok(Object.isFrozen(index.entries[0]!.keys.text));
      assert.ok(Object.isFrozen(index.metadata));
      assert.ok(Object.isFrozen(index.metadata.nested));
      assert.ok(Object.isFrozen(index.metadata.groups));
      assert.throws(
        () => (index.entries as unknown as Array<typeof index.entries[number]>)
          .push(index.entries[0]!),
        TypeError
      );
      assert.throws(
        () => {
          (index.entries[0]!.state as unknown as { label: string }).label =
            "Mutated";
        },
        TypeError
      );
      assert.throws(
        () => (index.metadata.groups as unknown as string[]).push("mutated"),
        TypeError
      );
      assert.equal(index.entries[0]!.state.label, "First");
      assert.deepEqual(index.metadata.groups, ["second", "first"]);
      if (control.rejectCompleteIndex) {
        throw new TypeError("complete index rejected");
      }
    }
  });
  return { control, definition, sourceMetadata, sourceState };
}

async function createDecisionRuntimeFixture(tempRoot: string) {
  const source: MemoryStateSource<DecisionState> = {
    revision: "runtime-revision-1",
    states: await decisionStates()
  };
  const revisionReads = { value: 0 };
  const baseDefinition = decisionDefinition(source);
  const definition = defineStateIndexDefinition({
    ...baseDefinition,
    readRevision: async (context) => {
      revisionReads.value += 1;
      return await baseDefinition.readRevision(context);
    }
  });
  const runtime = createStateIndexRuntime({
    definition,
    indexPath: "indexes/decisions.json",
    root: tempRoot
  });
  assert.equal((await runtime.sync("write")).state, "written");
  revisionReads.value = 0;
  return { definition, revisionReads, runtime, source };
}

test("exposes a composable state-index schema", () => {
  const schema = createStateIndexSchema({
    definitionVersion: 1,
    keys: v.strictObject({
      status: v.tuple([stateIndexTextSchema])
    }),
    keyDefinitions: v.tuple([
      v.strictObject({
        mode: v.literal("exact"),
        name: v.literal("status")
      })
    ]),
    metadata: v.strictObject({}),
    namespace: "runtime-test",
    sourceRevision: stateIndexTextSchema,
    state: v.strictObject({
      id: stateIndexTextSchema
    })
  });
  assert.equal(
    toJsonSchema(schema, { target: "draft-2020-12" }).type,
    "object"
  );
});

test("builds typed metadata and freezes complete index projections", async () => {
  const {
    control,
    definition,
    sourceMetadata,
    sourceState
  } = createMetadataFixture();
  const index = resultValue(await buildStateIndex(definition, { root: "." }));
  const tenant: string = index.metadata.tenant;
  assert.equal(tenant, "tenant-a");
  assert.equal(control.validations, 1);
  assert.equal(Object.isFrozen(sourceMetadata), false);
  assert.equal(Object.isFrozen(sourceMetadata.nested), false);
  assert.equal(Object.isFrozen(sourceMetadata.groups), false);
  assert.equal(Object.isFrozen(sourceState), false);
});

test("creates an immutable in-memory reader snapshot and validates its input", async () => {
  const { control, definition } = createMetadataFixture();
  const index = resultValue(await buildStateIndex(definition, { root: "." }));
  const readerInput = structuredClone(index);
  const reader = createStateIndexReader({
    definition,
    index: readerInput,
    indexPath: "typed-metadata.json"
  });
  readerInput.metadata.tenant = "tenant-b";
  readerInput.metadata.groups.push("mutated");
  readerInput.entries[0]!.state.label = "Mutated";
  readerInput.entries.splice(0);
  readerInput.keyDefinitions.splice(0);
  assert.equal(reader.metadata.tenant, "tenant-a");
  assert.equal(
    resultValue(reader.get("tenant-a:one"))?.state.label,
    "First"
  );
  assert.equal(resultValue(reader.query()).total, 1);
  assert.equal(resultValue(reader.all()).length, 1);

  const mismatchedIndex = structuredClone(index);
  mismatchedIndex.keyDefinitions[0]!.mode = "range";
  assert.throws(
    () => createStateIndexReader({
      definition,
      index: mismatchedIndex,
      indexPath: "typed-metadata.json"
    }),
    /state-index\.definition-mismatch/u
  );
  assert.throws(
    () => createStateIndexReader({
      definition,
      index: { ...structuredClone(index), entries: null } as never,
      indexPath: "typed-metadata.json"
    }),
    /state-index\.schema-invalid/u
  );
  assert.equal(control.validations, 2);
});

test("serializes, parses, and domain-validates typed metadata", async () => {
  const { control, definition } = createMetadataFixture();
  const index = resultValue(await buildStateIndex(definition, { root: "." }));
  const text = serializeStateIndex(index, definition);
  const serializedMetadata = (
    JSON.parse(text) as { metadata: RuntimeMetadata }
  ).metadata;
  assert.deepEqual(Object.keys(serializedMetadata), [
    "groups",
    "nested",
    "tenant"
  ]);
  assert.deepEqual(Object.keys(serializedMetadata.nested), ["a", "z"]);
  assert.deepEqual(serializedMetadata.groups, ["second", "first"]);
  assert.equal(parseStateIndex({
    definition,
    expectation: { definitionVersion: 1, namespace: "typed-metadata" },
    sourcePath: "typed-metadata.json",
    text
  }).status, "ok");
  assert.equal(control.validations, 2);

  for (const mutate of [
    (value: Record<string, unknown>) => {
      delete value.metadata;
    },
    (value: Record<string, unknown>) => {
      value.metadata = [];
    },
    (value: Record<string, unknown>) => {
      value.schemaVersion = 1;
    }
  ]) {
    const invalid = JSON.parse(text) as Record<string, unknown>;
    mutate(invalid);
    const rejected = parseStateIndex({
      expectation: { definitionVersion: 1, namespace: "typed-metadata" },
      sourcePath: "typed-metadata.json",
      text: JSON.stringify(invalid)
    });
    assert.equal(rejected.status, "error");
    assert.ok(rejected.diagnostics.some((entry) => (
      entry.code === "state-index.schema-invalid"
    )));
  }

  control.rejectCompleteIndex = true;
  const rejected = parseStateIndex({
    definition,
    expectation: { definitionVersion: 1, namespace: "typed-metadata" },
    sourcePath: "typed-metadata.json",
    text
  });
  assert.equal(rejected.status, "error");
  assert.ok(rejected.diagnostics.some((entry) => (
    entry.code === "state-index.index-validation-failed"
    && entry.path === "typed-metadata.json"
  )));
});

test("freezes runtime reader metadata and avoids revalidating query overlays", async () => {
  await withTempRoot(async (tempRoot) => {
    const { control, definition, sourceMetadata } = createMetadataFixture();
    const runtime = createStateIndexRuntime({
      definition,
      indexPath: "indexes/typed-metadata.json",
      root: tempRoot
    });
    assert.equal((await runtime.sync("write")).state, "written");
    const reader = resultValue(await runtime.open());
    const tenant: string = reader.metadata.tenant;
    assert.equal(tenant, "tenant-a");
    if (false) {
      // @ts-expect-error Reader metadata objects are recursively readonly.
      reader.metadata.nested.a = 3;
      // @ts-expect-error Reader metadata arrays are recursively readonly.
      reader.metadata.groups.push("third");
    }
    const escapedMetadata = reader.metadata as unknown as RuntimeMetadata;
    assert.throws(
      () => {
        escapedMetadata.nested.a = 3;
      },
      TypeError
    );
    assert.throws(
      () => escapedMetadata.groups.push("third"),
      TypeError
    );

    sourceMetadata.nested.a = 9;
    sourceMetadata.groups.push("external");
    assert.equal(reader.metadata.nested.a, 1);
    assert.deepEqual(reader.metadata.groups, ["second", "first"]);
    const validationsBeforeQueries = control.validations;
    const queried = resultValue(reader.query());
    const queryTenant: string = queried.metadata.tenant;
    assert.equal(queryTenant, "tenant-a");
    if (false) {
      // @ts-expect-error Query metadata objects are recursively readonly.
      queried.metadata.nested.a = 3;
      // @ts-expect-error Query metadata arrays are recursively readonly.
      queried.metadata.groups.push("third");
    }
    assert.equal(queried.metadata.nested.a, 1);
    assert.deepEqual(queried.metadata.groups, ["second", "first"]);
    const overlay = resultValue(reader.query(
      {},
      { runtimeStates: [{ id: "two", label: "Second" }] }
    ));
    assert.equal(overlay.metadata.tenant, "tenant-a");
    assert.deepEqual(
      overlay.entries.map((entry) => entry.id),
      ["tenant-a:one", "tenant-a:two"]
    );
    assert.equal(control.validations, validationsBeforeQueries);
  });
});

test("opens a bound reader with one revision check for all operations", async () => {
  await withTempRoot(async (tempRoot) => {
    const { revisionReads, runtime, source } =
      await createDecisionRuntimeFixture(tempRoot);
    const reader = resultValue(await runtime.open());
    assert.equal(revisionReads.value, 1);
    assert.equal(resultValue(reader.all()).length, source.states.length);
    assert.equal(
      resultValue(reader.get("architecture/use-shared-cache.md"))?.state.title,
      "采用共享缓存策略"
    );
    assert.equal(resultValue(reader.query({
      filters: [{
        key: "status",
        kind: "exact",
        operator: "all",
        values: ["active"]
      }]
    })).total, 2);
    assert.equal(revisionReads.value, 1);
  });
});

test("queries and gets runtime states through direct operations", async () => {
  await withTempRoot(async (tempRoot) => {
    const { runtime, source } = await createDecisionRuntimeFixture(tempRoot);
    const queried = await runtime.query({
      filters: [{
        key: "status",
        kind: "exact",
        operator: "all",
        values: ["active"]
      }]
    });
    assert.equal(resultValue(queried).total, 2);
    const found = await runtime.get("architecture/use-shared-cache.md");
    const foundTitle: string | undefined = resultValue(found)?.state.title;
    assert.equal(foundTitle, "采用共享缓存策略");

    const runtimeState: DecisionState = {
      ...source.states[0]!,
      status: "archived"
    };
    const liveQuery = await runtime.query({
      filters: [{
        key: "status",
        kind: "exact",
        operator: "all",
        values: ["archived"]
      }]
    }, { runtimeStates: [runtimeState] });
    assert.deepEqual(
      resultValue(liveQuery).entries.map((entry) => entry.id),
      [runtimeState.path]
    );
  });
});

test("rejects incompatible or corrupt persisted indexes and can rebuild them", async () => {
  await withTempRoot(async (tempRoot) => {
    const { definition, runtime } = await createDecisionRuntimeFixture(tempRoot);
    const incompatibleDefinition = defineStateIndexDefinition({
      ...definition,
      keyStrategies: definition.keyStrategies.map((strategy) => (
        strategy.name === "status"
          ? { ...strategy, derive: () => "definition-changed" }
          : strategy
      ))
    });
    const incompatibleRuntime = createStateIndexRuntime({
      definition: incompatibleDefinition,
      indexPath: "indexes/decisions.json",
      root: tempRoot
    });
    const incompatible = await incompatibleRuntime.query();
    assert.equal(incompatible.status, "error");
    assert.ok(incompatible.diagnostics.some((entry) => (
      entry.code === "state-index.definition-mismatch"
    )));

    const persistedPath = path.join(tempRoot, "indexes", "decisions.json");
    const persisted = JSON.parse(
      await fs.readFile(persistedPath, "utf8")
    ) as { entries: Array<{ state: { title: unknown } }> };
    persisted.entries[0]!.state.title = 42;
    await fs.writeFile(persistedPath, `${JSON.stringify(persisted, null, 2)}\n`);
    const invalidState = await runtime.query();
    assert.equal(invalidState.status, "error");
    assert.ok(invalidState.diagnostics.some((entry) => (
      entry.code === "state-index.state-parse-failed"
      && entry.path === "indexes/decisions.json"
    )));
    assert.equal((await runtime.sync("write")).state, "written");
  });
});

test("keeps bound snapshots stable while runtime detects and refreshes staleness", async () => {
  await withTempRoot(async (tempRoot) => {
    const { runtime, source } = await createDecisionRuntimeFixture(tempRoot);
    const reader = resultValue(await runtime.open());
    source.revision = "runtime-revision-2";
    source.states[0] = {
      ...source.states[0]!,
      status: "archived"
    };
    assert.equal(
      resultValue(reader.get(source.states[0]!.path))?.state.status,
      "active"
    );
    assert.equal((await runtime.get(source.states[0]!.path)).status, "error");
    assert.equal((await runtime.sync("write")).state, "written");
    assert.equal((await runtime.get(source.states[0]!.path)).status, "ok");
  });
});
