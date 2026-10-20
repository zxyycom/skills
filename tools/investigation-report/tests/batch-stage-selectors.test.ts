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
