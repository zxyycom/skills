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

test("selected sync proves the complete projection before publishing it", async () => {
  await withTempRoot(async (tempRoot) => {
    const source: {
      metadataRevision: string;
      revisions: Record<string, string>;
      states: Record<string, { label: string }>;
    } = {
      metadataRevision: "metadata-1",
      revisions: { alpha: "alpha-1", beta: "beta-1" },
      states: {
        alpha: { label: "Alpha" },
        beta: { label: "Beta" }
      }
    };
    const definition = defineStateIndexDefinition<{ label: string }>({
      definitionVersion: 1,
      queryFields: [
        {
          mode: "text",
          name: "search",
          sources: [{ kind: "state-path", path: ["label"] }]
        }
      ],
      namespace: "selected-runtime",
      parseMetadata: (metadata) => metadata,
      parseState: (input) =>
        v.parse(v.strictObject({ label: v.string() }), input),
      read: async () => ({
        metadata: {},
        sourceRevision: {
          entries: source.revisions,
          metadata: source.metadataRevision
        },
        states: source.states
      }),
      readRevision: async () => ({
        entries: source.revisions,
        metadata: source.metadataRevision
      })
    });
    const runtime = createStateIndexRuntime({
      definition,
      indexPath: "indexes/selected.json",
      root: tempRoot
    });
    assert.equal((await runtime.sync("write")).state, "written");
    const indexPath = path.join(tempRoot, "indexes", "selected.json");
    const baselineText = await fs.readFile(indexPath, "utf8");

    source.states.alpha = { label: "Alpha changed" };
    source.revisions.alpha = "alpha-2";
    const unselected = await runtime.sync("write", {
      kind: "selected",
      selectedIds: ["beta"]
    });
    assert.equal(unselected.state, "unselected-changes");
    assert.deepEqual(unselected.changedIds, ["alpha"]);
    assert.equal(await fs.readFile(indexPath, "utf8"), baselineText);

    const checked = await runtime.sync("check", {
      kind: "selected",
      selectedIds: ["alpha"]
    });
    assert.equal(checked.state, "scoped-stale");
    assert.deepEqual(checked.changedIds, ["alpha"]);
    assert.equal(await fs.readFile(indexPath, "utf8"), baselineText);

    const written = await runtime.sync("write", {
      kind: "selected",
      selectedIds: ["alpha"]
    });
    assert.equal(written.state, "written");
    assert.deepEqual(written.selectedIds, ["alpha"]);
    const expected = serializeStateIndex(
      resultValue(await buildStateIndex(definition, { root: tempRoot })),
      definition
    );
    assert.equal(await fs.readFile(indexPath, "utf8"), expected);

    source.metadataRevision = "metadata-2";
    const collectionChanged = await runtime.sync("write", {
      kind: "selected",
      selectedIds: ["alpha"]
    });
    assert.equal(collectionChanged.state, "collection-changed");
    assert.equal(await fs.readFile(indexPath, "utf8"), expected);

    source.metadataRevision = "metadata-1";
    source.states.gamma = { label: "Gamma" };
    source.revisions.gamma = "gamma-1";
    const added = await runtime.sync("write", {
      kind: "selected",
      selectedIds: ["beta", "gamma"]
    });
    assert.equal(added.state, "written");
    assert.deepEqual(added.changedIds, ["gamma"]);

    delete source.states.gamma;
    delete source.revisions.gamma;
    const deleted = await runtime.sync("write", {
      kind: "selected",
      selectedIds: ["gamma"]
    });
    assert.equal(deleted.state, "written");
    assert.deepEqual(deleted.changedIds, ["gamma"]);

    delete source.states.alpha;
    delete source.revisions.alpha;
    source.states.omega = { label: "Omega" };
    source.revisions.omega = "omega-1";
    const incompleteRename = await runtime.sync("write", {
      kind: "selected",
      selectedIds: ["omega"]
    });
    assert.equal(incompleteRename.state, "unselected-changes");
    assert.deepEqual(incompleteRename.changedIds, ["alpha", "omega"]);
    const renamed = await runtime.sync("write", {
      kind: "selected",
      selectedIds: ["alpha", "omega"]
    });
    assert.equal(renamed.state, "written");
    assert.deepEqual(renamed.changedIds, ["alpha", "omega"]);
    const unchanged = await runtime.sync("check", {
      kind: "selected",
      selectedIds: ["beta", "omega"]
    });
    assert.equal(unchanged.state, "current");
    assert.equal(
      (
        await runtime.sync("write", {
          kind: "selected",
          selectedIds: ["missing"]
        })
      ).state,
      "selected-id-missing"
    );
    assert.equal(
      (
        await runtime.sync("write", {
          kind: "selected",
          selectedIds: ["omega", "omega"]
        })
      ).state,
      "selection-invalid"
    );
  });
});

test("selected sync requires a valid baseline while full sync repairs it", async () => {
  await withTempRoot(async (tempRoot) => {
    const source = {
      states: { alpha: { label: "Alpha" } }
    };
    const definition = defineStateIndexDefinition<{ label: string }>({
      definitionVersion: 1,
      queryFields: [
        {
          mode: "text",
          name: "search",
          sources: [{ kind: "state-path", path: ["label"] }]
        }
      ],
      namespace: "selected-baseline",
      parseMetadata: (metadata) => metadata,
      parseState: (input) =>
        v.parse(v.strictObject({ label: v.string() }), input),
      read: async () => ({
        metadata: {},
        sourceRevision: { entries: { alpha: "alpha-1" }, metadata: "metadata" },
        states: source.states
      }),
      readRevision: async () => ({
        entries: { alpha: "alpha-1" },
        metadata: "metadata"
      })
    });
    const runtime = createStateIndexRuntime({
      definition,
      indexPath: "indexes/selected.json",
      root: tempRoot
    });
    const rejected = await runtime.sync("write", {
      kind: "selected",
      selectedIds: ["alpha"]
    });
    assert.equal(rejected.state, "selected-baseline-invalid");
    assert.ok(
      rejected.diagnostics.every(
        (diagnostic) =>
          diagnostic.code === "state-index.selected-baseline-invalid"
      )
    );
    assert.equal((await runtime.sync("write")).state, "written");
  });
});
