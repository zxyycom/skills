import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";
import { stageInvestigationReports } from "../src/staging.ts";
import {
  git,
  indexRelativePath,
  initializeGit,
  investigationRoot,
  jsonObjectMember,
  parseJsonObject,
  withTempRoot,
  writeCollection
} from "./v6-support.ts";

async function writeResource(
  root: string,
  id: string,
  bytes: string
): Promise<void> {
  await fs.mkdir(path.dirname(resourcePath(root, id)), { recursive: true });
  await fs.writeFile(resourcePath(root, id), bytes, "utf8");
}

function resourcePath(root: string, id: string): string {
  return path.join(investigationRoot(root), "_resources", id);
}

test("stage --scope domain writes the report and its complete owner resource tree", async () => {
  await withTempRoot("stage-domain-tree", async (root) => {
    await writeResource(root, "first/evidence.txt", "baseline evidence\n");
    await writeCollection(root, [
      { id: "first", resources: ["first/evidence.txt"] },
      { id: "second" }
    ]);
    initializeGit(root);
    // Owner tree gains an unreferenced member, a nested member, and a byte
    // change to the referenced member; the report body changes as well.
    await fs.writeFile(
      resourcePath(root, "first/evidence.txt"),
      "modified evidence\n",
      "utf8"
    );
    await writeResource(root, "first/unreferenced.txt", "unreferenced notes\n");
    await writeResource(root, "first/nested/nested.txt", "nested evidence\n");
    await writeCollection(root, [
      { id: "first", resources: ["first/evidence.txt"], title: "Changed" },
      { id: "second" }
    ]);
    const result = await stageInvestigationReports({
      reportIds: ["first"],
      scope: "domain",
      workspaceRoot: root
    });
    assert.equal(result.status, "ok");
    assert.equal(result.changed, true);
    assert.equal(result.scope, "domain");
    assert.deepEqual(result.selectedIds, ["first"]);
    assert.deepEqual(result.writtenPaths, [
      "docs/investigations/_resources/first/evidence.txt",
      "docs/investigations/_resources/first/nested/nested.txt",
      "docs/investigations/_resources/first/unreferenced.txt",
      "docs/investigations/first.md"
    ]);
    const pending = git(root, ["diff", "--cached", "--name-status"]);
    assert.match(
      pending,
      /M\tdocs\/investigations\/_resources\/first\/evidence\.txt/u
    );
    assert.match(
      pending,
      /A\tdocs\/investigations\/_resources\/first\/nested\/nested\.txt/u
    );
    assert.match(
      pending,
      /A\tdocs\/investigations\/_resources\/first\/unreferenced\.txt/u
    );
    assert.match(pending, /M\tdocs\/investigations\/first\.md/u);
    assert.equal(git(root, ["diff", "--cached", "--", indexRelativePath]), "");
    assert.equal(
      git(root, ["diff", "--cached", "--", "docs/investigations/second.md"]),
      ""
    );
  });
});

test("stage --scope domain stages owner resource deletions and ignores other owners", async () => {
  await withTempRoot("stage-domain-deletion", async (root) => {
    await writeResource(root, "first/evidence.txt", "first evidence\n");
    await writeResource(root, "second/evidence.txt", "second evidence\n");
    await writeCollection(root, [
      { id: "first", resources: ["first/evidence.txt"] },
      { id: "second", resources: ["second/evidence.txt"] }
    ]);
    initializeGit(root);
    await fs.rm(resourcePath(root, "first/evidence.txt"));
    await writeResource(root, "second/evidence.txt", "changed second\n");
    await writeCollection(root, [
      { id: "first" },
      { id: "second", resources: ["second/evidence.txt"] }
    ]);
    const result = await stageInvestigationReports({
      reportIds: ["first"],
      scope: "domain",
      workspaceRoot: root
    });
    assert.equal(result.status, "ok");
    assert.match(
      git(root, ["diff", "--cached", "--name-status"]),
      /D\tdocs\/investigations\/_resources\/first\/evidence\.txt/u
    );
    assert.equal(
      git(root, [
        "diff",
        "--cached",
        "--",
        "docs/investigations/_resources/second/evidence.txt"
      ]),
      ""
    );
  });
});

test("stage --scope domain stages report deletion with the owner tree for a baseline-only ID", async () => {
  await withTempRoot("stage-domain-report-deletion", async (root) => {
    await writeResource(root, "removed/evidence.txt", "removed evidence\n");
    await writeCollection(root, [
      { id: "removed", resources: ["removed/evidence.txt"] },
      { id: "kept" }
    ]);
    initializeGit(root);
    await fs.rm(path.join(investigationRoot(root), "removed.md"));
    await fs.rm(resourcePath(root, "removed/evidence.txt"), { force: true });
    await fs.rm(path.join(investigationRoot(root), "_resources", "removed"), {
      force: true,
      recursive: true
    });
    await writeCollection(root, [{ id: "kept" }]);
    const result = await stageInvestigationReports({
      reportIds: ["removed"],
      scope: "domain",
      workspaceRoot: root
    });
    assert.equal(result.status, "ok");
    const pending = git(root, ["diff", "--cached", "--name-status"]);
    assert.match(pending, /D\tdocs\/investigations\/removed\.md/u);
    assert.match(
      pending,
      /D\tdocs\/investigations\/_resources\/removed\/evidence\.txt/u
    );
    assert.equal(
      git(root, ["diff", "--cached", "--", "docs/investigations/kept.md"]),
      ""
    );
  });
});

test("stage --scope domain keeps unrelated staged deletions when staging another report", async () => {
  await withTempRoot("stage-domain-keeps-deletion", async (root) => {
    await writeResource(root, "removed/evidence.txt", "removed evidence\n");
    await writeCollection(root, [
      { id: "removed", resources: ["removed/evidence.txt"] },
      { id: "kept" }
    ]);
    initializeGit(root);
    await fs.rm(path.join(investigationRoot(root), "removed.md"));
    await fs.rm(path.join(investigationRoot(root), "_resources", "removed"), {
      force: true,
      recursive: true
    });
    await writeCollection(root, [{ id: "kept" }]);
    const deletion = await stageInvestigationReports({
      reportIds: ["removed"],
      scope: "domain",
      workspaceRoot: root
    });
    assert.equal(deletion.status, "ok");
    await writeCollection(root, [{ id: "kept", title: "Changed" }]);
    const result = await stageInvestigationReports({
      reportIds: ["kept"],
      scope: "domain",
      workspaceRoot: root
    });
    assert.equal(result.status, "ok");
    assert.deepEqual(result.writtenPaths, ["docs/investigations/kept.md"]);
    const pending = git(root, [
      "diff",
      "--cached",
      "--name-status",
      "--no-renames"
    ]);
    assert.match(pending, /M\tdocs\/investigations\/kept\.md/u);
    assert.match(pending, /D\tdocs\/investigations\/removed\.md/u);
    assert.match(
      pending,
      /D\tdocs\/investigations\/_resources\/removed\/evidence\.txt/u
    );
  });
});

test("stage --scope domain stages an explicit rename as deletion plus addition", async () => {
  await withTempRoot("stage-domain-rename", async (root) => {
    await writeCollection(root, [{ id: "old-name" }]);
    initializeGit(root);
    await fs.rm(path.join(investigationRoot(root), "old-name.md"));
    await writeCollection(root, [{ id: "new-name" }]);
    const result = await stageInvestigationReports({
      reportIds: ["old-name", "new-name"],
      scope: "domain",
      workspaceRoot: root
    });
    assert.equal(result.status, "ok");
    assert.deepEqual(result.selectedIds, ["new-name", "old-name"]);
    const pending = git(root, [
      "diff",
      "--cached",
      "--name-status",
      "--no-renames"
    ]);
    assert.match(pending, /D\tdocs\/investigations\/old-name\.md/u);
    assert.match(pending, /A\tdocs\/investigations\/new-name\.md/u);
    assert.equal(git(root, ["diff", "--cached", "--", indexRelativePath]), "");
  });
});

test("stage --scope domain preserves staged index pending bytes and reports the preserved scope", async () => {
  await withTempRoot("stage-domain-preserve-index", async (root) => {
    await writeCollection(root, [{ id: "first" }, { id: "second" }]);
    initializeGit(root);
    await writeCollection(root, [
      { id: "first", title: "Changed" },
      { id: "second" }
    ]);
    const indexStaged = await stageInvestigationReports({
      reportIds: ["first"],
      scope: "index",
      workspaceRoot: root
    });
    assert.equal(indexStaged.status, "ok");
    assert.equal(indexStaged.changed, true);
    const stagedIndexBytes = git(root, ["show", `:${indexRelativePath}`]);
    const result = await stageInvestigationReports({
      reportIds: ["first"],
      scope: "domain",
      workspaceRoot: root
    });
    assert.equal(result.status, "ok");
    assert.deepEqual(result.preservedPendingPaths, [indexRelativePath]);
    assert.deepEqual(result.callerOwnedPaths, [indexRelativePath]);
    assert.equal(
      git(root, ["show", `:${indexRelativePath}`]),
      stagedIndexBytes
    );
    assert.match(
      git(root, ["show", ":docs/investigations/first.md"]),
      /Changed/u
    );
  });
});

test("stage --scope all writes the index projection, report, and owner tree atomically", async () => {
  await withTempRoot("stage-all-scope", async (root) => {
    await writeResource(root, "first/evidence.txt", "evidence\n");
    await writeCollection(root, [
      { id: "first", resources: ["first/evidence.txt"] },
      { id: "second" }
    ]);
    initializeGit(root);
    await fs.writeFile(
      resourcePath(root, "first/evidence.txt"),
      "changed evidence\n",
      "utf8"
    );
    await writeCollection(root, [
      { id: "first", resources: ["first/evidence.txt"], title: "All changed" },
      { id: "second" }
    ]);
    const result = await stageInvestigationReports({
      reportIds: ["first"],
      scope: "all",
      workspaceRoot: root
    });
    assert.equal(result.status, "ok");
    assert.equal(result.scope, "all");
    assert.deepEqual(result.callerOwnedPaths, []);
    assert.deepEqual(result.writtenPaths, [
      "docs/investigations/_resources/first/evidence.txt",
      "docs/investigations/first.md",
      indexRelativePath
    ]);
    const pendingIndex = parseJsonObject(
      git(root, ["show", `:${indexRelativePath}`])
    );
    const entries = jsonObjectMember(pendingIndex, "entries");
    assert.match(
      JSON.stringify(jsonObjectMember(entries, "first")),
      /All changed/u
    );
    assert.ok(jsonObjectMember(entries, "second"));
    assert.equal(
      git(root, ["diff", "--cached", "--", "docs/investigations/second.md"]),
      ""
    );
  });
});

test("stage rejects owner source drift before the pending write stays atomic", async () => {
  await withTempRoot("stage-domain-drift", async (root) => {
    await writeResource(root, "first/evidence.txt", "before\n");
    await writeCollection(root, [
      { id: "first", resources: ["first/evidence.txt"] }
    ]);
    initializeGit(root);
    await writeResource(root, "first/evidence.txt", "after\n");
    await writeCollection(root, [
      { id: "first", resources: ["first/evidence.txt"] }
    ]);
    const driftPath = resourcePath(root, "first/evidence.txt");
    const descriptor = Object.getOwnPropertyDescriptor(fs, "readFile");
    assert.ok(descriptor);
    const readFile = fs.readFile.bind(fs);
    let reads = 0;
    let injected = false;
    Object.defineProperty(fs, "readFile", {
      ...descriptor,
      value: async (...args: Parameters<typeof readFile>) => {
        if (args[0] === driftPath && ++reads === 2 && !injected) {
          injected = true;
          await fs.writeFile(driftPath, "drifted\n", "utf8");
        }
        return await readFile(...args);
      }
    });
    try {
      const result = await stageInvestigationReports({
        reportIds: ["first"],
        scope: "domain",
        workspaceRoot: root
      });
      assert.equal(result.status, "error");
      assert.equal(result.state, "source-drift");
    } finally {
      Object.defineProperty(fs, "readFile", descriptor);
    }
    assert.equal(injected, true);
    assert.equal(git(root, ["diff", "--cached", "--name-only"]), "");
    assert.equal(await fs.readFile(driftPath, "utf8"), "drifted\n");
  });
});

test("stage --scope domain reports a busy pending boundary without workspace writes", async () => {
  await withTempRoot("stage-domain-busy", async (root) => {
    await writeCollection(root, [{ id: "first" }]);
    initializeGit(root);
    const lockPath = path.join(root, ".git", "index.lock");
    await fs.writeFile(lockPath, "held", "utf8");
    try {
      const result = await stageInvestigationReports({
        reportIds: ["first"],
        scope: "domain",
        workspaceRoot: root
      });
      assert.equal(result.status, "error");
      assert.equal(result.state, "pending-conflict");
    } finally {
      await fs.rm(lockPath, { force: true });
    }
  });
});
