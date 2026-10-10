import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";
import { showInvestigationCandidate } from "../src/candidate.ts";
import { stageInvestigationReports } from "../src/staging.ts";
import {
  synchronizeInvestigationIndex,
  validateInvestigationReports
} from "../src/validation.ts";
import {
  git,
  initializeGit,
  investigationRoot,
  reportMarkdown,
  withTempRoot,
  writeCollection
} from "./v6-support.ts";

test("scoped investigation discovery treats an inherited legacy ID as absent from the published index", async () => {
  await withTempRoot("legacy-scoped-membership", async (root) => {
    await writeCollection(root, [{ id: "keep" }]);
    await fs.writeFile(
      path.join(investigationRoot(root), "constructor.md"),
      reportMarkdown({ id: "constructor" })
    );
    const checked = await validateInvestigationReports({
      workspaceRoot: root,
      ids: ["constructor"]
    });
    assert.deepEqual(checked.errors, []);
    assert.equal(checked.selectedReportCount, 1);
    assert.equal(checked.indexChecked, false);
  });
});

test("candidate resource visibility discovers an unindexed formal legacy owner instead of an inherited entry", async () => {
  await withTempRoot("legacy-owner-membership", async (root) => {
    await writeCollection(root, [{ id: "keep" }]);
    const directory = investigationRoot(root);
    await fs.mkdir(path.join(directory, "_resources", "constructor"), {
      recursive: true
    });
    await fs.writeFile(
      path.join(directory, "_resources", "constructor", "sample.txt"),
      "shared evidence\n"
    );
    await fs.writeFile(
      path.join(directory, "constructor.md"),
      reportMarkdown({
        id: "constructor",
        resources: ["constructor/sample.txt"]
      })
    );
    await fs.writeFile(
      path.join(directory, "_candidate.shared"),
      reportMarkdown({ id: "shared", resources: ["constructor/sample.txt"] })
    );
    const shown = await showInvestigationCandidate({
      workspaceRoot: root,
      id: "shared"
    });
    assert.equal(shown.status, "ok");
    assert.deepEqual(shown.candidate?.errors, []);
    assert.equal(shown.candidate?.readiness.resourceReady, true);
  });
});

test("investigation domain staging deletes a HEAD-only legacy report without reading an inherited current entry", async () => {
  await withTempRoot("legacy-stage-membership", async (root) => {
    await writeCollection(root, [{ id: "constructor" }, { id: "keep" }]);
    initializeGit(root);
    await fs.rm(path.join(investigationRoot(root), "constructor.md"));
    const synced = await synchronizeInvestigationIndex({ workspaceRoot: root });
    assert.deepEqual(synced.errors, []);
    const staged = await stageInvestigationReports({
      workspaceRoot: root,
      reportIds: ["constructor"],
      scope: "domain"
    });
    assert.equal(staged.status, "ok");
    assert.equal(
      git(root, ["diff", "--cached", "--name-status", "--no-renames"]).trim(),
      "D\tdocs/investigations/constructor.md"
    );
    assert.match(
      git(root, ["show", ":docs/investigations/keep.md"]),
      /id: "keep"/u
    );
  });
});
