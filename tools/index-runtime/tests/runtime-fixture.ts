/* oxlint-disable no-unused-vars -- Shared test fixture keeps the original dependency surface for focused scenario modules. */
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

export type RuntimeMetadata = {
  groups: string[];
  nested: {
    a: number;
    z: number;
  };
  tenant: string;
};

export type SpecialState = {
  domainId: string;
  label: string;
};

export async function withTempRoot(
  run: (tempRoot: string) => Promise<void>
): Promise<void> {
  const tempRoot = await fs.mkdtemp(
    path.join(os.tmpdir(), "state-index-runtime-")
  );
  try {
    await run(tempRoot);
  } finally {
    await fs.rm(tempRoot, { force: true, recursive: true });
  }
}

export function createMetadataFixture() {
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
    queryFields: [
      {
        mode: "text",
        name: "text",
        sources: [{ kind: "state-path", path: ["label"] }]
      }
    ],
    namespace: "typed-metadata",
    parseMetadata: (input) => v.parse(metadataSchema, input),
    parseState: (input, context) => {
      assert.equal(context.metadata.tenant, "tenant-a");
      assert.match(context.id, /^tenant-a:/u);
      // oxlint-disable-next-line no-constant-condition -- The unreachable block retains compile-only @ts-expect-error checks for the readonly projection context.
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
      assert.deepEqual(Object.keys(index.metadata), [
        "groups",
        "nested",
        "tenant"
      ]);
      // oxlint-disable-next-line no-constant-condition -- The unreachable block retains compile-only @ts-expect-error checks for the complete index's readonly fields.
      if (false) {
        // @ts-expect-error Complete index entries are recursively readonly.
        index.entries["tenant-a:two"] = index.entries["tenant-a:one"]!;
        // @ts-expect-error Complete index state is recursively readonly.
        index.entries["tenant-a:one"]!.label = "Mutated";
        // @ts-expect-error Complete index metadata objects are recursively readonly.
        index.metadata.nested.a = 3;
        // @ts-expect-error Complete index metadata arrays are recursively readonly.
        index.metadata.groups.push("mutated");
      }
      assert.ok(Object.isFrozen(index));
      assert.ok(Object.isFrozen(index.entries));
      assert.ok(Object.isFrozen(index.entries["tenant-a:one"]));
      assert.ok(Object.isFrozen(index.entries["tenant-a:one"]));
      assert.ok(Object.isFrozen(index.metadata));
      assert.ok(Object.isFrozen(index.metadata.nested));
      assert.ok(Object.isFrozen(index.metadata.groups));
      assert.throws(() => {
        (index.entries as Record<string, unknown>)["tenant-a:two"] = {};
      }, TypeError);
      assert.throws(() => {
        (index.entries["tenant-a:one"] as unknown as { label: string }).label =
          "Mutated";
      }, TypeError);
      assert.throws(
        () => (index.metadata.groups as unknown as string[]).push("mutated"),
        TypeError
      );
      assert.equal(index.entries["tenant-a:one"]!.label, "First");
      assert.deepEqual(index.metadata.groups, ["second", "first"]);
      if (control.rejectCompleteIndex) {
        throw new TypeError("complete index rejected");
      }
    }
  });
  return { control, definition, sourceMetadata, sourceState };
}

export async function createDecisionRuntimeFixture(tempRoot: string) {
  const source: MemoryStateSource<DecisionState> = {
    revision: "runtime-revision-1",
    states: await decisionStates()
  };
  const calls = {
    parses: 0,
    reads: 0,
    revisionReads: 0,
    validations: 0
  };
  const baseDefinition = decisionDefinition(source);
  const definition = defineStateIndexDefinition({
    ...baseDefinition,
    queryFields: baseDefinition.queryFields,
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

export async function createSpecialIdFixture() {
  const ids = ["constructor", "prototype", "__proto__"] as const;
  const states: Record<string, SpecialState> = Object.fromEntries(
    ids.map((id) => [id, { domainId: `domain:${id}`, label: id }])
  );
  const sourceRevision = {
    entries: Object.fromEntries(ids.map((id) => [id, `source:${id}`])),
    metadata: "source:metadata"
  };
  const seenContexts: string[] = [];
  const definition = defineStateIndexDefinition<SpecialState>({
    definitionVersion: 1,
    queryFields: [
      { mode: "exact", name: "source-id", sources: [{ kind: "entry-id" }] }
    ],
    namespace: "special-ids",
    parseMetadata: (metadata) => metadata,
    parseState: (input, { id }) => {
      seenContexts.push(id);
      if (
        typeof input.domainId !== "string" ||
        typeof input.label !== "string"
      ) {
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

export function recordMember(
  value: unknown,
  description: string
): Record<string, unknown> {
  if (!isPlainRecord(value)) {
    assert.fail(`${description} must be an object`);
  }
  return value;
}

export function assertOriginalRecordPathItem(
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

export function assertRecordJsonSchema(
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
