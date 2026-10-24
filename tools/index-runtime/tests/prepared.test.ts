import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { withTempRoot } from "./runtime-fixture.ts";
import { resultValue } from "./support.ts";
import {
  createStateIndexReader,
  loadStateIndexReader,
  queryStateIndex,
  serializeStateIndex
} from "../src/index.ts";
import { resolveIndexPath } from "../src/index-path.ts";
import {
  consumePreparedSelectedBaseline,
  consumePreparedStateIndex,
  prepareSelectedStateIndexBaseline,
  prepareStateIndexFromSnapshot
} from "../src/prepared.ts";
import { createStateIndexReaderFromPrepared } from "../src/reader.ts";
import { readerLoadFixture } from "./reader-load-fixture.ts";
import { preparationFixture } from "./prepared-fixture.ts";

test("prepared readers consume strict field materialization once without weakening raw boundaries", async () => {
  await withTempRoot(async (root) => {
    const { definition, index } = readerLoadFixture();
    const options = { context: { root }, definition, indexPath: "index.json" };
    await fs.writeFile(
      path.join(root, options.indexPath),
      JSON.stringify(index)
    );
    const originalParse = Date.parse;
    let extractions = 0;
    // This file runs serially; restore the global extraction probe before returning.
    Date.parse = (text) => {
      extractions += 1;
      return originalParse(text);
    };
    try {
      const reader = resultValue(await loadStateIndexReader(options));
      assert.equal(extractions, 2);
      resultValue(reader.query());
      resultValue(reader.get("a"));
      resultValue(reader.all());
      assert.equal(extractions, 2);
      const memoryReader = createStateIndexReader({
        definition,
        index,
        indexPath: "<memory>"
      });
      assert.equal(extractions, 4);
      resultValue(memoryReader.query());
      assert.equal(extractions, 4);
      const prepared = resultValue(
        prepareStateIndexFromSnapshot({
          ...options,
          snapshot: {
            metadata: index.metadata,
            sourceRevision: index.sourceRevision,
            states: index.entries
          }
        })
      );
      assert.equal(extractions, 6);
      const preparedReader = resultValue(
        createStateIndexReaderFromPrepared({ ...options, prepared })
      );
      assert.equal(extractions, 6);
      assert.equal(
        resultValue(preparedReader.query()).entries[0]!.state,
        prepared.index.entries.a
      );
      const invalid = {
        ...index,
        entries: {
          ...index.entries,
          a: { ...index.entries.a!, formedAt: "invalid" }
        }
      };
      assert.equal(
        queryStateIndex({ definition, index: invalid }).status,
        "error"
      );
      assert.throws(
        () =>
          createStateIndexReader({
            definition,
            index: invalid,
            indexPath: "raw"
          }),
        /query-field-source-invalid/u
      );
    } finally {
      Date.parse = originalParse;
    }
  });
});

test("prepared evidence rejects definition root path index and forged byte identity mismatches", async () => {
  await withTempRoot(async (root) => {
    const { definition, snapshot } = preparationFixture();
    const options = { context: { root }, definition, indexPath: "index.json" };
    const prepared = resultValue(
      prepareStateIndexFromSnapshot({ ...options, snapshot })
    );
    const consume = { ...options, prepared };
    assert.equal(consumePreparedStateIndex(consume).status, "ok");
    assert.equal(
      consumePreparedStateIndex({ ...consume, definition: { ...definition } })
        .status,
      "error"
    );
    assert.equal(
      consumePreparedStateIndex({
        ...consume,
        context: { root: path.join(root, "other") }
      }).status,
      "error"
    );
    assert.equal(
      consumePreparedStateIndex({ ...consume, indexPath: "other.json" }).status,
      "error"
    );
    assert.equal(
      consumePreparedStateIndex({
        ...consume,
        index: structuredClone(prepared.index)
      }).status,
      "error"
    );
    assert.equal(
      consumePreparedStateIndex({
        ...consume,
        prepared: structuredClone(prepared)
      }).status,
      "error"
    );
    await fs.writeFile(
      path.join(root, options.indexPath),
      serializeStateIndex(prepared.index, definition)
    );
    const baseline = resultValue(
      await prepareSelectedStateIndexBaseline(options)
    );
    const resolved = resultValue(
      await resolveIndexPath(options.indexPath, root)
    );
    const baselineOptions = { ...options, baseline, resolved };
    assert.equal(consumePreparedSelectedBaseline(baselineOptions).status, "ok");
    assert.equal(
      consumePreparedSelectedBaseline({
        ...baselineOptions,
        resolved: { ...resolved, targetPath: path.join(root, "other.json") }
      }).status,
      "error"
    );
    assert.equal(
      consumePreparedSelectedBaseline({
        ...baselineOptions,
        resolved: { ...resolved, canonicalRoot: path.join(root, "other") }
      }).status,
      "error"
    );
    const changedBytes = baseline.bytes;
    changedBytes[0] = 0;
    assert.notEqual(baseline.bytes[0], changedBytes[0]);
    assert.equal(
      Reflect.set(baseline, "index", structuredClone(prepared.index)),
      false
    );
    assert.equal(Reflect.set(baseline, "text", "{}"), false);
    const forged = structuredClone(baseline);
    Reflect.set(forged, "bytes", changedBytes);
    assert.equal(
      consumePreparedSelectedBaseline({ ...baselineOptions, baseline: forged })
        .status,
      "error"
    );
    definition.queryFields = [
      { name: "other", mode: "exact", sources: [{ kind: "entry-id" }] }
    ];
    assert.equal(consumePreparedStateIndex(consume).status, "error");
    assert.equal(
      consumePreparedSelectedBaseline(baselineOptions).status,
      "error"
    );
  });
});
