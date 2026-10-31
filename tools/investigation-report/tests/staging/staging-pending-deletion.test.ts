import {
  validateInvestigationReports,
  synchronizeInvestigationIndex
} from "../../src/records/validation/validation.ts";

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
  writeResource
} from "../support/collection-support.ts";

test("stage deletion defers unknown workspace identity rediscovery to explicit full validation", async (t) => {
  await withTempRoot("stage-deletion-unknown-identity", async (root) => {
    await writeCollection(root, [{ id: "first" }, { id: "second" }]);
    initializeGit(root);
    await fs.unlink(path.join(investigationRoot(root), "first.md"));
    await writeCollection(root, [{ id: "second" }]);
    const unknownPath = path.join(investigationRoot(root), "unknown.md");
    await fs.writeFile(unknownPath, reportMarkdown({ id: "first" }));
    const original = fs.readFile;
    let unknownReads = 0;
    const observedRead = t.mock.method(
      fs,
      "readFile",
      async (...args: Parameters<typeof fs.readFile>) => {
        if (args[0] === unknownPath) unknownReads++;
        return original(...args);
      }
    );
    try {
      const result = await stageInvestigationReports({
        reportIds: ["first"],
        scope: "all",
        workspaceRoot: root
      });
      assert.equal(result.status, "ok", JSON.stringify(result));
      assert.equal(unknownReads, 0);
      assert.equal(
        git(root, [
          "ls-files",
          "docs/investigations/first.md",
          "docs/investigations/unknown.md"
        ]),
        ""
      );
    } finally {
      observedRead.mock.restore();
    }
    const checked = await validateInvestigationReports({ workspaceRoot: root });
    assert.ok(checked.errors.length > 0);
    const synced = await synchronizeInvestigationIndex({ workspaceRoot: root });
    assert.deepEqual(synced.errors, []);
    const index = parseJsonObject(
      await fs.readFile(
        path.join(investigationRoot(root), "investigation-index.json"),
        "utf8"
      )
    );
    assert.equal(
      jsonObjectMember(jsonObjectMember(index, "entries"), "first").sourcePath,
      "unknown.md"
    );
  });
});

test("stage deletion rejects an unsynchronized source at a known old location", async () => {
  await withTempRoot("stage-deletion-known-identity", async (root) => {
    await writeCollection(root, [{ id: "first" }, { id: "second" }]);
    initializeGit(root);
    await fs.unlink(path.join(investigationRoot(root), "first.md"));
    await writeCollection(root, [{ id: "second" }]);
    await fs.writeFile(
      path.join(investigationRoot(root), "first.md"),
      reportMarkdown({ id: "first" })
    );
    const before = git(root, ["ls-files", "--stage"]);
    const result = await stageInvestigationReports({
      reportIds: ["first"],
      scope: "all",
      workspaceRoot: root
    });
    assert.equal(result.status, "error");
    assert.match(JSON.stringify(result.diagnostics), /old report location/u);
    assert.equal(git(root, ["ls-files", "--stage"]), before);
  });
});

test("stage all preserves a pure dependency pending deletion until explicitly selected", async () => {
  await withTempRoot("stage-owner-pending-missing", async (root) => {
    await writeResource(root, "second/evidence.txt", "shared evidence\n");
    await writeCollection(root, [
      { id: "first", resources: ["second/evidence.txt"] },
      { id: "second", resources: ["second/evidence.txt"] }
    ]);
    initializeGit(root);
    git(root, ["rm", "--cached", "docs/investigations/second.md"]);
    const before = git(root, ["ls-files", "--stage"]);
    const denied = await stageInvestigationReports({
      reportIds: ["first"],
      scope: "all",
      workspaceRoot: root
    });
    assert.equal(denied.status, "ok", JSON.stringify(denied));
    assert.equal(git(root, ["ls-files", "--stage"]), before);
    const completed = await stageInvestigationReports({
      reportIds: ["first", "second"],
      scope: "all",
      workspaceRoot: root
    });
    assert.equal(completed.status, "ok", JSON.stringify(completed));
    assert.equal(git(root, ["diff", "--cached", "--name-only"]), "");
  });
});

test("stage all preserves an unselected pending deletion despite workspace restoration", async () => {
  await withTempRoot("stage-preserved-deletion-all", async (root) => {
    await writeCollection(root, [{ id: "first" }, { id: "second" }]);
    initializeGit(root);
    await fs.unlink(path.join(investigationRoot(root), "second.md"));
    await writeCollection(root, [{ id: "first" }]);
    const removed = await stageInvestigationReports({
      reportIds: ["second"],
      scope: "all",
      workspaceRoot: root
    });
    assert.equal(removed.status, "ok", JSON.stringify(removed));
    await writeCollection(root, [
      { id: "first", title: "Selected update" },
      { id: "second", title: "Restored workspace" }
    ]);
    const selected = await stageInvestigationReports({
      reportIds: ["first"],
      scope: "all",
      workspaceRoot: root
    });
    assert.equal(selected.status, "ok", JSON.stringify(selected));
    const entries = jsonObjectMember(
      parseJsonObject(git(root, ["show", `:${indexRelativePath}`])),
      "entries"
    );
    assert.equal(Object.hasOwn(entries, "second"), false);
    assert.equal(jsonObjectMember(entries, "first").title, "Selected update");
    assert.equal(git(root, ["ls-files", "docs/investigations/second.md"]), "");
  });
});
