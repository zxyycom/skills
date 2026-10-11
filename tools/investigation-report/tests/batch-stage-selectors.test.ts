import assert from "node:assert/strict";
import { test } from "node:test";
import { resolveInvestigationStageSelectors } from "../src/staging-selectors.ts";
import { loadInvestigationIndex } from "../src/investigation-state-index.ts";
import {
  investigationRoot,
  withTempRoot,
  writeCollection
} from "./v6-support.ts";

async function index(root: string) {
  const loaded = await loadInvestigationIndex({
    investigationsDirectory: investigationRoot(root)
  });
  assert.equal(loaded.status, "ok");
  assert.ok(loaded.value !== null);
  return loaded.value;
}

test("stage batch names share the final ID union while retaining dated priority and duplicate selections", async () => {
  await withTempRoot("batch-names", async (root) => {
    await writeCollection(root, [{ id: "baseline" }, { id: "overwritten" }]);
    const baseline = await index(root);
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
});

test("stage batch ambiguous and missing names preserve selector order and sorted complete candidates", async () => {
  await withTempRoot("batch-diagnostics", async (root) => {
    await writeCollection(root, [{ id: "one" }, { id: "two" }]);
    const loaded = await index(root);
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
});
