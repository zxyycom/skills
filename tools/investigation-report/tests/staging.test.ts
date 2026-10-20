import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";
import { investigationIndexFixture } from "./index-fixture.ts";
import { resolveInvestigationStageSelectors } from "../src/staging-selectors.ts";
import { prepareInvestigationStage } from "../src/staging-options.ts";
import os from "node:os";
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

test("stage --scope index resolves a unique Investigation name after one Markdown suffix", () => {
  const id = "260828-stage-name";
  const prepared = prepareInvestigationStage({
    reportIds: ["stage-name.MD"],
    scope: "index",
    workspaceRoot: os.tmpdir()
  });
  assert.ok(prepared.isOk());
  if (prepared.isErr()) assert.fail(JSON.stringify(prepared.error));
  const workspace = investigationIndexFixture([{ id }]);
  assert.deepEqual(
    resolveInvestigationStageSelectors({
      baseline: workspace,
      workspace,
      selectedIds: prepared.value.reportIds
    }),
    {
      status: "ok",
      diagnostics: [],
      value: [id]
    }
  );
});

test("stage --scope index treats a standard Investigation ID as exact", async () => {
  await withTempRoot("stage-exact-selector", async (root) => {
    await writeCollection(root, [{ id: "260828-stage-name" }]);
    initializeGit(root);
    const result = await stageInvestigationReports({
      reportIds: ["260829-stage-not-present"],
      scope: "index",
      workspaceRoot: root
    });
    assert.equal(result.status, "error");
    assert.ok(
      result.diagnostics.some(
        (diagnostic) =>
          diagnostic.code === "state-index.selected-id-missing" &&
          diagnostic.stateId === "260829-stage-not-present"
      )
    );
  });
});

test("stage --scope index rejects an ambiguous Investigation name", () => {
  const workspace = investigationIndexFixture([
    { id: "260828-stage-name" },
    { id: "260829-stage-name", formedAt: "2026-08-29T12:00:00+00:00" }
  ]);
  const result = resolveInvestigationStageSelectors({
    baseline: workspace,
    workspace,
    selectedIds: ["stage-name"]
  });
  assert.equal(result.status, "error");
  assert.deepEqual(
    result.diagnostics.map(({ stateId, message }) => ({ stateId, message })),
    [
      {
        stateId: "stage-name",
        message:
          'report name "stage-name" is ambiguous; choose one standard ID: 260828-stage-name, 260829-stage-name'
      }
    ]
  );
});

test("stage --scope index resolves a baseline-only Investigation name as a deletion", async () => {
  await withTempRoot("stage-baseline-name", async (root) => {
    const deletedId = "260828-baseline-only";
    const retainedId = "260828-retained";
    await writeCollection(root, [{ id: deletedId }, { id: retainedId }]);
    initializeGit(root);
    await fs.rm(path.join(investigationRoot(root), `${deletedId}.md`));
    await writeCollection(root, [{ id: retainedId }]);
    const result = await stageInvestigationReports({
      reportIds: ["baseline-only"],
      scope: "index",
      workspaceRoot: root
    });
    assert.equal(result.status, "ok");
    const pending = parseJsonObject(
      git(root, ["show", `:${indexRelativePath}`])
    );
    assert.equal(
      Object.hasOwn(jsonObjectMember(pending, "entries"), deletedId),
      false
    );
  });
});

test("stage --scope index resolves a workspace-only Investigation name as an addition", async () => {
  await withTempRoot("stage-workspace-name", async (root) => {
    const baselineId = "260828-baseline";
    const addedId = "260829-workspace-only";
    await writeCollection(root, [{ id: baselineId }]);
    initializeGit(root);
    await writeCollection(root, [
      { id: baselineId },
      { id: addedId, formedAt: "2026-08-29T12:00:00+00:00" }
    ]);
    const result = await stageInvestigationReports({
      reportIds: ["workspace-only"],
      scope: "index",
      workspaceRoot: root
    });
    assert.equal(result.status, "ok");
    const pending = parseJsonObject(
      git(root, ["show", `:${indexRelativePath}`])
    );
    assert.ok(Object.hasOwn(jsonObjectMember(pending, "entries"), addedId));
  });
});

test("stage --scope index rejects invalid or duplicate Investigation IDs", () => {
  const result = prepareInvestigationStage({
    reportIds: [
      "stage-report",
      "stage-report",
      "bad/path.md",
      "./stage-report.md",
      " stage-report.md "
    ],
    scope: "index",
    workspaceRoot: os.tmpdir()
  });
  assert.ok(result.isErr());
  if (result.isOk()) assert.fail("invalid selection was accepted");
  assert.equal(result.error.kind, "invalid-options");
  assert.equal(result.error.result.changed, false);
  assert.deepEqual(
    result.error.result.diagnostics.map((item) => item.code),
    [
      "investigation-report.stage-report-id-duplicate",
      "investigation-report.stage-report-id-invalid",
      "investigation-report.stage-report-id-invalid",
      "investigation-report.stage-report-id-invalid"
    ]
  );
  assert.ok(
    result.error.result.diagnostics.every((item) => item.message.length > 0)
  );
});

test("stage --scope index validates canonical Investigation IDs before repository access", async () => {
  await withTempRoot("stage-before-repository", async (root) => {
    const missingRoot = path.join(root, "missing-workspace");
    const result = await stageInvestigationReports({
      reportIds: ["bad/path.md"],
      workspaceRoot: missingRoot
    });
    assert.equal(result.status, "error");
    assert.ok(
      result.diagnostics.some(
        (diagnostic) =>
          diagnostic.code === "investigation-report.stage-report-id-invalid"
      )
    );
    await assert.rejects(fs.access(missingRoot));
  });
});

test("stage --scope index reports unavailable version control without working-tree writes", async () => {
  await withTempRoot("stage-no-git", async (root) => {
    await writeCollection(root, [{ id: "report" }]);
    const reportPath = path.join(investigationRoot(root), "report.md");
    const indexPath = path.join(
      investigationRoot(root),
      "investigation-index.json"
    );
    const before = await Promise.all(
      [reportPath, indexPath].map(
        async (file) => await fs.readFile(file, "utf8")
      )
    );
    const result = await stageInvestigationReports({
      reportIds: ["report"],
      scope: "index",
      workspaceRoot: root
    });
    assert.equal(result.status, "error");
    assert.deepEqual(
      await Promise.all(
        [reportPath, indexPath].map(
          async (file) => await fs.readFile(file, "utf8")
        )
      ),
      before
    );
  });
});

test("stage --scope index rejects IDs missing from the current collection", () => {
  const workspace = investigationIndexFixture([{ id: "report" }]);
  const result = resolveInvestigationStageSelectors({
    baseline: null,
    workspace,
    selectedIds: ["missing"]
  });
  assert.equal(result.status, "error");
  assert.deepEqual(
    result.diagnostics.map(({ stateId, message }) => ({ stateId, message })),
    [
      {
        stateId: "missing",
        message: 'report name "missing" is absent from both indexes'
      }
    ]
  );
});

test("stage --scope index keeps report Markdown outside selected index staging", async () => {
  await withTempRoot("stage-isolation", async (root) => {
    await writeCollection(root, [{ id: "report" }]);
    initializeGit(root);
    await writeCollection(root, [{ id: "report", title: "Changed" }]);
    const workspaceIndex = await fs.readFile(
      `${investigationRoot(root)}/investigation-index.json`,
      "utf8"
    );
    const result = await stageInvestigationReports({
      reportIds: ["report"],
      scope: "index",
      workspaceRoot: root
    });
    assert.equal(result.status, "ok");
    assert.equal(result.changed, true);
    assert.deepEqual(result.selectedIds, ["report"]);
    assert.deepEqual(
      git(root, ["diff", "--cached", "--name-only"]).trim(),
      indexRelativePath
    );
    assert.equal(git(root, ["show", `:${indexRelativePath}`]), workspaceIndex);
    assert.equal(
      git(root, ["diff", "--cached", "--", "docs/investigations/report.md"]),
      ""
    );
    assert.notEqual(
      git(root, ["diff", "--", "docs/investigations/report.md"]),
      ""
    );
  });
});

test("stage --scope index accepts selected report additions in a current index", async () => {
  await withTempRoot("stage-add", async (root) => {
    await writeCollection(root, [{ id: "report" }]);
    initializeGit(root);
    await writeCollection(root, [{ id: "report" }, { id: "added" }]);
    const workspaceIndex = parseJsonObject(
      await fs.readFile(
        `${investigationRoot(root)}/investigation-index.json`,
        "utf8"
      )
    );
    const workspaceEntries = jsonObjectMember(workspaceIndex, "entries");
    const addedMarkdown = await fs.readFile(
      `${investigationRoot(root)}/added.md`,
      "utf8"
    );
    const result = await stageInvestigationReports({
      reportIds: ["added"],
      scope: "index",
      workspaceRoot: root
    });
    assert.equal(result.status, "ok");
    assert.equal(result.changed, true);
    assert.deepEqual(result.selectedIds, ["added"]);
    const pendingIndex = parseJsonObject(
      git(root, ["show", `:${indexRelativePath}`])
    );
    assert.ok(Object.hasOwn(workspaceEntries, "added"));
    assert.deepEqual(
      jsonObjectMember(pendingIndex, "entries")["added"],
      workspaceEntries["added"]
    );
    assert.deepEqual(
      git(root, ["diff", "--cached", "--name-only"]).trim(),
      indexRelativePath
    );
    assert.equal(
      git(root, ["diff", "--cached", "--", "docs/investigations/added.md"]),
      ""
    );
    assert.equal(
      await fs.readFile(`${investigationRoot(root)}/added.md`, "utf8"),
      addedMarkdown
    );
  });
});

test("stage --scope index treats resource byte changes as outside report selection", async () => {
  await withTempRoot("stage-resource-byte", async (root) => {
    const resourcePath = `${investigationRoot(root)}/_resources/report/evidence.txt`;
    await fs.mkdir(`${investigationRoot(root)}/_resources/report`, {
      recursive: true
    });
    await fs.writeFile(resourcePath, "before", "utf8");
    await writeCollection(root, [
      { id: "report", resources: ["report/evidence.txt"] }
    ]);
    initializeGit(root);
    const cachedBefore = git(root, ["diff", "--cached", "--binary"]);
    const indexBefore = await fs.readFile(
      `${investigationRoot(root)}/investigation-index.json`,
      "utf8"
    );
    await fs.writeFile(resourcePath, "after", "utf8");
    const result = await stageInvestigationReports({
      reportIds: ["report"],
      scope: "index",
      workspaceRoot: root
    });
    assert.equal(result.status, "ok");
    assert.equal(result.changed, false);
    assert.equal(git(root, ["diff", "--cached", "--binary"]), cachedBefore);
    assert.equal(
      await fs.readFile(
        `${investigationRoot(root)}/investigation-index.json`,
        "utf8"
      ),
      indexBefore
    );
    assert.equal(
      git(root, ["diff", "--cached", "--", "docs/investigations/report.md"]),
      ""
    );
    assert.notEqual(
      git(root, [
        "diff",
        "--",
        "docs/investigations/_resources/report/evidence.txt"
      ]),
      ""
    );
  });
});

test("stage --scope index treats unrelated report resources as outside selected report entries", async () => {
  await withTempRoot("stage-unrelated", async (root) => {
    const resourcePath = `${investigationRoot(root)}/_resources/second/evidence.txt`;
    await fs.mkdir(`${investigationRoot(root)}/_resources/second`, {
      recursive: true
    });
    await fs.writeFile(resourcePath, "before", "utf8");
    await writeCollection(root, [
      { id: "first" },
      { id: "second", resources: ["second/evidence.txt"] }
    ]);
    initializeGit(root);
    await writeCollection(root, [
      { id: "first", title: "Changed first" },
      { id: "second", resources: ["second/evidence.txt"] }
    ]);
    const workspaceIndex = parseJsonObject(
      await fs.readFile(
        `${investigationRoot(root)}/investigation-index.json`,
        "utf8"
      )
    );
    const workspaceEntries = jsonObjectMember(workspaceIndex, "entries");
    const baseIndex = parseJsonObject(
      git(root, ["show", `HEAD:${indexRelativePath}`])
    );
    const baseEntries = jsonObjectMember(baseIndex, "entries");
    await fs.writeFile(resourcePath, "after", "utf8");
    const result = await stageInvestigationReports({
      reportIds: ["first"],
      scope: "index",
      workspaceRoot: root
    });
    assert.equal(result.status, "ok");
    assert.equal(result.changed, true);
    const pendingIndex = parseJsonObject(
      git(root, ["show", `:${indexRelativePath}`])
    );
    const pendingEntries = jsonObjectMember(pendingIndex, "entries");
    assert.ok(Object.hasOwn(workspaceEntries, "first"));
    assert.ok(Object.hasOwn(baseEntries, "second"));
    assert.deepEqual(pendingEntries["first"], workspaceEntries["first"]);
    assert.deepEqual(pendingEntries["second"], baseEntries["second"]);
    assert.deepEqual(
      git(root, ["diff", "--cached", "--name-only"]).trim(),
      indexRelativePath
    );
    assert.equal(
      git(root, ["diff", "--cached", "--", "docs/investigations/first.md"]),
      ""
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
    assert.notEqual(
      git(root, [
        "diff",
        "--",
        "docs/investigations/_resources/second/evidence.txt"
      ]),
      ""
    );
  });
});

test("stage --scope index preserves strict current index definition requirements", async () => {
  await withTempRoot("stage-definition", async (root) => {
    await writeCollection(root, [{ id: "report" }]);
    initializeGit(root);
    const indexPath = `${investigationRoot(root)}/investigation-index.json`;
    const cachedBefore = git(root, ["diff", "--cached", "--binary"]);
    const stagedBefore = git(root, ["show", `:${indexRelativePath}`]);
    const invalidIndex = parseJsonObject(await fs.readFile(indexPath, "utf8"));
    invalidIndex["definitionVersion"] = 5;
    const invalidText = `${JSON.stringify(invalidIndex, null, 2)}\n`;
    await fs.writeFile(indexPath, invalidText, "utf8");
    const result = await stageInvestigationReports({
      reportIds: ["report"],
      scope: "index",
      workspaceRoot: root
    });
    assert.equal(result.status, "error");
    assert.ok(
      result.diagnostics.some(
        (diagnostic) =>
          diagnostic.code === "state-index.definition-version-mismatch"
      )
    );
    assert.equal(git(root, ["diff", "--cached", "--binary"]), cachedBefore);
    assert.equal(git(root, ["show", `:${indexRelativePath}`]), stagedBefore);
    assert.equal(await fs.readFile(indexPath, "utf8"), invalidText);
  });
});

test("stage --scope index reports selection diagnostics deterministically", () => {
  const result = prepareInvestigationStage({
    reportIds: [],
    scope: "index",
    workspaceRoot: os.tmpdir()
  });
  assert.ok(result.isErr());
  if (result.isOk()) assert.fail("invalid selection was accepted");
  assert.equal(result.error.kind, "invalid-options");
  assert.equal(result.error.result.changed, false);
  assert.deepEqual(
    result.error.result.diagnostics.map((item) => item.code),
    ["investigation-report.stage-report-ids-empty"]
  );
  assert.ok(
    result.error.result.diagnostics.every((item) => item.message.length > 0)
  );
});

test("stage --scope index does not accept legacy topic path identifiers", () => {
  const result = prepareInvestigationStage({
    reportIds: ["category/report.md"],
    scope: "index",
    workspaceRoot: os.tmpdir()
  });
  assert.ok(result.isErr());
  if (result.isOk()) assert.fail("invalid selection was accepted");
  assert.equal(result.error.kind, "invalid-options");
  assert.equal(result.error.result.changed, false);
  assert.deepEqual(
    result.error.result.diagnostics.map((item) => item.code),
    ["investigation-report.stage-report-id-invalid"]
  );
  assert.ok(
    result.error.result.diagnostics.every((item) => item.message.length > 0)
  );
});
