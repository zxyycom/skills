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
  fileExists,
  findIndexEntry,
  initializeGitRepository,
  readIndex,
  runSourceCli,
  runSuccessfulSourceCli,
  withFixtureWorkspace
} from "./support.ts";

test("archive pauses before preserving an unrecorded established decision", () =>
  withFixtureWorkspace("archive-unrecorded", async (workspaceRoot) => {
    initializeGitRepository(workspaceRoot);
    const decisionsDirectory = path.join(workspaceRoot, "docs", "decisions");
    const indexPath = path.join(decisionsDirectory, "decision-index.json");
    const unrecordedRelativePath = "use-unrecorded-archive-target.md";
    const unrecordedPath = decisionFilePath(
      workspaceRoot,
      unrecordedRelativePath
    );
    await fs.writeFile(unrecordedPath, candidateDecisionBody(), "utf8");
    await runSuccessfulSourceCli([
      "activate",
      unrecordedRelativePath,
      "--alignment",
      "aligned",
      "--root",
      workspaceRoot
    ]);
    const decisionBeforeWarning = await fs.readFile(unrecordedPath, "utf8");
    const indexBeforeWarning = await fs.readFile(indexPath, "utf8");

    const paused = await runSourceCli([
      "archive",
      unrecordedRelativePath,
      "--root",
      workspaceRoot
    ]);
    assert.equal(paused.exitCode, 1);
    assert.match(paused.stderr, /command paused with warnings/);
    assert.match(
      paused.stderr,
      /confirm whether it should be preserved as independent decision history/
    );
    assert.equal(
      await fs.readFile(unrecordedPath, "utf8"),
      decisionBeforeWarning
    );
    assert.equal(await fs.readFile(indexPath, "utf8"), indexBeforeWarning);

    await fs.writeFile(
      path.join(workspaceRoot, ".git", "HEAD"),
      "invalid Git head\n",
      "utf8"
    );

    const archived = await runSourceCli([
      "archive",
      unrecordedRelativePath,
      "--keep-unrecorded-history",
      "--root",
      workspaceRoot
    ]);
    assert.equal(archived.exitCode, 0, archived.stderr);
    const archivedState = findIndexEntry(
      await readIndex(indexPath),
      unrecordedRelativePath
    );
    assert.equal(archivedState.status, "archived");
    assert.equal(archivedState.alignment, "aligned");
  }));
const unrecordedIntermediateRelativePath = "use-unrecorded-intermediate.md";

async function establishUnrecordedIntermediate(
  workspaceRoot: string
): Promise<{ indexPath: string; intermediatePath: string }> {
  initializeGitRepository(workspaceRoot);
  commitWorkspace(workspaceRoot);
  const decisionsDirectory = path.join(workspaceRoot, "docs", "decisions");
  const intermediatePath = decisionFilePath(
    workspaceRoot,
    unrecordedIntermediateRelativePath
  );
  await fs.writeFile(intermediatePath, candidateDecisionBody(), "utf8");
  await runSuccessfulSourceCli([
    "evolve",
    "--successor",
    "aligned=" + unrecordedIntermediateRelativePath,
    "--relation",
    "修订=" + currentRelativePath,
    "--root",
    workspaceRoot
  ]);
  return {
    indexPath: path.join(decisionsDirectory, "decision-index.json"),
    intermediatePath
  };
}

test("unrecorded decision evolution pauses until history is explicitly preserved", () =>
  withFixtureWorkspace("unrecorded-evolution-keep", async (workspaceRoot) => {
    const { indexPath, intermediatePath } =
      await establishUnrecordedIntermediate(workspaceRoot);
    const successorRelativePath = "use-preserved-unrecorded-history.md";
    const successorPath = decisionFilePath(
      workspaceRoot,
      successorRelativePath
    );
    const successorCandidate = candidateDecisionBody();
    await fs.writeFile(successorPath, successorCandidate, "utf8");
    const intermediateBeforeWarning = await fs.readFile(
      intermediatePath,
      "utf8"
    );
    const indexBeforeWarning = await fs.readFile(indexPath, "utf8");
    const paused = await runSourceCli([
      "activate",
      successorRelativePath,
      "--alignment",
      "aligned",
      "--relation",
      "修订=" + unrecordedIntermediateRelativePath,
      "--root",
      workspaceRoot
    ]);
    assert.equal(paused.exitCode, 1);
    assert.match(paused.stderr, /command paused with warnings/);
    assert.match(
      paused.stderr,
      new RegExp(
        "Predecessor decision " +
          unrecordedIntermediateRelativePath +
          " has not entered Git HEAD"
      )
    );
    assert.match(paused.stderr, /this 修订 relation should be preserved/);
    assert.match(paused.stderr, /--keep-unrecorded-history/);
    assert.equal(await fs.readFile(successorPath, "utf8"), successorCandidate);
    assert.equal(
      await fs.readFile(intermediatePath, "utf8"),
      intermediateBeforeWarning
    );
    assert.equal(await fs.readFile(indexPath, "utf8"), indexBeforeWarning);

    const preserved = await runSourceCli([
      "activate",
      successorRelativePath,
      "--alignment",
      "aligned",
      "--relation",
      "修订=" + unrecordedIntermediateRelativePath,
      "--keep-unrecorded-history",
      "--root",
      workspaceRoot
    ]);
    assert.equal(preserved.exitCode, 0, preserved.stderr);
    const preservedIndex = await readIndex(indexPath);
    assert.equal(
      findIndexEntry(preservedIndex, unrecordedIntermediateRelativePath).status,
      "archived"
    );
    assert.deepEqual(
      findIndexEntry(preservedIndex, successorRelativePath).relations,
      [{ type: "修订", target: unrecordedIntermediateRelativePath }]
    );
  }));

test("evolve pauses for an unrecorded archived direct predecessor", () =>
  withFixtureWorkspace(
    "unrecorded-archived-predecessor",
    async (workspaceRoot) => {
      initializeGitRepository(workspaceRoot);
      commitWorkspace(workspaceRoot);
      const decisionsDirectory = path.join(workspaceRoot, "docs", "decisions");
      const indexPath = path.join(decisionsDirectory, "decision-index.json");
      const predecessorRelativePath = "use-unrecorded-archived-target.md";
      await fs.writeFile(
        decisionFilePath(workspaceRoot, predecessorRelativePath),
        candidateDecisionBody(),
        "utf8"
      );
      await runSuccessfulSourceCli([
        "activate",
        predecessorRelativePath,
        "--alignment",
        "aligned",
        "--root",
        workspaceRoot
      ]);
      await runSuccessfulSourceCli([
        "archive",
        predecessorRelativePath,
        "--keep-unrecorded-history",
        "--root",
        workspaceRoot
      ]);
      const successorRelativePath = "evolve-from-unrecorded-archived-target.md";
      const successorPath = decisionFilePath(
        workspaceRoot,
        successorRelativePath
      );
      const successorCandidate = candidateDecisionBody({
        relations: [{ target: predecessorRelativePath, type: "替代" }]
      });
      await fs.writeFile(successorPath, successorCandidate, "utf8");
      const archivedPredecessorPath = decisionFilePath(
        workspaceRoot,
        "archive/" + predecessorRelativePath
      );
      const predecessorBefore = await fs.readFile(
        archivedPredecessorPath,
        "utf8"
      );
      const indexBefore = await fs.readFile(indexPath, "utf8");

      const paused = await runSourceCli([
        "evolve",
        "--successor",
        "aligned=" + successorRelativePath,
        "--root",
        workspaceRoot
      ]);
      assert.equal(paused.exitCode, 1);
      assert.match(paused.stderr, /command paused with warnings/);
      assert.match(
        paused.stderr,
        new RegExp(
          "Predecessor decision " +
            predecessorRelativePath +
            " has not entered Git HEAD"
        )
      );
      assert.match(paused.stderr, /this 替代 relation should be preserved/);
      assert.equal(
        await fs.readFile(successorPath, "utf8"),
        successorCandidate
      );
      assert.equal(
        await fs.readFile(archivedPredecessorPath, "utf8"),
        predecessorBefore
      );
      assert.equal(await fs.readFile(indexPath, "utf8"), indexBefore);

      const preserved = await runSourceCli([
        "evolve",
        "--successor",
        "aligned=" + successorRelativePath,
        "--keep-unrecorded-history",
        "--root",
        workspaceRoot
      ]);
      assert.equal(preserved.exitCode, 0, preserved.stderr);
      const index = await readIndex(indexPath);
      assert.equal(
        findIndexEntry(index, predecessorRelativePath).status,
        "archived"
      );
      assert.deepEqual(findIndexEntry(index, successorRelativePath).relations, [
        { type: "替代", target: predecessorRelativePath }
      ]);
    }
  ));

test("evolve lists unrecorded predecessor warnings in Decision ID order", () =>
  withFixtureWorkspace(
    "unrecorded-predecessor-warning-order",
    async (workspaceRoot) => {
      initializeGitRepository(workspaceRoot);
      commitWorkspace(workspaceRoot);
      const predecessorIds = [
        "z-unrecorded-predecessor.md",
        "a-unrecorded-predecessor.md"
      ];
      for (const decisionId of predecessorIds) {
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
      }
      const successorId = "merge-unrecorded-predecessors.md";
      await fs.writeFile(
        decisionFilePath(workspaceRoot, successorId),
        candidateDecisionBody({
          relations: [
            { target: predecessorIds[0], type: "归并" },
            { target: predecessorIds[1], type: "归并" }
          ]
        }),
        "utf8"
      );

      const paused = await runSourceCli([
        "evolve",
        "--successor",
        "aligned=" + successorId,
        "--root",
        workspaceRoot
      ]);

      assert.equal(paused.exitCode, 1);
      const firstWarning = paused.stderr.indexOf(
        "Predecessor decision a-unrecorded-predecessor.md"
      );
      const secondWarning = paused.stderr.indexOf(
        "Predecessor decision z-unrecorded-predecessor.md"
      );
      assert.ok(firstWarning >= 0);
      assert.ok(secondWarning > firstWarning);
    }
  ));

test("evolve collapses an unrecorded intermediate with explicit final relations", () =>
  withFixtureWorkspace(
    "unrecorded-evolution-collapse",
    async (workspaceRoot) => {
      const { indexPath, intermediatePath } =
        await establishUnrecordedIntermediate(workspaceRoot);
      const beforeCollapse = await readIndex(indexPath);
      assert.equal(
        findIndexEntry(beforeCollapse, currentRelativePath).status,
        "archived"
      );
      assert.deepEqual(
        findIndexEntry(beforeCollapse, unrecordedIntermediateRelativePath)
          .relations,
        [{ type: "修订", target: currentRelativePath }]
      );
      const successorRelativePath = "use-collapsed-unrecorded-history.md";
      const successorPath = decisionFilePath(
        workspaceRoot,
        successorRelativePath
      );
      await fs.writeFile(successorPath, candidateDecisionBody(), "utf8");
      const collapsed = await runSourceCli([
        "evolve",
        "--successor",
        "aligned=" + successorRelativePath,
        "--collapse-unrecorded",
        unrecordedIntermediateRelativePath,
        "--relation",
        "修订=" + currentRelativePath,
        "--root",
        workspaceRoot
      ]);
      assert.equal(collapsed.exitCode, 0, collapsed.stderr);
      assert.match(collapsed.stdout, /collapsed unrecorded predecessor/);
      assert.equal(await fileExists(intermediatePath), false);
      const collapsedIndex = await readIndex(indexPath);
      assert.equal(
        Object.hasOwn(
          collapsedIndex.entries,
          unrecordedIntermediateRelativePath
        ),
        false
      );
      assert.deepEqual(
        findIndexEntry(collapsedIndex, successorRelativePath).relations,
        [{ type: "修订", target: currentRelativePath }]
      );
      assert.deepEqual(
        (await validateDecisionRecords({ workspaceRoot })).errors,
        []
      );
    }
  ));

test("evolve collapse rejects an implicit empty final relation selection", () =>
  withFixtureWorkspace(
    "unrecorded-evolution-implicit-empty",
    async (workspaceRoot) => {
      const { indexPath, intermediatePath } =
        await establishUnrecordedIntermediate(workspaceRoot);
      const successorRelativePath = "reject-implicit-empty-collapse.md";
      const successorPath = decisionFilePath(
        workspaceRoot,
        successorRelativePath
      );
      const successorCandidate = candidateDecisionBody();
      await fs.writeFile(successorPath, successorCandidate, "utf8");
      const intermediateBefore = await fs.readFile(intermediatePath, "utf8");
      const indexBefore = await fs.readFile(indexPath, "utf8");
      const rejected = await runSourceCli([
        "evolve",
        "--successor",
        "aligned=" + successorRelativePath,
        "--collapse-unrecorded",
        unrecordedIntermediateRelativePath,
        "--root",
        workspaceRoot
      ]);
      assert.equal(rejected.exitCode, 1);
      assert.match(rejected.stderr, /Use --clear-relations/);
      assert.equal(
        await fs.readFile(successorPath, "utf8"),
        successorCandidate
      );
      assert.equal(
        await fs.readFile(intermediatePath, "utf8"),
        intermediateBefore
      );
      assert.equal(await fs.readFile(indexPath, "utf8"), indexBefore);
    }
  ));

test("evolve collapse accepts an explicitly empty final relation set", () =>
  withFixtureWorkspace(
    "unrecorded-evolution-empty-relations",
    async (workspaceRoot) => {
      const { indexPath, intermediatePath } =
        await establishUnrecordedIntermediate(workspaceRoot);
      const successorRelativePath = "drop-collapsed-upstream-history.md";
      const successorPath = decisionFilePath(
        workspaceRoot,
        successorRelativePath
      );
      await fs.writeFile(successorPath, candidateDecisionBody(), "utf8");
      const collapsed = await runSourceCli([
        "evolve",
        "--successor",
        "aligned=" + successorRelativePath,
        "--collapse-unrecorded",
        unrecordedIntermediateRelativePath,
        "--clear-relations",
        "--root",
        workspaceRoot
      ]);
      assert.equal(collapsed.exitCode, 0, collapsed.stderr);
      assert.equal(await fileExists(intermediatePath), false);
      assert.deepEqual(
        findIndexEntry(await readIndex(indexPath), successorRelativePath)
          .relations,
        []
      );
    }
  ));

test("evolve collapse rejects archived relations outside the intermediate boundary", () =>
  withFixtureWorkspace(
    "unrecorded-evolution-relation-boundary",
    async (workspaceRoot) => {
      const { indexPath, intermediatePath } =
        await establishUnrecordedIntermediate(workspaceRoot);
      const successorRelativePath = "reject-unrelated-collapsed-upstream.md";
      const successorPath = decisionFilePath(
        workspaceRoot,
        successorRelativePath
      );
      const successorCandidate = candidateDecisionBody();
      await fs.writeFile(successorPath, successorCandidate, "utf8");
      const intermediateBefore = await fs.readFile(intermediatePath, "utf8");
      const indexBefore = await fs.readFile(indexPath, "utf8");
      const rejected = await runSourceCli([
        "evolve",
        "--successor",
        "aligned=" + successorRelativePath,
        "--collapse-unrecorded",
        unrecordedIntermediateRelativePath,
        "--relation",
        "修订=" + archivedRelativePath,
        "--root",
        workspaceRoot
      ]);
      assert.equal(rejected.exitCode, 1);
      assert.match(
        rejected.stderr,
        /must be a direct predecessor of the collapsed decision/
      );
      assert.equal(
        await fs.readFile(successorPath, "utf8"),
        successorCandidate
      );
      assert.equal(
        await fs.readFile(intermediatePath, "utf8"),
        intermediateBefore
      );
      assert.equal(await fs.readFile(indexPath, "utf8"), indexBefore);
    }
  ));

test("evolve collapse rejects a predecessor recorded in Git HEAD", () =>
  withFixtureWorkspace("recorded-evolution-collapse", async (workspaceRoot) => {
    const { indexPath, intermediatePath } =
      await establishUnrecordedIntermediate(workspaceRoot);
    commitWorkspace(workspaceRoot, "record intermediate decision");
    const successorRelativePath = "reject-recorded-collapse.md";
    const successorPath = decisionFilePath(
      workspaceRoot,
      successorRelativePath
    );
    const successorCandidate = candidateDecisionBody();
    await fs.writeFile(successorPath, successorCandidate, "utf8");
    const intermediateBefore = await fs.readFile(intermediatePath, "utf8");
    const indexBefore = await fs.readFile(indexPath, "utf8");
    const rejected = await runSourceCli([
      "evolve",
      "--successor",
      "aligned=" + successorRelativePath,
      "--collapse-unrecorded",
      unrecordedIntermediateRelativePath,
      "--relation",
      "修订=" + currentRelativePath,
      "--root",
      workspaceRoot
    ]);
    assert.equal(rejected.exitCode, 1);
    assert.match(rejected.stderr, /recorded in Git HEAD/);
    assert.equal(await fs.readFile(successorPath, "utf8"), successorCandidate);
    assert.equal(
      await fs.readFile(intermediatePath, "utf8"),
      intermediateBefore
    );
    assert.equal(await fs.readFile(indexPath, "utf8"), indexBefore);
  }));

test("evolve collapse rejects a predecessor referenced by another candidate", () =>
  withFixtureWorkspace(
    "referenced-evolution-collapse",
    async (workspaceRoot) => {
      const { indexPath, intermediatePath } =
        await establishUnrecordedIntermediate(workspaceRoot);
      const referencingRelativePath = "reference-unrecorded-intermediate.md";
      const referencingPath = decisionFilePath(
        workspaceRoot,
        referencingRelativePath
      );
      const referencingCandidate = candidateDecisionBody({
        relations: [
          { type: "修订", target: unrecordedIntermediateRelativePath }
        ]
      });
      await fs.writeFile(referencingPath, referencingCandidate, "utf8");
      const successorRelativePath = "reject-referenced-collapse.md";
      const successorPath = decisionFilePath(
        workspaceRoot,
        successorRelativePath
      );
      const successorCandidate = candidateDecisionBody();
      await fs.writeFile(successorPath, successorCandidate, "utf8");
      const intermediateBefore = await fs.readFile(intermediatePath, "utf8");
      const indexBefore = await fs.readFile(indexPath, "utf8");
      const rejected = await runSourceCli([
        "evolve",
        "--successor",
        "aligned=" + successorRelativePath,
        "--collapse-unrecorded",
        unrecordedIntermediateRelativePath,
        "--relation",
        "修订=" + currentRelativePath,
        "--root",
        workspaceRoot
      ]);
      assert.equal(rejected.exitCode, 1);
      assert.match(
        rejected.stderr,
        /Cannot collapse decision while it is still referenced/
      );
      assert.ok(rejected.stderr.includes(referencingRelativePath));
      assert.equal(
        await fs.readFile(successorPath, "utf8"),
        successorCandidate
      );
      assert.equal(
        await fs.readFile(referencingPath, "utf8"),
        referencingCandidate
      );
      assert.equal(
        await fs.readFile(intermediatePath, "utf8"),
        intermediateBefore
      );
      assert.equal(await fs.readFile(indexPath, "utf8"), indexBefore);
    }
  ));
