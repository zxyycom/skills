import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import {
  createStateIndexReader,
  loadCurrentStateIndexReader,
  loadStateIndexReader,
  queryStateIndex
} from "../src/index.ts";
import { rawReaderIndex, readerLoadFixture } from "./reader-load-fixture.ts";
import { withTempRoot } from "./runtime-fixture.ts";
import { resultValue } from "./support.ts";

test("loads a strict reader with an isolated readonly index view", async () => {
  await withTempRoot(async (root) => {
    const { definition, index, parsedMetadata, parsedStates } =
      readerLoadFixture();
    await fs.writeFile(path.join(root, "index.json"), JSON.stringify(index));
    const reader = resultValue(
      await loadStateIndexReader({
        context: { root },
        definition,
        indexPath: "index.json"
      })
    );
    const indexView = reader.index;
    assert.ok(Object.isFrozen(indexView));
    assert.ok(Object.isFrozen(indexView.entries.a));
    assert.ok(Object.isFrozen(indexView.metadata.nested));
    assert.ok(Object.isFrozen(indexView.sourceRevision.entries));
    assert.equal(indexView.metadata, reader.metadata);
    assert.equal(Object.hasOwn(indexView, "queryValues"), false);
    assert.equal(Object.hasOwn(indexView.entries.a!, "queryValues"), false);
    assert.equal(Object.isFrozen(parsedMetadata[0]!), false);
    assert.equal(Object.isFrozen(parsedStates[0]!), false);
    parsedMetadata[0]!.nested.limit = 99;
    parsedStates[0]!.label = "Changed parser output";
    index.metadata.nested.limit = 100;
    index.entries.a!.label = "Changed input";
    definition.queryFields = [
      { mode: "exact", name: "changed", sources: [{ kind: "entry-id" }] }
    ];
    await fs.writeFile(path.join(root, "index.json"), JSON.stringify(index));
    assert.equal(reader.index, indexView);
    assert.equal(reader.index.metadata.nested.limit, 2);
    assert.equal(resultValue(reader.get("a"))?.state.label, "First");
    assert.equal(
      resultValue(
        reader.query({ sort: [{ key: "formed-at", direction: "desc" }] })
      ).entries[0]?.id,
      "b"
    );
    assert.equal(Reflect.set(reader.index.metadata.nested, "limit", 3), false);
    assert.equal(
      Reflect.set(reader.index.entries.a!, "label", "Escape"),
      false
    );
    assert.equal(
      Reflect.set(reader.index.sourceRevision.entries, "a", "changed"),
      false
    );
    // oxlint-disable-next-line no-constant-condition -- The unreachable block checks the recursively readonly public index view.
    if (false) {
      // @ts-expect-error The reader index property cannot be replaced.
      reader.index = index;
      // @ts-expect-error The public index metadata is recursively readonly.
      reader.index.metadata.nested.limit = 3;
      // @ts-expect-error The public index states are recursively readonly.
      reader.index.entries.a!.label = "Changed";
      // @ts-expect-error The public source revision is recursively readonly.
      reader.index.sourceRevision.entries.a = "changed";
    }
  });
});

test("reuses loaded snapshot preparation for repeated reader operations", async () => {
  await withTempRoot(async (root) => {
    const { calls, definition, index } = readerLoadFixture();
    await fs.writeFile(path.join(root, "index.json"), JSON.stringify(index));
    const reader = resultValue(
      await loadStateIndexReader({
        context: { root },
        definition,
        indexPath: "index.json"
      })
    );
    assert.deepEqual(calls, {
      metadataParses: 1,
      parses: 2,
      reads: 0,
      revisionReads: 0,
      validations: 1
    });
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const queried = resultValue(
        reader.query({
          filters: [
            {
              key: "formed-at",
              kind: "range",
              operator: "gte",
              value: 1767225600000
            }
          ],
          sort: [{ key: "formed-at", direction: "desc" }],
          limit: 1
        })
      );
      assert.deepEqual(
        queried.entries.map(({ id }) => id),
        ["b"]
      );
      assert.equal(queried.entries[0]!.state, reader.index.entries.b);
      assert.equal(resultValue(reader.get("a"))!.state, reader.index.entries.a);
      assert.equal(resultValue(reader.all()).length, 2);
    }
    const invalidQuery = reader.query({
      filters: [{ key: "undeclared", kind: "exists", value: true }]
    });
    assert.equal(
      invalidQuery.diagnostics[0]?.code,
      "state-index.query-key-unknown"
    );
    assert.deepEqual(calls, {
      metadataParses: 1,
      parses: 2,
      reads: 0,
      revisionReads: 0,
      validations: 1
    });
    const overlay = resultValue(
      reader.query(
        {},
        {
          runtimeStates: {
            a: { formedAt: "2026-01-03T00:00:00Z", label: "Overlay" }
          }
        }
      )
    );
    assert.equal(overlay.entries[0]?.state.label, "Overlay");
    assert.equal(calls.parses, 3);
    assert.equal(resultValue(reader.get("a"))?.state.label, "First");
    assert.equal(resultValue(reader.query()).total, 2);
    assert.equal(calls.validations, 1);
  });
});

test("rejects unverified persisted input before exposing loaded readers", async () => {
  await withTempRoot(async (root) => {
    const { control, definition, index } = readerLoadFixture();
    const invalid = rawReaderIndex(index);
    invalid.entries = {
      a: { formedAt: "not-an-instant", label: "First" },
      b: index.entries.b!
    };
    for (const load of [loadStateIndexReader, loadCurrentStateIndexReader]) {
      await fs.writeFile(
        path.join(root, "index.json"),
        JSON.stringify(invalid)
      );
      const rejectedField = await load({
        context: { root },
        definition,
        indexPath: "index.json"
      });
      assert.equal(
        rejectedField.diagnostics[0]?.code,
        "state-index.query-field-source-invalid"
      );
      assert.equal(rejectedField.value, null);
      assert.equal(rejectedField.diagnostics[0]?.path, "index.json");
      await fs.writeFile(
        path.join(root, "index.json"),
        JSON.stringify({ ...index, metadata: {} })
      );
      const rejectedMetadata = await load({
        context: { root },
        definition,
        indexPath: "index.json"
      });
      assert.equal(
        rejectedMetadata.diagnostics[0]?.code,
        "state-index.metadata-parse-failed"
      );
      await fs.writeFile(path.join(root, "index.json"), JSON.stringify(index));
      control.rejectCollection = true;
      const rejectedCollection = await load({
        context: { root },
        definition,
        indexPath: "index.json"
      });
      assert.equal(
        rejectedCollection.diagnostics[0]?.code,
        "state-index.index-validation-failed"
      );
      control.rejectCollection = false;
      const rejectedPath = await load({
        context: { root },
        definition,
        indexPath: "../index.json"
      });
      assert.equal(
        rejectedPath.diagnostics[0]?.code,
        "state-index.index-path-invalid"
      );
    }
    const rejectedExpectation = await loadStateIndexReader({
      context: { root },
      definition,
      expectation: { namespace: "reader-load", definitionVersion: 2 },
      indexPath: "index.json"
    });
    assert.equal(
      rejectedExpectation.diagnostics[0]?.code,
      "state-index.definition-mismatch"
    );
    const frozenInvalid = Object.freeze({
      ...index,
      entries: Object.freeze({
        a: Object.freeze({ formedAt: "invalid", label: "First" }),
        b: index.entries.b!
      })
    });
    assert.equal(
      queryStateIndex({ definition, index: frozenInvalid }).status,
      "error"
    );
    assert.throws(
      () =>
        createStateIndexReader({
          definition,
          index: frozenInvalid,
          indexPath: "<memory>"
        }),
      /state-index.query-field-source-invalid/u
    );
    const rejectedDefinition = await loadStateIndexReader({
      context: { root },
      definition: { ...definition, queryFields: [] },
      indexPath: "index.json"
    });
    assert.equal(
      rejectedDefinition.diagnostics[0]?.code,
      "state-index.definition-invalid"
    );
  });
});

test("preserves current reader revision count stale precedence and fresh loads", async () => {
  await withTempRoot(async (root) => {
    const { calls, definition, index } = readerLoadFixture();
    const options = { context: { root }, definition, indexPath: "index.json" };
    await fs.writeFile(path.join(root, "index.json"), JSON.stringify(index));
    const reader = resultValue(await loadCurrentStateIndexReader(options));
    assert.deepEqual(calls, {
      metadataParses: 1,
      parses: 2,
      reads: 0,
      revisionReads: 1,
      validations: 1
    });
    const invalid = rawReaderIndex(index);
    invalid.entries = { a: { formedAt: 3, label: false }, b: index.entries.b! };
    await fs.writeFile(path.join(root, "index.json"), JSON.stringify(invalid));
    index.sourceRevision = { ...index.sourceRevision, metadata: "metadata-2" };
    const stale = await loadCurrentStateIndexReader(options);
    assert.equal(stale.diagnostics[0]?.code, "state-index.index-stale");
    assert.deepEqual(calls, {
      metadataParses: 1,
      parses: 2,
      reads: 0,
      revisionReads: 2,
      validations: 1
    });
    await fs.writeFile(
      path.join(root, "index.json"),
      JSON.stringify({ ...invalid, sourceRevision: index.sourceRevision })
    );
    const invalidCurrent = await loadCurrentStateIndexReader(options);
    assert.equal(
      invalidCurrent.diagnostics[0]?.code,
      "state-index.state-parse-failed"
    );
    index.entries.a!.label = "New file";
    await fs.writeFile(path.join(root, "index.json"), JSON.stringify(index));
    const reopened = resultValue(await loadCurrentStateIndexReader(options));
    assert.equal(calls.revisionReads, 4);
    assert.equal(resultValue(reader.get("a"))?.state.label, "First");
    assert.equal(resultValue(reopened.get("a"))?.state.label, "New file");
    assert.notEqual(reader.index, reopened.index);
    index.entries.a!.label = "Same revision, new file";
    await fs.writeFile(path.join(root, "index.json"), JSON.stringify(index));
    const sameRevisionReader = resultValue(
      await loadCurrentStateIndexReader(options)
    );
    assert.equal(calls.revisionReads, 5);
    assert.equal(
      resultValue(sameRevisionReader.get("a"))?.state.label,
      "Same revision, new file"
    );
    assert.notEqual(reopened.index, sameRevisionReader.index);
    assert.equal(calls.reads, 0);
    const sameRevision = reader.index.sourceRevision.metadata;
    assert.equal(sameRevision, "metadata-1");
  });
});
