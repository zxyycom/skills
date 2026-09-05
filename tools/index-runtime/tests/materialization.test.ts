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
    const definition = defineStateIndexDefinition<{
      sourcePath: string;
      title: string;
      status: string;
      summary: { purpose: string; background: string };
    }>({
      definitionVersion: 1,
      fieldOrder: "definition",
      queryFields: [
        {
          mode: "exact",
          name: "topic",
          sources: [{ kind: "source-path-first-segment" }]
        },
        {
          mode: "exact",
          name: "status",
          sources: [{ kind: "state-path", path: ["status"] }]
        }
      ],
      namespace: "semantic-order",
      parseMetadata: (metadata) => {
        calls.metadataParses += 1;
        return metadata;
      },
      parseState: (input) => {
        calls.parses += 1;
        const summary = input.summary;
        if (
          typeof input.sourcePath !== "string" ||
          typeof input.title !== "string" ||
          typeof input.status !== "string" ||
          summary === null ||
          typeof summary !== "object" ||
          Array.isArray(summary) ||
          typeof summary.purpose !== "string" ||
          typeof summary.background !== "string"
        ) {
          throw new TypeError("invalid semantic state");
        }
        return {
          sourcePath: input.sourcePath,
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
        sourceRevision: {
          entries: {
            "topic/a.md": "semantic-a-revision-1",
            "topic/z.md": "semantic-z-revision-1"
          },
          metadata: "semantic-metadata-revision-1"
        },
        states: {
          "topic/z.md": {
            sourcePath: "topic/z.md",
            status: "active",
            summary: { background: "B", purpose: "P" },
            title: "Z"
          },
          "topic/a.md": {
            sourcePath: "topic/a.md",
            status: "active",
            summary: { background: "B", purpose: "P" },
            title: "A"
          }
        }
      }),
      readRevision: async () => {
        calls.revisionReads += 1;
        return {
          entries: {
            "topic/a.md": "semantic-a-revision-1",
            "topic/z.md": "semantic-z-revision-1"
          },
          metadata: "semantic-metadata-revision-1"
        };
      },
      validateIndex: () => {
        calls.validations += 1;
      }
    });
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

test("checks, writes, and reloads current indexes across line endings", async () => {
  await withTempRoot(async (tempRoot) => {
    const { definition, source } = await createDecisionFixture();
    const indexPath = "indexes/decisions.json";
    assert.equal(
      (
        await syncStateIndex({
          context: { root: tempRoot },
          definition,
          indexPath,
          mode: "check"
        })
      ).state,
      "index-missing"
    );
    assert.equal(
      (
        await syncStateIndex({
          context: { root: tempRoot },
          definition,
          indexPath,
          mode: "write"
        })
      ).state,
      "written"
    );
    assert.equal(
      (
        await syncStateIndex({
          context: { root: tempRoot },
          definition,
          indexPath,
          mode: "check"
        })
      ).state,
      "current"
    );

    const resolvedIndexPath = path.join(tempRoot, ...indexPath.split("/"));
    await fs.writeFile(
      resolvedIndexPath,
      (await fs.readFile(resolvedIndexPath, "utf8")).replace(/\n/g, "\r\n"),
      "utf8"
    );
    assert.equal(
      (
        await syncStateIndex({
          context: { root: tempRoot },
          definition,
          indexPath,
          mode: "check"
        })
      ).state,
      "current"
    );

    const loaded = await loadStateIndex({
      context: { root: tempRoot },
      definition,
      expectation: { definitionVersion: 1, namespace: "decisions" },
      indexPath
    });
    assert.equal(
      Object.keys(resultValue(loaded).entries).length,
      source.states.length
    );
    assert.equal(
      (
        await loadCurrentStateIndex({
          context: { root: tempRoot },
          definition,
          indexPath
        })
      ).status,
      "ok"
    );
  });
});

test("sync checks reject invalid UTF-8 indexes and writes repair them", async () => {
  await withTempRoot(async (tempRoot) => {
    const { definition, source } = await createDecisionFixture();
    source.states[0] = {
      ...source.states[0]!,
      title: "Replacement character �( stays distinguishable"
    };
    const indexPath = "indexes/invalid-utf8.json";
    const resolvedIndexPath = path.join(tempRoot, ...indexPath.split("/"));
    assert.equal(
      (
        await syncStateIndex({
          context: { root: tempRoot },
          definition,
          indexPath,
          mode: "write"
        })
      ).state,
      "written"
    );

    const expected = await fs.readFile(resolvedIndexPath);
    const validSequence = Buffer.from([0xef, 0xbf, 0xbd, 0x28]);
    const offset = expected.indexOf(validSequence);
    assert.notEqual(offset, -1);
    const invalid = Buffer.concat([
      expected.subarray(0, offset),
      Buffer.from([0xc3, 0x28]),
      expected.subarray(offset + validSequence.length)
    ]);
    assert.equal(invalid.toString("utf8"), expected.toString("utf8"));
    await fs.writeFile(resolvedIndexPath, invalid);

    const checked = await syncStateIndex({
      context: { root: tempRoot },
      definition,
      indexPath,
      mode: "check"
    });
    assert.equal(checked.status, "error");
    assert.equal(checked.state, "index-invalid");
    assert.ok(
      checked.diagnostics.some(
        (entry) => entry.code === "state-index.index-encoding-invalid"
      )
    );

    const repaired = await syncStateIndex({
      context: { root: tempRoot },
      definition,
      indexPath,
      mode: "write"
    });
    assert.equal(repaired.status, "ok");
    assert.equal(repaired.state, "written");
    assert.equal(repaired.changed, true);
    assert.deepEqual(await fs.readFile(resolvedIndexPath), expected);
    assert.equal(
      (
        await syncStateIndex({
          context: { root: tempRoot },
          definition,
          indexPath,
          mode: "check"
        })
      ).state,
      "current"
    );
  });
});

test("rejects persisted indexes with changed definition versions", async () => {
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
        definitionVersion: definition.definitionVersion + 1,
        queryFields: definition.queryFields.map((field) =>
          field.name === "status" ? { ...field, name: "lifecycle" } : field
        )
      },
      indexPath
    });
    assert.equal(result.status, "error");
    assert.ok(
      result.diagnostics.some(
        (entry) => entry.code === "state-index.definition-version-mismatch"
      )
    );
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
    assert.ok(
      staleLoad.diagnostics.some(
        (entry) => entry.code === "state-index.index-stale"
      )
    );
    assert.equal(
      (
        await syncStateIndex({
          context: { root: tempRoot },
          definition,
          indexPath,
          mode: "check"
        })
      ).state,
      "index-stale"
    );
    assert.equal(
      (
        await syncStateIndex({
          context: { root: tempRoot },
          definition,
          indexPath,
          mode: "write"
        })
      ).state,
      "written"
    );
    const refreshed = resultValue(
      await loadCurrentStateIndex({
        context: { root: tempRoot },
        definition,
        indexPath
      })
    );
    assert.equal(
      refreshed.entries[source.states[0]!.path]?.title,
      "Changed decision title"
    );

    const removed = source.states.pop();
    assert.ok(removed);
    source.revision = "decision-revision-3";
    assert.equal(
      (
        await syncStateIndex({
          context: { root: tempRoot },
          definition,
          indexPath,
          mode: "write"
        })
      ).state,
      "written"
    );
    assert.equal(
      Object.keys(
        resultValue(
          await loadCurrentStateIndex({
            context: { root: tempRoot },
            definition,
            indexPath
          })
        ).entries
      ).length,
      source.states.length
    );
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
    assert.equal(result.diagnostics[0]?.filesystem, undefined);
  });
});

test("rejects index reads through a symlink outside the configured root", async () => {
  await withTempRoot(async (tempRoot) => {
    const { definition } = await createDecisionFixture();
    for (const linkPosition of [
      "intermediate-directory",
      "final-file"
    ] as const) {
      const root = path.join(tempRoot, `read-root-${linkPosition}`);
      const outside = path.join(tempRoot, `read-outside-${linkPosition}`);
      await fs.mkdir(root, { recursive: true });
      await fs.mkdir(outside, { recursive: true });
      const outsidePath = path.join(outside, "states.json");
      await fs.writeFile(outsidePath, "outside sentinel\n", "utf8");
      if (linkPosition === "intermediate-directory") {
        await fs.symlink(outside, path.join(root, "indexes"), "dir");
      } else {
        await fs.mkdir(path.join(root, "indexes"));
        await fs.symlink(
          outsidePath,
          path.join(root, "indexes", "states.json"),
          "file"
        );
      }

      const result = await loadStateIndex({
        context: { root },
        definition,
        expectation: { definitionVersion: 1, namespace: "decisions" },
        indexPath: "indexes/states.json"
      });
      assert.equal(result.status, "error");
      assert.equal(
        result.diagnostics[0]?.code,
        "state-index.index-path-invalid"
      );
      assert.equal(
        await fs.readFile(outsidePath, "utf8"),
        "outside sentinel\n"
      );
    }
  });
});

test("rejects index writes through a symlink outside the configured root", async () => {
  await withTempRoot(async (tempRoot) => {
    const { definition } = await createDecisionFixture();
    for (const linkPosition of [
      "intermediate-directory",
      "final-file"
    ] as const) {
      const root = path.join(tempRoot, `write-root-${linkPosition}`);
      const outside = path.join(tempRoot, `write-outside-${linkPosition}`);
      await fs.mkdir(root, { recursive: true });
      await fs.mkdir(outside, { recursive: true });
      const outsidePath = path.join(outside, "states.json");
      await fs.writeFile(outsidePath, "outside sentinel\n", "utf8");
      if (linkPosition === "intermediate-directory") {
        await fs.symlink(outside, path.join(root, "indexes"), "dir");
      } else {
        await fs.mkdir(path.join(root, "indexes"));
        await fs.symlink(
          outsidePath,
          path.join(root, "indexes", "states.json"),
          "file"
        );
      }

      const result = await syncStateIndex({
        context: { root },
        definition,
        indexPath: "indexes/states.json",
        mode: "write"
      });
      assert.equal(result.state, "index-path-invalid");
      assert.equal(
        result.diagnostics[0]?.code,
        "state-index.index-path-invalid"
      );
      assert.equal(
        await fs.readFile(outsidePath, "utf8"),
        "outside sentinel\n"
      );
    }
  });
});

test("uses canonical in-root targets through a symlinked root and directory", async () => {
  await withTempRoot(async (tempRoot) => {
    const layouts = [
      {
        create: async () => {
          const realRoot = path.join(tempRoot, "real-root");
          const root = path.join(tempRoot, "root-link");
          const targetDirectory = path.join(realRoot, "indexes");
          await fs.mkdir(targetDirectory, { recursive: true });
          await fs.symlink(realRoot, root, "dir");
          return { root, targetDirectory };
        },
        name: "symlinked-root"
      },
      {
        create: async () => {
          const root = path.join(tempRoot, "internal-link-root");
          const targetDirectory = path.join(root, "actual-indexes");
          await fs.mkdir(targetDirectory, { recursive: true });
          await fs.symlink(targetDirectory, path.join(root, "indexes"), "dir");
          return { root, targetDirectory };
        },
        name: "internal-directory"
      }
    ];
    for (const layout of layouts) {
      const { root, targetDirectory } = await layout.create();
      const { definition, source } = await createDecisionFixture();
      const indexPath = "indexes/states.json";

      const written = await syncStateIndex({
        context: { root },
        definition,
        indexPath,
        mode: "write"
      });
      assert.equal(written.state, "written", layout.name);
      assert.equal(
        await fs.readFile(path.join(targetDirectory, "states.json"), "utf8"),
        serializeStateIndex(
          resultValue(await buildStateIndex(definition, { root })),
          definition
        ),
        layout.name
      );
      assert.equal(
        Object.keys(
          resultValue(
            await loadStateIndex({
              context: { root },
              definition,
              expectation: { definitionVersion: 1, namespace: "decisions" },
              indexPath
            })
          ).entries
        ).length,
        source.states.length,
        layout.name
      );
    }
  });
});
