import {
  assert,
  candidateDecisionBody,
  commitWorkspace,
  countGitInvocations,
  createStageScaleFixture,
  currentDecisionId,
  decisionFilePath,
  fs,
  initializeGitRepository,
  path,
  process,
  runGit,
  runSourceCli,
  test,
  withGitFixtureWorkspace,
  withTemporaryWorkspace,
  writeDecision
} from "./support.ts";

test("stage does not bind unrelated identical deletion and addition as a rename", () =>
  withGitFixtureWorkspace(
    "stage-unrelated-identical",
    async (workspaceRoot) => {
      const oldId = "use-old-candidate";
      const newId = "use-new-candidate";
      const body = candidateDecisionBody({ title: "相同但无关的候选" });
      await writeDecision(workspaceRoot, oldId, body);
      commitWorkspace(workspaceRoot);
      await fs.rm(decisionFilePath(workspaceRoot, oldId));
      await writeDecision(workspaceRoot, newId, body);
      const staged = await runSourceCli([
        "stage",
        oldId,
        newId,
        "--root",
        workspaceRoot
      ]);
      assert.equal(staged.exitCode, 0, staged.stderr);
      const status = runGit(workspaceRoot, [
        "diff",
        "--cached",
        "--name-status",
        "--no-renames"
      ]);
      assert.match(status, new RegExp(`D\\tdocs/decisions/${oldId}`));
      assert.match(status, new RegExp(`A\\tdocs/decisions/${newId}`));
    }
  ));

test("stage isolates unselected filesystem changes", () =>
  withGitFixtureWorkspace("stage-isolation", async (workspaceRoot) => {
    const selectedId = "use-selected-stage";
    const unselectedId = "use-unselected-stage";
    await writeDecision(workspaceRoot, selectedId, candidateDecisionBody());
    await writeDecision(
      workspaceRoot,
      unselectedId,
      candidateDecisionBody({ title: "未选择的暂存变更" })
    );
    const staged = await runSourceCli([
      "stage",
      selectedId,
      "--root",
      workspaceRoot
    ]);
    assert.equal(staged.exitCode, 0, staged.stderr);
    const pending = runGit(workspaceRoot, ["diff", "--cached", "--name-only"]);
    assert.match(pending, new RegExp(selectedId));
    assert.doesNotMatch(pending, new RegExp(unselectedId));
  }));

test(
  "stage keeps Git invocation counts bounded for complete decision snapshots",
  { timeout: 30_000 },
  async (t) => {
    if (process.platform === "win32") {
      t.skip("The Git invocation wrapper is currently POSIX-only");
      return;
    }
    // More entries than either accepted call-count ceiling distinguish bounded
    // Git access from a per-entry regression without making fixture size itself
    // the behavior under test.
    for (const decisionCount of [64]) {
      await withTemporaryWorkspace(
        `stage-call-count-${decisionCount}`,
        async (workspaceRoot) => {
          initializeGitRepository(workspaceRoot);
          const decisionIds = await createStageScaleFixture(
            workspaceRoot,
            decisionCount
          );
          const synced = await runSourceCli([
            "sync-index",
            "--root",
            workspaceRoot
          ]);
          assert.equal(synced.exitCode, 0, synced.stderr);
          commitWorkspace(workspaceRoot);

          const unchanged = await countGitInvocations(async () =>
            runSourceCli(["stage", decisionIds[0]!, "--root", workspaceRoot])
          );
          assert.equal(unchanged.result.exitCode, 0, unchanged.result.stderr);
          assert.ok(
            unchanged.callCount <= 20,
            `${decisionCount} unchanged decisions used ${unchanged.callCount} Git invocations`
          );
          assert.equal(
            runGit(workspaceRoot, ["diff", "--cached", "--name-only"]),
            ""
          );

          const changedDecisionPath = decisionFilePath(
            workspaceRoot,
            decisionIds[0]!
          );
          await fs.writeFile(
            changedDecisionPath,
            (await fs.readFile(changedDecisionPath, "utf8")).replace(
              "规模化决策 0",
              "修改后的规模化决策"
            ),
            "utf8"
          );
          const changed = await countGitInvocations(async () =>
            runSourceCli(["stage", decisionIds[0]!, "--root", workspaceRoot])
          );
          assert.equal(changed.result.exitCode, 0, changed.result.stderr);
          assert.ok(
            changed.callCount <= 25,
            `${decisionCount} changed decisions used ${changed.callCount} Git invocations`
          );
          const pendingPaths = runGit(workspaceRoot, [
            "diff",
            "--cached",
            "--name-only"
          ]);
          assert.match(pendingPaths, new RegExp(decisionIds[0]!));
          assert.match(pendingPaths, /docs\/decisions\/decision-index\.json/);
          assert.match(
            runGit(workspaceRoot, [
              "show",
              `:docs/decisions/${decisionIds[0]!}.md`
            ]),
            /修改后的规模化决策/
          );
          const pendingIndex = JSON.parse(
            runGit(workspaceRoot, [
              "show",
              ":docs/decisions/decision-index.json"
            ])
          );
          assert.equal(
            pendingIndex.entries[decisionIds[0]!].title,
            "修改后的规模化决策"
          );
        }
      );
    }
  }
);

test("stage rejects an existing pending decision index", () =>
  withGitFixtureWorkspace("stage-existing-pending", async (workspaceRoot) => {
    const selectedId = "use-existing-pending";
    await writeDecision(workspaceRoot, selectedId, candidateDecisionBody());
    const first = await runSourceCli([
      "stage",
      selectedId,
      "--root",
      workspaceRoot
    ]);
    assert.equal(first.exitCode, 0, first.stderr);
    const second = await runSourceCli([
      "stage",
      selectedId,
      "--root",
      workspaceRoot
    ]);
    assert.notEqual(second.exitCode, 0);
    assert.match(second.stderr, /pending snapshot already contains files/);
  }));

test("stage rejects an old domain revision before changing pending files", () =>
  withGitFixtureWorkspace("stage-old-revision", async (workspaceRoot) => {
    const decisionsRoot = path.join(workspaceRoot, "docs", "decisions");
    await fs.rm(decisionsRoot, { force: true, recursive: true });
    await fs.mkdir(`${decisionsRoot}/decision-records`, { recursive: true });
    await fs.writeFile(
      `${decisionsRoot}/decision-domains.json`,
      '{"schemaVersion":1,"domains":[]}',
      "utf8"
    );
    await fs.writeFile(
      `${decisionsRoot}/decision-records/${currentDecisionId}`,
      candidateDecisionBody(),
      "utf8"
    );
    commitWorkspace(workspaceRoot);

    await fs.rm(decisionsRoot, { force: true, recursive: true });
    await writeDecision(
      workspaceRoot,
      currentDecisionId,
      candidateDecisionBody()
    );
    const staged = await runSourceCli([
      "stage",
      currentDecisionId,
      "--root",
      workspaceRoot
    ]);
    assert.notEqual(staged.exitCode, 0);
    assert.equal(
      runGit(workspaceRoot, ["diff", "--cached", "--name-only"]),
      ""
    );
  }));
