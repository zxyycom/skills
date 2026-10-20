import { withGitFixtureWorkspace } from "./support-git-fixture.ts";
import assert from "node:assert/strict";
import test from "node:test";
import * as v from "valibot";
import { runSuccessfulSourceCli, runSourceCli, runGit } from "./support.ts";
import { writeReallocationRing } from "./reallocation-fixture.ts";

test("Decision stage and selected sync resolve mixed short names without changing duplicate and missing-source errors", async () => {
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
    const before = runGit(root, ["write-tree"]);
    for (const command of ["stage", "sync-index"]) {
      const selected = [successorIds[0]!, successorIds[0]!.slice(7)];
      const duplicate = await runSourceCli([
        command,
        ...(command === "stage"
          ? selected
          : selected.flatMap((id) => ["--select", id])),
        "--root",
        root
      ]);
      assert.equal(
        duplicate.exitCode,
        command === "stage" ? 2 : 1,
        duplicate.stderr
      );
      assert.match(
        duplicate.stderr,
        /repeated Decision ID|selector-duplicate/u
      );
      const missing = await runSourceCli([
        command,
        ...(command === "stage"
          ? ["261002-missing"]
          : ["--select", "261002-missing"]),
        "--root",
        root
      ]);
      assert.equal(
        missing.exitCode,
        command === "stage" ? 2 : 1,
        missing.stderr
      );
      assert.match(
        missing.stderr,
        /does not exist in the revision or filesystem|selector-not-found/u
      );
      assert.equal(runGit(root, ["write-tree"]), before);
    }
    await runSuccessfulSourceCli([
      "stage",
      ...selectors,
      "--scope",
      "index",
      "--root",
      root
    ]);
    const pending = v.parse(
      v.object({ entries: v.record(v.string(), v.unknown()) }),
      JSON.parse(
        runGit(root, ["show", ":docs/decisions/decision-index.json"])
      ) as unknown
    );
    for (const id of successorIds) assert.ok(pending.entries[id]);
  });
});
