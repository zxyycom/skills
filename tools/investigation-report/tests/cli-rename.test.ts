import assert from "node:assert/strict";
import test from "node:test";

import { renameInvestigationRecord } from "../src/rename.ts";
import { withTempRoot } from "./fixture-support.ts";
import { runInvestigationCli } from "./cli-support.ts";
import { writeCollection } from "./collection-support.ts";

test("Investigation rename uses dated source IDs exactly and reports ambiguous name selectors", async () => {
  await withTempRoot("rename-selectors", async (workspaceRoot) => {
    await writeCollection(workspaceRoot, [
      { id: "260828-topic" },
      { formedAt: "2026-08-29T12:00:00+00:00", id: "260829-topic" }
    ]);
    const ambiguous = await renameInvestigationRecord({
      preflight: true,
      source: "topic",
      target: "renamed",
      workspaceRoot
    });
    assert.equal(ambiguous.status, "error");
    assert.match(ambiguous.errors.join("\n"), /name is ambiguous/u);
    const targetConflict = await renameInvestigationRecord({
      preflight: true,
      source: "260828-topic",
      target: "topic",
      workspaceRoot
    });
    assert.equal(targetConflict.status, "ok");
    assert.equal(targetConflict.changed, false);
    const exact = await runInvestigationCli(workspaceRoot, [
      "rename",
      "260828-topic.md",
      "renamed"
    ]);
    assert.equal(exact.status, 0, exact.stderr);
    assert.match(exact.stdout, /260828-topic -> 260828-renamed/u);
  });
});
