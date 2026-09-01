import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { validateDecisionRecords } from "../src/index.ts";
import {
  archivedRelativePath,
  candidateDecisionBody,
  commitWorkspace,
  currentRelativePath,
  decisionFilePath,
  findIndexEntry,
  readIndex,
  runSourceCli,
  runSuccessfulSourceCli,
  traceDecision,
  withFixtureWorkspace,
  withGitFixtureWorkspace
} from "./support.ts";

test("activate establishes candidate source relations and archives their active targets", () =>
  withGitFixtureWorkspace(
    "activate-source-relations",
    async (workspaceRoot) => {
      const successorRelativePath = "use-candidate-source-relation.md";
      await fs.writeFile(
        decisionFilePath(workspaceRoot, successorRelativePath),
        candidateDecisionBody({
          relations: [{ type: "修订", target: currentRelativePath }]
        }),
        "utf8"
      );

      const strictBefore = await validateDecisionRecords({ workspaceRoot });
      assert.deepEqual(strictBefore.errors, []);
      const output = await runSuccessfulSourceCli([
        "activate",
        successorRelativePath,
        "--alignment",
        "aligned",
        "--root",
        workspaceRoot
      ]);
      assert.match(output, /archived new active predecessors/);

      const index = await readIndex(
        path.join(workspaceRoot, "docs", "decisions", "decision-index.json")
      );
      assert.equal(
        findIndexEntry(index, currentRelativePath).status,
        "archived"
      );
      assert.deepEqual(findIndexEntry(index, successorRelativePath).relations, [
        {
          type: "修订",
          target: currentRelativePath
        }
      ]);
    }
  ));

test("activate relation replacement overrides rather than merges candidate relations", () =>
  withFixtureWorkspace("activate-relation-replace", async (workspaceRoot) => {
    const parallelRelativePath = "use-replacement-predecessor.md";
    await fs.writeFile(
      decisionFilePath(workspaceRoot, parallelRelativePath),
      candidateDecisionBody(),
      "utf8"
    );
    await runSuccessfulSourceCli([
      "activate",
      parallelRelativePath,
      "--alignment",
      "aligned",
      "--root",
      workspaceRoot
    ]);
    const successorRelativePath = "use-replaced-candidate-relations.md";
    await fs.writeFile(
      decisionFilePath(workspaceRoot, successorRelativePath),
      candidateDecisionBody({
        relations: [{ type: "修订", target: currentRelativePath }]
      }),
      "utf8"
    );
    await runSuccessfulSourceCli([
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
    const successorRelativePath = "use-cleared-candidate-relations.md";
    await fs.writeFile(
      decisionFilePath(workspaceRoot, successorRelativePath),
      candidateDecisionBody({
        relations: [{ type: "修订", target: currentRelativePath }]
      }),
      "utf8"
    );
    await runSuccessfulSourceCli([
      "activate",
      successorRelativePath,
      "--alignment",
      "aligned",
      "--clear-relations",
      "--root",
      workspaceRoot
    ]);

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
    const successorRelativePath = "use-active-and-archived-predecessors.md";
    await fs.writeFile(
      decisionFilePath(workspaceRoot, successorRelativePath),
      candidateDecisionBody(),
      "utf8"
    );
    await runSuccessfulSourceCli([
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

test("evolve replaces established relations while preserving body and lifecycle fields", () =>
  withFixtureWorkspace("evolve-established-replace", async (workspaceRoot) => {
    const successorRelativePath = "replace-established-relations.md";
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
    await runSuccessfulSourceCli([
      "activate",
      successorRelativePath,
      "--alignment",
      "aligned",
      "--root",
      workspaceRoot
    ]);
    const activeTargetRelativePath = "use-active-replacement-target.md";
    await fs.writeFile(
      decisionFilePath(workspaceRoot, activeTargetRelativePath),
      candidateDecisionBody(),
      "utf8"
    );
    await runSuccessfulSourceCli([
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

    await runSuccessfulSourceCli([
      "evolve",
      "--successor",
      "aligned=" + successorRelativePath,
      "--relation",
      "替代=" + activeTargetRelativePath,
      "--root",
      workspaceRoot
    ]);

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
  }));

test("evolve keeps an archived established successor archived during relation replacement", () =>
  withFixtureWorkspace("evolve-archived-successor", async (workspaceRoot) => {
    const successorRelativePath = "keep-archived-successor-state.md";
    await fs.writeFile(
      decisionFilePath(workspaceRoot, successorRelativePath),
      candidateDecisionBody(),
      "utf8"
    );
    await runSuccessfulSourceCli([
      "activate",
      successorRelativePath,
      "--alignment",
      "unaligned",
      "--root",
      workspaceRoot
    ]);
    await runSuccessfulSourceCli([
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

    await runSuccessfulSourceCli([
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
      const rejected = await runSourceCli([
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

test("evolve rejects historical archived successors with null alignment", () =>
  withFixtureWorkspace("evolve-historical-successor", async (workspaceRoot) => {
    const rejected = await runSourceCli([
      "evolve",
      "--successor",
      "aligned=" + archivedRelativePath,
      "--clear-relations",
      "--root",
      workspaceRoot
    ]);
    assert.equal(rejected.exitCode, 1);
    assert.match(rejected.stderr, /non-null alignment/);
  }));

test("activate rejects relation replacement for established decisions", () =>
  withFixtureWorkspace(
    "activate-established-relations",
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
      for (const relationSelection of [
        ["--clear-relations"],
        ["--relation", "替代=" + archivedRelativePath]
      ]) {
        const rejected = await runSourceCli([
          "activate",
          currentRelativePath,
          "--alignment",
          "aligned",
          ...relationSelection,
          "--root",
          workspaceRoot
        ]);
        assert.equal(rejected.exitCode, 1);
        assert.match(rejected.stderr, /apply only when activate establishes/);
      }
      assert.equal(await fs.readFile(currentPath, "utf8"), currentBefore);
      assert.equal(await fs.readFile(indexPath, "utf8"), indexBefore);
    }
  ));

test("evolve performs a closed split with independently aligned successors", () =>
  withGitFixtureWorkspace("evolve-closed-split", async (workspaceRoot) => {
    const established = await establishClosedSplit(workspaceRoot);
    const index = await readIndex(established.indexPath);
    const coarseState = findIndexEntry(index, established.coarseRelativePath);
    const alignedState = findIndexEntry(index, established.alignedRelativePath);
    const unalignedState = findIndexEntry(
      index,
      established.unalignedRelativePath
    );
    assert.equal(coarseState.status, "archived");
    assert.equal(findIndexEntry(index, currentRelativePath).status, "active");
    assert.equal(alignedState.alignment, "aligned");
    assert.equal(unalignedState.alignment, "unaligned");
    assert.equal(alignedState.createdAt, unalignedState.createdAt);
    assert.deepEqual(alignedState.relations, [
      {
        type: "拆分",
        target: established.coarseRelativePath
      }
    ]);
    assert.deepEqual(unalignedState.relations, [
      {
        type: "拆分",
        target: established.coarseRelativePath
      }
    ]);

    const traced = await traceDecision(
      established.coarseRelativePath,
      ["--direction", "successors", "--depth", "1"],
      workspaceRoot
    );
    assert.match(traced, /keep-current-split-slice/);
    assert.match(traced, /keep-future-split-slice/);
  }));

test("evolve performs a closed sparse reallocation with independently aligned successors", () =>
  withFixtureWorkspace("evolve-closed-reallocation", async (workspaceRoot) => {
    const established = await establishClosedReallocation(workspaceRoot);
    const index = await readIndex(established.indexPath);
    assert.equal(findIndexEntry(index, currentRelativePath).status, "archived");
    assert.equal(
      findIndexEntry(index, established.secondPredecessorRelativePath).status,
      "archived"
    );
    assert.deepEqual(
      findIndexEntry(index, established.firstSuccessorRelativePath).relations,
      [
        { type: "重划", target: currentRelativePath },
        { type: "重划", target: established.secondPredecessorRelativePath }
      ]
    );
    assert.deepEqual(
      findIndexEntry(index, established.secondSuccessorRelativePath).relations,
      [{ type: "重划", target: currentRelativePath }]
    );
    assert.equal(
      findIndexEntry(index, established.firstSuccessorRelativePath).alignment,
      "aligned"
    );
    assert.equal(
      findIndexEntry(index, established.secondSuccessorRelativePath).alignment,
      "unaligned"
    );
    assert.deepEqual(
      (await validateDecisionRecords({ workspaceRoot })).errors,
      []
    );
  }));

test("evolve rejects a one-successor reallocation", () =>
  withFixtureWorkspace(
    "evolve-one-successor-reallocation",
    async (workspaceRoot) => {
      const predecessor =
        await establishAdditionalActivePredecessor(workspaceRoot);
      const successorRelativePath = "use-one-reallocation-successor.md";
      await fs.writeFile(
        decisionFilePath(workspaceRoot, successorRelativePath),
        candidateDecisionBody({
          relations: [
            { type: "重划", target: currentRelativePath },
            { type: "重划", target: predecessor }
          ]
        }),
        "utf8"
      );
      const rejected = await runSourceCli([
        "evolve",
        "--successor",
        "aligned=" + successorRelativePath,
        "--root",
        workspaceRoot
      ]);
      assert.equal(rejected.exitCode, 1);
      assert.match(
        rejected.stderr,
        /requires at least two explicitly selected/
      );
    }
  ));

test("evolve rejects a one-predecessor reallocation", () =>
  withFixtureWorkspace(
    "evolve-one-predecessor-reallocation",
    async (workspaceRoot) => {
      const firstSuccessor = "use-first-one-predecessor-reallocation.md";
      const secondSuccessor = "use-second-one-predecessor-reallocation.md";
      for (const successor of [firstSuccessor, secondSuccessor]) {
        await fs.writeFile(
          decisionFilePath(workspaceRoot, successor),
          candidateDecisionBody({
            relations: [{ type: "重划", target: currentRelativePath }]
          }),
          "utf8"
        );
      }
      const rejected = await runSourceCli([
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
    const mixedSuccessor = "use-mixed-reallocation.md";
    const reallocationSuccessor = "use-pure-reallocation.md";
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
    const rejected = await runSourceCli([
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
      const firstSuccessor = "use-first-disconnected-reallocation.md";
      const secondSuccessor = "use-second-disconnected-reallocation.md";
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
      const rejected = await runSourceCli([
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
      const overlappingSuccessor = "use-overlapping-reallocation-owner.md";
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
      const rejected = await runSourceCli([
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
    const thirdSuccessor = "use-third-reallocation-successor.md";
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
    await runSuccessfulSourceCli([
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
    const rejected = await runSourceCli([
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

test("evolve keeps a later reallocation separate from its archived predecessor event", () =>
  withFixtureWorkspace(
    "evolve-successive-reallocation",
    async (workspaceRoot) => {
      const established = await establishClosedReallocation(workspaceRoot);
      await runSuccessfulSourceCli([
        "archive",
        established.firstSuccessorRelativePath,
        "--root",
        workspaceRoot
      ]);
      const additionalPredecessor = "use-later-reallocation-predecessor.md";
      await fs.writeFile(
        decisionFilePath(workspaceRoot, additionalPredecessor),
        candidateDecisionBody(),
        "utf8"
      );
      await runSuccessfulSourceCli([
        "activate",
        additionalPredecessor,
        "--alignment",
        "aligned",
        "--root",
        workspaceRoot
      ]);
      await runSuccessfulSourceCli([
        "archive",
        additionalPredecessor,
        "--root",
        workspaceRoot
      ]);
      const firstSuccessor = "use-later-combined-reallocation-owner.md";
      const secondSuccessor = "use-later-narrow-reallocation-owner.md";
      await fs.writeFile(
        decisionFilePath(workspaceRoot, firstSuccessor),
        candidateDecisionBody({
          relations: [
            { type: "重划", target: established.firstSuccessorRelativePath },
            { type: "重划", target: additionalPredecessor }
          ]
        }),
        "utf8"
      );
      await fs.writeFile(
        decisionFilePath(workspaceRoot, secondSuccessor),
        candidateDecisionBody({
          relations: [
            { type: "重划", target: established.firstSuccessorRelativePath }
          ]
        }),
        "utf8"
      );
      await runSuccessfulSourceCli([
        "evolve",
        "--successor",
        "aligned=" + firstSuccessor,
        "--successor",
        "aligned=" + secondSuccessor,
        "--root",
        workspaceRoot
      ]);
      assert.deepEqual(
        (await validateDecisionRecords({ workspaceRoot })).errors,
        []
      );
    }
  ));

test("discard rejects a split successor that would leave an open split", () =>
  withGitFixtureWorkspace("discard-open-split", async (workspaceRoot) => {
    const established = await establishClosedSplit(workspaceRoot);
    const discardedPath = decisionFilePath(
      workspaceRoot,
      established.alignedRelativePath
    );
    const discardedText = await fs.readFile(discardedPath, "utf8");
    const indexText = await fs.readFile(established.indexPath, "utf8");

    const discarded = await runSourceCli([
      "discard",
      established.alignedRelativePath,
      "--delete-recorded-decision",
      "--root",
      workspaceRoot
    ]);

    assert.equal(discarded.exitCode, 1);
    assert.match(
      discarded.stderr,
      /split target must have at least two direct/
    );
    assert.equal(await fs.readFile(discardedPath, "utf8"), discardedText);
    assert.equal(await fs.readFile(established.indexPath, "utf8"), indexText);
  }));

test("evolve discards one split successor when it replaces the complete closure", () =>
  withGitFixtureWorkspace(
    "evolve-replace-split-successor",
    async (workspaceRoot) => {
      const established = await establishClosedSplit(workspaceRoot);
      const replacementRelativePath = "replace-current-split-slice.md";
      await fs.writeFile(
        decisionFilePath(workspaceRoot, replacementRelativePath),
        candidateDecisionBody(),
        "utf8"
      );

      await runSuccessfulSourceCli([
        "evolve",
        "--successor",
        "unaligned=" + established.unalignedRelativePath,
        "--successor",
        "aligned=" + replacementRelativePath,
        "--relation",
        "拆分=" + established.coarseRelativePath,
        "--discard",
        established.alignedRelativePath,
        "--root",
        workspaceRoot
      ]);

      const index = await readIndex(established.indexPath);
      assert.equal(
        Object.hasOwn(index.entries, established.alignedRelativePath),
        false
      );
      assert.deepEqual(
        findIndexEntry(index, replacementRelativePath).relations,
        [{ type: "拆分", target: established.coarseRelativePath }]
      );
      assert.deepEqual(
        (await validateDecisionRecords({ workspaceRoot })).errors,
        []
      );
    }
  ));

test("evolve adds a split successor only when every existing successor is selected", () =>
  withGitFixtureWorkspace("evolve-extend-split", async (workspaceRoot) => {
    const established = await establishClosedSplit(workspaceRoot);
    const thirdRelativePath = "add-third-split-slice.md";
    await fs.writeFile(
      decisionFilePath(workspaceRoot, thirdRelativePath),
      candidateDecisionBody(),
      "utf8"
    );
    await runSuccessfulSourceCli([
      "evolve",
      "--successor",
      "aligned=" + established.alignedRelativePath,
      "--successor",
      "unaligned=" + established.unalignedRelativePath,
      "--successor",
      "aligned=" + thirdRelativePath,
      "--relation",
      "拆分=" + established.coarseRelativePath,
      "--root",
      workspaceRoot
    ]);
    const index = await readIndex(established.indexPath);
    assert.deepEqual(findIndexEntry(index, thirdRelativePath).relations, [
      {
        type: "拆分",
        target: established.coarseRelativePath
      }
    ]);
    assert.deepEqual(
      (await validateDecisionRecords({ workspaceRoot })).errors,
      []
    );
  }));

test("evolve rejects a discarded Decision ID selected as a successor without mutation", () =>
  withFixtureWorkspace(
    "evolve-discard-successor-conflict",
    async (workspaceRoot) => {
      const targetPath = decisionFilePath(workspaceRoot, currentRelativePath);
      const targetText = await fs.readFile(targetPath, "utf8");
      const indexPath = path.join(
        workspaceRoot,
        "docs",
        "decisions",
        "decision-index.json"
      );
      const indexText = await fs.readFile(indexPath, "utf8");

      const rejected = await runSourceCli([
        "evolve",
        "--successor",
        "aligned=" + currentRelativePath,
        "--discard",
        currentRelativePath,
        "--root",
        workspaceRoot
      ]);

      assert.equal(rejected.exitCode, 1);
      assert.match(
        rejected.stderr,
        /Discarded Decision ID must not also be a successor/
      );
      assert.equal(await fs.readFile(targetPath, "utf8"), targetText);
      assert.equal(await fs.readFile(indexPath, "utf8"), indexText);
    }
  ));

test("evolve rejects a split extension that omits an existing successor before writing", () =>
  withGitFixtureWorkspace("evolve-omit-split", async (workspaceRoot) => {
    const established = await establishClosedSplit(workspaceRoot);
    const thirdRelativePath = "omit-existing-split-slice.md";
    const thirdPath = decisionFilePath(workspaceRoot, thirdRelativePath);
    const thirdCandidate = candidateDecisionBody();
    await fs.writeFile(thirdPath, thirdCandidate, "utf8");
    const indexBefore = await fs.readFile(established.indexPath, "utf8");
    const rejected = await runSourceCli([
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
    const successorRelativePath = "use-single-split.md";
    await fs.writeFile(
      decisionFilePath(workspaceRoot, successorRelativePath),
      candidateDecisionBody({
        relations: [{ type: "拆分", target: currentRelativePath }]
      }),
      "utf8"
    );
    const rejected = await runSourceCli([
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
    const splitRelativePath = "use-mixed-split.md";
    const revisionRelativePath = "use-mixed-revision.md";
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
    const rejected = await runSourceCli([
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
    const firstRelativePath = "use-first-multiple.md";
    const secondRelativePath = "use-second-multiple.md";
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
    const rejected = await runSourceCli([
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
    const successorRelativePath = "use-undersized-merge.md";
    await fs.writeFile(
      decisionFilePath(workspaceRoot, successorRelativePath),
      candidateDecisionBody(),
      "utf8"
    );
    const rejected = await runSourceCli([
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

type ClosedSplit = {
  alignedRelativePath: string;
  coarseRelativePath: string;
  indexPath: string;
  unalignedRelativePath: string;
};

type ClosedReallocation = {
  firstSuccessorRelativePath: string;
  indexPath: string;
  secondPredecessorRelativePath: string;
  secondSuccessorRelativePath: string;
};

async function establishClosedReallocation(
  workspaceRoot: string
): Promise<ClosedReallocation> {
  const secondPredecessorRelativePath =
    await establishAdditionalActivePredecessor(workspaceRoot);
  const firstSuccessorRelativePath = "use-combined-reallocation-owner.md";
  const secondSuccessorRelativePath = "use-narrow-reallocation-owner.md";
  await fs.writeFile(
    decisionFilePath(workspaceRoot, firstSuccessorRelativePath),
    candidateDecisionBody({
      relations: [
        { type: "重划", target: currentRelativePath },
        { type: "重划", target: secondPredecessorRelativePath }
      ]
    }),
    "utf8"
  );
  await fs.writeFile(
    decisionFilePath(workspaceRoot, secondSuccessorRelativePath),
    candidateDecisionBody({
      relations: [{ type: "重划", target: currentRelativePath }]
    }),
    "utf8"
  );
  await runSuccessfulSourceCli([
    "evolve",
    "--successor",
    "aligned=" + firstSuccessorRelativePath,
    "--successor",
    "unaligned=" + secondSuccessorRelativePath,
    "--root",
    workspaceRoot
  ]);
  return {
    firstSuccessorRelativePath,
    indexPath: path.join(
      workspaceRoot,
      "docs",
      "decisions",
      "decision-index.json"
    ),
    secondPredecessorRelativePath,
    secondSuccessorRelativePath
  };
}

async function establishAdditionalActivePredecessor(
  workspaceRoot: string
): Promise<string> {
  const decisionId = "use-second-reallocation-predecessor.md";
  await fs.writeFile(
    decisionFilePath(workspaceRoot, decisionId),
    candidateDecisionBody(),
    "utf8"
  );
  await runSuccessfulSourceCli([
    "activate",
    decisionId,
    "--alignment",
    "aligned",
    "--root",
    workspaceRoot
  ]);
  return decisionId;
}

async function establishClosedSplit(
  workspaceRoot: string
): Promise<ClosedSplit> {
  const coarseRelativePath = "use-coarse-future-direction.md";
  await fs.writeFile(
    decisionFilePath(workspaceRoot, coarseRelativePath),
    candidateDecisionBody(),
    "utf8"
  );
  await runSuccessfulSourceCli([
    "activate",
    coarseRelativePath,
    "--alignment",
    "unaligned",
    "--root",
    workspaceRoot
  ]);
  commitWorkspace(workspaceRoot, "record coarse future direction");

  const alignedRelativePath = "keep-current-split-slice.md";
  const unalignedRelativePath = "keep-future-split-slice.md";
  await fs.writeFile(
    decisionFilePath(workspaceRoot, alignedRelativePath),
    candidateDecisionBody({
      relations: [{ type: "修订", target: currentRelativePath }]
    }),
    "utf8"
  );
  await fs.writeFile(
    decisionFilePath(workspaceRoot, unalignedRelativePath),
    candidateDecisionBody({
      relations: [{ type: "修订", target: archivedRelativePath }]
    }),
    "utf8"
  );
  await runSuccessfulSourceCli([
    "evolve",
    "--successor",
    "aligned=" + alignedRelativePath,
    "--successor",
    "unaligned=" + unalignedRelativePath,
    "--relation",
    "拆分=" + coarseRelativePath,
    "--root",
    workspaceRoot
  ]);
  return {
    alignedRelativePath,
    coarseRelativePath,
    indexPath: path.join(
      workspaceRoot,
      "docs",
      "decisions",
      "decision-index.json"
    ),
    unalignedRelativePath
  };
}
