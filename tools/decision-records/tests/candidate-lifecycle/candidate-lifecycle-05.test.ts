import {
  archivedSourcePath,
  assert,
  candidateDecisionBody,
  currentRelativePath,
  decisionFilePath,
  fileExists,
  findIndexEntry,
  fs,
  path,
  readIndex,
  runSourceCli,
  test,
  unindexedBody,
  withFixtureWorkspace,
  withTemporaryWorkspace,
  writeDecision,
  writeIndex
} from "./support.ts";

test("activation reconciles unindexed established records before committing a candidate", () =>
  withFixtureWorkspace("candidate-activation-index", async (workspaceRoot) => {
    const decisionsDirectory = path.join(workspaceRoot, "docs", "decisions");
    const indexPath = path.join(decisionsDirectory, "decision-index.json");
    const targetCandidateRelativePath = "use-target-candidate";
    const orphanRelativePath = "use-orphan-established";
    const targetCandidatePath = decisionFilePath(
      workspaceRoot,
      targetCandidateRelativePath
    );
    const orphanPath = decisionFilePath(workspaceRoot, orphanRelativePath);
    await fs.writeFile(
      targetCandidatePath,
      unindexedBody(targetCandidateRelativePath),
      "utf8"
    );
    await fs.writeFile(
      orphanPath,
      unindexedBody(orphanRelativePath)
        .replace("status: candidate", "status: active")
        .replace("alignment: null", "alignment: aligned")
        .replace("createdAt: null", "createdAt: 2026-07-22T10:20:30+08:00"),
      "utf8"
    );
    for (const staleQueryArgs of [
      ["list", "--root", workspaceRoot],
      ["show", currentRelativePath, "--root", workspaceRoot],
      ["trace", currentRelativePath, "--root", workspaceRoot]
    ]) {
      const staleQueryWithOrphan = await runSourceCli(staleQueryArgs);
      assert.equal(
        staleQueryWithOrphan.exitCode,
        0,
        staleQueryWithOrphan.stderr
      );
      assert.doesNotMatch(
        staleQueryWithOrphan.stdout,
        /use-orphan-established\.md/
      );
    }

    const syncWithOrphan = await runSourceCli([
      "sync-index",
      "--root",
      workspaceRoot
    ]);
    assert.equal(syncWithOrphan.exitCode, 0);
    assert.match(syncWithOrphan.stderr, /use-target-candidate\.md/);
    findIndexEntry(await readIndex(indexPath), orphanRelativePath);

    const activationWithOrphan = await runSourceCli([
      "activate",
      targetCandidateRelativePath,
      "--alignment",
      "aligned",
      "--root",
      workspaceRoot
    ]);
    assert.equal(activationWithOrphan.exitCode, 0);
    assert.match(
      await fs.readFile(targetCandidatePath, "utf8"),
      /createdAt: \d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z/
    );
    const indexWithEstablishedAdditions = await readIndex(indexPath);
    findIndexEntry(indexWithEstablishedAdditions, targetCandidateRelativePath);
    findIndexEntry(indexWithEstablishedAdditions, orphanRelativePath);
  }));

test("discarding the only candidate leaves no established decision index", () =>
  withTemporaryWorkspace("only-candidate", async (workspaceRoot) => {
    const decisionsDirectory = path.join(workspaceRoot, "docs", "decisions");
    const relativePath = "use-only-candidate";
    const decisionPath = decisionFilePath(workspaceRoot, relativePath);
    await fs.mkdir(path.dirname(decisionPath), { recursive: true });
    await fs.writeFile(decisionPath, candidateDecisionBody(), "utf8");
    const discarded = await runSourceCli([
      "discard",
      relativePath,
      "--root",
      workspaceRoot
    ]);
    assert.equal(discarded.exitCode, 0, discarded.stderr);
    assert.equal(await fileExists(decisionPath), false);
    assert.equal(
      await fileExists(path.join(decisionsDirectory, "decision-index.json")),
      false
    );
  }));

test("candidate collection requires a current valid index when established records exist", async () => {
  for (const indexState of ["missing", "invalid", "stale"] as const) {
    await withFixtureWorkspace(
      `candidate-index-${indexState}`,
      async (workspaceRoot) => {
        const indexPath = path.join(
          workspaceRoot,
          "docs",
          "decisions",
          "decision-index.json"
        );
        if (indexState === "missing") {
          await fs.rm(indexPath);
        } else if (indexState === "invalid") {
          await fs.writeFile(indexPath, "not JSON\n", "utf8");
        } else {
          const sourcePath = decisionFilePath(
            workspaceRoot,
            currentRelativePath
          );
          await fs.writeFile(
            sourcePath,
            (await fs.readFile(sourcePath, "utf8")).replace(
              "使用生成 CLI",
              "过期索引来源"
            ),
            "utf8"
          );
        }
        const candidates = await runSourceCli([
          "candidates",
          "--root",
          workspaceRoot
        ]);
        assert.notEqual(candidates.exitCode, 0, indexState);
        assert.equal(candidates.stdout, "", indexState);
      }
    );
  }
});

test("first candidate discovery succeeds with no established records and no index", () =>
  withTemporaryWorkspace("candidate-first-discovery", async (workspaceRoot) => {
    const candidateId = "use-first-candidate";
    await writeDecision(workspaceRoot, candidateId, candidateDecisionBody());
    const candidates = await runSourceCli([
      "candidates",
      "--root",
      workspaceRoot
    ]);
    assert.equal(candidates.exitCode, 0, candidates.stderr);
    assert.match(candidates.stdout, new RegExp(candidateId));
  }));

test("candidate collection rejects an empty index when only candidates remain", () =>
  withFixtureWorkspace("candidate-empty-index", async (workspaceRoot) => {
    const decisionsDirectory = path.join(workspaceRoot, "docs", "decisions");
    const candidateId = "use-only-candidate";
    await fs.rm(decisionFilePath(workspaceRoot, currentRelativePath));
    await fs.rm(decisionFilePath(workspaceRoot, archivedSourcePath));
    await writeDecision(workspaceRoot, candidateId, candidateDecisionBody());
    const indexPath = path.join(decisionsDirectory, "decision-index.json");
    const indexedState = await readIndex(workspaceRoot);
    const emptyIndex = {
      ...indexedState,
      entries: {},
      sourceRevision: {
        ...indexedState.sourceRevision,
        entries: {}
      }
    };
    await writeIndex(indexPath, emptyIndex);

    for (const args of [["candidates"], ["show-candidate", candidateId]]) {
      const result = await runSourceCli([...args, "--root", workspaceRoot]);
      assert.notEqual(result.exitCode, 0, args.join(" "));
      assert.equal(result.stdout, "", args.join(" "));
      assert.match(result.stderr, /decision-index|index/i, args.join(" "));
    }
  }));
