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
  withTempRoot,
  type RuntimeMetadata
} from "./runtime-fixture.ts";

test("builds typed metadata and freezes complete index projections", async () => {
  const { control, definition, sourceMetadata, sourceState } =
    createMetadataFixture();
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
  readerInput.entries["tenant-a:one"]!.label = "Mutated";
  Reflect.deleteProperty(readerInput.entries, "tenant-a:one");
  assert.equal(reader.metadata.tenant, "tenant-a");
  const entry = resultValue(reader.get("tenant-a:one"));
  assert.deepEqual(Object.keys(entry ?? {}), ["id", "state"]);
  assert.equal(entry?.state.label, "First");
  assert.equal(resultValue(reader.query()).total, 1);
  assert.equal(resultValue(reader.all()).length, 1);

  const mismatchedIndex = structuredClone(index);
  mismatchedIndex.definitionVersion += 1;
  assert.throws(
    () =>
      createStateIndexReader({
        definition,
        index: mismatchedIndex,
        indexPath: "typed-metadata.json"
      }),
    /state-index\.definition-version-mismatch/u
  );
  assert.throws(
    () =>
      createStateIndexReader({
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
  const serializedMetadata = (JSON.parse(text) as { metadata: RuntimeMetadata })
    .metadata;
  assert.deepEqual(Object.keys(serializedMetadata), [
    "groups",
    "nested",
    "tenant"
  ]);
  assert.deepEqual(Object.keys(serializedMetadata.nested), ["a", "z"]);
  assert.deepEqual(serializedMetadata.groups, ["second", "first"]);
  assert.equal(
    parseStateIndex({
      definition,
      expectation: { definitionVersion: 1, namespace: "typed-metadata" },
      sourcePath: "typed-metadata.json",
      text
    }).status,
    "ok"
  );
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
      definition,
      expectation: { definitionVersion: 1, namespace: "typed-metadata" },
      sourcePath: "typed-metadata.json",
      text: JSON.stringify(invalid)
    });
    assert.equal(rejected.status, "error");
    assert.ok(
      rejected.diagnostics.some(
        (entry) =>
          entry.code === "state-index.schema-invalid" ||
          entry.code === "state-index.schema-version-unsupported"
      )
    );
  }

  control.rejectCompleteIndex = true;
  const rejected = parseStateIndex({
    definition,
    expectation: { definitionVersion: 1, namespace: "typed-metadata" },
    sourcePath: "typed-metadata.json",
    text
  });
  assert.equal(rejected.status, "error");
  assert.ok(
    rejected.diagnostics.some(
      (entry) =>
        entry.code === "state-index.index-validation-failed" &&
        entry.path === "typed-metadata.json"
    )
  );
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
    // oxlint-disable-next-line no-constant-condition -- The unreachable block retains compile-only @ts-expect-error checks for readonly reader metadata.
    if (false) {
      // @ts-expect-error Reader metadata objects are recursively readonly.
      reader.metadata.nested.a = 3;
      // @ts-expect-error Reader metadata arrays are recursively readonly.
      reader.metadata.groups.push("third");
    }
    const escapedMetadata = reader.metadata as unknown as RuntimeMetadata;
    assert.throws(() => {
      escapedMetadata.nested.a = 3;
    }, TypeError);
    assert.throws(() => escapedMetadata.groups.push("third"), TypeError);

    sourceMetadata.nested.a = 9;
    sourceMetadata.groups.push("external");
    assert.equal(reader.metadata.nested.a, 1);
    assert.deepEqual(reader.metadata.groups, ["second", "first"]);
    const validationsBeforeQueries = control.validations;
    const queried = resultValue(reader.query());
    const queryTenant: string = queried.metadata.tenant;
    assert.equal(queryTenant, "tenant-a");
    // oxlint-disable-next-line no-constant-condition -- The unreachable block retains compile-only @ts-expect-error checks for readonly query metadata.
    if (false) {
      // @ts-expect-error Query metadata objects are recursively readonly.
      queried.metadata.nested.a = 3;
      // @ts-expect-error Query metadata arrays are recursively readonly.
      queried.metadata.groups.push("third");
    }
    assert.equal(queried.metadata.nested.a, 1);
    assert.deepEqual(queried.metadata.groups, ["second", "first"]);
    const overlay = resultValue(
      reader.query(
        {},
        { runtimeStates: { "tenant-a:two": { id: "two", label: "Second" } } }
      )
    );
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
      parses: 2,
      reads: 0,
      revisionReads: 1,
      validations: 1
    });
    assert.equal(resultValue(reader.all()).length, source.states.length);
    assert.equal(
      resultValue(reader.get("architecture/use-shared-cache.md"))?.state.title,
      "采用共享缓存策略"
    );
    const invalidGet = reader.get(" invalid ");
    assert.equal(invalidGet.status, "error");
    assert.equal(invalidGet.diagnostics[0]?.code, "state-index.query-invalid");
    assert.equal(
      resultValue(
        reader.query({
          filters: [
            {
              key: "status",
              kind: "exact",
              operator: "all",
              values: ["active"]
            }
          ]
        })
      ).total,
      2
    );
    assert.deepEqual(calls, {
      parses: 2,
      reads: 0,
      revisionReads: 1,
      validations: 1
    });
  });
});

test("queries and gets runtime states through direct operations", async () => {
  await withTempRoot(async (tempRoot) => {
    const { runtime, source } = await createDecisionRuntimeFixture(tempRoot);
    const queried = await runtime.query({
      filters: [
        {
          key: "status",
          kind: "exact",
          operator: "all",
          values: ["active"]
        }
      ]
    });
    assert.equal(resultValue(queried).total, 2);
    const found = await runtime.get("architecture/use-shared-cache.md");
    const foundTitle: string | undefined = resultValue(found)?.state.title;
    assert.equal(foundTitle, "采用共享缓存策略");

    const runtimeState: DecisionState = {
      ...source.states[0]!,
      status: "archived"
    };
    const liveQuery = await runtime.query(
      {
        filters: [
          {
            key: "status",
            kind: "exact",
            operator: "all",
            values: ["archived"]
          }
        ]
      },
      { runtimeStates: { [runtimeState.path]: runtimeState } }
    );
    assert.deepEqual(
      resultValue(liveQuery).entries.map((entry) => entry.id),
      [runtimeState.path]
    );
  });
});
