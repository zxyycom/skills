import {
  archivedSourcePath,
  assert,
  assertRejectedDiscardPreserves,
  candidateDecisionBody,
  decisionFilePath,
  fileExists,
  fs,
  path,
  runSourceCli,
  runSuccessfulSourceLifecycleCli,
  test,
  withFixtureWorkspace,
  withGitFixtureWorkspace,
  withTemporaryWorkspace,
  writeDecision
} from "./support.ts";

test("discarding the only active established decision removes the derived index", () =>
  withTemporaryWorkspace("only-active-established", async (workspaceRoot) => {
    const decisionsDirectory = path.join(workspaceRoot, "docs", "decisions");
    const indexPath = path.join(decisionsDirectory, "decision-index.json");
    const decisionId = "use-only-active-established";
    const decisionPath = decisionFilePath(workspaceRoot, decisionId);
    await fs.mkdir(path.dirname(decisionPath), { recursive: true });
    await fs.writeFile(decisionPath, candidateDecisionBody(), "utf8");
    await runSuccessfulSourceLifecycleCli([
      "activate",
      decisionId,
      "--alignment",
      "aligned",
      "--root",
      workspaceRoot
    ]);
    assert.equal(await fileExists(indexPath), true);

    const discarded = await runSourceCli([
      "discard",
      decisionId,
      "--delete-recorded-decision",
      "--root",
      workspaceRoot
    ]);
    assert.equal(discarded.exitCode, 0, discarded.stderr);
    assert.equal(await fileExists(decisionPath), false);
    assert.equal(await fileExists(indexPath), false);
  }));

test("discarding the only archived established decision removes its archive path and index", () =>
  withTemporaryWorkspace("only-archived-established", async (workspaceRoot) => {
    const decisionsDirectory = path.join(workspaceRoot, "docs", "decisions");
    const indexPath = path.join(decisionsDirectory, "decision-index.json");
    const decisionId = "use-only-archived-established";
    const decisionPath = decisionFilePath(workspaceRoot, decisionId);
    await fs.mkdir(path.dirname(decisionPath), { recursive: true });
    await fs.writeFile(decisionPath, candidateDecisionBody(), "utf8");
    await runSuccessfulSourceLifecycleCli([
      "activate",
      decisionId,
      "--alignment",
      "aligned",
      "--root",
      workspaceRoot
    ]);
    await runSuccessfulSourceLifecycleCli([
      "archive",
      decisionId,
      "--root",
      workspaceRoot
    ]);
    const archivedPath = path.join(
      decisionsDirectory,
      "archive",
      decisionId + ".md"
    );
    assert.equal(await fileExists(archivedPath), true);

    const discarded = await runSourceCli([
      "discard",
      decisionId,
      "--delete-recorded-decision",
      "--root",
      workspaceRoot
    ]);
    assert.equal(discarded.exitCode, 0, discarded.stderr);
    assert.equal(await fileExists(archivedPath), false);
    assert.equal(await fileExists(indexPath), false);
  }));

test("discard rejects invalid candidate lifecycle or body without mutation", () =>
  withFixtureWorkspace(
    "candidate-discard-invalid-body",
    async (workspaceRoot) => {
      const decisionsDirectory = path.join(workspaceRoot, "docs", "decisions");
      const indexPath = path.join(decisionsDirectory, "decision-index.json");
      const originalIndexText = await fs.readFile(indexPath, "utf8");
      const invalidLifecycleRelativePath = "use-invalid-candidate-lifecycle";
      const invalidLifecyclePath = decisionFilePath(
        workspaceRoot,
        invalidLifecycleRelativePath
      );

      for (const invalidLifecycleBody of [
        candidateDecisionBody().replace(
          "alignment: null",
          "alignment: aligned"
        ),
        candidateDecisionBody().replace(
          "createdAt: null",
          "createdAt: 2026-08-06T10:20:30Z"
        )
      ]) {
        await fs.writeFile(invalidLifecyclePath, invalidLifecycleBody, "utf8");
        await assertRejectedDiscardPreserves({
          decisionPath: invalidLifecyclePath,
          expectedError: /candidate decision frontmatter/,
          indexPath,
          relativePath: invalidLifecycleRelativePath,
          workspaceRoot
        });
      }
      await fs.rm(invalidLifecyclePath);

      const invalidRelativePath = "use-invalid-candidate";
      const invalidPath = decisionFilePath(workspaceRoot, invalidRelativePath);
      const invalidBody = candidateDecisionBody().replace(
        "\n## 目的\n- 验证 Markdown 生命周期独立定义候选和已建立状态。\n",
        "\n"
      );
      await fs.writeFile(invalidPath, invalidBody, "utf8");
      await assertRejectedDiscardPreserves({
        decisionPath: invalidPath,
        expectedError: /body must start with "## 目的"/,
        indexPath,
        relativePath: invalidRelativePath,
        workspaceRoot
      });
      assert.equal(await fs.readFile(indexPath, "utf8"), originalIndexText);
    }
  ));

test("discard preflights an invalid established source before touching a candidate", () =>
  withGitFixtureWorkspace(
    "candidate-discard-invalid-established-source",
    async (workspaceRoot) => {
      const candidateId = "use-invalid-established-discard-candidate";
      const candidatePath = decisionFilePath(workspaceRoot, candidateId);
      const indexPath = path.join(
        workspaceRoot,
        "docs",
        "decisions",
        "decision-index.json"
      );
      await writeDecision(
        workspaceRoot,
        candidateId,
        candidateDecisionBody({ id: candidateId })
      );
      const archivedPath = decisionFilePath(workspaceRoot, archivedSourcePath);
      await fs.writeFile(
        archivedPath,
        (await fs.readFile(archivedPath, "utf8")).replace(
          "alignment: unaligned",
          "alignment: null"
        ),
        "utf8"
      );
      const preservedMtime = new Date("2000-01-01T00:00:00.000Z");
      await fs.utimes(candidatePath, preservedMtime, preservedMtime);
      const candidateBefore = await fs.readFile(candidatePath, "utf8");
      const candidateMtimeBefore = (
        await fs.stat(candidatePath, { bigint: true })
      ).mtimeNs;
      const indexBefore = await fs.readFile(indexPath, "utf8");

      const discarded = await runSourceCli([
        "discard",
        candidateId,
        "--root",
        workspaceRoot
      ]);
      assert.equal(discarded.exitCode, 1);
      assert.equal(discarded.stdout, "");
      assert.match(discarded.stderr, /alignment/i);
      assert.match(discarded.stderr, /outcome: no-change/);
      assert.equal(await fs.readFile(candidatePath, "utf8"), candidateBefore);
      assert.equal(
        (await fs.stat(candidatePath, { bigint: true })).mtimeNs,
        candidateMtimeBefore
      );
      assert.equal(await fs.readFile(indexPath, "utf8"), indexBefore);
    }
  ));
