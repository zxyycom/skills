import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";
import { stageInvestigationReports } from "../src/staging.ts";
import { git, initializeGit } from "./git-support.ts";
import {
  indexRelativePath,
  investigationRoot,
  jsonObjectMember,
  parseJsonObject,
  withTempRoot
} from "./fixture-support.ts";
import {
  writeCollection,
  writeResource,
  resourcePath
} from "./collection-support.ts";

async function verifySelectedRefresh(
  scope: "index" | "domain" | "all"
): Promise<void> {
  await withTempRoot(`stage-refresh-${scope}`, async (root) => {
    await writeCollection(root, [{ id: "first" }, { id: "second" }]);
    initializeGit(root);
    await writeCollection(root, [
      { id: "first", title: "First one" },
      { id: "second", title: "Second one" }
    ]);
    const stage = (id: string) =>
      stageInvestigationReports({
        reportIds: [id],
        scope,
        workspaceRoot: root
      });
    assert.equal((await stage("first")).status, "ok");
    assert.equal((await stage("second")).status, "ok");
    const secondBody = git(root, ["show", ":docs/investigations/second.md"]);
    const secondIndex = jsonObjectMember(
      jsonObjectMember(
        parseJsonObject(git(root, ["show", `:${indexRelativePath}`])),
        "entries"
      ),
      "second"
    );
    await writeCollection(root, [
      { id: "first", title: "First two" },
      { id: "second", title: "Second two" }
    ]);
    // A partial pending object is deliberately replaced by the full current object.
    if (scope !== "index") {
      const firstPath = path.join(investigationRoot(root), "first.md");
      const full = await fs.readFile(firstPath, "utf8");
      await fs.writeFile(firstPath, full + "\nPartial pending only\n");
      git(root, ["add", firstPath]);
      await fs.writeFile(firstPath, full);
    }
    const refreshed = await stage("first");
    assert.equal(refreshed.status, "ok", JSON.stringify(refreshed));
    assert.equal(
      git(root, ["show", ":docs/investigations/second.md"]),
      secondBody
    );
    const pendingIndex = parseJsonObject(
      git(root, ["show", `:${indexRelativePath}`])
    );
    assert.deepEqual(
      jsonObjectMember(jsonObjectMember(pendingIndex, "entries"), "second"),
      secondIndex
    );
    if (scope !== "index") {
      const body = git(root, ["show", ":docs/investigations/first.md"]);
      assert.match(body, /First two/u);
      assert.doesNotMatch(body, /Partial pending only/u);
    }
    if (scope !== "domain")
      assert.equal(
        jsonObjectMember(jsonObjectMember(pendingIndex, "entries"), "first")
          .title,
        "First two"
      );
    if (scope === "domain")
      assert.equal(
        git(root, ["diff", "--cached", "--", indexRelativePath]),
        ""
      );
    assert.equal((await stage("first")).changed, false);
  });
}

test("stage index refreshes only selected objects across repeated pending updates", async () => {
  await verifySelectedRefresh("index");
});

test("stage domain refreshes only selected objects across repeated pending updates", async () => {
  await verifySelectedRefresh("domain");
});

test("stage all refreshes only selected objects across repeated pending updates", async () => {
  await verifySelectedRefresh("all");
});

async function verifyPendingOnlyCancellation(
  scope: "domain" | "all"
): Promise<void> {
  await withTempRoot(`stage-cancel-${scope}`, async (root) => {
    await writeCollection(root, [{ id: "first" }]);
    initializeGit(root);
    await writeResource(root, "second/extra.txt", "pending only\n");
    await writeCollection(root, [{ id: "first" }, { id: "second" }]);
    const stage = () =>
      stageInvestigationReports({
        reportIds: ["second"],
        scope,
        workspaceRoot: root
      });
    assert.equal((await stage()).status, "ok");
    await fs.unlink(path.join(investigationRoot(root), "second.md"));
    await fs.unlink(resourcePath(root, "second/extra.txt"));
    await writeCollection(root, [{ id: "first" }]);
    const canceled = await stage();
    assert.equal(canceled.status, "ok", JSON.stringify(canceled));
    assert.equal(
      git(root, [
        "ls-files",
        "docs/investigations/second.md",
        "docs/investigations/_resources/second"
      ]),
      ""
    );
    assert.equal(git(root, ["diff", "--cached", "--name-only"]), "");
  });
}

test("stage domain cancels pending-only additions and removes pending-only owner members", async () => {
  await verifyPendingOnlyCancellation("domain");
});

test("stage all cancels pending-only additions and removes pending-only owner members", async () => {
  await verifyPendingOnlyCancellation("all");
});

async function verifyDeletedPendingIndex(
  scope: "index" | "all"
): Promise<void> {
  await withTempRoot(`stage-deleted-index-${scope}`, async (root) => {
    await writeCollection(root, [{ id: "first" }]);
    initializeGit(root);
    git(root, ["rm", "--cached", indexRelativePath]);
    const before = git(root, ["ls-files", "--stage"]);
    const result = await stageInvestigationReports({
      reportIds: ["first"],
      scope,
      workspaceRoot: root
    });
    assert.equal(result.status, "error");
    assert.match(JSON.stringify(result.diagnostics), /restore/u);
    assert.equal(git(root, ["ls-files", "--stage"]), before);
  });
}

test("stage index rejects a deleted pending index without changing pending", async () => {
  await verifyDeletedPendingIndex("index");
});

test("stage all rejects a deleted pending index without changing pending", async () => {
  await verifyDeletedPendingIndex("all");
});

async function verifyRepeatedPendingMoves(
  scope: "domain" | "all"
): Promise<void> {
  await withTempRoot(`stage-move-again-${scope}`, async (root) => {
    await writeCollection(root, [{ id: "first" }]);
    initializeGit(root);
    for (const [previous, next] of [
      ["first.md", "middle.md"],
      ["middle.md", "final.md"]
    ]) {
      await fs.unlink(path.join(investigationRoot(root), previous!));
      await writeCollection(root, [{ id: "first", sourcePath: next! }]);
      const result = await stageInvestigationReports({
        reportIds: ["first"],
        scope,
        workspaceRoot: root
      });
      assert.equal(result.status, "ok", JSON.stringify(result));
    }
    assert.equal(
      git(root, [
        "ls-files",
        "docs/investigations/first.md",
        "docs/investigations/middle.md"
      ]),
      ""
    );
    assert.equal(
      git(root, ["ls-files", "docs/investigations/final.md"]).trim(),
      "docs/investigations/final.md"
    );
  });
}

test("stage domain cleans each previous pending location during repeated moves", async () => {
  await verifyRepeatedPendingMoves("domain");
});

test("stage all cleans each previous pending location during repeated moves", async () => {
  await verifyRepeatedPendingMoves("all");
});

test("stage domain preserves a deleted pending index while refreshing the selected report", async () => {
  await withTempRoot("stage-domain-deleted-index", async (root) => {
    await writeCollection(root, [{ id: "first" }]);
    initializeGit(root);
    git(root, ["rm", "--cached", indexRelativePath]);
    await writeCollection(root, [{ id: "first", title: "Current" }]);
    const result = await stageInvestigationReports({
      reportIds: ["first"],
      scope: "domain",
      workspaceRoot: root
    });
    assert.equal(result.status, "ok", JSON.stringify(result));
    assert.equal(git(root, ["ls-files", indexRelativePath]), "");
    assert.match(
      git(root, ["show", ":docs/investigations/first.md"]),
      /Current/u
    );
  });
});
