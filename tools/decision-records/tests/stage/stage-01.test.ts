import {
  assert,
  candidateDecisionBody,
  commitWorkspace,
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

test("stage selects one Decision ID when its sourcePath moves between root and archive", () =>
  withGitFixtureWorkspace("stage-move", async (workspaceRoot) => {
    const currentPath = decisionFilePath(workspaceRoot, currentSourcePath);
    const archivedPath = decisionFilePath(
      workspaceRoot,
      `archive/${currentDecisionId}`
    );
    await fs.mkdir(path.dirname(archivedPath), { recursive: true });
    await fs.rename(currentPath, archivedPath);
    await fs.writeFile(
      archivedPath,
      (await fs.readFile(archivedPath, "utf8")).replace(
        "status: active",
        "status: archived"
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
      "--name-status"
    ]);
    assert.match(
      pendingPaths,
      new RegExp(
        `R\\d+\\tdocs/decisions/${currentDecisionId}\\.md\\tdocs/decisions/archive/${currentDecisionId}\\.md`
      )
    );
    assert.match(pendingPaths, /docs\/decisions\/decision-index\.json/);
  }));

test("stage treats a selected new ID as an addition and preserves an unselected old ID", () =>
  withGitFixtureWorkspace("stage-addition", async (workspaceRoot) => {
    const addedId = "use-added-cli";
    await writeDecision(
      workspaceRoot,
      addedId,
      candidateDecisionBody({ title: "新增稳定 ID" })
        .replace("status: candidate", "status: active")
        .replace("alignment: null", "alignment: aligned")
        .replace("createdAt: null", "createdAt: 2026-08-15T00:00:00Z")
    );
    const staged = await runSourceCli([
      "stage",
      addedId,
      "--root",
      workspaceRoot
    ]);
    assert.equal(staged.exitCode, 0, staged.stderr);
    const pending = JSON.parse(
      runGit(workspaceRoot, ["show", ":docs/decisions/decision-index.json"])
    );
    assert.ok(pending.entries[currentDecisionId]);
    assert.ok(pending.entries[addedId]);
  }));

test("stage resolves a unique Decision name after one Markdown suffix", () =>
  withGitFixtureWorkspace("stage-name-selector", async (workspaceRoot) => {
    const staged = await runSourceCli([
      "stage",
      "use-source-cli.MD",
      "--root",
      workspaceRoot
    ]);
    assert.equal(staged.exitCode, 0, staged.stderr);
  }));

test("stage treats a standard Decision ID as exact instead of falling back to a name", () =>
  withGitFixtureWorkspace("stage-exact-selector", async (workspaceRoot) => {
    const staged = await runSourceCli([
      "stage",
      "260801-stage-not-present",
      "--root",
      workspaceRoot
    ]);
    assert.equal(staged.exitCode, 2);
    assert.match(
      staged.stderr,
      /Selected Decision ID does not exist in the revision or filesystem: 260801-stage-not-present/
    );
  }));

test("stage reports ambiguous Decision names before writing pending files", () =>
  withGitFixtureWorkspace("stage-ambiguous-name", async (workspaceRoot) => {
    const duplicateId = "260711-use-source-cli";
    await writeDecision(
      workspaceRoot,
      duplicateId,
      candidateDecisionBody({ id: duplicateId, title: "同名候选" })
    );
    const staged = await runSourceCli([
      "stage",
      "use-source-cli",
      "--root",
      workspaceRoot
    ]);
    assert.equal(staged.exitCode, 2);
    assert.match(staged.stderr, /Selected Decision name is ambiguous/);
    assert.equal(
      runGit(workspaceRoot, ["diff", "--cached", "--name-only"]),
      ""
    );
  }));

test("stage resolves a filesystem-only Decision addition by name", () =>
  withGitFixtureWorkspace("stage-filesystem-name", async (workspaceRoot) => {
    const addedId = "260801-stage-filesystem-only";
    await writeDecision(
      workspaceRoot,
      addedId,
      candidateDecisionBody({ id: addedId, title: "工作树名称选择" })
        .replace("status: candidate", "status: active")
        .replace("alignment: null", "alignment: aligned")
        .replace("createdAt: null", "createdAt: 2026-08-01T00:00:00Z")
    );
    const staged = await runSourceCli([
      "stage",
      "stage-filesystem-only",
      "--root",
      workspaceRoot
    ]);
    assert.equal(staged.exitCode, 0, staged.stderr);
    const pending = JSON.parse(
      runGit(workspaceRoot, ["show", ":docs/decisions/decision-index.json"])
    );
    assert.ok(pending.entries[addedId]);
  }));

test("stage preserves one Decision ID when its semantic sourcePath is renamed", () =>
  withGitFixtureWorkspace("stage-rename", async (workspaceRoot) => {
    const renamedId = "use-renamed-cli";
    const renamedPath = decisionFilePath(workspaceRoot, renamedId);
    await fs.rename(
      decisionFilePath(workspaceRoot, currentSourcePath),
      renamedPath
    );
    await fs.writeFile(
      renamedPath,
      (await fs.readFile(renamedPath, "utf8")).replace(
        "使用生成 CLI",
        "重命名后编辑 CLI"
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
    const pending = JSON.parse(
      runGit(workspaceRoot, ["show", ":docs/decisions/decision-index.json"])
    );
    assert.equal(pending.entries[currentDecisionId].title, "重命名后编辑 CLI");
    assert.equal(
      pending.entries[currentDecisionId].sourcePath,
      `${renamedId}.md`
    );
  }));

test("stage ignores an invalid former ID basename after an ID keeps a semantic sourcePath", () =>
  withGitFixtureWorkspace("stage-former-basename", async (workspaceRoot) => {
    const formerPath = decisionFilePath(workspaceRoot, currentSourcePath);
    const semanticSourcePath = "semantic-current.md";
    const semanticPath = decisionFilePath(workspaceRoot, semanticSourcePath);
    await fs.rename(formerPath, semanticPath);
    const synchronized = await runSourceCli([
      "sync-index",
      "--root",
      workspaceRoot
    ]);
    assert.equal(synchronized.exitCode, 0, synchronized.stderr);
    commitWorkspace(workspaceRoot);

    await fs.writeFile(formerPath, "not a Decision record\n", "utf8");
    await fs.writeFile(
      semanticPath,
      (await fs.readFile(semanticPath, "utf8")).replace(
        "使用生成 CLI",
        "语义路径的选择修改"
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
    assert.match(pendingPaths, /docs\/decisions\/semantic-current\.md/);
    assert.doesNotMatch(
      pendingPaths,
      new RegExp(`docs/decisions/${currentDecisionId}\\.md`)
    );
  }));
