import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import {
  buildStateIndex,
  parseStateIndex,
  serializeStateIndex,
  syncStateIndex,
  type StateIndexSyncMode
} from "../src/index.ts";
import { resultValue } from "./support.ts";
import {
  createDecisionFixture,
  withTempRoot
} from "./materialization-test-support.ts";
test("rejects persisted indexes from another namespace", async () => {
  await withTempRoot(async (tempRoot) => {
    const { definition } = await createDecisionFixture();
    const text = serializeStateIndex(
      resultValue(await buildStateIndex(definition, { root: tempRoot })),
      definition
    );
    assert.equal(
      parseStateIndex({
        definition,
        expectation: { definitionVersion: 1, namespace: "decisions" },
        sourcePath: "indexes/decisions.json",
        text
      }).status,
      "ok"
    );

    const mismatched = parseStateIndex({
      definition,
      expectation: { definitionVersion: 1, namespace: "investigations" },
      sourcePath: "indexes/decisions.json",
      text
    });
    assert.equal(mismatched.status, "error");
    assert.ok(
      mismatched.diagnostics.some(
        (entry) => entry.code === "state-index.definition-mismatch"
      )
    );
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
      await fs.access(path.join(tempRoot, ...indexPath.split("/"))).then(
        () => true,
        () => false
      ),
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
        readRevision: async () => ({
          entries: {},
          metadata: "different-revision"
        })
      },
      indexPath: "indexes/inconsistent-revision.json",
      mode: "write"
    });
    assert.equal(result.state, "source-invalid");
    assert.ok(
      result.diagnostics.some(
        (entry) => entry.code === "state-index.source-changed"
      )
    );
  });
});

test("reports safe structured filesystem failures from sources and storage", async () => {
  await withTempRoot(async (tempRoot) => {
    const { definition } = await createDecisionFixture();
    const sourceError = Object.assign(
      new Error(
        "Authorization: Bearer source-secret\\nread /private workspace/secret data/index.json; " +
          "x".repeat(600)
      ),
      { code: "EACCES" }
    );
    const failingSourceDefinition = {
      ...definition,
      read: async () => {
        throw sourceError;
      }
    };
    const built = await buildStateIndex(failingSourceDefinition, {
      root: tempRoot
    });
    assert.equal(built.status, "error");
    const sourceDiagnostic = built.diagnostics[0];
    assert.equal(sourceDiagnostic?.code, "state-index.source-read-failed");
    assert.equal(
      sourceDiagnostic?.message,
      "failed to read the state-index source; inspect source availability and access, then retry"
    );
    assert.deepEqual(
      {
        causeCategory: sourceDiagnostic?.filesystem?.causeCategory,
        operation: sourceDiagnostic?.filesystem?.operation,
        target: sourceDiagnostic?.filesystem?.target
      },
      {
        causeCategory: "access-denied",
        operation: "read a state-index source",
        target: "state-index source"
      }
    );
    assert.ok(sourceDiagnostic?.filesystem?.detail);
    assert.ok(sourceDiagnostic.filesystem.detail.length <= 500);
    assert.doesNotMatch(
      sourceDiagnostic.filesystem.detail,
      /Bearer|source-secret|private workspace|secret data|\r|\n/u
    );

    const sourceSync = await syncStateIndex({
      context: { root: tempRoot },
      definition: failingSourceDefinition,
      indexPath: "indexes/source.json",
      mode: "check"
    });
    assert.equal(sourceSync.state, "source-invalid");
    assert.deepEqual(
      sourceSync.diagnostics[0]?.filesystem,
      sourceDiagnostic.filesystem
    );

    const storageRoot = path.join(tempRoot, "private workspace secret data");
    const storageIndexPath = "indexes/storage.json";
    await fs.mkdir(path.join(storageRoot, storageIndexPath), {
      recursive: true
    });
    const storage = await syncStateIndex({
      context: { root: storageRoot },
      definition,
      indexPath: storageIndexPath,
      mode: "check"
    });
    assert.equal(storage.state, "index-read-failed");
    const storageDiagnostic = storage.diagnostics[0];
    assert.equal(
      storageDiagnostic?.message,
      "failed to read the state-index file; inspect index availability and access, then retry"
    );
    assert.deepEqual(storageDiagnostic?.filesystem, {
      causeCategory: "unknown",
      detail: storageDiagnostic?.filesystem?.detail,
      operation: "read a state-index file",
      target: storageIndexPath
    });
    assert.ok(storageDiagnostic?.filesystem?.detail);
    assert.doesNotMatch(
      storageDiagnostic.filesystem.detail,
      /private workspace|secret data|\r|\n/u
    );
  });
});

test("reports non-filesystem source callback failures without filesystem facts", async () => {
  await withTempRoot(async (tempRoot) => {
    const { definition } = await createDecisionFixture();
    const sourceResult = await buildStateIndex(
      {
        ...definition,
        read: async () => {
          throw new Error(
            "token=source-secret\\nread /private workspace/secret data/index.json"
          );
        }
      },
      { root: tempRoot }
    );
    assert.equal(sourceResult.status, "error");
    assert.deepEqual(sourceResult.diagnostics[0], {
      code: "state-index.source-read-failed",
      message:
        "failed to read the state-index source; inspect source availability and access, then retry",
      path: null,
      stateId: null
    });

    const abortResult = await buildStateIndex(
      {
        ...definition,
        read: async () => {
          throw Object.assign(new Error("source callback aborted"), {
            code: "ABORT_ERR"
          });
        }
      },
      { root: tempRoot }
    );
    assert.equal(abortResult.status, "error");
    assert.equal(
      abortResult.diagnostics[0]?.code,
      "state-index.source-read-failed"
    );
    assert.equal(abortResult.diagnostics[0]?.filesystem, undefined);

    const revision = await syncStateIndex({
      context: { root: tempRoot },
      definition: {
        ...definition,
        readRevision: async () => {
          throw new Error(
            "Authorization: Bearer revision-secret\\nread /private workspace/revision"
          );
        }
      },
      indexPath: "indexes/revision.json",
      mode: "check"
    });
    assert.equal(revision.state, "source-invalid");
    assert.deepEqual(revision.diagnostics[0], {
      code: "state-index.revision-read-failed",
      message:
        "failed to read the current state-index source revision; inspect source availability and access, then retry",
      path: "indexes/revision.json",
      stateId: null
    });
  });
});
