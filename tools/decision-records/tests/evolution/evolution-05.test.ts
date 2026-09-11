import {
  assert,
  candidateDecisionBody,
  currentRelativePath,
  decisionFilePath,
  establishClosedReallocation,
  establishClosedSplit,
  findIndexEntry,
  fs,
  path,
  readIndex,
  runSourceCli,
  runSourceLifecycleCli,
  runSuccessfulSourceLifecycleCli,
  test,
  validateDecisionRecords,
  withFixtureWorkspace
} from "./support.ts";

test("evolve keeps a later reallocation separate from its archived predecessor event", () =>
  withFixtureWorkspace(
    "evolve-successive-reallocation",
    async (workspaceRoot) => {
      const established = await establishClosedReallocation(workspaceRoot);
      await runSuccessfulSourceLifecycleCli([
        "archive",
        established.firstSuccessorRelativePath,
        "--root",
        workspaceRoot
      ]);
      const additionalPredecessor = "use-later-reallocation-predecessor";
      await fs.writeFile(
        decisionFilePath(workspaceRoot, additionalPredecessor),
        candidateDecisionBody(),
        "utf8"
      );
      await runSuccessfulSourceLifecycleCli([
        "activate",
        additionalPredecessor,
        "--alignment",
        "aligned",
        "--root",
        workspaceRoot
      ]);
      await runSuccessfulSourceLifecycleCli([
        "archive",
        additionalPredecessor,
        "--root",
        workspaceRoot
      ]);
      const firstSuccessor = "use-later-combined-reallocation-owner";
      const secondSuccessor = "use-later-narrow-reallocation-owner";
      await fs.writeFile(
        decisionFilePath(workspaceRoot, firstSuccessor),
        candidateDecisionBody({
          relations: [
            { type: "重划", target: established.firstSuccessorRelativePath },
            { type: "重划", target: additionalPredecessor }
          ]
        }),
        "utf8"
      );
      await fs.writeFile(
        decisionFilePath(workspaceRoot, secondSuccessor),
        candidateDecisionBody({
          relations: [
            { type: "重划", target: established.firstSuccessorRelativePath }
          ]
        }),
        "utf8"
      );
      await runSuccessfulSourceLifecycleCli([
        "evolve",
        "--successor",
        "aligned=" + firstSuccessor,
        "--successor",
        "aligned=" + secondSuccessor,
        "--root",
        workspaceRoot
      ]);
      assert.deepEqual(
        (await validateDecisionRecords({ workspaceRoot })).errors,
        []
      );
    }
  ));

test("discard rejects a split successor that would leave an open split", () =>
  withFixtureWorkspace("discard-open-split", async (workspaceRoot) => {
    const established = await establishClosedSplit(workspaceRoot);
    const discardedPath = decisionFilePath(
      workspaceRoot,
      established.alignedRelativePath
    );
    const discardedText = await fs.readFile(discardedPath, "utf8");
    const indexText = await fs.readFile(established.indexPath, "utf8");

    const discarded = await runSourceCli([
      "discard",
      established.alignedRelativePath,
      "--delete-recorded-decision",
      "--root",
      workspaceRoot
    ]);

    assert.equal(discarded.exitCode, 1);
    assert.match(
      discarded.stderr,
      /split target must have at least two direct/
    );
    assert.equal(await fs.readFile(discardedPath, "utf8"), discardedText);
    assert.equal(await fs.readFile(established.indexPath, "utf8"), indexText);
  }));

test("evolve discards one split successor when it replaces the complete closure", () =>
  withFixtureWorkspace(
    "evolve-replace-split-successor",
    async (workspaceRoot) => {
      const established = await establishClosedSplit(workspaceRoot);
      const replacementRelativePath = "replace-current-split-slice";
      await fs.writeFile(
        decisionFilePath(workspaceRoot, replacementRelativePath),
        candidateDecisionBody(),
        "utf8"
      );

      await runSuccessfulSourceLifecycleCli([
        "evolve",
        "--successor",
        "unaligned=" + established.unalignedRelativePath,
        "--successor",
        "aligned=" + replacementRelativePath,
        "--relation",
        "拆分=" + established.coarseRelativePath,
        "--discard",
        established.alignedRelativePath,
        "--delete-recorded-decision",
        "--root",
        workspaceRoot
      ]);

      const index = await readIndex(established.indexPath);
      assert.equal(
        Object.hasOwn(index.entries, established.alignedRelativePath),
        false
      );
      assert.deepEqual(
        findIndexEntry(index, replacementRelativePath).relations,
        [{ type: "拆分", target: established.coarseRelativePath }]
      );
      assert.deepEqual(
        (await validateDecisionRecords({ workspaceRoot })).errors,
        []
      );
    }
  ));

test("evolve adds a split successor only when every existing successor is selected", () =>
  withFixtureWorkspace("evolve-extend-split", async (workspaceRoot) => {
    const established = await establishClosedSplit(workspaceRoot);
    const thirdRelativePath = "add-third-split-slice";
    await fs.writeFile(
      decisionFilePath(workspaceRoot, thirdRelativePath),
      candidateDecisionBody(),
      "utf8"
    );
    await runSuccessfulSourceLifecycleCli([
      "evolve",
      "--successor",
      "aligned=" + established.alignedRelativePath,
      "--successor",
      "unaligned=" + established.unalignedRelativePath,
      "--successor",
      "aligned=" + thirdRelativePath,
      "--relation",
      "拆分=" + established.coarseRelativePath,
      "--root",
      workspaceRoot
    ]);
    const index = await readIndex(established.indexPath);
    assert.deepEqual(findIndexEntry(index, thirdRelativePath).relations, [
      {
        type: "拆分",
        target: established.coarseRelativePath
      }
    ]);
    assert.deepEqual(
      (await validateDecisionRecords({ workspaceRoot })).errors,
      []
    );
  }));

test("evolve rejects a discarded Decision ID selected as a successor without mutation", () =>
  withFixtureWorkspace(
    "evolve-discard-successor-conflict",
    async (workspaceRoot) => {
      const targetPath = decisionFilePath(workspaceRoot, currentRelativePath);
      const targetText = await fs.readFile(targetPath, "utf8");
      const indexPath = path.join(
        workspaceRoot,
        "docs",
        "decisions",
        "decision-index.json"
      );
      const indexText = await fs.readFile(indexPath, "utf8");

      const rejected = await runSourceLifecycleCli([
        "evolve",
        "--successor",
        "aligned=" + currentRelativePath,
        "--discard",
        currentRelativePath,
        "--delete-recorded-decision",
        "--root",
        workspaceRoot
      ]);

      assert.equal(rejected.exitCode, 1);
      assert.match(
        rejected.stderr,
        /Discarded Decision ID must not also be a successor/
      );
      assert.equal(await fs.readFile(targetPath, "utf8"), targetText);
      assert.equal(await fs.readFile(indexPath, "utf8"), indexText);
    }
  ));
