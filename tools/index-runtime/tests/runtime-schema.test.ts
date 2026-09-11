/* oxlint-disable no-unused-vars -- Split test modules retain shared fixture imports for their focused scenario files. */
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
import {
  assertOriginalRecordPathItem,
  assertRecordJsonSchema,
  createDecisionRuntimeFixture,
  createMetadataFixture,
  createSpecialIdFixture,
  recordMember,
  withTempRoot
} from "./runtime-fixture.ts";

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
    metadata: v.strictObject({}),
    namespace: "runtime-test",
    sourceRevision: sourceRevisionSchema,
    state: v.strictObject({
      id: stateIndexTextSchema
    })
  });
  const jsonSchema = toJsonSchema(schema, { target: "draft-2020-12" });
  assert.equal(jsonSchema.type, "object");
  const properties = recordMember(
    jsonSchema.properties,
    "state index properties"
  );
  assertRecordJsonSchema(properties.entries, "^(?:__proto__|constructor)$");
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
    '{"__proto__":{"id":"__proto__"},' + '"constructor":{"id":"constructor"}}'
  );
  const expectedEntries = v.parse(schema.entries.entries, entriesInput);
  const standardEntries =
    await schema.entries.entries["~standard"].validate(entriesInput);
  if (!("value" in standardEntries)) {
    assert.fail(
      standardEntries.issues.map((issue) => issue.message).join("; ")
    );
  }
  assert.deepEqual(standardEntries.value, expectedEntries);
  assert.equal(Object.hasOwn(standardEntries.value, "__proto__"), true);
  assert.equal(Object.hasOwn(standardEntries.value, "constructor"), true);
  assert.equal(v.safeParse(schema.entries.entries, []).success, false);
  assert.equal(
    v.safeParse(schema.entries.entries, {
      invalid: expectedEntries.constructor
    }).success,
    false
  );
  const invalidEntriesInput = recordMember(
    JSON.parse('{"__proto__":{"id":0}}'),
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
  assert.equal(v.getDotPath(invalidPrototypeEntry.issues[0]), "__proto__.id");
  assertOriginalRecordPathItem(
    invalidPrototypeEntry.issues[0]?.path?.[0],
    invalidEntriesInput
  );
  const standardInvalidPrototypeEntry =
    await schema.entries.entries["~standard"].validate(invalidEntriesInput);
  if (standardInvalidPrototypeEntry.issues === undefined) {
    assert.fail("Standard Schema should reject the invalid prototype entry");
  }
  const standardIssue = standardInvalidPrototypeEntry.issues[0];
  assert.equal(
    standardIssue?.path
      ?.map((item) => (typeof item === "object" ? item.key : item))
      .join("."),
    "__proto__.id"
  );
  assertOriginalRecordPathItem(standardIssue?.path?.[0], invalidEntriesInput);
  assert.equal(
    v.safeParse(schema.entries.sourceRevision.entries.entries, {
      invalid: "source:invalid"
    }).success,
    false
  );
});

test("round-trips prototype-sensitive ids through schemas and runtime", async () => {
  const { definition, ids, index, seenContexts, sourceRevision, text } =
    await createSpecialIdFixture();
  assert.deepEqual(new Set(seenContexts), new Set(ids));
  assert.equal(
    Object.prototype.hasOwnProperty.call(index.entries, "__proto__"),
    true
  );
  assert.deepEqual(Object.keys(index.entries.__proto__!), [
    "domainId",
    "label"
  ]);

  const parsed = resultValue(
    parseStateIndex({
      definition,
      expectation: { definitionVersion: 1, namespace: "special-ids" },
      sourcePath: "special-ids.json",
      text
    })
  );
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
  const standardRevisionEntries =
    await publicSourceRevisionSchema.entries.entries["~standard"].validate(
      publicRevisionInput.entries
    );
  if (!("value" in standardRevisionEntries)) {
    assert.fail(
      standardRevisionEntries.issues.map((issue) => issue.message).join("; ")
    );
  }
  assert.deepEqual(
    standardRevisionEntries.value,
    publicRevisionResult.output.entries
  );
  assert.equal(Object.hasOwn(standardRevisionEntries.value, "__proto__"), true);
  assert.equal(
    Object.hasOwn(standardRevisionEntries.value, "constructor"),
    true
  );
  const publicIndexSchema = createStateIndexSchema({
    definitionVersion: 1,
    id: stateIndexTextSchema,
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
  assert.equal(publicIndex.entries["__proto__"]?.label, "__proto__");
  assert.equal(Object.hasOwn(publicIndex.entries, "constructor"), true);
  const invalidPublicIndex = JSON.parse(text) as {
    entries: Record<string, { label: unknown }>;
  };
  invalidPublicIndex.entries["__proto__"]!.label = 0;
  assert.equal(
    v.safeParse(publicIndexSchema, invalidPublicIndex).success,
    false
  );

  const reader = createStateIndexReader({
    definition,
    index: parsed,
    indexPath: "special-ids.json"
  });
  assert.equal(resultValue(reader.get("__proto__"))?.state.label, "__proto__");
  assert.deepEqual(
    resultValue(
      reader.query({
        filters: [
          {
            key: "id",
            kind: "exact",
            operator: "any",
            values: ["constructor", "prototype", "__proto__"]
          }
        ]
      })
    ).entries.map((entry) => entry.id),
    ["__proto__", "constructor", "prototype"]
  );
});

test("rejects incompatible persisted schema versions", async () => {
  const { definition, text } = await createSpecialIdFixture();
  const schemaV3 = JSON.parse(text) as Record<string, unknown>;
  schemaV3.schemaVersion = 3;
  const unsupported = parseStateIndex({
    definition,
    expectation: { definitionVersion: 1, namespace: "special-ids" },
    sourcePath: "special-ids.json",
    text: JSON.stringify(schemaV3)
  });
  assert.equal(unsupported.status, "error");
  assert.equal(
    unsupported.diagnostics[0]?.code,
    "state-index.schema-version-unsupported"
  );
});

test("rejects invalid or incomplete source revisions", async () => {
  const { definition, text } = await createSpecialIdFixture();
  const mismatched = JSON.parse(text) as {
    sourceRevision: { entries: Record<string, string> };
  };
  Reflect.deleteProperty(mismatched.sourceRevision.entries, "constructor");
  const mismatchResult = parseStateIndex({
    definition,
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
        '{"entries":{"__proto__":0,"constructor":"source:constructor"},' +
          '"metadata":"source:metadata"}'
      )
    ).success,
    false
  );

  const invalidRevision = JSON.parse(text) as {
    sourceRevision: { metadata: string };
  };
  invalidRevision.sourceRevision.metadata = "";
  const invalidRevisionResult = parseStateIndex({
    definition,
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
