import { executeDecisionQuery } from "../../src/decision-query-service.ts";
import { decisionIdForTest } from "../support-record-fixture.ts";
import { assertEvolutionRejected } from "./domain-support.ts";
import {
  archivedRelativePath,
  assert,
  currentRelativePath,
  decisionFilePath,
  establishClosedReallocation,
  establishClosedSplit,
  findIndexEntry,
  fs,
  path,
  readIndex,
  runSourceLifecycleCli,
  test,
  validateDecisionRecords,
  withFixtureWorkspace
} from "./support.ts";

test("evolve rejects archived sources without alignment before mutation", () =>
  withFixtureWorkspace("evolve-historical-successor", async (workspaceRoot) => {
    const archivedPath = decisionFilePath(
      workspaceRoot,
      "archive/" + archivedRelativePath
    );
    const indexPath = path.join(
      workspaceRoot,
      "docs",
      "decisions",
      "decision-index.json"
    );
    const validSource = await fs.readFile(archivedPath, "utf8");
    const indexBefore = await fs.readFile(indexPath, "utf8");

    for (const invalidAlignment of ["alignment: null", ""] as const) {
      const invalidSource = validSource.replace(
        "alignment: unaligned",
        invalidAlignment
      );
      await fs.writeFile(archivedPath, invalidSource, "utf8");
      const rejected = await runSourceLifecycleCli([
        "evolve",
        "--successor",
        "aligned=" + archivedRelativePath,
        "--clear-relations",
        "--root",
        workspaceRoot
      ]);
      assert.equal(rejected.exitCode, 1);
      assert.equal(rejected.stdout, "");
      assert.doesNotMatch(rejected.stdout, /Relation review/);
      assert.equal(rejected.stdout, "");
      assert.match(
        rejected.stderr,
        /decision-records\.lifecycle-preflight-failed/
      );
      assert.match(rejected.stderr, /alignment/i);
      assert.match(
        rejected.stderr,
        /restore the trusted historical alignment/i
      );
      assert.equal(await fs.readFile(archivedPath, "utf8"), invalidSource);
      assert.equal(await fs.readFile(indexPath, "utf8"), indexBefore);
    }
  }));

test("publish rejects an established decision and its removed override options", () =>
  withFixtureWorkspace(
    "publish-established-decision",
    async (workspaceRoot) => {
      const currentPath = decisionFilePath(workspaceRoot, currentRelativePath);
      const indexPath = path.join(
        workspaceRoot,
        "docs",
        "decisions",
        "decision-index.json"
      );
      const currentBefore = await fs.readFile(currentPath, "utf8");
      const indexBefore = await fs.readFile(indexPath, "utf8");
      const rejected = await runSourceLifecycleCli([
        "publish",
        currentRelativePath,
        "--alignment",
        "aligned",
        "--root",
        workspaceRoot
      ]);
      assert.equal(rejected.exitCode, 1);
      assert.match(
        rejected.stderr,
        /publish establishes a decision candidate; this decision is already an active formal record/
      );
      for (const removedOption of [
        ["--clear-relations"],
        ["--relation", "替代=" + archivedRelativePath],
        ["--relation-summary", archivedRelativePath + "=summary"]
      ]) {
        const invalid = await runSourceLifecycleCli([
          "publish",
          currentRelativePath,
          "--alignment",
          "aligned",
          ...removedOption,
          "--root",
          workspaceRoot
        ]);
        assert.equal(invalid.exitCode, 2, removedOption.join(" "));
        assert.match(invalid.stderr, /unknown option/);
      }
      assert.equal(await fs.readFile(currentPath, "utf8"), currentBefore);
      assert.equal(await fs.readFile(indexPath, "utf8"), indexBefore);
    }
  ));

test("evolve performs a closed split with independently aligned successors", () =>
  withFixtureWorkspace("evolve-closed-split", async (workspaceRoot) => {
    const established = await establishClosedSplit(workspaceRoot);
    assert.match(established.output, /Relation review \(committed\):/);
    assert.match(
      established.output,
      /keep-current-split-slice action=establish/
    );
    assert.match(
      established.output,
      /keep-future-split-slice action=establish/
    );
    const index = await readIndex(established.indexPath);
    const coarseState = findIndexEntry(index, established.coarseRelativePath);
    const alignedState = findIndexEntry(index, established.alignedRelativePath);
    const unalignedState = findIndexEntry(
      index,
      established.unalignedRelativePath
    );
    assert.equal(coarseState.status, "archived");
    assert.equal(findIndexEntry(index, currentRelativePath).status, "active");
    assert.equal(alignedState.alignment, "aligned");
    assert.equal(unalignedState.alignment, "unaligned");
    assert.equal(alignedState.createdAt, unalignedState.createdAt);
    assert.deepEqual(alignedState.relations, [
      {
        type: "拆分",
        target: established.coarseRelativePath
      }
    ]);
    assert.deepEqual(unalignedState.relations, [
      {
        type: "拆分",
        target: established.coarseRelativePath
      }
    ]);

    const traced = await executeDecisionQuery({
      command: "trace",
      decisionId: decisionIdForTest(established.coarseRelativePath),
      direction: "successors",
      maxDepth: 1,
      location: { workspaceRoot, decisionsDir: "docs/decisions" }
    });
    assert.ok(traced.status === "ok" && traced.command === "trace");
    assert.ok(
      traced.traceIds.includes(
        decisionIdForTest(established.alignedRelativePath)
      )
    );
    assert.ok(
      traced.traceIds.includes(
        decisionIdForTest(established.unalignedRelativePath)
      )
    );
  }));

test("evolve performs a closed sparse reallocation with independently aligned successors", () =>
  withFixtureWorkspace("evolve-closed-reallocation", async (workspaceRoot) => {
    const established = await establishClosedReallocation(workspaceRoot);
    const index = await readIndex(established.indexPath);
    assert.equal(findIndexEntry(index, currentRelativePath).status, "archived");
    assert.equal(
      findIndexEntry(index, established.secondPredecessorRelativePath).status,
      "archived"
    );
    assert.deepEqual(
      findIndexEntry(index, established.firstSuccessorRelativePath).relations,
      [
        { type: "重划", target: currentRelativePath },
        { type: "重划", target: established.secondPredecessorRelativePath }
      ]
    );
    assert.deepEqual(
      findIndexEntry(index, established.secondSuccessorRelativePath).relations,
      [{ type: "重划", target: currentRelativePath }]
    );
    assert.equal(
      findIndexEntry(index, established.firstSuccessorRelativePath).alignment,
      "aligned"
    );
    assert.equal(
      findIndexEntry(index, established.secondSuccessorRelativePath).alignment,
      "unaligned"
    );
    assert.deepEqual(
      (await validateDecisionRecords({ workspaceRoot })).errors,
      []
    );
  }));

test("evolve rejects a one-successor reallocation", async () => {
  await assertEvolutionRejected(
    [
      { id: "predecessor", status: "active" },
      { id: "another", status: "active" },
      {
        id: "first",
        relations: [
          { type: "重划", target: "predecessor" },
          { type: "重划", target: "another" }
        ]
      }
    ],
    ["first"],
    /requires at least two explicitly selected successors/u
  );
});
