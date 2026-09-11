/* oxlint-disable no-unused-vars -- Split test modules retain shared fixture imports for their focused scenario files. */
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  buildStateIndex,
  createStateIndexRuntime,
  defineStateIndexDefinition,
  loadCurrentStateIndex,
  loadStateIndex,
  parseStateIndex,
  serializeStateIndex,
  syncStateIndex,
  type StateIndexSyncMode
} from "../src/index.ts";
import { createSemanticDefinition } from "./materialization-definition-fixture.ts";
import {
  decisionDefinition,
  decisionStates,
  resultValue,
  type DecisionState,
  type MemoryStateSource
} from "./support.ts";

async function withTempRoot(
  run: (tempRoot: string) => Promise<void>
): Promise<void> {
  const tempRoot = await fs.mkdtemp(
    path.join(os.tmpdir(), "state-index-store-")
  );
  try {
    await run(tempRoot);
  } finally {
    await fs.rm(tempRoot, { force: true, recursive: true });
  }
}

async function createDecisionFixture() {
  const source: MemoryStateSource<DecisionState> = {
    revision: "decision-revision-1",
    states: await decisionStates()
  };
  return { definition: decisionDefinition(source), source };
}

test("serializes deterministic indexes independent of source order", async () => {
  await withTempRoot(async (tempRoot) => {
    const { definition, source } = await createDecisionFixture();
    const firstIndex = resultValue(
      await buildStateIndex(definition, {
        root: tempRoot
      })
    );
    assert.equal(Object.hasOwn(firstIndex, "keyDefinitions"), false);
    const firstText = serializeStateIndex(firstIndex, definition);

    source.states.reverse();
    assert.equal(
      serializeStateIndex(
        resultValue(await buildStateIndex(definition, { root: tempRoot })),
        definition
      ),
      firstText
    );
    assert.equal(firstText.endsWith("\n"), true);
    assert.equal(firstText.includes("generatedAt"), false);
  });
});

test("preserves definition-owned state field order through serialization", async () => {
  await withTempRoot(async (tempRoot) => {
    const calls = {
      metadataParses: 0,
      parses: 0,
      revisionReads: 0,
      validations: 0
    };
    const definition = createSemanticDefinition(calls);
    const index = resultValue(
      await buildStateIndex(definition, {
        root: tempRoot
      })
    );
    assert.equal(Object.hasOwn(index, "keyDefinitions"), false);
    const text = serializeStateIndex(index, definition);
    const value = JSON.parse(text) as {
      entries: Record<string, { summary: Record<string, unknown> }>;
    };
    assert.deepEqual(Object.keys(value), [
      "schemaVersion",
      "namespace",
      "definitionVersion",
      "metadata",
      "sourceRevision",
      "entries"
    ]);
    assert.deepEqual(Object.keys(value.entries), ["topic/a.md", "topic/z.md"]);
    assert.deepEqual(Object.keys(value.entries["topic/a.md"]!), [
      "sourcePath",
      "title",
      "status",
      "summary"
    ]);
    assert.deepEqual(Object.keys(value.entries["topic/a.md"]!.summary), [
      "purpose",
      "background"
    ]);

    const indexPath = "indexes/semantic-order.json";
    await fs.mkdir(path.join(tempRoot, "indexes"), { recursive: true });
    await fs.writeFile(path.join(tempRoot, indexPath), text, "utf8");
    calls.metadataParses = 0;
    calls.parses = 0;
    calls.revisionReads = 0;
    calls.validations = 0;
    const current = resultValue(
      await loadCurrentStateIndex({
        context: { root: tempRoot },
        definition,
        indexPath
      })
    );
    assert.deepEqual(Object.keys(current.entries["topic/a.md"]!), [
      "sourcePath",
      "title",
      "status",
      "summary"
    ]);
    assert.deepEqual(Object.keys(current.entries["topic/a.md"]!.summary), [
      "purpose",
      "background"
    ]);
    assert.deepEqual(calls, {
      metadataParses: 1,
      parses: 2,
      revisionReads: 1,
      validations: 1
    });

    const runtime = createStateIndexRuntime({
      definition,
      indexPath,
      root: tempRoot
    });
    const reader = resultValue(await runtime.open());
    const stored = resultValue(reader.get("topic/a.md"));
    assert.ok(stored);
    assert.deepEqual(Object.keys(stored.state), [
      "sourcePath",
      "title",
      "status",
      "summary"
    ]);
    assert.deepEqual(Object.keys(stored.state.summary), [
      "purpose",
      "background"
    ]);
    assert.deepEqual(calls, {
      metadataParses: 2,
      parses: 4,
      revisionReads: 2,
      validations: 2
    });

    const parsed = parseStateIndex({
      definition,
      expectation: { definitionVersion: 1, namespace: "semantic-order" },
      sourcePath: "indexes/semantic-order.json",
      text
    });
    assert.equal(parsed.status, "ok");
    assert.deepEqual(Object.keys(resultValue(parsed).entries["topic/a.md"]!), [
      "sourcePath",
      "title",
      "status",
      "summary"
    ]);

    const legacy = JSON.parse(text) as Record<string, unknown>;
    legacy.keyDefinitions = [];
    const rejected = parseStateIndex({
      definition,
      expectation: { definitionVersion: 1, namespace: "semantic-order" },
      sourcePath: "indexes/semantic-order.json",
      text: JSON.stringify(legacy)
    });
    assert.equal(rejected.status, "error");
    assert.ok(
      rejected.diagnostics.some(
        (entry) => entry.code === "state-index.schema-invalid"
      )
    );
  });
});
