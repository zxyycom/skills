import {
  assert,
  candidateDecisionBody,
  currentRelativePath,
  decisionFilePath,
  establishClosedSplit,
  fs,
  runSourceLifecycleCli,
  test,
  withFixtureWorkspace
} from "./support.ts";

test("evolve rejects a split extension that omits an existing successor before writing", () =>
  withFixtureWorkspace("evolve-omit-split", async (workspaceRoot) => {
    const established = await establishClosedSplit(workspaceRoot);
    const thirdRelativePath = "omit-existing-split-slice";
    const thirdPath = decisionFilePath(workspaceRoot, thirdRelativePath);
    const thirdCandidate = candidateDecisionBody();
    await fs.writeFile(thirdPath, thirdCandidate, "utf8");
    const indexBefore = await fs.readFile(established.indexPath, "utf8");
    const rejected = await runSourceLifecycleCli([
      "evolve",
      "--successor",
      "aligned=" + established.alignedRelativePath,
      "--successor",
      "aligned=" + thirdRelativePath,
      "--relation",
      "拆分=" + established.coarseRelativePath,
      "--root",
      workspaceRoot
    ]);
    assert.equal(rejected.exitCode, 1);
    assert.match(rejected.stderr, /selected successor set must equal/);
    assert.match(rejected.stderr, /keep-future-split-slice/);
    assert.equal(await fs.readFile(thirdPath, "utf8"), thirdCandidate);
    assert.equal(await fs.readFile(established.indexPath, "utf8"), indexBefore);
  }));

test("evolve rejects one selected split successor", () =>
  withFixtureWorkspace("evolve-single-split", async (workspaceRoot) => {
    const successorRelativePath = "use-single-split";
    await fs.writeFile(
      decisionFilePath(workspaceRoot, successorRelativePath),
      candidateDecisionBody({
        relations: [{ type: "拆分", target: currentRelativePath }]
      }),
      "utf8"
    );
    const rejected = await runSourceLifecycleCli([
      "evolve",
      "--successor",
      "aligned=" + successorRelativePath,
      "--root",
      workspaceRoot
    ]);
    assert.equal(rejected.exitCode, 1);
    assert.match(rejected.stderr, /requires at least two explicitly selected/);
  }));

test("evolve rejects mixed split and non-split successor relations", () =>
  withFixtureWorkspace("evolve-mixed-split", async (workspaceRoot) => {
    const splitRelativePath = "use-mixed-split";
    const revisionRelativePath = "use-mixed-revision";
    await fs.writeFile(
      decisionFilePath(workspaceRoot, splitRelativePath),
      candidateDecisionBody({
        relations: [{ type: "拆分", target: currentRelativePath }]
      }),
      "utf8"
    );
    await fs.writeFile(
      decisionFilePath(workspaceRoot, revisionRelativePath),
      candidateDecisionBody({
        relations: [{ type: "修订", target: currentRelativePath }]
      }),
      "utf8"
    );
    const rejected = await runSourceLifecycleCli([
      "evolve",
      "--successor",
      "aligned=" + splitRelativePath,
      "--successor",
      "aligned=" + revisionRelativePath,
      "--root",
      workspaceRoot
    ]);
    assert.equal(rejected.exitCode, 1);
    assert.match(rejected.stderr, /exactly one 拆分 relation and no other/);
  }));

test("evolve rejects unsupported multi-successor shapes without split relations", () =>
  withFixtureWorkspace("evolve-unsupported-multiple", async (workspaceRoot) => {
    const firstRelativePath = "use-first-multiple";
    const secondRelativePath = "use-second-multiple";
    await fs.writeFile(
      decisionFilePath(workspaceRoot, firstRelativePath),
      candidateDecisionBody(),
      "utf8"
    );
    await fs.writeFile(
      decisionFilePath(workspaceRoot, secondRelativePath),
      candidateDecisionBody(),
      "utf8"
    );
    const rejected = await runSourceLifecycleCli([
      "evolve",
      "--successor",
      "aligned=" + firstRelativePath,
      "--successor",
      "aligned=" + secondRelativePath,
      "--root",
      workspaceRoot
    ]);
    assert.equal(rejected.exitCode, 1);
    assert.match(rejected.stderr, /supported only by the closed 拆分 strategy/);
  }));

test("evolve rejects a pure merge with fewer than two predecessors", () =>
  withFixtureWorkspace("evolve-undersized-merge", async (workspaceRoot) => {
    const successorRelativePath = "use-undersized-merge";
    await fs.writeFile(
      decisionFilePath(workspaceRoot, successorRelativePath),
      candidateDecisionBody(),
      "utf8"
    );
    const rejected = await runSourceLifecycleCli([
      "evolve",
      "--successor",
      "aligned=" + successorRelativePath,
      "--relation",
      "归并=" + currentRelativePath,
      "--root",
      workspaceRoot
    ]);
    assert.equal(rejected.exitCode, 1);
    assert.match(rejected.stderr, /requires at least two predecessors/);
  }));
