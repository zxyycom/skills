import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";
import { readInvestigationSources } from "../src/investigation-index-source.ts";
import { loadInvestigationIndex } from "../src/investigation-state-index.ts";
import {
  investigationRoot,
  reportMarkdown,
  withTempRoot
} from "./fixture-support.ts";
import { writeCollection } from "./collection-support.ts";

test("source batch discovers moved and unindexed identities once without turning unrelated layout errors into a scope gate", async () => {
  await withTempRoot("batch-discovery", async (root) => {
    await writeCollection(root, [{ id: "one" }, { id: "two" }]);
    const directory = investigationRoot(root);
    await fs.rename(
      path.join(directory, "one.md"),
      path.join(directory, "moved.md")
    );
    await fs.writeFile(
      path.join(directory, "three.md"),
      reportMarkdown({ id: "three" })
    );
    await fs.writeFile(
      path.join(directory, "unrelated.txt"),
      "not a formal source"
    );
    const original = fs.readdir;
    let scans = 0;
    fs.readdir = ((...args: Parameters<typeof fs.readdir>) => {
      if (args[0] === directory) scans += 1;
      return original(...args);
    }) as typeof fs.readdir;
    let sources;
    try {
      sources = await readInvestigationSources(directory, [
        "three",
        "one",
        "two"
      ]);
    } finally {
      fs.readdir = original;
    }
    assert.equal(scans, 1);
    assert.deepEqual(
      sources.map(({ id, sourcePath }) => ({ id, sourcePath })),
      [
        { id: "one", sourcePath: "moved.md" },
        { id: "three", sourcePath: "three.md" },
        { id: "two", sourcePath: "two.md" }
      ]
    );
  });
});

test("source batch rejects absent and duplicated discovered identities instead of accepting the first path", async () => {
  await withTempRoot("batch-duplicates", async (root) => {
    await writeCollection(root, [{ id: "one" }]);
    const directory = investigationRoot(root);
    await fs.rm(path.join(directory, "one.md"));
    await fs.writeFile(
      path.join(directory, "first.md"),
      reportMarkdown({ id: "one" })
    );
    await fs.writeFile(
      path.join(directory, "second.md"),
      reportMarkdown({ id: "one" })
    );
    for (const id of ["one", "absent"]) {
      await assert.rejects(
        readInvestigationSources(directory, [id]),
        new RegExp(
          `Investigation ID does not resolve to one source path: ${id}`,
          "u"
        )
      );
    }
    await assert.rejects(
      readInvestigationSources(directory, ["one", "one"]),
      /unique Investigation IDs/u
    );
  });
});

test("source batch preserves indexed read failures and discovery failures rather than manufacturing an empty source", async () => {
  await withTempRoot("batch-read-failure", async (root) => {
    await writeCollection(root, [{ id: "one" }]);
    const directory = investigationRoot(root);
    const loaded = await loadInvestigationIndex({
      investigationsDirectory: directory
    });
    await fs.rm(path.join(directory, "one.md"));
    await fs.mkdir(path.join(directory, "one.md"));
    await assert.rejects(
      readInvestigationSources(directory, ["one"], undefined, loaded),
      /must be a regular non-symbolic-link file/u
    );
    await fs.rm(directory, { recursive: true });
    await assert.rejects(
      readInvestigationSources(directory, ["absent"], undefined, loaded),
      /investigation root could not be read/u
    );
  });
});
