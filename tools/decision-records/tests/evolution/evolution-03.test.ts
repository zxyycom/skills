import {
  archivedRelativePath,
  assert,
  candidateDecisionBody,
  currentRelativePath,
  decisionFilePath,
  establishAdditionalActivePredecessor,
  establishClosedReallocation,
  establishClosedSplit,
  findIndexEntry,
  fs,
  path,
  readIndex,
  runSourceLifecycleCli,
  test,
  traceDecision,
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

test("activate rejects relation replacement for established decisions", () =>
  withFixtureWorkspace(
    "activate-established-relations",
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
      for (const relationSelection of [
        ["--clear-relations"],
        ["--relation", "替代=" + archivedRelativePath]
      ]) {
        const rejected = await runSourceLifecycleCli([
          "activate",
          currentRelativePath,
          "--alignment",
          "aligned",
          ...relationSelection,
          "--root",
          workspaceRoot
        ]);
        assert.equal(rejected.exitCode, 1);
        assert.match(rejected.stderr, /apply only when activate establishes/);
      }
      assert.equal(await fs.readFile(currentPath, "utf8"), currentBefore);
      assert.equal(await fs.readFile(indexPath, "utf8"), indexBefore);
    }
  ));

test("evolve performs a closed split with independently aligned successors", () =>
  withFixtureWorkspace("evolve-closed-split", async (workspaceRoot) => {
    const established = await establishClosedSplit(workspaceRoot);
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

    const traced = await traceDecision(
      established.coarseRelativePath,
      ["--direction", "successors", "--depth", "1"],
      workspaceRoot
    );
    assert.match(traced, /keep-current-split-slice/);
    assert.match(traced, /keep-future-split-slice/);
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

test("evolve rejects a one-successor reallocation", () =>
  withFixtureWorkspace(
    "evolve-one-successor-reallocation",
    async (workspaceRoot) => {
      const predecessor =
        await establishAdditionalActivePredecessor(workspaceRoot);
      const successorRelativePath = "use-one-reallocation-successor";
      await fs.writeFile(
        decisionFilePath(workspaceRoot, successorRelativePath),
        candidateDecisionBody({
          relations: [
            { type: "重划", target: currentRelativePath },
            { type: "重划", target: predecessor }
          ]
        }),
        "utf8"
      );
      const rejected = await runSourceLifecycleCli([
        "evolve",
        "--successor",
        "aligned=" + successorRelativePath,
        "--root",
        workspaceRoot
      ]);
      assert.equal(rejected.exitCode, 1);
      assert.match(
        rejected.stderr,
        /requires at least two explicitly selected/
      );
    }
  ));
