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
  initializeGitRepository,
  readIndex,
  runSourceCli,
  runSuccessfulSourceCli,
  traceDecision,
  withFixtureWorkspace
} from "./support.ts";

test("activate establishes candidate source relations and archives their active targets", () => (
  withFixtureWorkspace("activate-source-relations", async (workspaceRoot) => {
  initializeGitRepository(workspaceRoot);
  commitWorkspace(workspaceRoot);
  const successorRelativePath =
    "decision-records/use-candidate-source-relation.md";
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

  const index = await readIndex(path.join(
    workspaceRoot,
    "docs",
    "decisions",
    "decision-index.json"
  ));
  assert.equal(findIndexEntry(index, currentRelativePath).status, "archived");
  assert.deepEqual(findIndexEntry(index, successorRelativePath).relations, [{
    type: "修订",
    target: currentRelativePath
  }]);
  })
));

test("activate relation replacement overrides rather than merges candidate relations", () => (
  withFixtureWorkspace("activate-relation-replace", async (workspaceRoot) => {
  const parallelRelativePath =
    "decision-records/use-replacement-predecessor.md";
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
  const successorRelativePath =
    "decision-records/use-replaced-candidate-relations.md";
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

  const index = await readIndex(path.join(
    workspaceRoot,
    "docs",
    "decisions",
    "decision-index.json"
  ));
  assert.equal(findIndexEntry(index, currentRelativePath).status, "active");
  assert.equal(findIndexEntry(index, parallelRelativePath).status, "archived");
  assert.deepEqual(findIndexEntry(index, successorRelativePath).relations, [{
    type: "替代",
    target: parallelRelativePath
  }]);
  })
));

test("activate clear-relations explicitly replaces candidate relations with an empty set", () => (
  withFixtureWorkspace("activate-relation-clear", async (workspaceRoot) => {
  const successorRelativePath =
    "decision-records/use-cleared-candidate-relations.md";
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

  const index = await readIndex(path.join(
    workspaceRoot,
    "docs",
    "decisions",
    "decision-index.json"
  ));
  assert.equal(findIndexEntry(index, currentRelativePath).status, "active");
  assert.deepEqual(findIndexEntry(index, successorRelativePath).relations, []);
  })
));

test("evolve establishes one successor while preserving archived predecessors", () => (
  withFixtureWorkspace("evolve-archived-predecessor", async (workspaceRoot) => {
  const successorRelativePath =
    "decision-records/use-active-and-archived-predecessors.md";
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

  const index = await readIndex(path.join(
    workspaceRoot,
    "docs",
    "decisions",
    "decision-index.json"
  ));
  assert.equal(findIndexEntry(index, currentRelativePath).status, "archived");
  assert.equal(findIndexEntry(index, archivedRelativePath).status, "archived");
  assert.deepEqual(findIndexEntry(index, successorRelativePath).relations, [
    { type: "修订", target: currentRelativePath },
    { type: "替代", target: archivedRelativePath }
  ]);
  })
));

test("evolve replaces established relations while preserving body and lifecycle fields", () => (
  withFixtureWorkspace("evolve-established-replace", async (workspaceRoot) => {
  const successorRelativePath =
    "decision-records/replace-established-relations.md";
  const successorPath = decisionFilePath(workspaceRoot, successorRelativePath);
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
  const activeTargetRelativePath =
    "decision-records/use-active-replacement-target.md";
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
  const removedTargetBefore = findIndexEntry(beforeIndex, currentRelativePath);
  assert.equal(removedTargetBefore.status, "archived");
  assert.equal(findIndexEntry(beforeIndex, activeTargetRelativePath).status, "active");

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
  assert.equal(afterText.slice(afterText.indexOf("## 目的")), beforeText.slice(
    beforeText.indexOf("## 目的")
  ));
  assert.deepEqual(afterState.relations, [{
    type: "替代",
    target: activeTargetRelativePath
  }]);
  assert.deepEqual(
    findIndexEntry(afterIndex, currentRelativePath),
    removedTargetBefore
  );
  assert.equal(
    findIndexEntry(afterIndex, activeTargetRelativePath).status,
    "archived"
  );
  })
));

test("evolve keeps an archived established successor archived during relation replacement", () => (
  withFixtureWorkspace("evolve-archived-successor", async (workspaceRoot) => {
  const successorRelativePath =
    "decision-records/keep-archived-successor-state.md";
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
  const before = findIndexEntry(await readIndex(indexPath), successorRelativePath);

  await runSuccessfulSourceCli([
    "evolve",
    "--successor",
    "unaligned=" + successorRelativePath,
    "--relation",
    "修订=" + archivedRelativePath,
    "--root",
    workspaceRoot
  ]);
  const after = findIndexEntry(await readIndex(indexPath), successorRelativePath);
  assert.equal(after.status, "archived");
  assert.equal(after.alignment, before.alignment);
  assert.equal(after.createdAt, before.createdAt);
  assert.deepEqual(after.relations, [{
    type: "修订",
    target: archivedRelativePath
  }]);
  })
));

test("evolve rejects established successor alignment mismatches without mutation", () => (
  withFixtureWorkspace("evolve-alignment-confirmation", async (workspaceRoot) => {
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
  })
));

test("evolve rejects historical archived successors with null alignment", () => (
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
  })
));

test("activate rejects relation replacement for established decisions", () => (
  withFixtureWorkspace("activate-established-relations", async (workspaceRoot) => {
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
  })
));

test("evolve performs a closed split with independently aligned successors", () => (
  withFixtureWorkspace("evolve-closed-split", async (workspaceRoot) => {
  const established = await establishClosedSplit(workspaceRoot);
  const index = await readIndex(established.indexPath);
  const coarseState = findIndexEntry(index, established.coarseRelativePath);
  const alignedState = findIndexEntry(index, established.alignedRelativePath);
  const unalignedState = findIndexEntry(index, established.unalignedRelativePath);
  assert.equal(coarseState.status, "archived");
  assert.equal(findIndexEntry(index, currentRelativePath).status, "active");
  assert.equal(alignedState.alignment, "aligned");
  assert.equal(unalignedState.alignment, "unaligned");
  assert.equal(alignedState.createdAt, unalignedState.createdAt);
  assert.deepEqual(alignedState.relations, [{
    type: "拆分",
    target: established.coarseRelativePath
  }]);
  assert.deepEqual(unalignedState.relations, [{
    type: "拆分",
    target: established.coarseRelativePath
  }]);

  const traced = await traceDecision(
    established.coarseRelativePath,
    ["--direction", "successors", "--depth", "1"],
    workspaceRoot
  );
  assert.match(traced, /keep-current-split-slice/);
  assert.match(traced, /keep-future-split-slice/);
  })
));

test("evolve adds a split successor only when every existing successor is selected", () => (
  withFixtureWorkspace("evolve-extend-split", async (workspaceRoot) => {
  const established = await establishClosedSplit(workspaceRoot);
  const thirdRelativePath = "decision-records/add-third-split-slice.md";
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
  assert.deepEqual(findIndexEntry(index, thirdRelativePath).relations, [{
    type: "拆分",
    target: established.coarseRelativePath
  }]);
  assert.deepEqual((await validateDecisionRecords({ workspaceRoot })).errors, []);
  })
));

test("evolve rejects a split extension that omits an existing successor before writing", () => (
  withFixtureWorkspace("evolve-omit-split", async (workspaceRoot) => {
  const established = await establishClosedSplit(workspaceRoot);
  const thirdRelativePath = "decision-records/omit-existing-split-slice.md";
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
  })
));

test("evolve rejects one selected split successor", () => (
  withFixtureWorkspace("evolve-single-split", async (workspaceRoot) => {
  const successorRelativePath = "decision-records/use-single-split.md";
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
  })
));

test("evolve rejects mixed split and non-split successor relations", () => (
  withFixtureWorkspace("evolve-mixed-split", async (workspaceRoot) => {
  const splitRelativePath = "decision-records/use-mixed-split.md";
  const revisionRelativePath = "decision-records/use-mixed-revision.md";
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
  })
));

test("evolve rejects unsupported multi-successor shapes without split relations", () => (
  withFixtureWorkspace("evolve-unsupported-multiple", async (workspaceRoot) => {
  const firstRelativePath = "decision-records/use-first-multiple.md";
  const secondRelativePath = "decision-records/use-second-multiple.md";
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
  })
));

test("evolve rejects a pure merge with fewer than two predecessors", () => (
  withFixtureWorkspace("evolve-undersized-merge", async (workspaceRoot) => {
  const successorRelativePath = "decision-records/use-undersized-merge.md";
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
  })
));

type ClosedSplit = {
  alignedRelativePath: string;
  coarseRelativePath: string;
  indexPath: string;
  unalignedRelativePath: string;
};

async function establishClosedSplit(workspaceRoot: string): Promise<ClosedSplit> {
  initializeGitRepository(workspaceRoot);
  commitWorkspace(workspaceRoot);
  const coarseRelativePath =
    "decision-records/use-coarse-future-direction.md";
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

  const alignedRelativePath =
    "decision-records/keep-current-split-slice.md";
  const unalignedRelativePath =
    "decision-records/keep-future-split-slice.md";
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
