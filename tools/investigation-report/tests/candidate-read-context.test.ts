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

test("candidate preparation reuses complete formal identities and owner bytes without reading the published index", async () => {
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
      assert.deepEqual(reads, []);
    } finally {
      fs.readFile = original;
    }
  });
});

test("candidate preparation with an empty formal layout still supports a first candidate without an index", async () => {
  await withTempRoot("candidate-empty-layout", async (root) => {
    const directory = investigationRoot(root);
    await fs.mkdir(directory, { recursive: true });
    await fs.writeFile(
      path.join(directory, "_candidate.first"),
      reportMarkdown({ id: "first" })
    );
    const layout = await inspectInvestigationCollectionLayout(directory);
    assert.deepEqual(layout.formalSources, []);
    const context = await prepareCandidateReadContext(directory, layout);
    const candidate = await readInvestigationCandidate(
      directory,
      "first",
      context
    );
    assert.equal(candidate.status, "ok");
    if (candidate.status !== "ok")
      assert.fail("first candidate must be readable");
    assert.deepEqual(candidate.value.errors, []);
  });
});

test("candidate partial layouts discover moved formal owners when the index is stale or unavailable", async () => {
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
    assert.deepEqual(indexed.candidate?.errors, []);
    await fs.writeFile(indexPath, "invalid JSON\n");
    const unindexed = await showInvestigationCandidate({
      workspaceRoot: root,
      id: "next"
    });
    assert.equal(unindexed.status, "ok");
    assert.deepEqual(unindexed.candidate?.errors, []);
    await fs.rm(indexPath);
    const missing = await showInvestigationCandidate({
      workspaceRoot: root,
      id: "next"
    });
    assert.equal(missing.status, "ok");
    assert.deepEqual(missing.candidate?.errors, []);
  });
});

test("candidate partial layouts preserve required owner access and duplicate identity failures", async () => {
  await withTempRoot("candidate-owner-failure", async (root) => {
    await writeSharedCandidate(root);
    await writeCollection(root, [
      { id: "owner", resources: ["owner/sample.txt"] }
    ]);
    const directory = investigationRoot(root);
    const owner = path.join(directory, "owner.md");
    const original = fs.readFile;
    fs.readFile = (async (...args: Parameters<typeof fs.readFile>) => {
      if (args[0] === owner)
        throw Object.assign(new Error("owner access denied"), {
          code: "EACCES"
        });
      return await original(...args);
    }) as typeof fs.readFile;
    try {
      const denied = await showInvestigationCandidate({
        workspaceRoot: root,
        id: "next"
      });
      assert.equal(denied.status, "error");
      assert.equal(
        denied.diagnostics[0]?.code,
        "investigation-report.candidate-read-failed"
      );
      assert.equal(denied.diagnostics[0]?.causeCategory, "access-denied");
    } finally {
      fs.readFile = original;
    }
    await fs.rm(owner);
    for (const sourcePath of ["first.md", "second.md"])
      await fs.writeFile(
        path.join(directory, sourcePath),
        reportMarkdown({ id: "owner", resources: ["owner/sample.txt"] })
      );
    const duplicate = await showInvestigationCandidate({
      workspaceRoot: root,
      id: "next"
    });
    assert.equal(duplicate.status, "error");
    assert.equal(
      duplicate.diagnostics[0]?.code,
      "investigation-report.candidate-read-failed"
    );
  });
});
