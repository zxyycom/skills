import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  buildStateIndex,
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
    const firstText = serializeStateIndex(resultValue(firstBuild));
    source.states.reverse();
    assert.equal(
      serializeStateIndex(resultValue(await buildStateIndex(definition, { root: tempRoot }))),
      firstText
    );
    source.states.reverse();
    assert.equal(firstText.endsWith("\n"), true);
    assert.equal(firstText.includes("generatedAt"), false);

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
