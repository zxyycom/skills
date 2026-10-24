import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";
import {
  prepareCandidateReadContext,
  readInvestigationCandidate
} from "../src/candidate-document.ts";
import { showInvestigationCandidate } from "../src/candidate.ts";
import { inspectInvestigationCollectionLayout } from "../src/investigation-index-source.ts";
import { writeCollection } from "./collection-support.ts";
import {
  investigationRoot,
  reportMarkdown,
  withTempRoot
} from "./fixture-support.ts";

async function writeSharedCandidate(root: string): Promise<void> {
  const directory = investigationRoot(root);
  await fs.mkdir(path.join(directory, "_resources/owner"), { recursive: true });
  await fs.writeFile(
    path.join(directory, "_resources/owner/sample.txt"),
    "sample\n"
  );
  await fs.writeFile(
    path.join(directory, "_candidate.next"),
    reportMarkdown({ id: "next", resources: ["owner/sample.txt"] })
  );
}

test("candidate preparation uses published owner declarations without reading formal owner bytes", async () => {
  await withTempRoot("candidate-complete-layout", async (root) => {
    await writeSharedCandidate(root);
    await writeCollection(root, [
      { id: "owner", resources: ["owner/sample.txt"] },
      { id: "unused" }
    ]);
    const directory = investigationRoot(root);
    const layout = await inspectInvestigationCollectionLayout(directory);
    assert.deepEqual(layout.errors, []);
    const original = fs.readFile;
    const reads: string[] = [];
    fs.readFile = (async (...args: Parameters<typeof fs.readFile>) => {
      const target = args[0];
      if (typeof target === "string" && path.dirname(target) === directory)
        reads.push(path.basename(target));
      return await original(...args);
    }) as typeof fs.readFile;
    try {
      const context = await prepareCandidateReadContext(directory, layout, [
        "next"
      ]);
      const candidate = await readInvestigationCandidate(
        directory,
        "next",
        context
      );
      assert.equal(candidate.status, "ok");
      if (candidate.status !== "ok") assert.fail("candidate must be readable");
      assert.deepEqual(candidate.value.errors, []);
      assert.equal(candidate.value.readiness.resourceReady, true);
      assert.deepEqual([...context.references.keys()], ["next", "owner"]);
      assert.deepEqual(reads, ["investigation-index.json"]);
    } finally {
      fs.readFile = original;
    }
  });
});

test("candidate reads use indexed owner declarations despite source moves and require a valid index", async () => {
  await withTempRoot("candidate-owner-discovery", async (root) => {
    await writeSharedCandidate(root);
    await writeCollection(root, [
      { id: "owner", resources: ["owner/sample.txt"] }
    ]);
    const directory = investigationRoot(root);
    const indexPath = path.join(directory, "investigation-index.json");
    await fs.rename(
      path.join(directory, "owner.md"),
      path.join(directory, "moved.md")
    );
    const partial = await inspectInvestigationCollectionLayout(directory, {
      readFormalSources: false
    });
    assert.deepEqual(partial.formalSources, []);
    const indexed = await showInvestigationCandidate({
      workspaceRoot: root,
      id: "next"
    });
    assert.equal(indexed.status, "ok");
    await fs.writeFile(indexPath, "invalid JSON\n");
    const unindexed = await showInvestigationCandidate({
      workspaceRoot: root,
      id: "next"
    });
    assert.equal(unindexed.status, "error");
    await fs.rm(indexPath);
    const missing = await showInvestigationCandidate({
      workspaceRoot: root,
      id: "next"
    });
    assert.equal(missing.status, "error");
  });
});

test("candidate resource readiness does not read an indexed formal owner body", async () => {
  await withTempRoot("candidate-owner-access", async (root) => {
    await writeSharedCandidate(root);
    await writeCollection(root, [
      { id: "owner", resources: ["owner/sample.txt"] }
    ]);
    const directory = investigationRoot(root);
    const owner = path.join(directory, "owner.md");
    const original = fs.open;
    fs.open = (async (...args: Parameters<typeof fs.open>) => {
      if (args[0] === owner)
        throw Object.assign(new Error("owner access denied"), {
          code: "EACCES"
        });
      return await original(...args);
    }) as typeof fs.open;
    try {
      const denied = await showInvestigationCandidate({
        workspaceRoot: root,
        id: "next"
      });
      assert.equal(denied.status, "ok");
      assert.equal(denied.candidate?.readiness.resourceReady, true);
    } finally {
      fs.open = original;
    }
  });
});

test("candidate reads do not discover duplicate unselected formal bodies outside published locations", async () => {
  await withTempRoot("candidate-owner-duplicates", async (root) => {
    await writeSharedCandidate(root);
    await writeCollection(root, [
      { id: "owner", resources: ["owner/sample.txt"] }
    ]);
    const directory = investigationRoot(root);
    await fs.rm(path.join(directory, "owner.md"));
    for (const sourcePath of ["first.md", "second.md"])
      await fs.writeFile(
        path.join(directory, sourcePath),
        reportMarkdown({ id: "owner", resources: ["owner/sample.txt"] })
      );
    const duplicate = await showInvestigationCandidate({
      workspaceRoot: root,
      id: "next"
    });
    assert.equal(duplicate.status, "ok");
    assert.equal(duplicate.candidate?.readiness.resourceReady, true);
  });
});
