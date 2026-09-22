import type { Stats } from "node:fs";
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
  writeDecision,
  syncDecisionIndexBeforeStage
} from "./support.ts";

test("stage isolates unselected invalid filesystem content from a selected revision ID", () =>
  withGitFixtureWorkspace("stage-unselected-invalid", async (workspaceRoot) => {
    const invalidName = "invalid_candidate.md";
    const selectedPath = decisionFilePath(workspaceRoot, currentSourcePath);
    await fs.writeFile(
      selectedPath,
      (await fs.readFile(selectedPath, "utf8")).replace(
        "使用生成 CLI",
        "选择的合法修改"
      ),
      "utf8"
    );
    await syncDecisionIndexBeforeStage(workspaceRoot);

    // The invalid unselected file appears only after the freshness gate has
    // read the synchronized sources; sync-index must not be asked to publish
    // around it, and staging itself isolates the unselected content.
    const descriptor = Object.getOwnPropertyDescriptor(fs, "readFile");
    assert.ok(descriptor);
    const readFile = fs.readFile.bind(fs);
    let reads = 0;
    let injected = false;
    Object.defineProperty(fs, "readFile", {
      ...descriptor,
      value: async (
        filePath: string,
        encoding: BufferEncoding
      ): Promise<string> => {
        if (path.resolve(filePath) === selectedPath && ++reads === 2) {
          injected = true;
          await writeDecision(
            workspaceRoot,
            invalidName,
            candidateDecisionBody()
          );
        }
        return await readFile(filePath, encoding);
      }
    });
    try {
      const staged = await runSourceCli([
        "stage",
        currentDecisionId,
        "--root",
        workspaceRoot
      ]);
      assert.equal(staged.exitCode, 0, staged.stderr);
    } finally {
      Object.defineProperty(fs, "readFile", descriptor);
    }
    assert.equal(injected, true);
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
    await syncDecisionIndexBeforeStage(workspaceRoot);
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
      const probePath = path.join(workspaceRoot, "symlink-probe");
      try {
        await fs.symlink(outsidePath, probePath);
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
      await fs.rm(probePath);

      // The selected source turns into a symlink only after the freshness
      // gate has read the regular synchronized source; staging must still
      // reject reading through the symlink.
      const descriptor = Object.getOwnPropertyDescriptor(fs, "lstat");
      assert.ok(descriptor);
      const lstat = fs.lstat.bind(fs);
      let stats = 0;
      let injected = false;
      Object.defineProperty(fs, "lstat", {
        ...descriptor,
        value: async (filePath: string): Promise<Stats> => {
          if (
            !injected &&
            path.resolve(filePath) === selectedPath &&
            ++stats === 2
          ) {
            injected = true;
            await fs.rm(selectedPath);
            await fs.symlink(outsidePath, selectedPath);
          }
          return await lstat(filePath);
        }
      });
      try {
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
      } finally {
        Object.defineProperty(fs, "lstat", descriptor);
      }
      assert.equal(injected, true);
      assert.equal(await fs.readFile(outsidePath, "utf8"), outsideText);
      assert.equal((await fs.lstat(selectedPath)).isSymbolicLink(), true);
      assert.equal(
        runGit(workspaceRoot, ["diff", "--cached", "--name-only"]),
        ""
      );
    }
  );
});
