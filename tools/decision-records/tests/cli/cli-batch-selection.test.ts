import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs/promises";
import path from "node:path";
import { withGitFixtureWorkspace } from "../support/support-git-fixture.ts";
import {
  runGit,
  runSuccessfulSourceCli,
  runSourceCli
} from "../support/support.ts";
import { writeReallocationRing } from "../relations/reallocation-fixture.ts";
import { parseDecisionIndex } from "../../src/index/decision-state-index.ts";
import { isDecisionId } from "../../src/collection/decision-path.ts";

test("Decision stage and selected sync resolve mixed names and reject duplicate or unavailable identities", async () => {
  await withGitFixtureWorkspace("batch-stage-sync-names", async (root) => {
    const { predecessorIds, successorIds } = await writeReallocationRing(
      root,
      10
    );
    await runSuccessfulSourceCli(["sync-index", "--root", root]);
    const selectors = [...predecessorIds, ...successorIds].map((id, index) =>
      index % 2 === 0 ? id.slice(7) : id
    );
    const synchronized = await runSuccessfulSourceCli([
      "sync-index",
      "--root",
      root,
      "--preflight",
      ...selectors.flatMap((selector) => ["--select", selector])
    ]);
    for (const id of successorIds) assert.ok(synchronized.includes(id));
    const indexPath = path.join(root, "docs/decisions/decision-index.json");
    const before = await fs.readFile(indexPath, "utf8");
    const pendingBefore = runGit(root, ["write-tree"]);
    for (const selected of [
      [successorIds[0]!, successorIds[0]!.slice(7)],
      ["261002-missing"]
    ]) {
      const staged = await runSourceCli(["stage", ...selected, "--root", root]);
      assert.equal(staged.exitCode, 1, staged.stderr);
      assert.match(staged.stderr, /Repeated resolved|missing or ambiguous/);
      assert.equal(runGit(root, ["write-tree"]), pendingBefore);
      const sync = await runSourceCli([
        "sync-index",
        ...selected.flatMap((id) => ["--select", id]),
        "--root",
        root
      ]);
      assert.equal(sync.exitCode, 1, sync.stderr);
      assert.match(
        sync.stderr,
        /selector-duplicate|Unknown selected ID or source location/
      );
      assert.equal(await fs.readFile(indexPath, "utf8"), before);
    }
    const staged = await runSourceCli([
      "stage",
      ...selectors,
      "--scope",
      "index",
      "--root",
      root
    ]);
    assert.equal(staged.exitCode, 0, staged.stderr);
    const pending = parseDecisionIndex(
      runGit(root, ["show", ":docs/decisions/decision-index.json"]),
      indexPath
    );
    assert.equal(pending.status, "ok", JSON.stringify(pending));
    if (pending.status !== "ok") assert.fail("Expected a valid pending index");
    for (const id of successorIds) {
      assert.ok(isDecisionId(id));
      assert.ok(pending.value.entries[id]);
    }
    assert.equal(await fs.readFile(indexPath, "utf8"), before);
  });
});
