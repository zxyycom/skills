import {
  archivedSourcePath,
  assert,
  assertRejectedDiscardPreserves,
  candidateDecisionBody,
  decisionFilePath,
  fileExists,
  findIndexEntry,
  fs,
  path,
  readIndex,
  runSourceCli,
  runSuccessfulSourceLifecycleCli,
  test,
  withFixtureWorkspace,
  withTemporaryWorkspace,
  writeDecision
} from "./support.ts";

test("discarding the only active established decision keeps a usable empty index", () =>
  withTemporaryWorkspace("only-active-established", async (workspaceRoot) => {
    const decisionsDirectory = path.join(workspaceRoot, "docs", "decisions");
    const indexPath = path.join(decisionsDirectory, "decision-index.json");
    const decisionId = "use-only-active-established";
    const decisionPath = decisionFilePath(workspaceRoot, decisionId);
    await fs.mkdir(path.dirname(decisionPath), { recursive: true });
    await fs.writeFile(decisionPath, candidateDecisionBody(), "utf8");
    await runSuccessfulSourceLifecycleCli([
      "publish",
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
      "--delete-recorded",
      "--root",
      workspaceRoot
    ]);
    assert.equal(discarded.exitCode, 0, discarded.stderr);
    assert.equal(await fileExists(decisionPath), false);
    await assertUsableEmptyIndex(workspaceRoot, indexPath);
  }));

test("discarding the only archived established decision removes its archive path and keeps a usable empty index", () =>
  withTemporaryWorkspace("only-archived-established", async (workspaceRoot) => {
    const decisionsDirectory = path.join(workspaceRoot, "docs", "decisions");
    const indexPath = path.join(decisionsDirectory, "decision-index.json");
    const decisionId = "use-only-archived-established";
    const decisionPath = decisionFilePath(workspaceRoot, decisionId);
    await fs.mkdir(path.dirname(decisionPath), { recursive: true });
    await fs.writeFile(decisionPath, candidateDecisionBody(), "utf8");
    await runSuccessfulSourceLifecycleCli([
      "publish",
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
      "--delete-recorded",
      "--root",
      workspaceRoot
    ]);
    assert.equal(discarded.exitCode, 0, discarded.stderr);
    assert.equal(await fileExists(archivedPath), false);
    await assertUsableEmptyIndex(workspaceRoot, indexPath);
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

test("discard ignores an unrelated invalid established source while preserving its published snapshot", () =>
  withFixtureWorkspace(
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
      const archivedBefore = await fs.readFile(archivedPath, "utf8");
      const indexBefore = await fs.readFile(indexPath, "utf8");

      const discarded = await runSourceCli([
        "discard",
        candidateId,
        "--root",
        workspaceRoot
      ]);
      assert.equal(discarded.exitCode, 0, discarded.stderr);
      assert.equal(await fileExists(candidatePath), false);
      assert.equal(await fs.readFile(archivedPath, "utf8"), archivedBefore);
      assert.equal(await fs.readFile(indexPath, "utf8"), indexBefore);
    }
  ));

async function assertUsableEmptyIndex(
  workspaceRoot: string,
  indexPath: string
): Promise<void> {
  assert.equal(await fileExists(indexPath), true);
  assert.deepEqual((await readIndex(indexPath)).entries, {});
  const listed = await runSourceCli(["list", "--root", workspaceRoot]);
  assert.equal(listed.exitCode, 0, listed.stderr);
  const nextId = "after-only-member-discard";
  await writeDecision(
    workspaceRoot,
    nextId,
    candidateDecisionBody({ id: nextId })
  );
  await runSuccessfulSourceLifecycleCli([
    "publish",
    nextId,
    "--alignment",
    "unaligned",
    "--root",
    workspaceRoot
  ]);
  const nextIndex = await readIndex(indexPath);
  assert.deepEqual(Object.keys(nextIndex.entries), [nextId]);
  assert.equal(findIndexEntry(nextIndex, nextId).status, "active");
}
