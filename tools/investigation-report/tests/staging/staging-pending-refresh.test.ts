import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";
import { stageInvestigationReports } from "../../src/staging/staging.ts";
import { git, initializeGit } from "../support/git-support.ts";
import {
  indexRelativePath,
  investigationRoot,
  jsonObjectMember,
  parseJsonObject,
  reportMarkdown,
  withTempRoot
} from "../support/fixture-support.ts";
import {
  writeCollection,
  writeResource,
  resourcePath
} from "../support/collection-support.ts";

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
      scope === "domain" ? "docs/investigations/middle.md\n" : ""
    );
    assert.equal(
      git(root, ["ls-files", "docs/investigations/final.md"]).trim(),
      "docs/investigations/final.md"
    );
  });
}

test("stage domain preserves old noncanonical pending locations absent from trusted indexes", async () => {
  await verifyRepeatedPendingMoves("domain");
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

test("stage domain cancels a pending-only legacy locator from the required valid pending index", async () => {
  await withTempRoot("stage-domain-pending-legacy", async (root) => {
    await writeCollection(root, [{ id: "first" }]);
    initializeGit(root);
    const legacyPath = "docs/investigations/legacy-locator.md";
    await writeCollection(root, [
      { id: "first" },
      { id: "260828-second", sourcePath: "legacy-locator.md" }
    ]);
    git(root, ["add", "."]);
    const pendingIndex = git(root, ["show", `:${indexRelativePath}`]);
    const firstEntry = git(root, [
      "ls-files",
      "--stage",
      "docs/investigations/first.md"
    ]);
    await fs.unlink(path.join(root, legacyPath));
    await writeCollection(root, [{ id: "first" }]);
    const result = await stageInvestigationReports({
      workspaceRoot: root,
      reportIds: ["second"],
      scope: "domain"
    });
    assert.equal(result.status, "ok", JSON.stringify(result));
    assert.equal(result.changed, true);
    assert.deepEqual(result.selectedIds, ["260828-second"]);
    assert.deepEqual(result.writtenPaths, [legacyPath]);
    assert.equal(git(root, ["ls-files", legacyPath]), "");
    assert.equal(git(root, ["show", `:${indexRelativePath}`]), pendingIndex);
    assert.equal(
      git(root, ["ls-files", "--stage", "docs/investigations/first.md"]),
      firstEntry
    );
  });
});

test("stage domain tolerates an unavailable pending index when HEAD and workspace locate the selection", async () => {
  await withTempRoot("stage-domain-unneeded-pending-index", async (root) => {
    await writeCollection(root, [{ id: "first" }]);
    initializeGit(root);
    await writeCollection(root, [
      { id: "first", title: "Published selected update" }
    ]);
    const currentIndex = await fs.readFile(path.join(root, indexRelativePath));
    await fs.writeFile(
      path.join(root, indexRelativePath),
      "unneeded invalid pending index\n"
    );
    git(root, ["add", indexRelativePath]);
    await fs.writeFile(path.join(root, indexRelativePath), currentIndex);
    const indexOid = git(root, ["rev-parse", `:${indexRelativePath}`]).trim();
    await fs.unlink(
      path.join(root, ".git/objects", indexOid.slice(0, 2), indexOid.slice(2))
    );
    const pendingIndexEntry = git(root, [
      "ls-files",
      "--stage",
      indexRelativePath
    ]);
    const result = await stageInvestigationReports({
      workspaceRoot: root,
      reportIds: ["first"],
      scope: "domain"
    });
    assert.equal(result.status, "ok", JSON.stringify(result));
    assert.equal(result.changed, true);
    assert.deepEqual(result.writtenPaths, ["docs/investigations/first.md"]);
    assert.match(
      git(root, ["show", ":docs/investigations/first.md"]),
      /Published selected update/
    );
    assert.equal(
      git(root, ["ls-files", "--stage", indexRelativePath]),
      pendingIndexEntry
    );
  });
});

test("stage domain cancels a canonical pending-only addition while preserving a deleted pending index", async () => {
  await withTempRoot(
    "stage-domain-pending-canonical-no-index",
    async (root) => {
      await writeCollection(root, [{ id: "first" }]);
      initializeGit(root);
      await writeCollection(root, [{ id: "first" }, { id: "260828-second" }]);
      const sourcePath = "docs/investigations/260828-second.md";
      git(root, ["add", sourcePath]);
      git(root, ["rm", "--cached", indexRelativePath]);
      await fs.unlink(path.join(root, sourcePath));
      await writeCollection(root, [{ id: "first" }]);
      const result = await stageInvestigationReports({
        workspaceRoot: root,
        reportIds: ["second"],
        scope: "domain"
      });
      assert.equal(result.status, "ok", JSON.stringify(result));
      assert.deepEqual(result.writtenPaths, [sourcePath]);
      assert.equal(git(root, ["ls-files", sourcePath, indexRelativePath]), "");
    }
  );
});

test("stage domain cancels canonical pending-only identities without requiring a valid pending index", async () => {
  for (const selector of ["second", "260828-second"])
    await withTempRoot(
      "stage-domain-canonical-malformed-pending-index",
      async (root) => {
        await writeCollection(root, [{ id: "first" }]);
        initializeGit(root);
        const sourcePath = "docs/investigations/260828-second.md";
        await writeCollection(root, [{ id: "first" }, { id: "260828-second" }]);
        const invalidIndex = "caller-owned invalid pending index\n";
        await fs.writeFile(path.join(root, indexRelativePath), invalidIndex);
        git(root, ["add", "."]);
        git(root, ["update-index", "--chmod=+x", indexRelativePath]);
        const indexEntry = git(root, [
          "ls-files",
          "--stage",
          indexRelativePath
        ]);
        const firstEntry = git(root, [
          "ls-files",
          "--stage",
          "docs/investigations/first.md"
        ]);
        await fs.unlink(path.join(root, sourcePath));
        await writeCollection(root, [{ id: "first" }]);
        const result = await stageInvestigationReports({
          workspaceRoot: root,
          reportIds: [selector],
          scope: "domain"
        });
        assert.equal(result.status, "ok", JSON.stringify(result));
        assert.deepEqual(result.selectedIds, ["260828-second"]);
        assert.deepEqual(result.writtenPaths, [sourcePath]);
        assert.equal(git(root, ["ls-files", sourcePath]), "");
        assert.equal(
          git(root, ["show", `:${indexRelativePath}`]),
          invalidIndex
        );
        assert.equal(
          git(root, ["ls-files", "--stage", indexRelativePath]),
          indexEntry
        );
        assert.equal(
          git(root, ["ls-files", "--stage", "docs/investigations/first.md"]),
          firstEntry
        );
      }
    );
});

test("stage domain verifies the selected canonical pending header before deleting its source", async () => {
  await withTempRoot("stage-domain-canonical-header-drift", async (root) => {
    await writeCollection(root, [{ id: "first" }]);
    initializeGit(root);
    const sourcePath = "docs/investigations/260828-second.md";
    await fs.writeFile(
      path.join(root, sourcePath),
      reportMarkdown({ id: "260828-other" })
    );
    const currentIndex = await fs.readFile(path.join(root, indexRelativePath));
    await fs.writeFile(
      path.join(root, indexRelativePath),
      "caller-owned invalid pending index\n"
    );
    git(root, ["add", "."]);
    await fs.unlink(path.join(root, sourcePath));
    await fs.writeFile(path.join(root, indexRelativePath), currentIndex);
    const before = git(root, ["ls-files", "--stage"]);
    const result = await stageInvestigationReports({
      workspaceRoot: root,
      reportIds: ["260828-second"],
      scope: "domain"
    });
    assert.equal(result.status, "error");
    assert.equal(result.changed, false);
    assert.match(JSON.stringify(result.diagnostics), /selected-id-missing/);
    assert.equal(git(root, ["ls-files", "--stage"]), before);
  });
});

test("stage domain collects a valid pending legacy old location even when HEAD and workspace already know the identity", async () => {
  await withTempRoot("stage-domain-known-pending-legacy-old", async (root) => {
    const id = "260828-selected";
    await writeCollection(root, [
      { id, sourcePath: "head-old.md" },
      { id: "unselected" }
    ]);
    initializeGit(root);
    await fs.unlink(path.join(investigationRoot(root), "head-old.md"));
    await writeCollection(root, [
      { id, sourcePath: "staged-old.md" },
      { id: "unselected" }
    ]);
    git(root, ["add", "."]);
    git(root, ["update-index", "--chmod=+x", indexRelativePath]);
    const indexEntry = git(root, ["ls-files", "--stage", indexRelativePath]);
    const indexBytes = git(root, ["show", `:${indexRelativePath}`]);
    const unselected = git(root, [
      "ls-files",
      "--stage",
      "docs/investigations/unselected.md"
    ]);
    await fs.unlink(path.join(investigationRoot(root), "staged-old.md"));
    await writeCollection(root, [
      { id, sourcePath: "current.md" },
      { id: "unselected" }
    ]);
    const result = await stageInvestigationReports({
      workspaceRoot: root,
      reportIds: [id],
      scope: "domain"
    });
    assert.equal(result.status, "ok", JSON.stringify(result));
    assert.equal(
      git(root, [
        "ls-files",
        "docs/investigations/head-old.md",
        "docs/investigations/staged-old.md"
      ]),
      ""
    );
    assert.equal(
      git(root, ["ls-files", "docs/investigations/current.md"]).trim(),
      "docs/investigations/current.md"
    );
    assert.equal(git(root, ["show", `:${indexRelativePath}`]), indexBytes);
    assert.equal(
      git(root, ["ls-files", "--stage", indexRelativePath]),
      indexEntry
    );
    assert.equal(
      git(root, ["ls-files", "--stage", "docs/investigations/unselected.md"]),
      unselected
    );
  });
});

test("stage domain collects a canonical pending old location with a malformed pending index and known HEAD identity", async () => {
  await withTempRoot(
    "stage-domain-known-pending-canonical-old",
    async (root) => {
      const id = "260828-selected";
      await writeCollection(root, [
        { id, sourcePath: "head-old.md" },
        { id: "unselected" }
      ]);
      initializeGit(root);
      await fs.unlink(path.join(investigationRoot(root), "head-old.md"));
      await writeCollection(root, [{ id }, { id: "unselected" }]);
      const indexBytes = "caller-owned invalid P index\n";
      await fs.writeFile(path.join(root, indexRelativePath), indexBytes);
      git(root, ["add", "."]);
      git(root, ["update-index", "--chmod=+x", indexRelativePath]);
      const indexEntry = git(root, ["ls-files", "--stage", indexRelativePath]);
      const unselected = git(root, [
        "ls-files",
        "--stage",
        "docs/investigations/unselected.md"
      ]);
      await fs.unlink(path.join(investigationRoot(root), id + ".md"));
      await writeCollection(root, [
        { id, sourcePath: "current.md" },
        { id: "unselected" }
      ]);
      const result = await stageInvestigationReports({
        workspaceRoot: root,
        reportIds: [id],
        scope: "domain"
      });
      assert.equal(result.status, "ok", JSON.stringify(result));
      assert.equal(
        git(root, [
          "ls-files",
          "docs/investigations/head-old.md",
          `docs/investigations/${id}.md`
        ]),
        ""
      );
      assert.equal(
        git(root, ["ls-files", "docs/investigations/current.md"]).trim(),
        "docs/investigations/current.md"
      );
      assert.equal(git(root, ["show", `:${indexRelativePath}`]), indexBytes);
      assert.equal(
        git(root, ["ls-files", "--stage", indexRelativePath]),
        indexEntry
      );
      assert.equal(
        git(root, ["ls-files", "--stage", "docs/investigations/unselected.md"]),
        unselected
      );
    }
  );
});
