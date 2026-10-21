import { readInvestigationSourceRevision } from "../src/investigation-index-source.ts";
import {
  buildStateIndexFromSnapshot,
  selectTargetSnapshot,
  parseStateIndex
} from "../../index-runtime/src/index.ts";
import { createInvestigationStageIndexDefinition } from "../src/staging-domain-index.ts";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";
import { investigationIndexFixture } from "./index-fixture.ts";
import { resolveInvestigationStageSelectors } from "../src/staging-selectors.ts";
import { prepareInvestigationStage } from "../src/staging-options.ts";
import os from "node:os";
import { stageInvestigationReports } from "../src/staging.ts";
import { git, initializeGit } from "./git-support.ts";
import {
  indexRelativePath,
  investigationRoot,
  jsonObjectMember,
  parseJsonObject,
  withTempRoot
} from "./fixture-support.ts";
import { writeCollection } from "./collection-support.ts";

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

test("stage --scope index treats a standard Investigation ID as exact", () => {
  const workspace = investigationIndexFixture([{ id: "260828-stage-name" }]);
  const resolved = resolveInvestigationStageSelectors({
    baseline: workspace,
    workspace,
    selectedIds: ["260829-stage-not-present"]
  });
  assert.equal(resolved.status, "ok");
  if (resolved.status !== "ok")
    assert.fail("exact selector was rejected as a name");
  assert.deepEqual(resolved.value, ["260829-stage-not-present"]);
  assert.equal(Object.hasOwn(workspace.entries, resolved.value[0]!), false);
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

test("stage selectors resolve a workspace-only Investigation name as an addition", () => {
  const baseline = investigationIndexFixture([{ id: "260828-baseline" }]);
  const addedId = "260829-workspace-only";
  const workspace = investigationIndexFixture([
    { id: "260828-baseline" },
    { id: addedId, formedAt: "2026-08-29T12:00:00+00:00" }
  ]);
  const resolved = resolveInvestigationStageSelectors({
    baseline,
    workspace,
    selectedIds: ["workspace-only"]
  });
  assert.equal(resolved.status, "ok");
  if (resolved.status !== "ok") assert.fail("workspace-only name was rejected");
  assert.deepEqual(resolved.value, [addedId]);
  const target = buildStateIndexFromSnapshot(
    createInvestigationStageIndexDefinition(),
    selectTargetSnapshot(baseline, workspace, new Set(resolved.value))
  );
  assert.equal(target.status, "ok");
  if (target.status !== "ok") assert.fail("addition projection failed");
  assert.deepEqual(target.value.entries[addedId], workspace.entries[addedId]);
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

test("investigation index projection accepts selected report additions without changing Markdown", async () => {
  await withTempRoot("stage-add-projection", async (root) => {
    await writeCollection(root, [{ id: "report" }]);
    const definition = createInvestigationStageIndexDefinition();
    const baseline = parseStateIndex({
      text: await fs.readFile(path.join(root, indexRelativePath), "utf8"),
      definition,
      sourcePath: indexRelativePath
    });
    assert.ok(baseline.status === "ok");
    await writeCollection(root, [{ id: "report" }, { id: "added" }]);
    const workspace = parseStateIndex({
      text: await fs.readFile(path.join(root, indexRelativePath), "utf8"),
      definition,
      sourcePath: indexRelativePath
    });
    assert.ok(workspace.status === "ok");
    const addedPath = path.join(investigationRoot(root), "added.md");
    const markdown = await fs.readFile(addedPath, "utf8");
    const target = buildStateIndexFromSnapshot(
      definition,
      selectTargetSnapshot(baseline.value, workspace.value, new Set(["added"]))
    );
    assert.equal(target.status, "ok");
    if (target.status !== "ok") assert.fail("addition projection failed");
    assert.ok(Object.hasOwn(workspace.value.entries, "added"));
    assert.deepEqual(
      target.value.entries["added"],
      workspace.value.entries["added"]
    );
    assert.equal(await fs.readFile(addedPath, "utf8"), markdown);
  });
});

test("investigation source revision and published index exclude resource byte changes", async () => {
  await withTempRoot("stage-resource-byte", async (root) => {
    const resourcePath = path.join(
      investigationRoot(root),
      "_resources/report/evidence.txt"
    );
    await fs.mkdir(path.dirname(resourcePath), { recursive: true });
    await fs.writeFile(resourcePath, "before");
    await writeCollection(root, [
      { id: "report", resources: ["report/evidence.txt"] }
    ]);
    const indexPath = path.join(root, indexRelativePath);
    const indexBefore = await fs.readFile(indexPath, "utf8");
    const revision = await readInvestigationSourceRevision(
      investigationRoot(root)
    );
    await fs.writeFile(resourcePath, "after");
    assert.deepEqual(
      await readInvestigationSourceRevision(investigationRoot(root)),
      revision
    );
    assert.equal(await fs.readFile(indexPath, "utf8"), indexBefore);
    assert.equal(await fs.readFile(resourcePath, "utf8"), "after");
  });
});

test("investigation selective index projection keeps unrelated report resources outside selected entries", () => {
  const baseline = investigationIndexFixture([
    { id: "first" },
    { id: "second", resources: ["second/evidence.txt"] }
  ]);
  const workspace = investigationIndexFixture([
    { id: "first", title: "Changed first" },
    {
      id: "second",
      title: "Unselected change",
      resources: ["second/evidence.txt"]
    }
  ]);
  const target = buildStateIndexFromSnapshot(
    createInvestigationStageIndexDefinition(),
    selectTargetSnapshot(baseline, workspace, new Set(["first"]))
  );
  assert.equal(target.status, "ok");
  if (target.status !== "ok") assert.fail("selective projection failed");
  assert.ok(Object.hasOwn(workspace.entries, "first"));
  assert.ok(Object.hasOwn(baseline.entries, "second"));
  assert.deepEqual(target.value.entries["first"], workspace.entries["first"]);
  assert.deepEqual(target.value.entries["second"], baseline.entries["second"]);
});

test("stage --scope index preserves strict current index definition requirements", () => {
  const index = investigationIndexFixture([{ id: "report" }]);
  const result = parseStateIndex({
    text: JSON.stringify({ ...index, definitionVersion: 5 }),
    definition: createInvestigationStageIndexDefinition(),
    sourcePath: "investigation-index.json"
  });
  assert.equal(result.status, "error");
  assert.ok(
    result.diagnostics.some(
      (item) => item.code === "state-index.definition-version-mismatch"
    )
  );
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
