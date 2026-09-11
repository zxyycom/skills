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

test("rejects incompatible indexes and fully parses corrupt projections", async () => {
  await withTempRoot(async (tempRoot) => {
    const { definition, runtime } =
      await createDecisionRuntimeFixture(tempRoot);
    const incompatibleDefinition = defineStateIndexDefinition({
      ...definition,
      definitionVersion: definition.definitionVersion + 1,
      queryFields: definition.queryFields.map((field) =>
        field.name === "status" ? { ...field, name: "lifecycle" } : field
      )
    });
    const incompatibleRuntime = createStateIndexRuntime({
      definition: incompatibleDefinition,
      indexPath: "indexes/decisions.json",
      root: tempRoot
    });
    const incompatible = await incompatibleRuntime.query();
    assert.equal(incompatible.status, "error");
    assert.ok(
      incompatible.diagnostics.some(
        (entry) => entry.code === "state-index.definition-version-mismatch"
      )
    );

    const persistedPath = path.join(tempRoot, "indexes", "decisions.json");
    const persisted = JSON.parse(await fs.readFile(persistedPath, "utf8")) as {
      entries: Record<string, { title: unknown }>;
    };
    persisted.entries["architecture/use-shared-cache.md"]!.title = 42;
    await fs.writeFile(
      persistedPath,
      `${JSON.stringify(persisted, null, 2)}\n`
    );
    const invalidState = parseStateIndex({
      definition,
      expectation: { definitionVersion: 1, namespace: "decisions" },
      sourcePath: "indexes/decisions.json",
      text: await fs.readFile(persistedPath, "utf8")
    });
    assert.equal(invalidState.status, "error");
    assert.ok(
      invalidState.diagnostics.some(
        (entry) =>
          entry.code === "state-index.state-parse-failed" &&
          entry.path === "indexes/decisions.json"
      )
    );
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
