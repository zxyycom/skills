import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import {
  buildStateIndex,
  loadCurrentStateIndex,
  loadStateIndex,
  serializeStateIndex,
  syncStateIndex
} from "../src/index.ts";
import { resultValue } from "./support.ts";
import {
  createDecisionFixture,
  withTempRoot
} from "./materialization-test-support.ts";
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
