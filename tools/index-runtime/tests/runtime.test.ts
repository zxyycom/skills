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
  createStateSourceRevisionSchema,
  defineStateIndexDefinition,
  parseStateIndex,
  serializeStateIndex,
  stateIndexTextSchema
} from "../src/index.ts";
import { isPlainRecord } from "../src/record.ts";
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

type SpecialState = {
  domainId: string;
  label: string;
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
  const sourceRevision = {
    entries: { "tenant-a:one": "typed-state-revision-1" },
    metadata: "typed-metadata-revision-1"
  };
  const definition = defineStateIndexDefinition<
    { id: string; label: string },
    RuntimeMetadata
  >({
    definitionVersion: 1,
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
      assert.match(context.id, /^tenant-a:/u);
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
      sourceRevision,
      states: { "tenant-a:one": sourceState }
    }),
    readRevision: async () => sourceRevision,
    validateIndex: (index) => {
      control.validations += 1;
      assert.deepEqual(Object.keys(index.entries), ["tenant-a:one"]);
      assert.deepEqual(Object.keys(index.metadata), ["groups", "nested", "tenant"]);
      if (false) {
        // @ts-expect-error Complete index entries are recursively readonly.
        index.entries["tenant-a:two"] = index.entries["tenant-a:one"]!;
        // @ts-expect-error Complete index state is recursively readonly.
        index.entries["tenant-a:one"]!.state.label = "Mutated";
        // @ts-expect-error Complete index key arrays are recursively readonly.
        index.entries["tenant-a:one"]!.keys.text!.push("mutated");
        // @ts-expect-error Complete index metadata objects are recursively readonly.
        index.metadata.nested.a = 3;
        // @ts-expect-error Complete index metadata arrays are recursively readonly.
        index.metadata.groups.push("mutated");
      }
      assert.ok(Object.isFrozen(index));
      assert.ok(Object.isFrozen(index.entries));
      assert.ok(Object.isFrozen(index.entries["tenant-a:one"]));
      assert.ok(Object.isFrozen(index.entries["tenant-a:one"]!.state));
      assert.ok(Object.isFrozen(index.entries["tenant-a:one"]!.keys.text));
      assert.ok(Object.isFrozen(index.metadata));
      assert.ok(Object.isFrozen(index.metadata.nested));
      assert.ok(Object.isFrozen(index.metadata.groups));
      assert.throws(
        () => {
          (index.entries as Record<string, unknown>)["tenant-a:two"] = {};
        },
        TypeError
      );
      assert.throws(
        () => {
          (index.entries["tenant-a:one"]!.state as unknown as { label: string }).label =
            "Mutated";
        },
        TypeError
      );
      assert.throws(
        () => (index.metadata.groups as unknown as string[]).push("mutated"),
        TypeError
      );
      assert.equal(index.entries["tenant-a:one"]!.state.label, "First");
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
  const calls = {
    derives: 0,
    parses: 0,
    reads: 0,
    revisionReads: 0,
    validations: 0
  };
  const baseDefinition = decisionDefinition(source);
  const definition = defineStateIndexDefinition({
    ...baseDefinition,
    keyStrategies: baseDefinition.keyStrategies.map((strategy) => ({
      ...strategy,
      derive: (...args: Parameters<typeof strategy.derive>) => {
        calls.derives += 1;
        return strategy.derive(...args);
      }
    })),
    parseState: (...args: Parameters<typeof baseDefinition.parseState>) => {
      calls.parses += 1;
      return baseDefinition.parseState(...args);
    },
    read: async (context) => {
      calls.reads += 1;
      return await baseDefinition.read(context);
    },
    readRevision: async (context) => {
      calls.revisionReads += 1;
      return await baseDefinition.readRevision(context);
    },
    validateIndex: () => {
      calls.validations += 1;
    }
  });
  const runtime = createStateIndexRuntime({
    definition,
    indexPath: "indexes/decisions.json",
    root: tempRoot
  });
  assert.equal((await runtime.sync("write")).state, "written");
  for (const key of Object.keys(calls) as Array<keyof typeof calls>) {
    calls[key] = 0;
  }
  return { calls, definition, runtime, source };
}

async function createSpecialIdFixture() {
  const ids = ["constructor", "prototype", "__proto__"] as const;
  const states: Record<string, SpecialState> = Object.fromEntries(ids.map((id) => [
    id,
    { domainId: `domain:${id}`, label: id }
  ]));
  const sourceRevision = {
    entries: Object.fromEntries(ids.map((id) => [id, `source:${id}`])),
    metadata: "source:metadata"
  };
  const seenContexts: string[] = [];
  const definition = defineStateIndexDefinition<SpecialState>({
    definitionVersion: 1,
    keyStrategies: [{
      derive: (_state, { id }) => id,
      mode: "exact",
      name: "source-id"
    }],
    namespace: "special-ids",
    parseMetadata: (metadata) => metadata,
    parseState: (input, { id }) => {
      seenContexts.push(id);
      if (typeof input.domainId !== "string" || typeof input.label !== "string") {
        throw new TypeError("invalid special state");
      }
      return { domainId: input.domainId, label: input.label };
    },
    read: async () => ({ metadata: {}, sourceRevision, states }),
    readRevision: async () => sourceRevision
  });
  const index = resultValue(await buildStateIndex(definition, { root: "." }));
  return {
    definition,
    ids,
    index,
    seenContexts,
    sourceRevision,
    text: serializeStateIndex(index, definition)
  };
}

test("exposes a composable state-index schema", async () => {
  const idSchema = v.pipe(
    v.string(),
    v.regex(/^(?:__proto__|constructor)$/, "must be a runtime test id")
  );
  const sourceRevisionSchema = createStateSourceRevisionSchema({
    fingerprint: stateIndexTextSchema,
    id: idSchema
  });
  const schema = createStateIndexSchema({
    definitionVersion: 1,
    id: idSchema,
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
    sourceRevision: sourceRevisionSchema,
    state: v.strictObject({
      id: stateIndexTextSchema
    })
  });
  const jsonSchema = toJsonSchema(schema, { target: "draft-2020-12" });
  assert.equal(jsonSchema.type, "object");
  const properties = recordMember(jsonSchema.properties, "state index properties");
  assertRecordJsonSchema(
    properties.entries,
    "^(?:__proto__|constructor)$"
  );
  const revisionJsonSchema = toJsonSchema(sourceRevisionSchema, {
    target: "draft-2020-12"
  });
  const revisionProperties = recordMember(
    revisionJsonSchema.properties,
    "source revision properties"
  );
  assertRecordJsonSchema(
    revisionProperties.entries,
    "^(?:__proto__|constructor)$"
  );

  const entriesInput = JSON.parse(
    '{"__proto__":{"keys":{"status":["active"]},'
    + '"state":{"id":"__proto__"}},'
    + '"constructor":{"keys":{"status":["active"]},'
    + '"state":{"id":"constructor"}}}'
  );
  const expectedEntries = v.parse(schema.entries.entries, entriesInput);
  const standardEntries = await schema.entries.entries["~standard"]
    .validate(entriesInput);
  if (!("value" in standardEntries)) {
    assert.fail(standardEntries.issues.map((issue) => issue.message).join("; "));
  }
  assert.deepEqual(standardEntries.value, expectedEntries);
  assert.equal(Object.hasOwn(standardEntries.value, "__proto__"), true);
  assert.equal(Object.hasOwn(standardEntries.value, "constructor"), true);
  assert.equal(v.safeParse(schema.entries.entries, []).success, false);
  assert.equal(
    v.safeParse(schema.entries.entries, { invalid: expectedEntries.constructor })
      .success,
    false
  );
  const invalidEntriesInput = recordMember(
    JSON.parse(
      '{"__proto__":{"keys":{"status":["active"]},'
      + '"state":{"id":0}}}'
    ),
    "invalid entries input"
  );
  const invalidPrototypeEntry = v.safeParse(
    schema.entries.entries,
    invalidEntriesInput
  );
  assert.equal(invalidPrototypeEntry.success, false);
  if (invalidPrototypeEntry.success) {
    assert.fail("prototype-sensitive entry should fail state validation");
  }
  assert.equal(
    v.getDotPath(invalidPrototypeEntry.issues[0]),
    "__proto__.state.id"
  );
  assertOriginalRecordPathItem(
    invalidPrototypeEntry.issues[0]?.path?.[0],
    invalidEntriesInput
  );
  const standardInvalidPrototypeEntry = await schema.entries.entries["~standard"]
    .validate(invalidEntriesInput);
  if (standardInvalidPrototypeEntry.issues === undefined) {
    assert.fail("Standard Schema should reject the invalid prototype entry");
  }
  const standardIssue = standardInvalidPrototypeEntry.issues[0];
  assert.equal(
    standardIssue?.path?.map((item) => (
      typeof item === "object" ? item.key : item
    )).join("."),
    "__proto__.state.id"
  );
  assertOriginalRecordPathItem(
    standardIssue?.path?.[0],
    invalidEntriesInput
  );
  assert.equal(
    v.safeParse(
      schema.entries.sourceRevision.entries.entries,
      { invalid: "source:invalid" }
    ).success,
    false
  );
});

test("round-trips prototype-sensitive ids through schemas and runtime", async () => {
  const {
    definition,
    ids,
    index,
    seenContexts,
    sourceRevision,
    text
  } = await createSpecialIdFixture();
  assert.deepEqual(new Set(seenContexts), new Set(ids));
  assert.equal(Object.prototype.hasOwnProperty.call(index.entries, "__proto__"), true);
  assert.deepEqual(Object.keys(index.entries.__proto__!), ["keys", "state"]);

  const parsed = resultValue(parseStateIndex({
    definition,
    expectation: { definitionVersion: 1, namespace: "special-ids" },
    sourcePath: "special-ids.json",
    text
  }));
  const publicSourceRevisionSchema = createStateSourceRevisionSchema({
    fingerprint: stateIndexTextSchema,
    id: stateIndexTextSchema
  });
  const publicRevisionInput = JSON.parse(JSON.stringify(sourceRevision));
  const publicRevisionResult = v.safeParse(
    publicSourceRevisionSchema,
    publicRevisionInput
  );
  assert.equal(publicRevisionResult.success, true);
  assert.equal(
    Object.hasOwn(publicRevisionResult.output.entries, "__proto__"),
    true
  );
  assert.equal(
    publicRevisionResult.output.entries["__proto__"],
    "source:__proto__"
  );
  assert.equal(
    Object.hasOwn(publicRevisionResult.output.entries, "constructor"),
    true
  );
  const standardRevisionEntries = await publicSourceRevisionSchema.entries
    .entries["~standard"].validate(publicRevisionInput.entries);
  if (!("value" in standardRevisionEntries)) {
    assert.fail(
      standardRevisionEntries.issues.map((issue) => issue.message).join("; ")
    );
  }
  assert.deepEqual(
    standardRevisionEntries.value,
    publicRevisionResult.output.entries
  );
  assert.equal(
    Object.hasOwn(standardRevisionEntries.value, "__proto__"),
    true
  );
  assert.equal(
    Object.hasOwn(standardRevisionEntries.value, "constructor"),
    true
  );
  const publicIndexSchema = createStateIndexSchema({
    definitionVersion: 1,
    id: stateIndexTextSchema,
    keys: v.strictObject({
      "source-id": v.tuple([stateIndexTextSchema])
    }),
    keyDefinitions: v.tuple([v.strictObject({
      mode: v.literal("exact"),
      name: v.literal("source-id")
    })]),
    metadata: v.strictObject({}),
    namespace: "special-ids",
    sourceRevision: publicSourceRevisionSchema,
    state: v.strictObject({
      domainId: stateIndexTextSchema,
      label: stateIndexTextSchema
    })
  });
  const publicIndex = v.parse(publicIndexSchema, JSON.parse(text));
  assert.equal(Object.hasOwn(publicIndex.entries, "__proto__"), true);
  assert.equal(publicIndex.entries["__proto__"]?.state.label, "__proto__");
  assert.equal(Object.hasOwn(publicIndex.entries, "constructor"), true);
  const invalidPublicIndex = JSON.parse(text) as {
    entries: Record<string, { state: { label: unknown } }>;
  };
  invalidPublicIndex.entries["__proto__"]!.state.label = 0;
  assert.equal(v.safeParse(publicIndexSchema, invalidPublicIndex).success, false);

  const reader = createStateIndexReader({
    definition,
    index: parsed,
    indexPath: "special-ids.json"
  });
  assert.equal(resultValue(reader.get("__proto__"))?.state.label, "__proto__");
  assert.deepEqual(
    resultValue(reader.query({
      filters: [{
        key: "id",
        kind: "exact",
        operator: "any",
        values: ["constructor", "prototype", "__proto__"]
      }]
    })).entries.map((entry) => entry.id),
    ["__proto__", "constructor", "prototype"]
  );
});

test("rejects incompatible persisted schema versions", async () => {
  const { text } = await createSpecialIdFixture();
  const schemaV2 = JSON.parse(text) as Record<string, unknown>;
  schemaV2.schemaVersion = 2;
  const unsupported = parseStateIndex({
    expectation: { definitionVersion: 1, namespace: "special-ids" },
    sourcePath: "special-ids.json",
    text: JSON.stringify(schemaV2)
  });
  assert.equal(unsupported.status, "error");
  assert.equal(
    unsupported.diagnostics[0]?.code,
    "state-index.schema-version-unsupported"
  );
});

test("rejects invalid or incomplete source revisions", async () => {
  const { text } = await createSpecialIdFixture();
  const mismatched = JSON.parse(text) as {
    sourceRevision: { entries: Record<string, string> };
  };
  Reflect.deleteProperty(mismatched.sourceRevision.entries, "constructor");
  const mismatchResult = parseStateIndex({
    expectation: { definitionVersion: 1, namespace: "special-ids" },
    sourcePath: "special-ids.json",
    text: JSON.stringify(mismatched)
  });
  assert.equal(mismatchResult.status, "error");
  assert.equal(
    mismatchResult.diagnostics[0]?.code,
    "state-index.source-revision-members-mismatch"
  );

  const publicSourceRevisionSchema = createStateSourceRevisionSchema({
    fingerprint: stateIndexTextSchema,
    id: stateIndexTextSchema
  });
  assert.equal(
    v.safeParse(
      publicSourceRevisionSchema,
      JSON.parse(
        '{"entries":{"__proto__":0,"constructor":"source:constructor"},'
        + '"metadata":"source:metadata"}'
      )
    ).success,
    false
  );

  const invalidRevision = JSON.parse(text) as {
    sourceRevision: { metadata: string };
  };
  invalidRevision.sourceRevision.metadata = "";
  const invalidRevisionResult = parseStateIndex({
    expectation: { definitionVersion: 1, namespace: "special-ids" },
    sourcePath: "special-ids.json",
    text: JSON.stringify(invalidRevision)
  });
  assert.equal(invalidRevisionResult.status, "error");
  assert.equal(
    invalidRevisionResult.diagnostics[0]?.code,
    "state-index.source-revision-invalid"
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
  readerInput.entries["tenant-a:one"]!.state.label = "Mutated";
  Reflect.deleteProperty(readerInput.entries, "tenant-a:one");
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
      || entry.code === "state-index.schema-version-unsupported"
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
      { runtimeStates: { "tenant-a:two": { id: "two", label: "Second" } } }
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
    const { calls, runtime, source } =
      await createDecisionRuntimeFixture(tempRoot);
    const reader = resultValue(await runtime.open());
    assert.deepEqual(calls, {
      derives: 0,
      parses: 0,
      reads: 0,
      revisionReads: 1,
      validations: 0
    });
    assert.equal(resultValue(reader.all()).length, source.states.length);
    assert.equal(
      resultValue(reader.get("architecture/use-shared-cache.md"))?.state.title,
      "采用共享缓存策略"
    );
    const invalidGet = reader.get(" invalid ");
    assert.equal(invalidGet.status, "error");
    assert.equal(invalidGet.diagnostics[0]?.code, "state-index.query-invalid");
    assert.equal(resultValue(reader.query({
      filters: [{
        key: "status",
        kind: "exact",
        operator: "all",
        values: ["active"]
      }]
    })).total, 2);
    assert.deepEqual(calls, {
      derives: 0,
      parses: 0,
      reads: 0,
      revisionReads: 1,
      validations: 0
    });
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
    }, { runtimeStates: { [runtimeState.path]: runtimeState } });
    assert.deepEqual(
      resultValue(liveQuery).entries.map((entry) => entry.id),
      [runtimeState.path]
    );
  });
});

test("rejects incompatible indexes and fully parses corrupt projections", async () => {
  await withTempRoot(async (tempRoot) => {
    const { definition, runtime } = await createDecisionRuntimeFixture(tempRoot);
    const incompatibleDefinition = defineStateIndexDefinition({
      ...definition,
      keyStrategies: definition.keyStrategies.map((strategy) => (
        strategy.name === "status"
          ? { ...strategy, name: "lifecycle" }
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
    ) as { entries: Record<string, { state: { title: unknown } }> };
    persisted.entries["architecture/use-shared-cache.md"]!.state.title = 42;
    await fs.writeFile(persistedPath, `${JSON.stringify(persisted, null, 2)}\n`);
    const invalidState = parseStateIndex({
      definition,
      expectation: { definitionVersion: 1, namespace: "decisions" },
      sourcePath: "indexes/decisions.json",
      text: await fs.readFile(persistedPath, "utf8")
    });
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

function recordMember(
  value: unknown,
  description: string
): Record<string, unknown> {
  if (!isPlainRecord(value)) {
    assert.fail(`${description} must be an object`);
  }
  return value;
}

function assertOriginalRecordPathItem(
  value: unknown,
  originalRecord: Record<string, unknown>
): void {
  const pathItem = recordMember(value, "record issue path item");
  assert.equal(pathItem.key, "__proto__");
  const input = recordMember(pathItem.input, "record issue path input");
  assert.strictEqual(input, originalRecord);
  assert.equal(Object.hasOwn(input, "__proto__"), true);
  assert.equal(Object.hasOwn(input, ":__proto__"), false);
  assert.strictEqual(pathItem.value, originalRecord["__proto__"]);
}

function assertRecordJsonSchema(
  value: unknown,
  expectedPropertyNamePattern: string
): void {
  const schema = recordMember(value, "record JSON Schema");
  assert.equal(schema.type, "object");
  const propertyNames = recordMember(
    schema.propertyNames,
    "record propertyNames schema"
  );
  assert.equal(propertyNames.type, "string");
  assert.equal(propertyNames.pattern, expectedPropertyNamePattern);
  recordMember(
    schema.additionalProperties,
    "record additionalProperties schema"
  );
}
