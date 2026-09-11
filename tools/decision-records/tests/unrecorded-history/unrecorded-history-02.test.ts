import {
  assert,
  candidateDecisionBody,
  currentRelativePath,
  decisionFilePath,
  establishUnrecordedIntermediate,
  fileExists,
  findIndexEntry,
  fs,
  path,
  readIndex,
  runSourceCli,
  runSuccessfulSourceCli,
  test,
  unrecordedIntermediateRelativePath,
  validateDecisionRecords,
  withFixtureWorkspace,
  withGitFixtureWorkspace
} from "./support.ts";

test("evolve pauses for an unrecorded archived direct predecessor", () =>
  withGitFixtureWorkspace(
    "unrecorded-archived-predecessor",
    async (workspaceRoot) => {
      const decisionsDirectory = path.join(workspaceRoot, "docs", "decisions");
      const indexPath = path.join(decisionsDirectory, "decision-index.json");
      const predecessorRelativePath = "use-unrecorded-archived-target";
      await fs.writeFile(
        decisionFilePath(workspaceRoot, predecessorRelativePath),
        candidateDecisionBody(),
        "utf8"
      );
      await runSuccessfulSourceCli([
        "activate",
        predecessorRelativePath,
        "--alignment",
        "aligned",
        "--root",
        workspaceRoot
      ]);
      await runSuccessfulSourceCli([
        "archive",
        predecessorRelativePath,
        "--keep-unrecorded-history",
        "--root",
        workspaceRoot
      ]);
      const successorRelativePath = "evolve-from-unrecorded-archived-target";
      const successorPath = decisionFilePath(
        workspaceRoot,
        successorRelativePath
      );
      const successorCandidate = candidateDecisionBody({
        relations: [{ target: predecessorRelativePath, type: "替代" }]
      });
      await fs.writeFile(successorPath, successorCandidate, "utf8");
      const archivedPredecessorPath = decisionFilePath(
        workspaceRoot,
        "archive/" + predecessorRelativePath
      );
      const predecessorBefore = await fs.readFile(
        archivedPredecessorPath,
        "utf8"
      );
      const indexBefore = await fs.readFile(indexPath, "utf8");

      const paused = await runSourceCli([
        "evolve",
        "--successor",
        "aligned=" + successorRelativePath,
        "--root",
        workspaceRoot
      ]);
      assert.equal(paused.exitCode, 1);
      assert.match(paused.stderr, /command paused with warnings/);
      assert.match(
        paused.stderr,
        new RegExp(
          "Predecessor decision " +
            predecessorRelativePath +
            " has not entered Git HEAD"
        )
      );
      assert.match(paused.stderr, /this 替代 relation should be preserved/);
      assert.equal(
        await fs.readFile(successorPath, "utf8"),
        successorCandidate
      );
      assert.equal(
        await fs.readFile(archivedPredecessorPath, "utf8"),
        predecessorBefore
      );
      assert.equal(await fs.readFile(indexPath, "utf8"), indexBefore);

      const preserved = await runSourceCli([
        "evolve",
        "--successor",
        "aligned=" + successorRelativePath,
        "--keep-unrecorded-history",
        "--root",
        workspaceRoot
      ]);
      assert.equal(preserved.exitCode, 0, preserved.stderr);
      const index = await readIndex(indexPath);
      assert.equal(
        findIndexEntry(index, predecessorRelativePath).status,
        "archived"
      );
      assert.deepEqual(findIndexEntry(index, successorRelativePath).relations, [
        { type: "替代", target: predecessorRelativePath }
      ]);
    }
  ));

test("evolve lists unrecorded predecessor warnings in Decision ID order", () =>
  withGitFixtureWorkspace(
    "unrecorded-predecessor-warning-order",
    async (workspaceRoot) => {
      const predecessorIds = [
        "z-unrecorded-predecessor.md",
        "a-unrecorded-predecessor.md"
      ];
      for (const decisionId of predecessorIds) {
        await fs.writeFile(
          decisionFilePath(workspaceRoot, decisionId),
          candidateDecisionBody(),
          "utf8"
        );
        await runSuccessfulSourceCli([
          "activate",
          decisionId,
          "--alignment",
          "aligned",
          "--root",
          workspaceRoot
        ]);
      }
      const successorId = "merge-unrecorded-predecessors";
      await fs.writeFile(
        decisionFilePath(workspaceRoot, successorId),
        candidateDecisionBody({
          relations: [
            { target: predecessorIds[0], type: "归并" },
            { target: predecessorIds[1], type: "归并" }
          ]
        }),
        "utf8"
      );

      const paused = await runSourceCli([
        "evolve",
        "--successor",
        "aligned=" + successorId,
        "--root",
        workspaceRoot
      ]);

      assert.equal(paused.exitCode, 1);
      const firstWarning = paused.stderr.indexOf(
        "Predecessor decision a-unrecorded-predecessor"
      );
      const secondWarning = paused.stderr.indexOf(
        "Predecessor decision z-unrecorded-predecessor"
      );
      assert.ok(firstWarning >= 0);
      assert.ok(secondWarning > firstWarning);
    }
  ));

test("evolve discards an intermediate with explicit final relations", () =>
  withFixtureWorkspace(
    "unrecorded-evolution-discard",
    async (workspaceRoot) => {
      const { indexPath, intermediatePath } =
        await establishUnrecordedIntermediate(workspaceRoot);
      const beforeDiscard = await readIndex(indexPath);
      assert.equal(
        findIndexEntry(beforeDiscard, currentRelativePath).status,
        "archived"
      );
      assert.deepEqual(
        findIndexEntry(beforeDiscard, unrecordedIntermediateRelativePath)
          .relations,
        [{ type: "修订", target: currentRelativePath }]
      );
      const successorRelativePath = "use-discard-unrecorded-history";
      const successorPath = decisionFilePath(
        workspaceRoot,
        successorRelativePath
      );
      await fs.writeFile(successorPath, candidateDecisionBody(), "utf8");
      const discarded = await runSourceCli([
        "evolve",
        "--successor",
        "aligned=" + successorRelativePath,
        "--discard",
        unrecordedIntermediateRelativePath,
        "--relation",
        "修订=" + currentRelativePath,
        "--delete-recorded-decision",
        "--root",
        workspaceRoot
      ]);
      assert.equal(discarded.exitCode, 0, discarded.stderr);
      assert.match(
        discarded.stdout,
        /discarded decision use-unrecorded-intermediate/
      );
      assert.equal(await fileExists(intermediatePath), false);
      const discardedIndex = await readIndex(indexPath);
      assert.equal(
        Object.hasOwn(
          discardedIndex.entries,
          unrecordedIntermediateRelativePath
        ),
        false
      );
      assert.deepEqual(
        findIndexEntry(discardedIndex, successorRelativePath).relations,
        [{ type: "修订", target: currentRelativePath }]
      );
      assert.deepEqual(
        (await validateDecisionRecords({ workspaceRoot })).errors,
        []
      );
    }
  ));
