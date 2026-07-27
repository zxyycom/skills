import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  buildStateIndex,
  defineStateIndexDefinition,
  keyDefinitionsOf,
  loadCurrentStateIndex,
  loadStateIndex,
  parseStateIndex,
  serializeStateIndex,
  syncStateIndex,
  type StateIndexSyncMode
} from "../src/index.ts";
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
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "state-index-store-"));
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
    const firstIndex = resultValue(await buildStateIndex(definition, {
      root: tempRoot
    }));
    assert.deepEqual(firstIndex.keyDefinitions, keyDefinitionsOf(definition));
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

test("preserves definition field and key order through serialization", async () => {
  await withTempRoot(async (tempRoot) => {
    const definition = defineStateIndexDefinition<{
      path: string;
      title: string;
      status: string;
      summary: { purpose: string; background: string };
    }>({
      definitionVersion: 1,
      fieldOrder: "definition",
      identify: (state) => state.path,
      keyStrategies: [
        {
          derive: (state) => state.path.split("/", 1)[0],
          mode: "exact",
          name: "topic"
        },
        {
          derive: (state) => state.status,
          mode: "exact",
          name: "status"
        }
      ],
      namespace: "semantic-order",
      parseMetadata: (metadata) => metadata,
      parseState: (input) => {
        const summary = input.summary;
        if (
          typeof input.path !== "string"
          || typeof input.title !== "string"
          || typeof input.status !== "string"
          || summary === null
          || typeof summary !== "object"
          || Array.isArray(summary)
          || typeof summary.purpose !== "string"
          || typeof summary.background !== "string"
        ) {
          throw new TypeError("invalid semantic state");
        }
        return {
          path: input.path,
          title: input.title,
          status: input.status,
          summary: {
            purpose: summary.purpose,
            background: summary.background
          }
        };
      },
      read: async () => ({
        metadata: {},
        revision: "semantic-revision-1",
        states: [
          {
            path: "topic/z.md",
            status: "active",
            summary: { background: "B", purpose: "P" },
            title: "Z"
          },
          {
            path: "topic/a.md",
            status: "active",
            summary: { background: "B", purpose: "P" },
            title: "A"
          }
        ]
      }),
      readRevision: async () => "semantic-revision-1"
    });
    const index = resultValue(await buildStateIndex(definition, {
      root: tempRoot
    }));
    assert.deepEqual(index.keyDefinitions, keyDefinitionsOf(definition));
    const text = serializeStateIndex(index, definition);
    const value = JSON.parse(text) as {
      entries: Array<{
        id: string;
        keys: Record<string, unknown>;
        state: { summary: Record<string, unknown> };
      }>;
      keyDefinitions: Array<Record<string, unknown>>;
    };
    assert.deepEqual(Object.keys(value), [
      "schemaVersion",
      "namespace",
      "definitionVersion",
      "metadata",
      "sourceRevision",
      "keyDefinitions",
      "entries"
    ]);
    assert.deepEqual(
      value.keyDefinitions.map((entry) => Object.values(entry)),
      [["topic", "exact"], ["status", "exact"]]
    );
    assert.deepEqual(
      value.entries.map((entry) => entry.id),
      ["topic/a.md", "topic/z.md"]
    );
    assert.deepEqual(Object.keys(value.entries[0]!.keys), ["topic", "status"]);
    assert.deepEqual(Object.keys(value.entries[0]!.state), [
      "path",
      "title",
      "status",
      "summary"
    ]);
    assert.deepEqual(Object.keys(value.entries[0]!.state.summary), [
      "purpose",
      "background"
    ]);

    const parsed = parseStateIndex({
      definition,
      expectation: { definitionVersion: 1, namespace: "semantic-order" },
      sourcePath: "indexes/semantic-order.json",
      text
    });
    assert.equal(parsed.status, "ok");
    assert.deepEqual(
      resultValue(parsed).keyDefinitions,
      keyDefinitionsOf(definition)
    );
    assert.deepEqual(
      Object.keys(resultValue(parsed).entries[0]!.state),
      ["path", "title", "status", "summary"]
    );

    const reordered = JSON.parse(text) as { keyDefinitions: unknown[] };
    reordered.keyDefinitions.reverse();
    const rejected = parseStateIndex({
      definition,
      expectation: { definitionVersion: 1, namespace: "semantic-order" },
      sourcePath: "indexes/semantic-order.json",
      text: JSON.stringify(reordered)
    });
    assert.equal(rejected.status, "error");
    assert.ok(rejected.diagnostics.some((entry) => (
      entry.code === "state-index.definition-mismatch"
    )));
  });
});

test("rejects persisted indexes from another namespace", async () => {
  await withTempRoot(async (tempRoot) => {
    const { definition } = await createDecisionFixture();
    const text = serializeStateIndex(
      resultValue(await buildStateIndex(definition, { root: tempRoot })),
      definition
    );
    assert.equal(parseStateIndex({
      expectation: { definitionVersion: 1, namespace: "decisions" },
      sourcePath: "indexes/decisions.json",
      text
    }).status, "ok");

    const mismatched = parseStateIndex({
      expectation: { definitionVersion: 1, namespace: "investigations" },
      sourcePath: "indexes/decisions.json",
      text
    });
    assert.equal(mismatched.status, "error");
    assert.ok(mismatched.diagnostics.some((entry) => (
      entry.code === "state-index.namespace-mismatch"
    )));
  });
});

test("rejects invalid sync modes without writing an index", async () => {
  await withTempRoot(async (tempRoot) => {
    const { definition } = await createDecisionFixture();
    const indexPath = "indexes/invalid-mode.json";
    const result = await syncStateIndex({
      context: { root: tempRoot },
      definition,
      indexPath,
      mode: "invalid" as StateIndexSyncMode
    });
    assert.equal(result.state, "mode-invalid");
    assert.equal(result.mode, null);
    assert.equal(
      await fs.access(path.join(tempRoot, ...indexPath.split("/")))
        .then(() => true, () => false),
      false
    );
  });
});

test("rejects a source revision that changes during synchronization", async () => {
  await withTempRoot(async (tempRoot) => {
    const { definition } = await createDecisionFixture();
    const result = await syncStateIndex({
      context: { root: tempRoot },
      definition: {
        ...definition,
        readRevision: async () => "different-revision"
      },
      indexPath: "indexes/inconsistent-revision.json",
      mode: "write"
    });
    assert.equal(result.state, "source-invalid");
    assert.ok(result.diagnostics.some((entry) => (
      entry.code === "state-index.source-changed"
    )));
  });
});

test("checks, writes, and reloads current indexes across line endings", async () => {
  await withTempRoot(async (tempRoot) => {
    const { definition, source } = await createDecisionFixture();
    const indexPath = "indexes/decisions.json";
    assert.equal((await syncStateIndex({
      context: { root: tempRoot },
      definition,
      indexPath,
      mode: "check"
    })).state, "index-missing");
    assert.equal((await syncStateIndex({
      context: { root: tempRoot },
      definition,
      indexPath,
      mode: "write"
    })).state, "written");
    assert.equal((await syncStateIndex({
      context: { root: tempRoot },
      definition,
      indexPath,
      mode: "check"
    })).state, "current");

    const resolvedIndexPath = path.join(tempRoot, ...indexPath.split("/"));
    await fs.writeFile(
      resolvedIndexPath,
      (await fs.readFile(resolvedIndexPath, "utf8")).replace(/\n/g, "\r\n"),
      "utf8"
    );
    assert.equal((await syncStateIndex({
      context: { root: tempRoot },
      definition,
      indexPath,
      mode: "check"
    })).state, "current");

    const loaded = await loadStateIndex({
      context: { root: tempRoot },
      definition,
      expectation: { definitionVersion: 1, namespace: "decisions" },
      indexPath
    });
    assert.equal(resultValue(loaded).entries.length, source.states.length);
    assert.equal((await loadCurrentStateIndex({
      context: { root: tempRoot },
      definition,
      indexPath
    })).status, "ok");
  });
});

test("rejects persisted indexes with changed key definitions", async () => {
  await withTempRoot(async (tempRoot) => {
    const { definition } = await createDecisionFixture();
    const indexPath = "indexes/decisions.json";
    await syncStateIndex({
      context: { root: tempRoot },
      definition,
      indexPath,
      mode: "write"
    });
    const result = await loadCurrentStateIndex({
      context: { root: tempRoot },
      definition: {
        ...definition,
        keyStrategies: definition.keyStrategies.map((strategy) => (
          strategy.name === "status"
            ? { ...strategy, name: "lifecycle" }
            : strategy
        ))
      },
      indexPath
    });
    assert.equal(result.status, "error");
    assert.ok(result.diagnostics.some((entry) => (
      entry.code === "state-index.definition-mismatch"
    )));
  });
});

test("detects stale sources and refreshes changed or removed states", async () => {
  await withTempRoot(async (tempRoot) => {
    const { definition, source } = await createDecisionFixture();
    const indexPath = "indexes/decisions.json";
    await syncStateIndex({
      context: { root: tempRoot },
      definition,
      indexPath,
      mode: "write"
    });

    source.revision = "decision-revision-2";
    source.states[0] = {
      ...source.states[0]!,
      title: "Changed decision title"
    };
    const staleLoad = await loadCurrentStateIndex({
      context: { root: tempRoot },
      definition,
      indexPath
    });
    assert.equal(staleLoad.status, "error");
    assert.ok(staleLoad.diagnostics.some((entry) => (
      entry.code === "state-index.index-stale"
    )));
    assert.equal((await syncStateIndex({
      context: { root: tempRoot },
      definition,
      indexPath,
      mode: "check"
    })).state, "index-stale");
    assert.equal((await syncStateIndex({
      context: { root: tempRoot },
      definition,
      indexPath,
      mode: "write"
    })).state, "written");
    const refreshed = resultValue(await loadCurrentStateIndex({
      context: { root: tempRoot },
      definition,
      indexPath
    }));
    assert.equal(refreshed.entries.find((entry) => (
      entry.id === source.states[0]!.path
    ))?.state.title, "Changed decision title");

    const removed = source.states.pop();
    assert.ok(removed);
    source.revision = "decision-revision-3";
    assert.equal((await syncStateIndex({
      context: { root: tempRoot },
      definition,
      indexPath,
      mode: "write"
    })).state, "written");
    assert.equal(resultValue(await loadCurrentStateIndex({
      context: { root: tempRoot },
      definition,
      indexPath
    })).entries.length, source.states.length);
  });
});

test("rejects index paths outside the configured root", async () => {
  await withTempRoot(async (tempRoot) => {
    const { definition } = await createDecisionFixture();
    const result = await syncStateIndex({
      context: { root: tempRoot },
      definition,
      indexPath: "../outside.json",
      mode: "write"
    });
    assert.equal(result.state, "index-path-invalid");
  });
});
