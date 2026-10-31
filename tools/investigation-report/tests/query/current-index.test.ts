import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";
import {
  loadCurrentInvestigationIndex,
  loadInvestigationIndex
} from "../../src/index/investigation-state-index.ts";
import { writeCollection } from "../support/collection-support.ts";
import {
  investigationRoot,
  jsonObjectMember,
  parseJsonObject,
  withTempRoot
} from "../support/fixture-support.ts";

test("current investigation loading parses one persisted snapshot and rechecks source freshness on every call", async () => {
  await withTempRoot("current-index-reuse", async (root) => {
    await writeCollection(root, [{ id: "one" }, { id: "two" }]);
    const directory = investigationRoot(root);
    const text = await fs.readFile(
      path.join(directory, "investigation-index.json"),
      "utf8"
    );
    const expected = await loadInvestigationIndex({
      investigationsDirectory: directory
    });
    const original = JSON.parse;
    let parses = 0;
    JSON.parse = (...args: Parameters<typeof JSON.parse>) => {
      if (args[0] === text) parses += 1;
      return original(...args);
    };
    try {
      assert.deepEqual(
        await loadCurrentInvestigationIndex({
          investigationsDirectory: directory
        }),
        expected
      );
      assert.equal(parses, 1);
      await fs.appendFile(path.join(directory, "one.md"), "changed\n");
      const stale = await loadCurrentInvestigationIndex({
        investigationsDirectory: directory
      });
      assert.equal(stale.status, "error");
      assert.deepEqual(
        stale.diagnostics.map((item) => item.code),
        ["state-index.index-stale"]
      );
      assert.equal(parses, 2);
    } finally {
      JSON.parse = original;
    }
  });
});

test("current investigation loading preserves strict state metadata and collection validation", async () => {
  await withTempRoot("current-index-validation", async (root) => {
    await writeCollection(root, [{ id: "one" }, { id: "two" }]);
    const directory = investigationRoot(root);
    const indexPath = path.join(directory, "investigation-index.json");
    const text = await fs.readFile(indexPath, "utf8");
    const invalidState = parseJsonObject(text);
    jsonObjectMember(jsonObjectMember(invalidState, "entries"), "one")[
      "formedAt"
    ] = "invalid";
    const invalidMetadata = parseJsonObject(text);
    jsonObjectMember(invalidMetadata, "metadata")["extra"] = true;
    const duplicatePath = parseJsonObject(text);
    jsonObjectMember(jsonObjectMember(duplicatePath, "entries"), "two")[
      "sourcePath"
    ] = "one.md";
    for (const invalid of [invalidState, invalidMetadata, duplicatePath]) {
      await fs.writeFile(indexPath, JSON.stringify(invalid));
      const current = await loadCurrentInvestigationIndex({
        investigationsDirectory: directory
      });
      const strict = await loadInvestigationIndex({
        investigationsDirectory: directory
      });
      assert.equal(current.status, "error");
      assert.deepEqual(current, strict);
    }
  });
});

test("current investigation loading preserves envelope source access and cancellation failures", async () => {
  await withTempRoot("current-index-failures", async (root) => {
    await writeCollection(root, [{ id: "one" }]);
    const directory = investigationRoot(root);
    const indexPath = path.join(directory, "investigation-index.json");
    const text = await fs.readFile(indexPath, "utf8");
    const mismatchedDefinition = parseJsonObject(text);
    mismatchedDefinition["definitionVersion"] = 0;
    for (const invalid of ["{", JSON.stringify(mismatchedDefinition)]) {
      await fs.writeFile(indexPath, invalid);
      assert.equal(
        (
          await loadCurrentInvestigationIndex({
            investigationsDirectory: directory
          })
        ).status,
        "error"
      );
    }
    await fs.rm(indexPath);
    const missing = await loadCurrentInvestigationIndex({
      investigationsDirectory: directory
    });
    assert.equal(missing.diagnostics[0]?.code, "state-index.index-missing");
    await fs.writeFile(indexPath, text);
    const cancelled = await loadCurrentInvestigationIndex({
      investigationsDirectory: directory,
      signal: AbortSignal.abort()
    });
    assert.equal(cancelled.status, "error");
    await fs.rm(path.join(directory, "one.md"));
    await fs.symlink(
      path.join(root, "outside.md"),
      path.join(directory, "one.md")
    );
    assert.equal(
      (
        await loadCurrentInvestigationIndex({
          investigationsDirectory: directory
        })
      ).status,
      "error"
    );
  });
});
