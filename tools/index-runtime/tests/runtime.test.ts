import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { toJsonSchema } from "@valibot/to-json-schema";
import * as v from "valibot";
import {
  buildStateIndex,
  createStateIndexSchema,
  createStateIndexRuntime,
  defineStateIndexDefinition,
  parseStateIndex,
  serializeStateIndex,
  type JsonObject,
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

export async function testRuntime(): Promise<void> {
  const composableIndexSchema = createStateIndexSchema({
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
    toJsonSchema(composableIndexSchema, { target: "draft-2020-12" }).type,
    "object"
  );

  const runtimeMetadataSchema = v.strictObject({
    groups: v.array(v.string()),
    nested: v.strictObject({
      a: v.number(),
      z: v.number()
    }),
    tenant: v.string()
  });
  const runtimeMetadataStateSchema = v.strictObject({
    id: v.string(),
    label: v.string()
  });
  const sourceMetadata: RuntimeMetadata = {
    tenant: "tenant-a",
    nested: { z: 2, a: 1 },
    groups: ["second", "first"]
  };
  const sourceMetadataState = { id: "one", label: "First" };
  let rejectCompleteIndex = false;
  let completeIndexValidations = 0;
  const metadataDefinition = defineStateIndexDefinition({
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
    parseMetadata: (input) => v.parse(runtimeMetadataSchema, input),
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
      return v.parse(runtimeMetadataStateSchema, input);
    },
    read: async () => ({
      metadata: sourceMetadata,
      revision: "typed-metadata-revision-1",
      states: [sourceMetadataState]
    }),
    readRevision: async () => "typed-metadata-revision-1",
    validateIndex: (index) => {
      completeIndexValidations += 1;
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
      if (rejectCompleteIndex) {
        throw new TypeError("complete index rejected");
      }
    }
  });
  const metadataIndex = resultValue(await buildStateIndex(
    metadataDefinition,
    { root: "." }
  ));
  const typedTenant: string = metadataIndex.metadata.tenant;
  assert.equal(typedTenant, "tenant-a");
  assert.equal(Object.isFrozen(sourceMetadata), false);
  assert.equal(Object.isFrozen(sourceMetadata.nested), false);
  assert.equal(Object.isFrozen(sourceMetadata.groups), false);
  assert.equal(Object.isFrozen(sourceMetadataState), false);
  assert.equal(completeIndexValidations, 1);
  const metadataText = serializeStateIndex(metadataIndex, metadataDefinition);
  const serializedMetadata = (
    JSON.parse(metadataText) as { metadata: RuntimeMetadata }
  ).metadata;
  assert.deepEqual(Object.keys(serializedMetadata), [
    "groups",
    "nested",
    "tenant"
  ]);
  assert.deepEqual(Object.keys(serializedMetadata.nested), ["a", "z"]);
  assert.deepEqual(serializedMetadata.groups, ["second", "first"]);
  assert.equal(parseStateIndex({
    definition: metadataDefinition,
    expectation: { definitionVersion: 1, namespace: "typed-metadata" },
    sourcePath: "typed-metadata.json",
    text: metadataText
  }).status, "ok");
  assert.equal(completeIndexValidations, 2);

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
    const invalid = JSON.parse(metadataText) as Record<string, unknown>;
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

  rejectCompleteIndex = true;
  const rejectedCompleteIndex = parseStateIndex({
    definition: metadataDefinition,
    expectation: { definitionVersion: 1, namespace: "typed-metadata" },
    sourcePath: "typed-metadata.json",
    text: metadataText
  });
  assert.equal(rejectedCompleteIndex.status, "error");
  assert.ok(rejectedCompleteIndex.diagnostics.some((entry) => (
    entry.code === "state-index.index-validation-failed"
    && entry.path === "typed-metadata.json"
  )));
  rejectCompleteIndex = false;

  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "state-index-runtime-"));
  try {
    const metadataRuntime = createStateIndexRuntime({
      definition: metadataDefinition,
      indexPath: "indexes/typed-metadata.json",
      root: tempRoot
    });
    assert.equal((await metadataRuntime.sync("write")).state, "written");
    const metadataReader = resultValue(await metadataRuntime.open());
    const readerTenant: string = metadataReader.metadata.tenant;
    assert.equal(readerTenant, "tenant-a");
    if (false) {
      // @ts-expect-error Reader metadata objects are recursively readonly.
      metadataReader.metadata.nested.a = 3;
      // @ts-expect-error Reader metadata arrays are recursively readonly.
      metadataReader.metadata.groups.push("third");
    }
    const escapedReaderMetadata = metadataReader.metadata as unknown as RuntimeMetadata;
    assert.throws(
      () => {
        escapedReaderMetadata.nested.a = 3;
      },
      TypeError
    );
    assert.throws(
      () => escapedReaderMetadata.groups.push("third"),
      TypeError
    );
    sourceMetadata.nested.a = 9;
    sourceMetadata.groups.push("external");
    assert.equal(metadataReader.metadata.nested.a, 1);
    assert.deepEqual(metadataReader.metadata.groups, ["second", "first"]);
    const validationsBeforeReaderQueries = completeIndexValidations;
    const metadataReaderQuery = resultValue(metadataReader.query());
    const queryTenant: string = metadataReaderQuery.metadata.tenant;
    assert.equal(queryTenant, "tenant-a");
    if (false) {
      // @ts-expect-error Query metadata objects are recursively readonly.
      metadataReaderQuery.metadata.nested.a = 3;
      // @ts-expect-error Query metadata arrays are recursively readonly.
      metadataReaderQuery.metadata.groups.push("third");
    }
    assert.equal(metadataReaderQuery.metadata.nested.a, 1);
    assert.deepEqual(metadataReaderQuery.metadata.groups, ["second", "first"]);
    const metadataOverlayQuery = resultValue(metadataReader.query(
      {},
      { runtimeStates: [{ id: "two", label: "Second" }] }
    ));
    assert.equal(metadataOverlayQuery.metadata.tenant, "tenant-a");
    assert.deepEqual(
      metadataOverlayQuery.entries.map((entry) => entry.id),
      ["tenant-a:one", "tenant-a:two"]
    );
    assert.equal(completeIndexValidations, validationsBeforeReaderQueries);
    const metadataRuntimeQuery = resultValue(await metadataRuntime.query());
    const runtimeQueryTenant: string = metadataRuntimeQuery.metadata.tenant;
    assert.equal(runtimeQueryTenant, "tenant-a");

    const source: MemoryStateSource<DecisionState> = {
      revision: "runtime-revision-1",
      states: await decisionStates()
    };
    let revisionReads = 0;
    const baseDefinition = decisionDefinition(source);
    const definition = defineStateIndexDefinition({
      ...baseDefinition,
      readRevision: async (context) => {
        revisionReads += 1;
        return await baseDefinition.readRevision(context);
      }
    });
    const runtime = createStateIndexRuntime({
      definition,
      indexPath: "indexes/decisions.json",
      root: tempRoot
    });
    assert.equal((await runtime.sync("write")).state, "written");
    revisionReads = 0;

    const opened = await runtime.open();
    const reader = resultValue(opened);
    assert.equal(revisionReads, 1);
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
    assert.equal(revisionReads, 1);

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
    const incompatibleProjection = await incompatibleRuntime.query();
    assert.equal(incompatibleProjection.status, "error");
    assert.ok(incompatibleProjection.diagnostics.some((entry) => (
      entry.code === "state-index.definition-mismatch"
    )));

    const persistedPath = path.join(tempRoot, "indexes", "decisions.json");
    const persisted = JSON.parse(
      await fs.readFile(persistedPath, "utf8")
    ) as { entries: Array<{ state: { title: unknown } }> };
    persisted.entries[0]!.state.title = 42;
    await fs.writeFile(persistedPath, `${JSON.stringify(persisted, null, 2)}\n`);
    const invalidPersistedState = await runtime.query();
    assert.equal(invalidPersistedState.status, "error");
    assert.ok(invalidPersistedState.diagnostics.some((entry) => (
      entry.code === "state-index.state-parse-failed"
      && entry.path === "indexes/decisions.json"
    )));
    assert.equal((await runtime.sync("write")).state, "written");

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

    const duplicateIdDefinition = defineStateIndexDefinition({
      definitionVersion: 1,
      identify: () => "same-id",
      keyStrategies: [{ derive: () => "active", mode: "exact", name: "status" }],
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
    const duplicateId = await buildStateIndex(duplicateIdDefinition, { root: tempRoot });
    assert.equal(duplicateId.status, "error");
    assert.ok(duplicateId.diagnostics.some((entry) => (
      entry.code === "state-index.id-duplicate"
    )));

    const invalidStateDefinition = defineStateIndexDefinition<JsonObject>({
      definitionVersion: 1,
      identify: () => "invalid",
      keyStrategies: [{ derive: () => "active", mode: "exact", name: "status" }],
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
    const invalidState = await buildStateIndex(invalidStateDefinition, { root: tempRoot });
    assert.equal(invalidState.status, "error");
    assert.ok(invalidState.diagnostics.some((entry) => (
      entry.code === "state-index.state-invalid"
    )));

    const invalidParserOutput = defineStateIndexDefinition<JsonObject>({
      definitionVersion: 1,
      identify: () => "invalid-parser-output",
      keyStrategies: [{ derive: () => "active", mode: "exact", name: "status" }],
      namespace: "invalid-parser-output",
      parseMetadata: (metadata) => metadata,
      parseState: () => new Date() as never,
      read: async () => ({ metadata: {}, revision: "one", states: [{}] }),
      readRevision: async () => "one"
    });
    const invalidParsedState = await buildStateIndex(invalidParserOutput, {
      root: tempRoot
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
      { root: tempRoot }
    );
    assert.equal(invalidParsedMetadata.status, "error");
    assert.ok(invalidParsedMetadata.diagnostics.some((entry) => (
      entry.code === "state-index.metadata-parse-invalid"
    )));

    const invalidTextKey = defineStateIndexDefinition({
      definitionVersion: 1,
      identify: () => "invalid-key",
      keyStrategies: [{ derive: () => true, mode: "text", name: "text" }],
      namespace: "invalid-text-key",
      parseMetadata: (metadata) => metadata,
      parseState: (state) => state,
      read: async () => ({ metadata: {}, revision: "one", states: [{}] }),
      readRevision: async () => "one"
    });
    const invalidKey = await buildStateIndex(invalidTextKey, { root: tempRoot });
    assert.equal(invalidKey.status, "error");
    assert.ok(invalidKey.diagnostics.some((entry) => (
      entry.code === "state-index.key-value-invalid"
    )));

    const malformedRead = defineStateIndexDefinition({
      definitionVersion: 1,
      identify: () => "state",
      keyStrategies: [{ derive: () => "active", mode: "exact", name: "status" }],
      namespace: "malformed-read",
      parseMetadata: (metadata) => metadata,
      parseState: (state) => state,
      read: async () => null as never,
      readRevision: async () => "one"
    });
    assert.equal(
      (await buildStateIndex(malformedRead, { root: tempRoot })).status,
      "error"
    );

    const controller = new AbortController();
    controller.abort();
    const aborted = await buildStateIndex(definition, {
      root: tempRoot,
      signal: controller.signal
    });
    assert.equal(aborted.status, "error");
    assert.ok(aborted.diagnostics.some((entry) => (
      entry.code === "state-index.operation-aborted"
    )));
  } finally {
    await fs.rm(tempRoot, { force: true, recursive: true });
  }
}
