import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { executeDecisionQuery } from "../src/decision-query-service.ts";
import { decisionPublishedSnapshotSource } from "../src/decision-query-contract.ts";
import {
  currentDecisionId,
  withFixtureWorkspace,
  runSourceCli
} from "./support.ts";

async function snapshotQueries(root: string) {
  const location = { decisionsDir: "docs/decisions", workspaceRoot: root };
  return await Promise.all([
    executeDecisionQuery({
      command: "list",
      location,
      alignment: "all",
      status: "all",
      tags: [],
      limit: 10,
      offset: 0
    }),
    executeDecisionQuery({
      command: "trace",
      location,
      decisionId: currentDecisionId
    }),
    executeDecisionQuery({
      command: "search",
      location,
      alignment: "all",
      status: "all",
      tags: [],
      text: "CLI",
      match: "all",
      in: "metadata"
    })
  ]);
}

test("Decision snapshot queries perform zero Markdown reads and source directory discovery", async () => {
  await withFixtureWorkspace("query-snapshot-no-source", async (root) => {
    const readFile = fs.readFile;
    const readdir = fs.readdir;
    let markdownReads = 0;
    let discoveries = 0;
    Object.defineProperty(fs, "readFile", {
      configurable: true,
      value: (...args: Parameters<typeof fs.readFile>) => {
        if (typeof args[0] === "string" && args[0].endsWith(".md")) {
          markdownReads += 1;
          throw new Error("source unavailable");
        }
        return readFile(...args);
      }
    });
    Object.defineProperty(fs, "readdir", {
      configurable: true,
      value: (...args: Parameters<typeof fs.readdir>) => {
        discoveries += 1;
        return readdir(...args);
      }
    });
    try {
      for (const result of await snapshotQueries(root)) {
        assert.ok(result.status === "ok");
        assert.deepEqual(result.warnings, []);
        const source =
          result.command === "search"
            ? result.searchInfo.source
            : "source" in result
              ? result.source
              : null;
        assert.deepEqual(source, decisionPublishedSnapshotSource);
      }
      assert.equal(markdownReads, 0);
      assert.equal(discoveries, 0);
      const shown = await executeDecisionQuery({
        command: "show",
        location: { decisionsDir: "docs/decisions", workspaceRoot: root },
        decisionId: currentDecisionId
      });
      assert.equal(shown.status, "error");
      assert.equal(markdownReads, 1);
    } finally {
      fs.readFile = readFile;
      fs.readdir = readdir;
    }
  });
});

test("Decision snapshot queries reject corrupt incompatible and relation-invalid indexes without fallback", async () => {
  await withFixtureWorkspace("query-snapshot-invalid", async (root) => {
    const file = path.join(root, "docs/decisions/decision-index.json");
    const original = await fs.readFile(file, "utf8");
    const incompatible = JSON.parse(original) as { definitionVersion: number };
    incompatible.definitionVersion += 1;
    const invalidRelation = JSON.parse(original) as {
      entries: Record<
        string,
        { relations: { target: string; type: string }[] }
      >;
    };
    invalidRelation.entries[currentDecisionId]!.relations = [
      { target: "missing-target", type: "修订" }
    ];
    for (const data of [
      "{broken",
      JSON.stringify(incompatible),
      JSON.stringify(invalidRelation)
    ]) {
      await fs.writeFile(file, data);
      for (const result of await snapshotQueries(root))
        assert.equal(result.status, "error");
    }
    await fs.rm(file);
    for (const result of await snapshotQueries(root))
      assert.equal(result.status, "error");
    assert.equal(
      (await runSourceCli(["show", currentDecisionId, "--root", root]))
        .exitCode,
      1
    );
  });
});
