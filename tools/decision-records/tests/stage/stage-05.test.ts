import {
  assert,
  candidateDecisionBody,
  currentDecisionId,
  currentSourcePath,
  decisionFilePath,
  fs,
  path,
  runGit,
  runSourceCli,
  test,
  withGitFixtureWorkspace,
  writeDecision
} from "./support.ts";

test("stage isolates unselected invalid filesystem content from a selected revision ID", () =>
  withGitFixtureWorkspace("stage-unselected-invalid", async (workspaceRoot) => {
    const invalidName = "invalid_candidate.md";
    await writeDecision(workspaceRoot, invalidName, candidateDecisionBody());
    const selectedPath = decisionFilePath(workspaceRoot, currentSourcePath);
    await fs.writeFile(
      selectedPath,
      (await fs.readFile(selectedPath, "utf8")).replace(
        "使用生成 CLI",
        "选择的合法修改"
      ),
      "utf8"
    );
    const staged = await runSourceCli([
      "stage",
      currentDecisionId,
      "--root",
      workspaceRoot
    ]);
    assert.equal(staged.exitCode, 0, staged.stderr);
    const pendingPaths = runGit(workspaceRoot, [
      "diff",
      "--cached",
      "--name-only"
    ]);
    assert.match(pendingPaths, new RegExp(currentDecisionId));
    assert.doesNotMatch(pendingPaths, new RegExp(invalidName));
  }));

test("stage treats a selected old ID as a deletion without inferring a rename", () =>
  withGitFixtureWorkspace("stage-deletion", async (workspaceRoot) => {
    const replacementId = "use-unselected-replacement";
    await fs.rm(decisionFilePath(workspaceRoot, currentSourcePath));
    await writeDecision(
      workspaceRoot,
      replacementId,
      candidateDecisionBody({ title: "未选择的替代记录" })
        .replace("status: candidate", "status: active")
        .replace("alignment: null", "alignment: aligned")
        .replace("createdAt: null", "createdAt: 2026-08-15T00:00:00Z")
    );
    const staged = await runSourceCli([
      "stage",
      currentDecisionId,
      "--root",
      workspaceRoot
    ]);
    assert.equal(staged.exitCode, 0, staged.stderr);
    const pendingPaths = runGit(workspaceRoot, [
      "diff",
      "--cached",
      "--name-status",
      "--no-renames"
    ]);
    assert.match(
      pendingPaths,
      new RegExp(`D\\tdocs/decisions/${currentDecisionId}`)
    );
    assert.doesNotMatch(pendingPaths, new RegExp(replacementId));
  }));

test("stage rejects a selected symlink source outside the decision root without writing pending", async (t) => {
  await withGitFixtureWorkspace(
    "stage-selected-nonregular",
    async (workspaceRoot) => {
      const selectedPath = decisionFilePath(workspaceRoot, currentSourcePath);
      const outsidePath = path.join(workspaceRoot, "outside-decision.md");
      const outsideText = await fs.readFile(selectedPath, "utf8");
      await fs.writeFile(outsidePath, outsideText, "utf8");
      await fs.rm(selectedPath);
      try {
        await fs.symlink(outsidePath, selectedPath);
      } catch (error) {
        if (
          error instanceof Error &&
          "code" in error &&
          error.code === "EPERM"
        ) {
          t.skip("symlinks are unavailable on this platform");
          return;
        }
        throw error;
      }
      const staged = await runSourceCli([
        "stage",
        currentDecisionId,
        "--root",
        workspaceRoot
      ]);
      assert.equal(staged.exitCode, 1);
      assert.match(
        staged.stderr,
        new RegExp(
          "Decision source must be a regular non-symlink file: " +
            currentDecisionId
        )
      );
      assert.equal(await fs.readFile(outsidePath, "utf8"), outsideText);
      assert.equal((await fs.lstat(selectedPath)).isSymbolicLink(), true);
      assert.equal(
        runGit(workspaceRoot, ["diff", "--cached", "--name-only"]),
        ""
      );
    }
  );
});
