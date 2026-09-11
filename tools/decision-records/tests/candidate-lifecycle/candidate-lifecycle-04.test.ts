import {
  assert,
  candidateDecisionBody,
  decisionFilePath,
  findIndexEntry,
  fs,
  path,
  readIndex,
  runSourceCli,
  runSuccessfulSourceCli,
  test,
  unindexedBody,
  validateDecisionRecords,
  withFixtureWorkspace
} from "./support.ts";

test("candidate queries discover source records while activation indexes only reviewed targets", () =>
  withFixtureWorkspace(
    "candidate-activation-selection",
    async (workspaceRoot) => {
      const decisionsDirectory = path.join(workspaceRoot, "docs", "decisions");
      const indexPath = path.join(decisionsDirectory, "decision-index.json");
      const originalIndexText = await fs.readFile(indexPath, "utf8");
      const firstUnindexedRelativePath = "use-first-unindexed";
      const secondUnindexedRelativePath = "use-second-unindexed";
      const firstUnindexedPath = decisionFilePath(
        workspaceRoot,
        firstUnindexedRelativePath
      );
      const secondUnindexedPath = decisionFilePath(
        workspaceRoot,
        secondUnindexedRelativePath
      );
      await fs.writeFile(
        firstUnindexedPath,
        unindexedBody(firstUnindexedRelativePath),
        "utf8"
      );
      await fs.writeFile(
        secondUnindexedPath,
        unindexedBody(secondUnindexedRelativePath),
        "utf8"
      );
      const invalidRelativePath = "use-invalid-source-candidate";
      const invalidPath = decisionFilePath(workspaceRoot, invalidRelativePath);
      await fs.writeFile(
        invalidPath,
        candidateDecisionBody({ id: invalidRelativePath }).replace(
          "\n## 决策\n",
          "\n## 非法章节\n"
        ),
        "utf8"
      );
      const discoveredCandidates = await runSourceCli([
        "candidates",
        "--root",
        workspaceRoot
      ]);
      assert.equal(
        discoveredCandidates.exitCode,
        0,
        discoveredCandidates.stderr
      );
      assert.match(
        discoveredCandidates.stderr,
        /query completed with warnings/i
      );
      assert.match(
        discoveredCandidates.stderr,
        /use-invalid-source-candidate\.md/
      );
      assert.match(discoveredCandidates.stdout, /Candidates:/);
      assert.match(discoveredCandidates.stdout, /use-first-unindexed\.md/);
      assert.match(discoveredCandidates.stdout, /use-second-unindexed\.md/);
      assert.doesNotMatch(
        discoveredCandidates.stdout,
        /use-invalid-source-candidate\.md/
      );
      const shownCandidate = await runSourceCli([
        "show-candidate",
        secondUnindexedRelativePath,
        "--root",
        workspaceRoot
      ]);
      assert.equal(shownCandidate.exitCode, 0, shownCandidate.stderr);
      assert.match(shownCandidate.stderr, /use-invalid-source-candidate\.md/);
      assert.match(shownCandidate.stdout, /^status: candidate$/m);
      assert.match(shownCandidate.stdout, /^alignment: null$/m);
      assert.match(shownCandidate.stdout, /^createdAt: null$/m);
      const invalidCandidate = await runSourceCli([
        "show-candidate",
        invalidRelativePath,
        "--root",
        workspaceRoot
      ]);
      assert.equal(invalidCandidate.exitCode, 1);
      assert.match(
        invalidCandidate.stderr,
        /not a valid candidate scaffold.*use-invalid-source-candidate/i
      );
      assert.match(
        invalidCandidate.stderr,
        /has unsupported section ## 非法章节/
      );
      await fs.rm(invalidPath);
      const candidateCheckBeforeActivation = await runSourceCli([
        "check",
        "--root",
        workspaceRoot
      ]);
      assert.equal(
        candidateCheckBeforeActivation.exitCode,
        0,
        candidateCheckBeforeActivation.stderr
      );
      assert.match(
        candidateCheckBeforeActivation.stdout,
        /2 candidate scaffolds/
      );
      const multipleUnindexedActivation = await runSourceCli([
        "activate",
        firstUnindexedRelativePath,
        "--alignment",
        "aligned",
        "--root",
        workspaceRoot
      ]);
      assert.equal(multipleUnindexedActivation.exitCode, 0);
      assert.match(
        multipleUnindexedActivation.stdout,
        /Activated new decision as aligned use-first-unindexed\.md\./
      );
      assert.match(
        multipleUnindexedActivation.stderr,
        /Decision candidate scaffold remains: use-second-unindexed\.md/
      );
      assert.doesNotMatch(
        multipleUnindexedActivation.stderr,
        /Decision candidate scaffold remains: use-first-unindexed\.md/
      );
      const firstActivationIndex = await readIndex(indexPath);
      findIndexEntry(firstActivationIndex, firstUnindexedRelativePath);
      assert.equal(
        Object.hasOwn(
          firstActivationIndex.entries,
          secondUnindexedRelativePath
        ),
        false
      );

      const remainingCandidateCheck = await runSourceCli([
        "check",
        "--root",
        workspaceRoot
      ]);
      assert.equal(remainingCandidateCheck.exitCode, 0);
      assert.equal(remainingCandidateCheck.stderr, "");
      assert.match(remainingCandidateCheck.stdout, /1 candidate scaffolds/);
      const candidateValidation = await validateDecisionRecords({
        workspaceRoot
      });
      assert.equal(candidateValidation.activationCandidateCount, 1);

      const candidateList = await runSourceCli([
        "list",
        "--root",
        workspaceRoot
      ]);
      assert.equal(candidateList.exitCode, 0);
      assert.equal(candidateList.stderr, "");
      assert.match(candidateList.stdout, /- use-first-unindexed /);
      assert.doesNotMatch(candidateList.stdout, /use-second-unindexed\.md/);

      const candidateSync = await runSourceCli([
        "sync-index",
        "--root",
        workspaceRoot
      ]);
      assert.equal(candidateSync.exitCode, 0);
      assert.match(candidateSync.stdout, /Decision index is up to date/);
      assert.match(candidateSync.stderr, /use-second-unindexed\.md/);

      const secondActivation = await runSuccessfulSourceCli([
        "activate",
        secondUnindexedRelativePath,
        "--alignment",
        "aligned",
        "--root",
        workspaceRoot
      ]);
      assert.match(secondActivation, /Activated new decision as aligned/);
      const completeCandidateIndex = await readIndex(indexPath);
      findIndexEntry(completeCandidateIndex, firstUnindexedRelativePath);
      findIndexEntry(completeCandidateIndex, secondUnindexedRelativePath);
      await runSuccessfulSourceCli(["check", "--root", workspaceRoot]);
      await fs.rm(firstUnindexedPath);
      await fs.rm(secondUnindexedPath);
      await fs.writeFile(indexPath, originalIndexText, "utf8");
    }
  ));
