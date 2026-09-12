import {
  archivedRelativePath,
  assert,
  candidateDecisionBody,
  currentRelativePath,
  decisionFilePath,
  findIndexEntry,
  fs,
  path,
  readIndex,
  runSourceLifecycleCli,
  runSuccessfulSourceLifecycleCli,
  test,
  withFixtureWorkspace
} from "./support.ts";

test("evolve replaces established relations while preserving body and lifecycle fields", () =>
  withFixtureWorkspace("evolve-established-replace", async (workspaceRoot) => {
    const successorRelativePath = "replace-established-relations";
    const successorPath = decisionFilePath(
      workspaceRoot,
      successorRelativePath
    );
    await fs.writeFile(
      successorPath,
      candidateDecisionBody({
        relations: [{ type: "修订", target: currentRelativePath }]
      }),
      "utf8"
    );
    await runSuccessfulSourceLifecycleCli([
      "activate",
      successorRelativePath,
      "--alignment",
      "aligned",
      "--root",
      workspaceRoot
    ]);
    const activeTargetRelativePath = "use-active-replacement-target";
    await fs.writeFile(
      decisionFilePath(workspaceRoot, activeTargetRelativePath),
      candidateDecisionBody(),
      "utf8"
    );
    await runSuccessfulSourceLifecycleCli([
      "activate",
      activeTargetRelativePath,
      "--alignment",
      "aligned",
      "--root",
      workspaceRoot
    ]);
    const beforeText = await fs.readFile(successorPath, "utf8");
    const indexPath = path.join(
      workspaceRoot,
      "docs",
      "decisions",
      "decision-index.json"
    );
    const beforeIndex = await readIndex(indexPath);
    const beforeState = findIndexEntry(beforeIndex, successorRelativePath);
    const removedTargetBefore = findIndexEntry(
      beforeIndex,
      currentRelativePath
    );
    assert.equal(removedTargetBefore.status, "archived");
    assert.equal(
      findIndexEntry(beforeIndex, activeTargetRelativePath).status,
      "active"
    );

    const replaced = await runSuccessfulSourceLifecycleCli([
      "evolve",
      "--successor",
      "aligned=" + successorRelativePath,
      "--relation",
      "替代=" + activeTargetRelativePath,
      "--root",
      workspaceRoot
    ]);
    assert.match(replaced, /Relation review \(committed\):/);
    assert.match(replaced, /action=replace/);
    assert.match(replaced, /removed replace-established-relations --修订-->/);
    assert.match(replaced, /added replace-established-relations --替代-->/);

    const afterText = await fs.readFile(successorPath, "utf8");
    const afterIndex = await readIndex(indexPath);
    const afterState = findIndexEntry(afterIndex, successorRelativePath);
    assert.equal(afterState.status, beforeState.status);
    assert.equal(afterState.alignment, beforeState.alignment);
    assert.equal(afterState.createdAt, beforeState.createdAt);
    assert.equal(afterState.title, beforeState.title);
    assert.equal(afterState.purpose, beforeState.purpose);
    assert.equal(afterState.background, beforeState.background);
    assert.equal(afterState.decision, beforeState.decision);
    assert.equal(
      afterText.slice(afterText.indexOf("## 目的")),
      beforeText.slice(beforeText.indexOf("## 目的"))
    );
    assert.deepEqual(afterState.relations, [
      {
        type: "替代",
        target: activeTargetRelativePath
      }
    ]);
    assert.deepEqual(
      findIndexEntry(afterIndex, currentRelativePath),
      removedTargetBefore
    );
    assert.equal(
      findIndexEntry(afterIndex, activeTargetRelativePath).status,
      "archived"
    );
    const unchanged = await runSuccessfulSourceLifecycleCli([
      "evolve",
      "--successor",
      "aligned=" + successorRelativePath,
      "--relation",
      "替代=" + activeTargetRelativePath,
      "--root",
      workspaceRoot
    ]);
    assert.match(unchanged, /action=unchanged/);
    assert.match(unchanged, /changes: unchanged/);
  }));

test("evolve keeps an archived established successor archived during relation replacement", () =>
  withFixtureWorkspace("evolve-archived-successor", async (workspaceRoot) => {
    const successorRelativePath = "keep-archived-successor-state";
    await fs.writeFile(
      decisionFilePath(workspaceRoot, successorRelativePath),
      candidateDecisionBody(),
      "utf8"
    );
    await runSuccessfulSourceLifecycleCli([
      "activate",
      successorRelativePath,
      "--alignment",
      "unaligned",
      "--root",
      workspaceRoot
    ]);
    await runSuccessfulSourceLifecycleCli([
      "archive",
      successorRelativePath,
      "--root",
      workspaceRoot
    ]);
    const indexPath = path.join(
      workspaceRoot,
      "docs",
      "decisions",
      "decision-index.json"
    );
    const before = findIndexEntry(
      await readIndex(indexPath),
      successorRelativePath
    );

    await runSuccessfulSourceLifecycleCli([
      "evolve",
      "--successor",
      "unaligned=" + successorRelativePath,
      "--relation",
      "修订=" + archivedRelativePath,
      "--root",
      workspaceRoot
    ]);
    const after = findIndexEntry(
      await readIndex(indexPath),
      successorRelativePath
    );
    assert.equal(after.status, "archived");
    assert.equal(after.alignment, before.alignment);
    assert.equal(after.createdAt, before.createdAt);
    assert.deepEqual(after.relations, [
      {
        type: "修订",
        target: archivedRelativePath
      }
    ]);
  }));

test("evolve rejects established successor alignment mismatches without mutation", () =>
  withFixtureWorkspace(
    "evolve-alignment-confirmation",
    async (workspaceRoot) => {
      const currentPath = decisionFilePath(workspaceRoot, currentRelativePath);
      const indexPath = path.join(
        workspaceRoot,
        "docs",
        "decisions",
        "decision-index.json"
      );
      const currentBefore = await fs.readFile(currentPath, "utf8");
      const indexBefore = await fs.readFile(indexPath, "utf8");
      const rejected = await runSourceLifecycleCli([
        "evolve",
        "--successor",
        "unaligned=" + currentRelativePath,
        "--clear-relations",
        "--root",
        workspaceRoot
      ]);
      assert.equal(rejected.exitCode, 1);
      assert.match(rejected.stderr, /alignment confirmation does not match/);
      assert.equal(await fs.readFile(currentPath, "utf8"), currentBefore);
      assert.equal(await fs.readFile(indexPath, "utf8"), indexBefore);
    }
  ));
