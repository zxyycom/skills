import {
  archivedDecisionId,
  assert,
  currentDecisionId,
  currentRelativePath,
  decisionFilePath,
  fs,
  path,
  runSourceCli,
  syncDecisionIndex,
  test,
  validateDecisionRecords,
  withFixtureWorkspace
} from "./support.ts";

test("selected sync accepts one Decision change only after proving the complete collection", () =>
  withFixtureWorkspace("selected-index-maintenance", async (workspaceRoot) => {
    const decisionsDirectory = path.join(workspaceRoot, "docs", "decisions");
    const indexPath = path.join(decisionsDirectory, "decision-index.json");
    const activePath = decisionFilePath(workspaceRoot, currentRelativePath);
    const originalIndex = await fs.readFile(indexPath, "utf8");
    const active = await fs.readFile(activePath, "utf8");
    await fs.writeFile(
      activePath,
      active.replace("title: 使用生成 CLI", "title: 使用 selected sync"),
      "utf8"
    );

    const rejected = await runSourceCli([
      "sync-index",
      "--select",
      archivedDecisionId,
      "--root",
      workspaceRoot
    ]);
    assert.equal(rejected.exitCode, 1);
    assert.match(rejected.stderr, /outside the selected sync scope/u);
    assert.equal(await fs.readFile(indexPath, "utf8"), originalIndex);

    const checked = await runSourceCli([
      "sync-index",
      "--select",
      `${currentDecisionId}.md`,
      "--preflight",
      "--root",
      workspaceRoot
    ]);
    assert.equal(checked.exitCode, 0, checked.stderr);
    assert.equal(checked.stderr, "");
    assert.match(checked.stdout, /preflight passed.*not published/u);
    assert.doesNotMatch(checked.stdout, /already current/u);
    assert.equal(await fs.readFile(indexPath, "utf8"), originalIndex);

    const written = await runSourceCli([
      "sync-index",
      "--select",
      `${currentDecisionId}.md`,
      "--root",
      workspaceRoot
    ]);
    assert.equal(written.exitCode, 0, written.stderr);
    assert.match(
      written.stdout,
      /Selected Decision selectors: use-generated-cli\.md\./u
    );
    assert.match(written.stdout, /resolved IDs: use-generated-cli\./u);
    const selectedText = await fs.readFile(indexPath, "utf8");
    assert.notEqual(selectedText, originalIndex);

    await fs.writeFile(indexPath, originalIndex, "utf8");
    const full = await runSourceCli(["sync-index", "--root", workspaceRoot]);
    assert.equal(full.exitCode, 0, full.stderr);
    assert.equal(await fs.readFile(indexPath, "utf8"), selectedText);
  }));

test("Decision sync re-discovers complete established membership after an earlier scan", () =>
  withFixtureWorkspace("selected-index-membership", async (workspaceRoot) => {
    const decisionsDirectory = path.join(workspaceRoot, "docs", "decisions");
    const indexPath = path.join(decisionsDirectory, "decision-index.json");
    const currentPath = decisionFilePath(workspaceRoot, currentRelativePath);
    const current = await fs.readFile(currentPath, "utf8");
    const addedId = "260712-dynamic-member";
    const addedPath = path.join(decisionsDirectory, `${addedId}.md`);
    const beforeAddition = await fs.readFile(indexPath, "utf8");

    assert.deepEqual(
      (await validateDecisionRecords({ workspaceRoot })).errors,
      []
    );
    await fs.writeFile(
      currentPath,
      current.replace("title: 使用生成 CLI", "title: First selected change"),
      "utf8"
    );
    await fs.writeFile(
      addedPath,
      current
        .replace("title: 使用生成 CLI", "title: Dynamic member")
        .replace(`id: ${currentDecisionId}`, `id: ${addedId}`)
        .replace(
          "relations:\n  - type: 修订\n    target: 260710-use-source-cli",
          "relations: []"
        ),
      "utf8"
    );

    const afterAddition = await syncDecisionIndex({
      decisionsDirectory,
      mode: "write",
      scope: { kind: "selected", selectedIds: [currentDecisionId] }
    });
    assert.equal(afterAddition.status, "error");
    assert.equal(afterAddition.state, "unselected-changes");
    assert.deepEqual(afterAddition.changedIds, [addedId, currentDecisionId]);
    assert.equal(await fs.readFile(indexPath, "utf8"), beforeAddition);

    assert.equal(
      (await syncDecisionIndex({ decisionsDirectory, mode: "write" })).state,
      "written"
    );
    const beforeDeletion = await fs.readFile(indexPath, "utf8");
    assert.deepEqual(
      (await validateDecisionRecords({ workspaceRoot })).errors,
      []
    );
    await fs.writeFile(
      currentPath,
      current.replace("title: 使用生成 CLI", "title: Second selected change"),
      "utf8"
    );
    await fs.rm(addedPath);

    const afterDeletion = await syncDecisionIndex({
      decisionsDirectory,
      mode: "write",
      scope: { kind: "selected", selectedIds: [currentDecisionId] }
    });
    assert.equal(afterDeletion.status, "error");
    assert.equal(afterDeletion.state, "unselected-changes");
    assert.deepEqual(afterDeletion.changedIds, [addedId, currentDecisionId]);
    assert.equal(await fs.readFile(indexPath, "utf8"), beforeDeletion);
  }));

test("Decision full sync preflight accepts recoverable indexes without weakening strict check", () =>
  withFixtureWorkspace("full-index-preview", async (workspaceRoot) => {
    const indexPath = path.join(
      workspaceRoot,
      "docs",
      "decisions",
      "decision-index.json"
    );
    const baseline = await fs.readFile(indexPath, "utf8");
    for (const broken of [
      null,
      "not JSON",
      baseline.replace('"schemaVersion": 4', '"schemaVersion": 3')
    ]) {
      if (broken === null) await fs.rm(indexPath);
      else await fs.writeFile(indexPath, broken);
      const before = await fs.readFile(indexPath, "utf8").catch(() => null);
      const preview = await runSourceCli([
        "sync-index",
        "--preflight",
        "--root",
        workspaceRoot
      ]);
      assert.equal(preview.exitCode, 0, preview.stderr);
      assert.match(preview.stdout, /preflight passed.*not published/u);
      assert.equal(
        await fs.readFile(indexPath, "utf8").catch(() => null),
        before
      );
      const checked = await runSourceCli(["check", "--root", workspaceRoot]);
      assert.equal(checked.exitCode, 1);
      const selected = await runSourceCli([
        "sync-index",
        "--select",
        currentDecisionId,
        "--preflight",
        "--root",
        workspaceRoot
      ]);
      assert.equal(selected.exitCode, 1);
      assert.match(selected.stderr, /valid baseline|not-found/u);
      const written = await runSourceCli([
        "sync-index",
        "--root",
        workspaceRoot
      ]);
      assert.equal(written.exitCode, 0, written.stderr);
      assert.equal(await fs.readFile(indexPath, "utf8"), baseline);
    }
    const current = await runSourceCli([
      "sync-index",
      "--preflight",
      "--root",
      workspaceRoot
    ]);
    assert.equal(current.exitCode, 0, current.stderr);
    assert.match(current.stdout, /up to date/u);
    assert.doesNotMatch(current.stdout, /not published/u);
  }));
