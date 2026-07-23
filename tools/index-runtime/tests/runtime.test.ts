import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  buildStateIndex,
  createStateIndexRuntime,
  defineStateIndexDefinition,
  type JsonObject
} from "../src/index.ts";
import {
  decisionDefinition,
  decisionStates,
  resultValue,
  type DecisionState,
  type MemoryStateSource
} from "./support.ts";

export async function testRuntime(): Promise<void> {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "state-index-runtime-"));
  try {
    const source: MemoryStateSource<DecisionState> = {
      revision: "runtime-revision-1",
      states: await decisionStates()
    };
    const definition = decisionDefinition(source);
    const runtime = createStateIndexRuntime({
      definition,
      indexPath: "indexes/decisions.json",
      root: tempRoot
    });
    assert.equal((await runtime.sync("write")).state, "written");

    const queried = await runtime.query({
      filters: [{
        key: "status",
        kind: "exact",
        operator: "all",
        values: ["active"]
      }]
    });
    assert.equal(resultValue(queried).total, 2);
    const found = await runtime.get("architecture/use-shared-cache.md");
    const foundTitle: string | undefined = resultValue(found)?.state.title;
    assert.equal(foundTitle, "采用共享缓存策略");

    const runtimeState: DecisionState = {
      ...source.states[0]!,
      status: "archived"
    };
    const liveQuery = await runtime.query({
      filters: [{
        key: "status",
        kind: "exact",
        operator: "all",
        values: ["archived"]
      }]
    }, { runtimeStates: [runtimeState] });
    assert.deepEqual(
      resultValue(liveQuery).entries.map((entry) => entry.id),
      [runtimeState.path]
    );

    const incompatibleDefinition = defineStateIndexDefinition({
      ...definition,
      keyStrategies: definition.keyStrategies.map((strategy) => (
        strategy.name === "status"
          ? { ...strategy, derive: () => "definition-changed" }
          : strategy
      ))
    });
    const incompatibleRuntime = createStateIndexRuntime({
      definition: incompatibleDefinition,
      indexPath: "indexes/decisions.json",
      root: tempRoot
    });
    const incompatibleProjection = await incompatibleRuntime.query();
    assert.equal(incompatibleProjection.status, "error");
    assert.ok(incompatibleProjection.diagnostics.some((entry) => (
      entry.code === "state-index.definition-mismatch"
    )));

    const persistedPath = path.join(tempRoot, "indexes", "decisions.json");
    const persisted = JSON.parse(
      await fs.readFile(persistedPath, "utf8")
    ) as { entries: Array<{ state: { title: unknown } }> };
    persisted.entries[0]!.state.title = 42;
    await fs.writeFile(persistedPath, `${JSON.stringify(persisted, null, 2)}\n`);
    const invalidPersistedState = await runtime.query();
    assert.equal(invalidPersistedState.status, "error");
    assert.ok(invalidPersistedState.diagnostics.some((entry) => (
      entry.code === "state-index.state-parse-failed"
      && entry.path === "indexes/decisions.json"
    )));
    assert.equal((await runtime.sync("write")).state, "written");

    source.revision = "runtime-revision-2";
    source.states[0] = {
      ...source.states[0]!,
      status: "archived"
    };
    assert.equal((await runtime.get(source.states[0]!.path)).status, "error");
    assert.equal((await runtime.sync("write")).state, "written");
    assert.equal((await runtime.get(source.states[0]!.path)).status, "ok");

    assert.throws(
      () => defineStateIndexDefinition({
        definitionVersion: 1,
        identify: () => "state",
        keyStrategies: [
          { derive: () => "a", mode: "exact", name: "status" },
          { derive: () => "b", mode: "exact", name: "status" }
        ],
        namespace: "duplicate-keys",
        parseState: (state) => state,
        read: async () => ({ revision: "one", states: [{}] }),
        readRevision: async () => "one"
      }),
      /appears more than once/u
    );
    assert.throws(
      () => defineStateIndexDefinition({
        definitionVersion: 1,
        identify: () => "state",
        keyStrategies: [
          { derive: () => "state", mode: "exact", name: "id" }
        ],
        namespace: "reserved-key",
        parseState: (state) => state,
        read: async () => ({ revision: "one", states: [{}] }),
        readRevision: async () => "one"
      }),
      /reserved id/u
    );
    assert.throws(
      () => defineStateIndexDefinition({
        definitionVersion: 1,
        identify: () => "state",
        keyStrategies: [
          { derive: () => "active", mode: "exact", name: "status" }
        ],
        namespace: "missing-parser",
        parseState: null as never,
        read: async () => ({ revision: "one", states: [{}] }),
        readRevision: async () => "one"
      }),
      /parseState/u
    );

    const duplicateIdDefinition = defineStateIndexDefinition({
      definitionVersion: 1,
      identify: () => "same-id",
      keyStrategies: [{ derive: () => "active", mode: "exact", name: "status" }],
      namespace: "duplicate-id",
      parseState: (state) => state,
      read: async () => ({ revision: "one", states: [{ a: 1 }, { a: 2 }] }),
      readRevision: async () => "one"
    });
    const duplicateId = await buildStateIndex(duplicateIdDefinition, { root: tempRoot });
    assert.equal(duplicateId.status, "error");
    assert.ok(duplicateId.diagnostics.some((entry) => (
      entry.code === "state-index.id-duplicate"
    )));

    const invalidStateDefinition = defineStateIndexDefinition<JsonObject>({
      definitionVersion: 1,
      identify: () => "invalid",
      keyStrategies: [{ derive: () => "active", mode: "exact", name: "status" }],
      namespace: "invalid-state",
      parseState: (state) => state,
      read: async () => ({ revision: "one", states: [{ value: Number.NaN }] }),
      readRevision: async () => "one"
    });
    const invalidState = await buildStateIndex(invalidStateDefinition, { root: tempRoot });
    assert.equal(invalidState.status, "error");
    assert.ok(invalidState.diagnostics.some((entry) => (
      entry.code === "state-index.state-invalid"
    )));

    const invalidParserOutput = defineStateIndexDefinition<JsonObject>({
      definitionVersion: 1,
      identify: () => "invalid-parser-output",
      keyStrategies: [{ derive: () => "active", mode: "exact", name: "status" }],
      namespace: "invalid-parser-output",
      parseState: () => new Date() as never,
      read: async () => ({ revision: "one", states: [{}] }),
      readRevision: async () => "one"
    });
    const invalidParsedState = await buildStateIndex(invalidParserOutput, {
      root: tempRoot
    });
    assert.equal(invalidParsedState.status, "error");
    assert.ok(invalidParsedState.diagnostics.some((entry) => (
      entry.code === "state-index.state-parse-invalid"
    )));

    const invalidTextKey = defineStateIndexDefinition({
      definitionVersion: 1,
      identify: () => "invalid-key",
      keyStrategies: [{ derive: () => true, mode: "text", name: "text" }],
      namespace: "invalid-text-key",
      parseState: (state) => state,
      read: async () => ({ revision: "one", states: [{}] }),
      readRevision: async () => "one"
    });
    const invalidKey = await buildStateIndex(invalidTextKey, { root: tempRoot });
    assert.equal(invalidKey.status, "error");
    assert.ok(invalidKey.diagnostics.some((entry) => (
      entry.code === "state-index.key-value-invalid"
    )));

    const malformedRead = defineStateIndexDefinition({
      definitionVersion: 1,
      identify: () => "state",
      keyStrategies: [{ derive: () => "active", mode: "exact", name: "status" }],
      namespace: "malformed-read",
      parseState: (state) => state,
      read: async () => null as never,
      readRevision: async () => "one"
    });
    assert.equal(
      (await buildStateIndex(malformedRead, { root: tempRoot })).status,
      "error"
    );

    const controller = new AbortController();
    controller.abort();
    const aborted = await buildStateIndex(definition, {
      root: tempRoot,
      signal: controller.signal
    });
    assert.equal(aborted.status, "error");
    assert.ok(aborted.diagnostics.some((entry) => (
      entry.code === "state-index.operation-aborted"
    )));
  } finally {
    await fs.rm(tempRoot, { force: true, recursive: true });
  }
}
