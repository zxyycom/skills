import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
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

export async function testMaterialization(): Promise<void> {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "state-index-store-"));
  try {
    const source: MemoryStateSource<DecisionState> = {
      revision: "decision-revision-1",
      states: await decisionStates()
    };
    const definition = decisionDefinition(source);
    const firstBuild = await buildStateIndex(definition, { root: tempRoot });
    const firstIndex = resultValue(firstBuild);
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
    source.states.reverse();
    assert.equal(firstText.endsWith("\n"), true);
    assert.equal(firstText.includes("generatedAt"), false);

    const semanticDefinition = defineStateIndexDefinition<{
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
    const semanticIndex = resultValue(await buildStateIndex(
      semanticDefinition,
      { root: tempRoot }
    ));
    assert.deepEqual(
      semanticIndex.keyDefinitions,
      keyDefinitionsOf(semanticDefinition)
    );
    const semanticText = serializeStateIndex(semanticIndex, semanticDefinition);
    const semanticValue = JSON.parse(semanticText) as {
      entries: Array<{
        id: string;
        keys: Record<string, unknown>;
        state: { summary: Record<string, unknown> };
      }>;
      keyDefinitions: Array<Record<string, unknown>>;
    };
    assert.deepEqual(Object.keys(semanticValue), [
      "schemaVersion",
      "namespace",
      "definitionVersion",
      "sourceRevision",
      "keyDefinitions",
      "entries"
    ]);
    assert.deepEqual(
      semanticValue.keyDefinitions.map((definition) => Object.values(definition)),
      [["topic", "exact"], ["status", "exact"]]
    );
    assert.deepEqual(
      semanticValue.entries.map((entry) => entry.id),
      ["topic/a.md", "topic/z.md"]
    );
    assert.deepEqual(Object.keys(semanticValue.entries[0]!.keys), [
      "topic",
      "status"
    ]);
    assert.deepEqual(Object.keys(semanticValue.entries[0]!.state), [
      "path",
      "title",
      "status",
      "summary"
    ]);
    assert.deepEqual(Object.keys(semanticValue.entries[0]!.state.summary), [
      "purpose",
      "background"
    ]);
    const parsedSemantic = parseStateIndex({
      definition: semanticDefinition,
      expectation: { definitionVersion: 1, namespace: "semantic-order" },
      sourcePath: "indexes/semantic-order.json",
      text: semanticText
    });
    assert.equal(parsedSemantic.status, "ok");
    assert.deepEqual(
      resultValue(parsedSemantic).keyDefinitions,
      keyDefinitionsOf(semanticDefinition)
    );
    assert.deepEqual(
      Object.keys(resultValue(parsedSemantic).entries[0]!.state),
      ["path", "title", "status", "summary"]
    );
    const reorderedSemantic = JSON.parse(semanticText) as {
      keyDefinitions: unknown[];
    };
    reorderedSemantic.keyDefinitions.reverse();
    const rejectedSemantic = parseStateIndex({
      definition: semanticDefinition,
      expectation: { definitionVersion: 1, namespace: "semantic-order" },
      sourcePath: "indexes/semantic-order.json",
      text: JSON.stringify(reorderedSemantic)
    });
    assert.equal(rejectedSemantic.status, "error");
    assert.ok(rejectedSemantic.diagnostics.some((entry) => (
      entry.code === "state-index.definition-mismatch"
    )));

    const parsed = parseStateIndex({
      expectation: { definitionVersion: 1, namespace: "decisions" },
      sourcePath: "indexes/decisions.json",
      text: firstText
    });
    assert.equal(parsed.status, "ok");
    const mismatched = parseStateIndex({
      expectation: { definitionVersion: 1, namespace: "investigations" },
      sourcePath: "indexes/decisions.json",
      text: firstText
    });
    assert.equal(mismatched.status, "error");
    assert.ok(mismatched.diagnostics.some((entry) => (
      entry.code === "state-index.namespace-mismatch"
    )));

    const indexPath = "indexes/decisions.json";
    const invalidModePath = "indexes/invalid-mode.json";
    const invalidMode = await syncStateIndex({
      context: { root: tempRoot },
      definition,
      indexPath: invalidModePath,
      mode: "invalid" as StateIndexSyncMode
    });
    assert.equal(invalidMode.state, "mode-invalid");
    assert.equal(invalidMode.mode, null);
    assert.equal(
      await fs.access(path.join(tempRoot, ...invalidModePath.split("/")))
        .then(() => true, () => false),
      false
    );

    const inconsistentRevision = await syncStateIndex({
      context: { root: tempRoot },
      definition: {
        ...definition,
        readRevision: async () => "different-revision"
      },
      indexPath: "indexes/inconsistent-revision.json",
      mode: "write"
    });
    assert.equal(inconsistentRevision.state, "source-invalid");
    assert.ok(inconsistentRevision.diagnostics.some((entry) => (
      entry.code === "state-index.source-changed"
    )));

    const missing = await syncStateIndex({
      context: { root: tempRoot },
      definition,
      indexPath,
      mode: "check"
    });
    assert.equal(missing.state, "index-missing");
    const written = await syncStateIndex({
      context: { root: tempRoot },
      definition,
      indexPath,
      mode: "write"
    });
    assert.equal(written.state, "written");
    const current = await syncStateIndex({
      context: { root: tempRoot },
      definition,
      indexPath,
      mode: "check"
    });
    assert.equal(current.state, "current");
    const resolvedIndexPath = path.join(
      tempRoot,
      ...indexPath.split("/")
    );
    await fs.writeFile(
      resolvedIndexPath,
      (await fs.readFile(resolvedIndexPath, "utf8")).replace(/\n/g, "\r\n"),
      "utf8"
    );
    const currentWithCrLf = await syncStateIndex({
      context: { root: tempRoot },
      definition,
      indexPath,
      mode: "check"
    });
    assert.equal(currentWithCrLf.state, "current");

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
    const changedKeyDefinitions = await loadCurrentStateIndex({
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
    assert.equal(changedKeyDefinitions.status, "error");
    assert.ok(changedKeyDefinitions.diagnostics.some((entry) => (
      entry.code === "state-index.definition-mismatch"
    )));

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
    const removeResult = await syncStateIndex({
      context: { root: tempRoot },
      definition,
      indexPath,
      mode: "write"
    });
    assert.equal(removeResult.state, "written");
    assert.equal(resultValue(await loadCurrentStateIndex({
      context: { root: tempRoot },
      definition,
      indexPath
    })).entries.length, source.states.length);

    const invalidPath = await syncStateIndex({
      context: { root: tempRoot },
      definition,
      indexPath: "../outside.json",
      mode: "write"
    });
    assert.equal(invalidPath.state, "index-path-invalid");
  } finally {
    await fs.rm(tempRoot, { force: true, recursive: true });
  }
}
