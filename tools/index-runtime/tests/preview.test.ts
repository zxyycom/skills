import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import {
  createStateIndexRuntime,
  defineStateIndexDefinition
} from "../src/index.ts";
import { withTempRoot } from "./runtime-fixture.ts";

function fixture(root: string) {
  const control = {
    drift: false,
    invalid: false,
    metadata: "metadata-1",
    revision: "alpha-1"
  };
  const definition = defineStateIndexDefinition<{ label: string }>({
    definitionVersion: 1,
    namespace: "preview-test",
    parseMetadata: (value) => value,
    parseState: (value) => {
      if (
        value === null ||
        typeof value !== "object" ||
        !("label" in value) ||
        typeof value.label !== "string" ||
        value.label.length === 0
      )
        throw new Error("invalid source state");
      return { label: value.label };
    },
    queryFields: [
      {
        mode: "text",
        name: "label",
        sources: [{ kind: "state-path", path: ["label"] }]
      }
    ],
    read: async () => ({
      metadata: {},
      sourceRevision: {
        metadata: control.metadata,
        entries: { alpha: control.revision }
      },
      states: { alpha: { label: control.invalid ? "" : control.revision } }
    }),
    readRevision: async () => ({
      metadata: control.metadata,
      entries: { alpha: control.drift ? "drifted" : control.revision }
    })
  });
  return {
    control,
    runtime: createStateIndexRuntime({
      definition,
      indexPath: "indexes/preview.json",
      root
    })
  };
}

test("full sync preview accepts repairable indexes without creating or replacing files", async () => {
  await withTempRoot(async (root) => {
    const { runtime, control } = fixture(root);
    const indexPath = path.join(root, "indexes", "preview.json");
    const missing = await runtime.sync("preview");
    assert.equal(missing.status, "ok");
    assert.equal(missing.state, "previewed");
    assert.equal(missing.changed, false);
    assert.deepEqual(await fs.readdir(root), []);
    assert.equal((await runtime.sync("check")).state, "index-missing");
    assert.equal((await runtime.sync("write")).state, "written");
    const canonical = await fs.readFile(indexPath);
    assert.equal((await runtime.sync("preview")).state, "unchanged");
    for (const broken of [
      Buffer.from("not JSON"),
      Buffer.from([0xff]),
      Buffer.from('{"schemaVersion":3}')
    ]) {
      await fs.writeFile(indexPath, broken);
      const before = await fs.stat(indexPath);
      assert.equal((await runtime.sync("preview")).state, "previewed");
      assert.deepEqual(await fs.readFile(indexPath), broken);
      assert.equal((await fs.stat(indexPath)).mtimeMs, before.mtimeMs);
      assert.equal((await runtime.sync("check")).status, "error");
      assert.equal((await runtime.sync("write")).state, "written");
      assert.deepEqual(await fs.readFile(indexPath), canonical);
    }
    control.revision = "alpha-2";
    assert.equal((await runtime.sync("preview")).state, "previewed");
    assert.deepEqual(await fs.readFile(indexPath), canonical);
    assert.equal((await runtime.sync("check")).state, "index-stale");
    assert.equal((await runtime.sync("write")).state, "written");
    assert.equal((await runtime.sync("preview")).state, "unchanged");
  });
});

test("selected sync preview preserves baseline and enforces the complete acceptance boundary", async () => {
  await withTempRoot(async (root) => {
    const { runtime, control } = fixture(root);
    const selected = { kind: "selected", selectedIds: ["alpha"] } as const;
    assert.equal(
      (await runtime.sync("preview", selected)).state,
      "selected-baseline-invalid"
    );
    assert.equal((await runtime.sync("write")).state, "written");
    const indexPath = path.join(root, "indexes", "preview.json");
    const baseline = await fs.readFile(indexPath);
    assert.equal((await runtime.sync("preview", selected)).state, "unchanged");
    control.revision = "alpha-2";
    const preview = await runtime.sync("preview", selected);
    assert.equal(preview.status, "ok");
    assert.equal(preview.state, "previewed");
    assert.equal(preview.changed, false);
    assert.deepEqual(preview.changedIds, ["alpha"]);
    assert.equal((await runtime.sync("check", selected)).state, "scoped-stale");
    assert.equal(
      (await runtime.sync("preview", { kind: "selected", selectedIds: [] }))
        .state,
      "selection-invalid"
    );
    assert.equal(
      (
        await runtime.sync("preview", {
          kind: "selected",
          selectedIds: ["missing"]
        })
      ).state,
      "selected-id-missing"
    );
    control.metadata = "metadata-2";
    assert.equal(
      (await runtime.sync("preview", selected)).state,
      "collection-changed"
    );
    assert.deepEqual(await fs.readFile(indexPath), baseline);
    await fs.writeFile(indexPath, "broken");
    assert.equal(
      (await runtime.sync("preview", selected)).state,
      "selected-baseline-invalid"
    );
    assert.equal(await fs.readFile(indexPath, "utf8"), "broken");
  });
});

test("sync preview rejects invalid complete sources and revision drift before any publication", async () => {
  await withTempRoot(async (root) => {
    const { runtime, control } = fixture(root);
    assert.equal((await runtime.sync("write")).state, "written");
    const indexPath = path.join(root, "indexes", "preview.json");
    const baseline = await fs.readFile(indexPath);
    control.revision = "alpha-2";
    for (const scope of [
      { kind: "all" } as const,
      { kind: "selected", selectedIds: ["alpha"] } as const
    ]) {
      control.invalid = true;
      assert.equal(
        (await runtime.sync("preview", scope)).state,
        "source-invalid"
      );
      control.invalid = false;
      control.drift = true;
      const drifted = await runtime.sync("preview", scope);
      assert.equal(drifted.status, "error");
      assert.ok(
        drifted.diagnostics.some(
          (entry) => entry.code === "state-index.source-changed"
        )
      );
      control.drift = false;
      assert.deepEqual(await fs.readFile(indexPath), baseline);
    }
  });
});
