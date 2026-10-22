import {
  domainStageControl,
  resolveDomainSelection
} from "../src/staging-domain-context.ts";
import { createInvestigationStageIndexDefinition } from "../src/staging-domain-index.ts";
import {
  buildStateIndexFromSnapshot,
  selectTargetSnapshot
} from "../../index-runtime/src/index.ts";
import assert from "node:assert/strict";
import { test } from "node:test";
import { resolveInvestigationStageSelectors } from "../src/staging-selectors.ts";
import { investigationIndexFixture } from "./index-fixture.ts";

test("stage batch names share the final ID union while retaining dated priority and duplicate selections", () => {
  const baseline = investigationIndexFixture([
    { id: "baseline" },
    { id: "overwritten" }
  ]);
  const workspace = {
    ...baseline,
    entries: {
      overwritten: { ...baseline.entries.overwritten!, name: "new-name" },
      fresh: { ...baseline.entries.baseline!, name: "fresh" }
    }
  };
  const selectedIds = [
    "baseline",
    "new-name",
    "fresh",
    "new-name",
    "261011-unknown"
  ];
  assert.deepEqual(
    resolveInvestigationStageSelectors({ baseline, workspace, selectedIds }),
    {
      status: "ok",
      diagnostics: [],
      value: [
        "baseline",
        "overwritten",
        "fresh",
        "overwritten",
        "261011-unknown"
      ]
    }
  );
  const absent = resolveInvestigationStageSelectors({
    baseline,
    workspace,
    selectedIds: ["overwritten"]
  });
  assert.equal(absent.status, "error");
  assert.deepEqual(
    absent.diagnostics.map((item) => item.message),
    ['report name "overwritten" is absent from both indexes']
  );
});

test("stage batch ambiguous and missing names preserve selector order and sorted complete candidates", () => {
  const loaded = investigationIndexFixture([{ id: "one" }, { id: "two" }]);
  const workspace = {
    ...loaded,
    entries: {
      "261011-shared": { ...loaded.entries.one!, name: "shared" },
      "261010-shared": { ...loaded.entries.two!, name: "shared" }
    }
  };
  const result = resolveInvestigationStageSelectors({
    baseline: null,
    workspace,
    selectedIds: ["missing", "shared", "shared"]
  });
  assert.equal(result.status, "error");
  assert.deepEqual(
    result.diagnostics.map((item) => [item.stateId, item.message]),
    [
      ["missing", 'report name "missing" is absent from both indexes'],
      [
        "shared",
        'report name "shared" is ambiguous; choose one standard ID: 261010-shared, 261011-shared'
      ],
      [
        "shared",
        'report name "shared" is ambiguous; choose one standard ID: 261010-shared, 261011-shared'
      ]
    ]
  );
});

test("domain selection composes an explicit rename from deletion and addition", () => {
  const baseline = investigationIndexFixture([{ id: "old-name" }]);
  const workspaceIndex = investigationIndexFixture([{ id: "new-name" }]);
  const canonicalDefinition = createInvestigationStageIndexDefinition();
  const snapshot = {
    baseline,
    workspaceIndex,
    pendingIndex: baseline,
    pendingReportPaths: new Map(),
    canonicalDefinition,
    revision: null
  };
  const selection = resolveDomainSelection(
    snapshot,
    domainStageControl({
      investigationsDirectory: "/workspace/docs/investigations",
      reportIds: ["old-name", "new-name"],
      scope: "domain"
    })
  );
  assert.equal(selection.status, "ok");
  if (selection.status !== "ok")
    assert.fail("explicit rename selection failed");
  assert.deepEqual(selection.value.selectedIds, ["new-name", "old-name"]);
  assert.deepEqual(selection.value.sourceSelection, {
    deletedIds: ["old-name"],
    reportIds: ["new-name"],
    resourceIds: []
  });
  assert.equal(baseline.entries["old-name"]?.sourcePath, "old-name.md");
  assert.equal(workspaceIndex.entries["new-name"]?.sourcePath, "new-name.md");
  const target = buildStateIndexFromSnapshot(
    canonicalDefinition,
    selectTargetSnapshot(
      baseline,
      workspaceIndex,
      new Set(selection.value.selectedIds)
    )
  );
  assert.equal(target.status, "ok");
  if (target.status !== "ok") assert.fail("explicit rename projection failed");
  assert.equal(Object.hasOwn(target.value.entries, "old-name"), false);
  assert.deepEqual(
    target.value.entries["new-name"],
    workspaceIndex.entries["new-name"]
  );
});
