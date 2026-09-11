import {
  archivedDecisionId,
  archivedSourcePath,
  assert,
  candidateDecisionBody,
  commitWorkspace,
  currentDecisionId,
  currentSourcePath,
  decisionFilePath,
  fs,
  initializeGitRepository,
  path,
  runGit,
  runSourceCli,
  test,
  withGitFixtureWorkspace,
  withTemporaryWorkspace,
  writeDecision
} from "./support.ts";

test("stage applies selected additions modifications deletions and explicit renames", () =>
  withGitFixtureWorkspace("stage-overlay", async (workspaceRoot) => {
    const modified = decisionFilePath(workspaceRoot, currentSourcePath);
    const deleted = decisionFilePath(workspaceRoot, archivedSourcePath);
    const addedId = "use-added-stage";
    await fs.writeFile(
      modified,
      (await fs.readFile(modified, "utf8"))
        .replace("使用生成 CLI", "使用修改 CLI")
        .replace(
          "relations:\n  - type: 修订\n    target: 260710-use-source-cli",
          "relations: []"
        ),
      "utf8"
    );
    await fs.rm(deleted);
    await writeDecision(
      workspaceRoot,
      addedId,
      candidateDecisionBody({ title: "使用新增 Stage" })
        .replace("status: candidate", "status: active")
        .replace("alignment: null", "alignment: aligned")
        .replace("createdAt: null", "createdAt: 2026-08-15T00:00:00Z")
    );
    const staged = await runSourceCli([
      "stage",
      currentDecisionId,
      archivedDecisionId,
      addedId,
      "--root",
      workspaceRoot
    ]);
    assert.equal(staged.exitCode, 0, staged.stderr);
    const pending = runGit(workspaceRoot, ["diff", "--cached", "--name-only"]);
    assert.match(pending, new RegExp(currentDecisionId));
    assert.match(pending, new RegExp(archivedDecisionId));
    assert.match(pending, new RegExp(addedId));
    assert.match(pending, /decision-index\.json/);
  }));

test("stage bootstraps the first pending decision collection", () =>
  withTemporaryWorkspace("stage-first-collection", async (workspaceRoot) => {
    initializeGitRepository(workspaceRoot);
    await fs.writeFile(
      path.join(workspaceRoot, "README.md"),
      "baseline\n",
      "utf8"
    );
    commitWorkspace(workspaceRoot);
    const id = "use-first-stage";
    await writeDecision(
      workspaceRoot,
      id,
      candidateDecisionBody()
        .replace("status: candidate", "status: active")
        .replace("alignment: null", "alignment: aligned")
        .replace("createdAt: null", "createdAt: 2026-08-15T00:00:00Z")
    );
    const staged = await runSourceCli(["stage", id, "--root", workspaceRoot]);
    assert.equal(staged.exitCode, 0, staged.stderr);
    const pending = runGit(workspaceRoot, ["diff", "--cached", "--name-only"]);
    assert.match(pending, new RegExp(id));
    assert.match(pending, /decision-index\.json/);
  }));

test("stage bootstraps a new Decision when revision contains only the derived index", () =>
  withTemporaryWorkspace("stage-index-only-baseline", async (workspaceRoot) => {
    initializeGitRepository(workspaceRoot);
    const decisionsDirectory = path.join(workspaceRoot, "docs", "decisions");
    await fs.mkdir(decisionsDirectory, { recursive: true });
    await fs.writeFile(
      path.join(decisionsDirectory, "decision-index.json"),
      "{}\n",
      "utf8"
    );
    commitWorkspace(workspaceRoot);

    const decisionId = "use-index-only-baseline";
    await writeDecision(
      workspaceRoot,
      decisionId,
      candidateDecisionBody({ title: "从仅索引基线建立决策" })
        .replace("status: candidate", "status: active")
        .replace("alignment: null", "alignment: aligned")
        .replace("createdAt: null", "createdAt: 2026-08-15T00:00:00Z")
    );
    const staged = await runSourceCli([
      "stage",
      decisionId,
      "--root",
      workspaceRoot
    ]);
    assert.equal(staged.exitCode, 0, staged.stderr);
    const pending = JSON.parse(
      runGit(workspaceRoot, ["show", ":docs/decisions/decision-index.json"])
    );
    assert.ok(pending.entries[decisionId]);
    assert.match(
      runGit(workspaceRoot, ["diff", "--cached", "--name-only"]),
      new RegExp(decisionId)
    );
  }));

test("stage rejects invalid duplicate and missing paths without changing the pending snapshot", () =>
  withGitFixtureWorkspace("stage-invalid-input", async (workspaceRoot) => {
    const sourcePath = decisionFilePath(workspaceRoot, currentSourcePath);
    const indexPath = path.join(
      workspaceRoot,
      "docs",
      "decisions",
      "decision-index.json"
    );
    const sourceBefore = await fs.readFile(sourcePath, "utf8");
    const indexBefore = await fs.readFile(indexPath, "utf8");
    for (const { ids, expectedError } of [
      {
        expectedError: /must not repeat a Decision selector/,
        ids: [currentDecisionId, currentDecisionId]
      },
      {
        expectedError:
          /Selected Decision name does not exist in the revision or filesystem: use-missing-stage/,
        ids: ["use-missing-stage.md"]
      },
      {
        expectedError:
          /Decision selector is invalid; must be extensionless kebab-case text/,
        ids: ["../outside.md"]
      }
    ]) {
      const result = await runSourceCli([
        "stage",
        ...ids,
        "--root",
        workspaceRoot
      ]);
      assert.equal(result.exitCode, 2);
      assert.match(result.stderr, expectedError);
    }
    assert.equal(await fs.readFile(sourcePath, "utf8"), sourceBefore);
    assert.equal(await fs.readFile(indexPath, "utf8"), indexBefore);
    assert.equal(
      runGit(workspaceRoot, ["diff", "--cached", "--name-only"]),
      ""
    );
  }));

test("stage keeps duplicate selected source identities as a domain diagnostic", () =>
  withGitFixtureWorkspace(
    "stage-duplicate-source-identity",
    async (workspaceRoot) => {
      const currentPath = decisionFilePath(workspaceRoot, currentSourcePath);
      const archivePath = decisionFilePath(
        workspaceRoot,
        `archive/${currentDecisionId}`
      );
      await fs.mkdir(path.dirname(archivePath), { recursive: true });
      await fs.writeFile(
        archivePath,
        await fs.readFile(currentPath, "utf8"),
        "utf8"
      );

      const result = await runSourceCli([
        "stage",
        currentDecisionId,
        "--root",
        workspaceRoot
      ]);

      assert.equal(result.exitCode, 1);
      assert.equal(result.stdout, "");
      assert.match(
        result.stderr,
        /code: decision-records\.stage-snapshot-invalid/
      );
      assert.match(
        result.stderr,
        /Decision ID occurs in more than one filesystem source path/
      );
      assert.doesNotMatch(result.stderr, /causeCategory: unknown/);
    }
  ));

test("stage rejects invalid candidate relation targets before pending writes", () =>
  withGitFixtureWorkspace("stage-invalid-candidate", async (workspaceRoot) => {
    const invalid = "use-invalid-relation";
    await writeDecision(
      workspaceRoot,
      invalid,
      candidateDecisionBody({
        relations: [{ type: "修订", target: "use-missing-target" }]
      })
    );
    const result = await runSourceCli([
      "stage",
      invalid,
      "--root",
      workspaceRoot
    ]);
    assert.notEqual(result.exitCode, 0);
    assert.equal(
      runGit(workspaceRoot, ["diff", "--cached", "--name-only"]),
      ""
    );
  }));
