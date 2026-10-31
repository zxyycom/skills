import { investigationIndexFixture } from "../query/index/index-fixture.ts";
import { domainSourceSelection } from "../../src/staging/domain/staging-domain-sources.ts";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";
import { showInvestigationCandidate } from "../../src/candidates/candidate.ts";

import { validateInvestigationReports } from "../../src/records/validation/validation.ts";

import {
  investigationRoot,
  reportMarkdown,
  withTempRoot
} from "../support/fixture-support.ts";
import { writeCollection } from "../support/collection-support.ts";

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

test("candidate resource readiness rejects an unpublished formal owner instead of discovering its body", async () => {
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
    assert.match(
      shown.candidate?.errors.join("; ") ?? "",
      /owner report constructor does not exist/
    );
    assert.equal(shown.candidate?.readiness.resourceReady, false);
  });
});

test("investigation domain selection treats a HEAD-only inherited legacy ID as deleted", () => {
  const selection = domainSourceSelection(
    investigationIndexFixture([{ id: "keep" }]),
    ["constructor"]
  );
  assert.deepEqual(selection, {
    deletedIds: ["constructor"],
    reportIds: [],
    resourceIds: []
  });
});
