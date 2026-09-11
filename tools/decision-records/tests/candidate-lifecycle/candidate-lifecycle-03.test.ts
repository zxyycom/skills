import {
  assert,
  candidateDecisionBody,
  commitWorkspace,
  currentRelativePath,
  decisionFilePath,
  fileExists,
  fs,
  initializeGitRepository,
  path,
  runSourceCli,
  test,
  withFixtureWorkspace,
  withGitFixtureWorkspace
} from "./support.ts";

test("discard accepts a candidate with a valid active-target relation", () =>
  withFixtureWorkspace(
    "candidate-discard-active-target",
    async (workspaceRoot) => {
      const indexPath = path.join(
        workspaceRoot,
        "docs",
        "decisions",
        "decision-index.json"
      );
      const originalIndexText = await fs.readFile(indexPath, "utf8");
      const sourceRelativePath = "use-active-target-discard-source";
      const sourcePath = decisionFilePath(workspaceRoot, sourceRelativePath);
      await fs.writeFile(
        sourcePath,
        candidateDecisionBody({
          relations: [{ type: "修订", target: currentRelativePath }]
        }),
        "utf8"
      );

      const discarded = await runSourceCli([
        "discard",
        sourceRelativePath,
        "--root",
        workspaceRoot
      ]);
      assert.equal(discarded.exitCode, 0, discarded.stderr);
      assert.equal(await fileExists(sourcePath), false);
      assert.equal(await fs.readFile(indexPath, "utf8"), originalIndexText);
    }
  ));

test("discard pauses before deleting a candidate recorded in Git HEAD", () =>
  withGitFixtureWorkspace(
    "candidate-discard-selection",
    async (workspaceRoot) => {
      const decisionsDirectory = path.join(workspaceRoot, "docs", "decisions");
      const indexPath = path.join(decisionsDirectory, "decision-index.json");
      const originalIndexText = await fs.readFile(indexPath, "utf8");
      const otherCandidateRelativePath = "use-other-valid-candidate";
      const otherCandidatePath = decisionFilePath(
        workspaceRoot,
        otherCandidateRelativePath
      );
      const otherCandidateText = candidateDecisionBody();
      await fs.writeFile(otherCandidatePath, otherCandidateText, "utf8");
      const discardedRelativePath = "use-discarded-candidate";
      const discardedPath = decisionFilePath(
        workspaceRoot,
        discardedRelativePath
      );
      await fs.writeFile(discardedPath, candidateDecisionBody(), "utf8");
      commitWorkspace(workspaceRoot, "record candidate scaffolds");
      const candidateCheck = await runSourceCli([
        "check",
        "--root",
        workspaceRoot
      ]);
      assert.equal(candidateCheck.exitCode, 0, candidateCheck.stderr);
      assert.equal(candidateCheck.stderr, "");
      assert.match(candidateCheck.stdout, /2 candidate scaffolds/);
      const paused = await runSourceCli([
        "discard",
        discardedRelativePath,
        "--root",
        workspaceRoot
      ]);
      assert.equal(paused.exitCode, 1);
      assert.match(paused.stderr, /Decision .* has entered Git HEAD/i);
      assert.match(paused.stderr, /--delete-recorded-decision/);
      assert.equal(
        await fs.readFile(discardedPath, "utf8"),
        candidateDecisionBody()
      );
      assert.equal(await fs.readFile(indexPath, "utf8"), originalIndexText);
      const discarded = await runSourceCli([
        "discard",
        discardedRelativePath,
        "--delete-recorded-decision",
        "--root",
        workspaceRoot
      ]);
      assert.equal(discarded.exitCode, 0, discarded.stderr);
      assert.match(discarded.stdout, /Discarded decision/);
      assert.match(discarded.stderr, /use-other-valid-candidate\.md/);
      assert.equal(await fileExists(discardedPath), false);
      assert.equal(
        await fs.readFile(otherCandidatePath, "utf8"),
        otherCandidateText
      );
      assert.equal(await fs.readFile(indexPath, "utf8"), originalIndexText);
      await fs.rm(otherCandidatePath);
    }
  ));

test("discard deletes candidates absent from Git HEAD", () =>
  withGitFixtureWorkspace(
    "candidate-discard-unrecorded",
    async (workspaceRoot) => {
      const decisionsDirectory = path.join(workspaceRoot, "docs", "decisions");
      const indexPath = path.join(decisionsDirectory, "decision-index.json");
      const originalIndexText = await fs.readFile(indexPath, "utf8");

      const sourceRelativePath = "use-unrecorded-discard-candidate";
      const sourcePath = decisionFilePath(workspaceRoot, sourceRelativePath);
      await fs.writeFile(sourcePath, candidateDecisionBody(), "utf8");
      const discarded = await runSourceCli([
        "discard",
        sourceRelativePath,
        "--root",
        workspaceRoot
      ]);

      assert.equal(discarded.exitCode, 0, discarded.stderr);
      assert.equal(await fileExists(sourcePath), false);
      assert.equal(await fs.readFile(indexPath, "utf8"), originalIndexText);
    }
  ));

test("discard deletes candidates in a Git worktree with unborn HEAD", () =>
  withFixtureWorkspace(
    "candidate-discard-unborn-head",
    async (workspaceRoot) => {
      initializeGitRepository(workspaceRoot);
      const sourceRelativePath = "use-unborn-head-discard-candidate";
      const sourcePath = decisionFilePath(workspaceRoot, sourceRelativePath);
      await fs.writeFile(sourcePath, candidateDecisionBody(), "utf8");

      const discarded = await runSourceCli([
        "discard",
        sourceRelativePath,
        "--root",
        workspaceRoot
      ]);

      assert.equal(discarded.exitCode, 0, discarded.stderr);
      assert.equal(await fileExists(sourcePath), false);
    }
  ));
