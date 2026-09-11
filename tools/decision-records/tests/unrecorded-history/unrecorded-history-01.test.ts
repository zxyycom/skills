import {
  assert,
  candidateDecisionBody,
  decisionFilePath,
  establishUnrecordedIntermediate,
  findIndexEntry,
  fs,
  initializeGitRepository,
  path,
  readIndex,
  runSourceCli,
  runSuccessfulSourceCli,
  test,
  unrecordedIntermediateRelativePath,
  withFixtureWorkspace,
  withGitFixtureWorkspace
} from "./support.ts";

test("archive pauses before preserving an unrecorded established decision", () =>
  withFixtureWorkspace("archive-unrecorded", async (workspaceRoot) => {
    initializeGitRepository(workspaceRoot);
    const decisionsDirectory = path.join(workspaceRoot, "docs", "decisions");
    const indexPath = path.join(decisionsDirectory, "decision-index.json");
    const unrecordedRelativePath = "use-unrecorded-archive-target";
    const unrecordedPath = decisionFilePath(
      workspaceRoot,
      unrecordedRelativePath
    );
    await fs.writeFile(unrecordedPath, candidateDecisionBody(), "utf8");
    await runSuccessfulSourceCli([
      "activate",
      unrecordedRelativePath,
      "--alignment",
      "aligned",
      "--root",
      workspaceRoot
    ]);
    const decisionBeforeWarning = await fs.readFile(unrecordedPath, "utf8");
    const indexBeforeWarning = await fs.readFile(indexPath, "utf8");

    const paused = await runSourceCli([
      "archive",
      unrecordedRelativePath,
      "--root",
      workspaceRoot
    ]);
    assert.equal(paused.exitCode, 1);
    assert.match(paused.stderr, /command paused with warnings/);
    assert.match(
      paused.stderr,
      /confirm whether it should be preserved as independent decision history/
    );
    assert.equal(
      await fs.readFile(unrecordedPath, "utf8"),
      decisionBeforeWarning
    );
    assert.equal(await fs.readFile(indexPath, "utf8"), indexBeforeWarning);

    await fs.writeFile(
      path.join(workspaceRoot, ".git", "HEAD"),
      "invalid Git head\n",
      "utf8"
    );

    const archived = await runSourceCli([
      "archive",
      unrecordedRelativePath,
      "--keep-unrecorded-history",
      "--root",
      workspaceRoot
    ]);
    assert.equal(archived.exitCode, 0, archived.stderr);
    const archivedState = findIndexEntry(
      await readIndex(indexPath),
      unrecordedRelativePath
    );
    assert.equal(archivedState.status, "archived");
    assert.equal(archivedState.alignment, "aligned");
  }));

test("unrecorded decision evolution pauses until history is explicitly preserved", () =>
  withGitFixtureWorkspace(
    "unrecorded-evolution-keep",
    async (workspaceRoot) => {
      const { indexPath, intermediatePath } =
        await establishUnrecordedIntermediate(workspaceRoot);
      const successorRelativePath = "use-preserved-unrecorded-history";
      const successorPath = decisionFilePath(
        workspaceRoot,
        successorRelativePath
      );
      const successorCandidate = candidateDecisionBody();
      await fs.writeFile(successorPath, successorCandidate, "utf8");
      const intermediateBeforeWarning = await fs.readFile(
        intermediatePath,
        "utf8"
      );
      const indexBeforeWarning = await fs.readFile(indexPath, "utf8");
      const paused = await runSourceCli([
        "activate",
        successorRelativePath,
        "--alignment",
        "aligned",
        "--relation",
        "修订=" + unrecordedIntermediateRelativePath,
        "--root",
        workspaceRoot
      ]);
      assert.equal(paused.exitCode, 1);
      assert.match(paused.stderr, /command paused with warnings/);
      assert.match(
        paused.stderr,
        new RegExp(
          "Predecessor decision " +
            unrecordedIntermediateRelativePath +
            " has not entered Git HEAD"
        )
      );
      assert.match(paused.stderr, /this 修订 relation should be preserved/);
      assert.match(paused.stderr, /--keep-unrecorded-history/);
      assert.equal(
        await fs.readFile(successorPath, "utf8"),
        successorCandidate
      );
      assert.equal(
        await fs.readFile(intermediatePath, "utf8"),
        intermediateBeforeWarning
      );
      assert.equal(await fs.readFile(indexPath, "utf8"), indexBeforeWarning);

      const preserved = await runSourceCli([
        "activate",
        successorRelativePath,
        "--alignment",
        "aligned",
        "--relation",
        "修订=" + unrecordedIntermediateRelativePath,
        "--keep-unrecorded-history",
        "--root",
        workspaceRoot
      ]);
      assert.equal(preserved.exitCode, 0, preserved.stderr);
      const preservedIndex = await readIndex(indexPath);
      assert.equal(
        findIndexEntry(preservedIndex, unrecordedIntermediateRelativePath)
          .status,
        "archived"
      );
      assert.deepEqual(
        findIndexEntry(preservedIndex, successorRelativePath).relations,
        [{ type: "修订", target: unrecordedIntermediateRelativePath }]
      );
    }
  ));
