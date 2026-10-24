import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { withTempRoot } from "./runtime-fixture.ts";
import { resultValue } from "./support.ts";
import { serializeStateIndex, syncStateIndex } from "../src/index.ts";
import {
  prepareSelectedStateIndexBaseline,
  prepareStateIndex,
  prepareStateIndexFromSnapshot,
  syncStateIndexPrepared
} from "../src/prepared.ts";
import { changeState, preparationFixture } from "./prepared-fixture.ts";

test("prepared selected sync shares one baseline and native build while independently reading final revision", async () => {
  await withTempRoot(async (root) => {
    const { definition, snapshot, calls } = preparationFixture();
    const options = { context: { root }, definition, indexPath: "index.json" };
    const initial = resultValue(
      prepareStateIndexFromSnapshot({ ...options, snapshot })
    );
    await fs.writeFile(
      path.join(root, options.indexPath),
      serializeStateIndex(initial.index, definition)
    );
    Object.assign(calls, {
      metadata: 0,
      parses: 0,
      reads: 0,
      revisions: 0,
      validates: 0
    });
    const baseline = resultValue(
      await prepareSelectedStateIndexBaseline(options)
    );
    assert.equal(Object.keys(baseline.index.entries).length, 2);
    changeState(snapshot, "a");
    const prepared = resultValue(await prepareStateIndex(options));
    assert.deepEqual(calls, {
      metadata: 2,
      parses: 4,
      reads: 1,
      revisions: 0,
      validates: 2
    });
    const result = await syncStateIndexPrepared({
      ...options,
      baseline,
      prepared,
      mode: "write",
      scope: { kind: "selected", selectedIds: ["a"] }
    });
    assert.equal(result.state, "written");
    assert.deepEqual(result.changedIds, ["a"]);
    assert.deepEqual(calls, {
      metadata: 2,
      parses: 4,
      reads: 1,
      revisions: 1,
      validates: 2
    });
    assert.equal(
      await fs.readFile(path.join(root, options.indexPath), "utf8"),
      serializeStateIndex(prepared.index, definition)
    );
    assert.deepEqual(prepared.index.entries.b, initial.index.entries.b);
    assert.equal(
      prepared.index.sourceRevision.entries.b,
      initial.index.sourceRevision.entries.b
    );
  });
});

test("prepared selected sync retains complete source metadata unselected and fresh protections", async () => {
  for (const change of [
    "unselected",
    "metadata",
    "fresh",
    "invalid-unselected"
  ] as const) {
    await withTempRoot(async (root) => {
      const { definition, snapshot, calls } = preparationFixture();
      const options = {
        context: { root },
        definition,
        indexPath: "index.json"
      };
      const initial = resultValue(
        prepareStateIndexFromSnapshot({ ...options, snapshot })
      );
      const initialText = serializeStateIndex(initial.index, definition);
      await fs.writeFile(path.join(root, options.indexPath), initialText);
      const baseline = resultValue(
        await prepareSelectedStateIndexBaseline(options)
      );
      changeState(snapshot, "a");
      if (change === "unselected") changeState(snapshot, "b");
      if (change === "metadata") {
        snapshot.metadata = { tenant: "two" };
        snapshot.sourceRevision = {
          ...snapshot.sourceRevision,
          metadata: "metadata-2"
        };
      }
      if (change === "invalid-unselected") {
        snapshot.states = {
          ...snapshot.states,
          b: { ...snapshot.states.b!, formedAt: "not-an-instant" }
        };
        const failed = prepareStateIndexFromSnapshot({ ...options, snapshot });
        assert.equal(
          failed.diagnostics[0]?.code,
          "state-index.query-field-source-invalid"
        );
        assert.equal(failed.diagnostics[0]?.stateId, "b");
        return;
      }
      const prepared = resultValue(
        prepareStateIndexFromSnapshot({ ...options, snapshot })
      );
      if (change === "fresh") changeState(snapshot, "b");
      const result = await syncStateIndexPrepared({
        ...options,
        prepared,
        baseline,
        mode: "preview",
        scope: { kind: "selected", selectedIds: ["a"] }
      });
      assert.equal(result.status, "error");
      assert.equal(
        result.state,
        change === "unselected"
          ? "unselected-changes"
          : change === "metadata"
            ? "collection-changed"
            : "source-invalid"
      );
      if (change === "fresh")
        assert.equal(result.diagnostics[0]?.code, "state-index.source-changed");
      assert.equal(calls.revisions, 1);
      assert.equal(
        await fs.readFile(path.join(root, options.indexPath), "utf8"),
        initialText
      );
    });
  }
});

test("prepared full sync hands off native build but raw sync and final freshness remain independent", async () => {
  await withTempRoot(async (root) => {
    const { definition, snapshot, calls } = preparationFixture();
    const options = { context: { root }, definition, indexPath: "index.json" };
    const prepared = resultValue(await prepareStateIndex(options));
    const afterPrepare = { ...calls };
    assert.equal(
      (await syncStateIndexPrepared({ ...options, prepared, mode: "write" }))
        .state,
      "written"
    );
    assert.deepEqual(calls, { ...afterPrepare, revisions: 1 });
    const rawOptions = { ...options, prepared, mode: "preview" as const };
    assert.equal((await syncStateIndex(rawOptions)).state, "unchanged");
    assert.equal(calls.reads, afterPrepare.reads + 1);
    assert.equal(calls.parses, afterPrepare.parses + 2);
    assert.equal(calls.validates, afterPrepare.validates + 1);
    changeState(snapshot, "b");
    const stale = await syncStateIndexPrepared({
      ...options,
      prepared,
      mode: "preview"
    });
    assert.equal(stale.diagnostics[0]?.code, "state-index.source-changed");
    assert.equal(calls.revisions, 3);
  });
});
