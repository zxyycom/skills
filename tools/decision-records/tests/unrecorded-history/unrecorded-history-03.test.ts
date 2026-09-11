import {
  archivedRelativePath,
  assert,
  candidateDecisionBody,
  commitWorkspace,
  currentRelativePath,
  decisionFilePath,
  establishUnrecordedIntermediate,
  fileExists,
  findIndexEntry,
  fs,
  path,
  readIndex,
  runSourceCli,
  test,
  unrecordedIntermediateRelativePath,
  withFixtureWorkspace,
  withGitFixtureWorkspace
} from "./support.ts";

test("evolve discard accepts source-empty final relations", () =>
  withFixtureWorkspace(
    "unrecorded-evolution-implicit-empty",
    async (workspaceRoot) => {
      const { indexPath, intermediatePath } =
        await establishUnrecordedIntermediate(workspaceRoot);
      const successorRelativePath = "accept-source-empty-discard";
      const successorPath = decisionFilePath(
        workspaceRoot,
        successorRelativePath
      );
      const successorCandidate = candidateDecisionBody();
      await fs.writeFile(successorPath, successorCandidate, "utf8");
      const discarded = await runSourceCli([
        "evolve",
        "--successor",
        "aligned=" + successorRelativePath,
        "--discard",
        unrecordedIntermediateRelativePath,
        "--delete-recorded-decision",
        "--root",
        workspaceRoot
      ]);
      assert.equal(discarded.exitCode, 0, discarded.stderr);
      assert.equal(await fileExists(intermediatePath), false);
      assert.deepEqual(
        findIndexEntry(await readIndex(indexPath), successorRelativePath)
          .relations,
        []
      );
    }
  ));

test("evolve discard accepts an explicitly empty final relation set", () =>
  withFixtureWorkspace(
    "unrecorded-evolution-empty-relations",
    async (workspaceRoot) => {
      const { indexPath, intermediatePath } =
        await establishUnrecordedIntermediate(workspaceRoot);
      const successorRelativePath = "drop-discard-upstream-history";
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
        "--clear-relations",
        "--delete-recorded-decision",
        "--root",
        workspaceRoot
      ]);
      assert.equal(discarded.exitCode, 0, discarded.stderr);
      assert.equal(await fileExists(intermediatePath), false);
      assert.deepEqual(
        findIndexEntry(await readIndex(indexPath), successorRelativePath)
          .relations,
        []
      );
    }
  ));

test("evolve discard accepts an unrelated archived final relation", () =>
  withFixtureWorkspace(
    "unrecorded-evolution-relation-boundary",
    async (workspaceRoot) => {
      const { indexPath, intermediatePath } =
        await establishUnrecordedIntermediate(workspaceRoot);
      const successorRelativePath = "accept-unrelated-discard-upstream";
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
        "修订=" + archivedRelativePath,
        "--delete-recorded-decision",
        "--root",
        workspaceRoot
      ]);
      assert.equal(discarded.exitCode, 0, discarded.stderr);
      assert.equal(await fileExists(intermediatePath), false);
      assert.deepEqual(
        findIndexEntry(await readIndex(indexPath), successorRelativePath)
          .relations,
        [{ type: "修订", target: archivedRelativePath }]
      );
    }
  ));

test("evolve discard pauses before deleting a recorded decision", () =>
  withGitFixtureWorkspace(
    "recorded-evolution-discard",
    async (workspaceRoot) => {
      const { indexPath, intermediatePath } =
        await establishUnrecordedIntermediate(workspaceRoot);
      commitWorkspace(workspaceRoot, "record intermediate decision");
      const successorRelativePath = "reject-recorded-discard";
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
        "--root",
        workspaceRoot
      ]);
      assert.equal(rejected.exitCode, 1);
      assert.match(rejected.stderr, /has entered Git HEAD/);
      assert.equal(
        await fs.readFile(successorPath, "utf8"),
        successorCandidate
      );
      assert.equal(
        await fs.readFile(intermediatePath, "utf8"),
        intermediateBefore
      );
      assert.equal(await fs.readFile(indexPath, "utf8"), indexBefore);
    }
  ));

test("evolve discard flag deletes a recorded decision without reading Git HEAD", () =>
  withGitFixtureWorkspace(
    "recorded-evolution-discard-flag-corrupt-head",
    async (workspaceRoot) => {
      const { indexPath, intermediatePath } =
        await establishUnrecordedIntermediate(workspaceRoot);
      commitWorkspace(workspaceRoot, "record intermediate decision");
      const successorRelativePath = "use-flagged-recorded-discard";
      const successorPath = decisionFilePath(
        workspaceRoot,
        successorRelativePath
      );
      await fs.writeFile(successorPath, candidateDecisionBody(), "utf8");
      await fs.writeFile(
        path.join(workspaceRoot, ".git", "HEAD"),
        "invalid Git head\n",
        "utf8"
      );

      const discarded = await runSourceCli([
        "evolve",
        "--successor",
        "aligned=" + successorRelativePath,
        "--discard",
        unrecordedIntermediateRelativePath,
        "--delete-recorded-decision",
        "--root",
        workspaceRoot
      ]);
      assert.equal(discarded.exitCode, 0, discarded.stderr);
      assert.equal(await fileExists(intermediatePath), false);
      assert.deepEqual(
        findIndexEntry(await readIndex(indexPath), successorRelativePath)
          .relations,
        []
      );
    }
  ));
