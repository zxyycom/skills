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
  runSuccessfulSourceLifecycleCli,
  test,
  validateDecisionRecords,
  withFixtureWorkspace
} from "./support.ts";

test("activate establishes candidate source relations and archives their active targets", () =>
  withFixtureWorkspace("activate-source-relations", async (workspaceRoot) => {
    const successorRelativePath = "use-candidate-source-relation";
    await fs.writeFile(
      decisionFilePath(workspaceRoot, successorRelativePath),
      candidateDecisionBody({
        relations: [
          {
            summary: "候选承接当前方向",
            target: currentRelativePath,
            type: "修订"
          }
        ]
      }),
      "utf8"
    );

    const candidatePath = decisionFilePath(
      workspaceRoot,
      successorRelativePath
    );
    const candidateBefore = await fs.readFile(candidatePath, "utf8");
    const preflight = await runSuccessfulSourceLifecycleCli([
      "activate",
      successorRelativePath,
      "--alignment",
      "aligned",
      "--preflight",
      "--root",
      workspaceRoot
    ]);
    assert.match(preflight, /Relation review \(preflight\):/);
    assert.match(preflight, /action=establish/);
    assert.match(preflight, /before relations:/);
    assert.match(
      preflight,
      /use-candidate-source-relation --修订--> use-generated-cli: "候选承接当前方向"/
    );
    assert.equal(await fs.readFile(candidatePath, "utf8"), candidateBefore);

    const strictBefore = await validateDecisionRecords({ workspaceRoot });
    assert.deepEqual(strictBefore.errors, []);
    const output = await runSuccessfulSourceLifecycleCli([
      "activate",
      successorRelativePath,
      "--alignment",
      "aligned",
      "--root",
      workspaceRoot
    ]);
    assert.match(output, /archived new active predecessors/);
    assert.match(output, /Relation review \(committed\):/);

    const index = await readIndex(
      path.join(workspaceRoot, "docs", "decisions", "decision-index.json")
    );
    assert.equal(findIndexEntry(index, currentRelativePath).status, "archived");
    assert.deepEqual(findIndexEntry(index, successorRelativePath).relations, [
      {
        summary: "候选承接当前方向",
        type: "修订",
        target: currentRelativePath
      }
    ]);
  }));

test("activate relation replacement overrides rather than merges candidate relations", () =>
  withFixtureWorkspace("activate-relation-replace", async (workspaceRoot) => {
    const parallelRelativePath = "use-replacement-predecessor";
    await fs.writeFile(
      decisionFilePath(workspaceRoot, parallelRelativePath),
      candidateDecisionBody(),
      "utf8"
    );
    await runSuccessfulSourceLifecycleCli([
      "activate",
      parallelRelativePath,
      "--alignment",
      "aligned",
      "--root",
      workspaceRoot
    ]);
    const successorRelativePath = "use-replaced-candidate-relations";
    await fs.writeFile(
      decisionFilePath(workspaceRoot, successorRelativePath),
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
      "--relation",
      "替代=" + parallelRelativePath,
      "--root",
      workspaceRoot
    ]);

    const index = await readIndex(
      path.join(workspaceRoot, "docs", "decisions", "decision-index.json")
    );
    assert.equal(findIndexEntry(index, currentRelativePath).status, "active");
    assert.equal(
      findIndexEntry(index, parallelRelativePath).status,
      "archived"
    );
    assert.deepEqual(findIndexEntry(index, successorRelativePath).relations, [
      {
        type: "替代",
        target: parallelRelativePath
      }
    ]);
  }));

test("activate clear-relations explicitly replaces candidate relations with an empty set", () =>
  withFixtureWorkspace("activate-relation-clear", async (workspaceRoot) => {
    const successorRelativePath = "use-cleared-candidate-relations";
    await fs.writeFile(
      decisionFilePath(workspaceRoot, successorRelativePath),
      candidateDecisionBody({
        relations: [{ type: "修订", target: currentRelativePath }]
      }),
      "utf8"
    );
    const cleared = await runSuccessfulSourceLifecycleCli([
      "activate",
      successorRelativePath,
      "--alignment",
      "aligned",
      "--clear-relations",
      "--root",
      workspaceRoot
    ]);
    assert.match(cleared, /Relation review \(committed\):/);
    assert.match(cleared, /action=establish/);
    assert.match(cleared, /after relations: \[\]/);
    assert.match(
      cleared,
      /removed use-cleared-candidate-relations --修订--> use-generated-cli: \[无摘要\]/
    );

    const index = await readIndex(
      path.join(workspaceRoot, "docs", "decisions", "decision-index.json")
    );
    assert.equal(findIndexEntry(index, currentRelativePath).status, "active");
    assert.deepEqual(
      findIndexEntry(index, successorRelativePath).relations,
      []
    );
  }));

test("evolve establishes one successor while preserving archived predecessors", () =>
  withFixtureWorkspace("evolve-archived-predecessor", async (workspaceRoot) => {
    const successorRelativePath = "use-active-and-archived-predecessors";
    await fs.writeFile(
      decisionFilePath(workspaceRoot, successorRelativePath),
      candidateDecisionBody(),
      "utf8"
    );
    await runSuccessfulSourceLifecycleCli([
      "evolve",
      "--successor",
      "aligned=" + successorRelativePath,
      "--relation",
      "修订=" + currentRelativePath,
      "--relation",
      "替代=" + archivedRelativePath,
      "--root",
      workspaceRoot
    ]);

    const index = await readIndex(
      path.join(workspaceRoot, "docs", "decisions", "decision-index.json")
    );
    assert.equal(findIndexEntry(index, currentRelativePath).status, "archived");
    assert.equal(
      findIndexEntry(index, archivedRelativePath).status,
      "archived"
    );
    assert.deepEqual(findIndexEntry(index, successorRelativePath).relations, [
      { type: "修订", target: currentRelativePath },
      { type: "替代", target: archivedRelativePath }
    ]);
  }));
