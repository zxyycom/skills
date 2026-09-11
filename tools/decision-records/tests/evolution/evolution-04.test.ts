import {
  assert,
  candidateDecisionBody,
  currentRelativePath,
  decisionFilePath,
  establishAdditionalActivePredecessor,
  establishClosedReallocation,
  fs,
  runSourceLifecycleCli,
  runSuccessfulSourceLifecycleCli,
  test,
  withFixtureWorkspace
} from "./support.ts";

test("evolve rejects a one-predecessor reallocation", () =>
  withFixtureWorkspace(
    "evolve-one-predecessor-reallocation",
    async (workspaceRoot) => {
      const firstSuccessor = "use-first-one-predecessor-reallocation";
      const secondSuccessor = "use-second-one-predecessor-reallocation";
      for (const successor of [firstSuccessor, secondSuccessor]) {
        await fs.writeFile(
          decisionFilePath(workspaceRoot, successor),
          candidateDecisionBody({
            relations: [{ type: "重划", target: currentRelativePath }]
          }),
          "utf8"
        );
      }
      const rejected = await runSourceLifecycleCli([
        "evolve",
        "--successor",
        "aligned=" + firstSuccessor,
        "--successor",
        "aligned=" + secondSuccessor,
        "--root",
        workspaceRoot
      ]);
      assert.equal(rejected.exitCode, 1);
      assert.match(
        rejected.stderr,
        /requires at least two distinct predecessors/
      );
    }
  ));

test("evolve rejects mixed reallocation and other successor relations", () =>
  withFixtureWorkspace("evolve-mixed-reallocation", async (workspaceRoot) => {
    const predecessor =
      await establishAdditionalActivePredecessor(workspaceRoot);
    const mixedSuccessor = "use-mixed-reallocation";
    const reallocationSuccessor = "use-pure-reallocation";
    await fs.writeFile(
      decisionFilePath(workspaceRoot, mixedSuccessor),
      candidateDecisionBody({
        relations: [
          { type: "重划", target: currentRelativePath },
          { type: "修订", target: predecessor }
        ]
      }),
      "utf8"
    );
    await fs.writeFile(
      decisionFilePath(workspaceRoot, reallocationSuccessor),
      candidateDecisionBody({
        relations: [
          { type: "重划", target: currentRelativePath },
          { type: "重划", target: predecessor }
        ]
      }),
      "utf8"
    );
    const rejected = await runSourceLifecycleCli([
      "evolve",
      "--successor",
      "aligned=" + mixedSuccessor,
      "--successor",
      "aligned=" + reallocationSuccessor,
      "--root",
      workspaceRoot
    ]);
    assert.equal(rejected.exitCode, 1);
    assert.match(rejected.stderr, /at least one 重划 relation and no other/);
  }));

test("evolve rejects a disconnected reallocation graph", () =>
  withFixtureWorkspace(
    "evolve-disconnected-reallocation",
    async (workspaceRoot) => {
      const predecessor =
        await establishAdditionalActivePredecessor(workspaceRoot);
      const firstSuccessor = "use-first-disconnected-reallocation";
      const secondSuccessor = "use-second-disconnected-reallocation";
      await fs.writeFile(
        decisionFilePath(workspaceRoot, firstSuccessor),
        candidateDecisionBody({
          relations: [{ type: "重划", target: currentRelativePath }]
        }),
        "utf8"
      );
      await fs.writeFile(
        decisionFilePath(workspaceRoot, secondSuccessor),
        candidateDecisionBody({
          relations: [{ type: "重划", target: predecessor }]
        }),
        "utf8"
      );
      const rejected = await runSourceLifecycleCli([
        "evolve",
        "--successor",
        "aligned=" + firstSuccessor,
        "--successor",
        "aligned=" + secondSuccessor,
        "--root",
        workspaceRoot
      ]);
      assert.equal(rejected.exitCode, 1);
      assert.match(
        rejected.stderr,
        /successor-predecessor graph must be connected/
      );
    }
  ));

test("evolve rejects a reallocation that overlaps successor and predecessor roles", () =>
  withFixtureWorkspace(
    "evolve-overlapping-reallocation-roles",
    async (workspaceRoot) => {
      const established = await establishClosedReallocation(workspaceRoot);
      const overlappingSuccessor = "use-overlapping-reallocation-owner";
      await fs.writeFile(
        decisionFilePath(workspaceRoot, overlappingSuccessor),
        candidateDecisionBody({
          relations: [
            { type: "重划", target: established.firstSuccessorRelativePath },
            { type: "重划", target: currentRelativePath }
          ]
        }),
        "utf8"
      );
      const rejected = await runSourceLifecycleCli([
        "evolve",
        "--successor",
        "aligned=" + established.firstSuccessorRelativePath,
        "--successor",
        "aligned=" + overlappingSuccessor,
        "--root",
        workspaceRoot
      ]);
      assert.equal(rejected.exitCode, 1);
      assert.match(rejected.stderr, /both successor and predecessor/);
    }
  ));

test("evolve requires every established successor in a reallocation component", () =>
  withFixtureWorkspace("evolve-open-reallocation", async (workspaceRoot) => {
    const established = await establishClosedReallocation(workspaceRoot);
    const thirdSuccessor = "use-third-reallocation-successor";
    await fs.writeFile(
      decisionFilePath(workspaceRoot, thirdSuccessor),
      candidateDecisionBody({
        relations: [
          { type: "重划", target: currentRelativePath },
          { type: "重划", target: established.secondPredecessorRelativePath }
        ]
      }),
      "utf8"
    );
    await runSuccessfulSourceLifecycleCli([
      "evolve",
      "--successor",
      "aligned=" + established.firstSuccessorRelativePath,
      "--successor",
      "unaligned=" + established.secondSuccessorRelativePath,
      "--successor",
      "aligned=" + thirdSuccessor,
      "--root",
      workspaceRoot
    ]);
    const rejected = await runSourceLifecycleCli([
      "evolve",
      "--successor",
      "aligned=" + established.firstSuccessorRelativePath,
      "--successor",
      "unaligned=" + established.secondSuccessorRelativePath,
      "--root",
      workspaceRoot
    ]);
    assert.equal(rejected.exitCode, 1);
    assert.match(rejected.stderr, /equal every final 重划 successor/);
    assert.match(rejected.stderr, /use-third-reallocation-successor/);
  }));
