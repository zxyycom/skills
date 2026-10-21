import assert from "node:assert/strict";
import test from "node:test";
import * as v from "valibot";
import fs from "node:fs/promises";
import path from "node:path";
import { createCliProgram } from "../src/cli-args.ts";
import { decisionStageTargetFromSources } from "../src/decision-stage-target.ts";
import {
  buildStageIndexText,
  decisionStageTargetFailure
} from "../src/decision-stage-prepare.ts";
import { readFilesystemDecisionCandidates } from "../src/decision-stage-sources.ts";
import {
  runSuccessfulSourceCli,
  runSourceCli,
  withFixtureWorkspace
} from "./support.ts";
import { writeReallocationRing } from "./reallocation-fixture.ts";

test("Decision stage and selected sync resolve mixed short names without changing duplicate and missing-source errors", async () => {
  await withFixtureWorkspace("batch-stage-sync-names", async (root) => {
    const directory = path.join(root, "docs/decisions");
    const baseline = await readFilesystemDecisionCandidates(
      directory,
      "docs/decisions"
    );
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
    const filesystemCandidates = await readFilesystemDecisionCandidates(
      directory,
      "docs/decisions"
    );
    const indexPath = path.join(directory, "decision-index.json");
    const before = await fs.readFile(indexPath, "utf8");
    for (const selected of [
      [successorIds[0]!, successorIds[0]!.slice(7)],
      ["261002-missing"]
    ]) {
      let dispatched = false;
      const program = createCliProgram(
        async (args) => {
          assert.equal(args.command, "stage");
          if (args.command !== "stage")
            throw new Error("Expected stage dispatch");
          dispatched = true;
          assert.deepEqual(args.decisionIds, selected);
          assert.equal(args.scope, "all");
          let failure;
          try {
            await decisionStageTargetFromSources({
              baseline: [...baseline.sources.values()],
              filesystemCandidates,
              selectedSelectors: args.decisionIds,
              revision: "baseline"
            });
            assert.fail("Invalid selectors must fail");
          } catch (error) {
            failure = decisionStageTargetFailure(error);
          }
          assert.equal(failure.exitCode, 2);
          assert.match(
            failure.errors.join("\n"),
            /repeated Decision ID|does not exist in the revision or filesystem/u
          );
          return failure.exitCode;
        },
        () => {},
        { io: { stdout: () => {}, stderr: () => {} } }
      );
      await program.parseAsync([
        "node",
        "decision-records.ts",
        "stage",
        ...selected,
        "--root",
        root
      ]);
      assert.equal(dispatched, true);
      const sync = await runSourceCli([
        "sync-index",
        ...selected.flatMap((id) => ["--select", id]),
        "--root",
        root
      ]);
      assert.equal(sync.exitCode, 1, sync.stderr);
      assert.match(sync.stderr, /selector-duplicate|selector-not-found/u);
      assert.equal(await fs.readFile(indexPath, "utf8"), before);
    }
    let staged = false;
    const program = createCliProgram(
      async (args) => {
        assert.equal(args.command, "stage");
        if (args.command !== "stage")
          throw new Error("Expected stage dispatch");
        assert.equal(args.scope, "index");
        assert.deepEqual(args.decisionIds, selectors);
        const target = await decisionStageTargetFromSources({
          baseline: [...baseline.sources.values()],
          filesystemCandidates,
          selectedSelectors: args.decisionIds,
          revision: "baseline"
        });
        assert.deepEqual(target.selectedIds, [
          ...predecessorIds,
          ...successorIds
        ]);
        const projected = await buildStageIndexText(
          target.sources,
          "docs/decisions/decision-index.json"
        );
        assert.equal(projected.status, "ok", JSON.stringify(projected));
        if (projected.status !== "ok")
          throw new Error("Expected selected index projection");
        const pending = v.parse(
          v.object({ entries: v.record(v.string(), v.unknown()) }),
          JSON.parse(projected.value) as unknown
        );
        for (const id of successorIds) assert.ok(pending.entries[id]);
        staged = true;
        return 0;
      },
      () => {},
      { io: { stdout: () => {}, stderr: () => {} } }
    );
    await program.parseAsync([
      "node",
      "decision-records.ts",
      "stage",
      ...selectors,
      "--scope",
      "index",
      "--root",
      root
    ]);
    assert.equal(staged, true);
    assert.equal(await fs.readFile(indexPath, "utf8"), before);
  });
});
