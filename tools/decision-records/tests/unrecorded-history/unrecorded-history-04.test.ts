import {
  assert,
  candidateDecisionBody,
  commitWorkspace,
  currentRelativePath,
  decisionFilePath,
  establishUnrecordedIntermediate,
  fs,
  runSourceCli,
  runSuccessfulSourceCli,
  test,
  unrecordedIntermediateRelativePath,
  withFixtureWorkspace,
  withGitFixtureWorkspace
} from "./support.ts";

test("evolve discard flag still pauses for an unrecorded final predecessor", () =>
  withGitFixtureWorkspace(
    "recorded-evolution-discard-flag-unrecorded-relation",
    async (workspaceRoot) => {
      const { indexPath, intermediatePath } =
        await establishUnrecordedIntermediate(workspaceRoot);
      commitWorkspace(workspaceRoot, "record intermediate decision");
      const unrecordedPredecessorId = "use-unrecorded-final-predecessor";
      const unrecordedPredecessorPath = decisionFilePath(
        workspaceRoot,
        unrecordedPredecessorId
      );
      await fs.writeFile(
        unrecordedPredecessorPath,
        candidateDecisionBody(),
        "utf8"
      );
      await runSuccessfulSourceCli([
        "activate",
        unrecordedPredecessorId,
        "--alignment",
        "aligned",
        "--root",
        workspaceRoot
      ]);
      const successorRelativePath = "use-flagged-unrecorded-relation";
      const successorPath = decisionFilePath(
        workspaceRoot,
        successorRelativePath
      );
      const successorCandidate = candidateDecisionBody();
      await fs.writeFile(successorPath, successorCandidate, "utf8");
      const intermediateBefore = await fs.readFile(intermediatePath, "utf8");
      const predecessorBefore = await fs.readFile(
        unrecordedPredecessorPath,
        "utf8"
      );
      const indexBefore = await fs.readFile(indexPath, "utf8");

      const paused = await runSourceCli([
        "evolve",
        "--successor",
        "aligned=" + successorRelativePath,
        "--discard",
        unrecordedIntermediateRelativePath,
        "--delete-recorded-decision",
        "--relation",
        "修订=" + unrecordedPredecessorId,
        "--root",
        workspaceRoot
      ]);
      assert.equal(paused.exitCode, 1);
      assert.match(
        paused.stderr,
        new RegExp(
          "Predecessor decision " +
            unrecordedPredecessorId +
            " has not entered Git HEAD"
        )
      );
      assert.match(paused.stderr, /--keep-unrecorded-history/);
      assert.equal(
        await fs.readFile(successorPath, "utf8"),
        successorCandidate
      );
      assert.equal(
        await fs.readFile(intermediatePath, "utf8"),
        intermediateBefore
      );
      assert.equal(
        await fs.readFile(unrecordedPredecessorPath, "utf8"),
        predecessorBefore
      );
      assert.equal(await fs.readFile(indexPath, "utf8"), indexBefore);
    }
  ));

test("evolve discard rejects a predecessor referenced by another candidate", () =>
  withFixtureWorkspace(
    "referenced-evolution-discard",
    async (workspaceRoot) => {
      const { indexPath, intermediatePath } =
        await establishUnrecordedIntermediate(workspaceRoot);
      const referencingRelativePath = "reference-unrecorded-intermediate";
      const referencingPath = decisionFilePath(
        workspaceRoot,
        referencingRelativePath
      );
      const referencingCandidate = candidateDecisionBody({
        relations: [
          { type: "修订", target: unrecordedIntermediateRelativePath }
        ]
      });
      await fs.writeFile(referencingPath, referencingCandidate, "utf8");
      const successorRelativePath = "reject-referenced-discard";
      const successorPath = decisionFilePath(
        workspaceRoot,
        successorRelativePath
      );
      const successorCandidate = candidateDecisionBody();
      await fs.writeFile(successorPath, successorCandidate, "utf8");
      const intermediateBefore = await fs.readFile(intermediatePath, "utf8");
      const indexBefore = await fs.readFile(indexPath, "utf8");
      const rejected = await runSourceCli([
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
      assert.equal(rejected.exitCode, 1);
      assert.match(
        rejected.stderr,
        /Cannot discard decision while it is still referenced/
      );
      assert.ok(rejected.stderr.includes(referencingRelativePath));
      assert.equal(
        await fs.readFile(successorPath, "utf8"),
        successorCandidate
      );
      assert.equal(
        await fs.readFile(referencingPath, "utf8"),
        referencingCandidate
      );
      assert.equal(
        await fs.readFile(intermediatePath, "utf8"),
        intermediateBefore
      );
      assert.equal(await fs.readFile(indexPath, "utf8"), indexBefore);
    }
  ));
