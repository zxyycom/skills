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
  withFixtureWorkspace,
  withGitFixtureWorkspace
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
  withGitFixtureWorkspace(
    "unrecorded-evolution-keep",
    async (workspaceRoot) => {
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
      assert.equal(
        await fs.readFile(successorPath, "utf8"),
        successorCandidate
      );
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
        findIndexEntry(preservedIndex, unrecordedIntermediateRelativePath)
          .status,
        "archived"
      );
      assert.deepEqual(
        findIndexEntry(preservedIndex, successorRelativePath).relations,
        [{ type: "修订", target: unrecordedIntermediateRelativePath }]
      );
    }
  ));

test("evolve pauses for an unrecorded archived direct predecessor", () =>
  withGitFixtureWorkspace(
    "unrecorded-archived-predecessor",
    async (workspaceRoot) => {
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
  withGitFixtureWorkspace(
    "unrecorded-predecessor-warning-order",
    async (workspaceRoot) => {
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

test("evolve discards an intermediate with explicit final relations", () =>
  withFixtureWorkspace(
    "unrecorded-evolution-discard",
    async (workspaceRoot) => {
      const { indexPath, intermediatePath } =
        await establishUnrecordedIntermediate(workspaceRoot);
      const beforeDiscard = await readIndex(indexPath);
      assert.equal(
        findIndexEntry(beforeDiscard, currentRelativePath).status,
        "archived"
      );
      assert.deepEqual(
        findIndexEntry(beforeDiscard, unrecordedIntermediateRelativePath)
          .relations,
        [{ type: "修订", target: currentRelativePath }]
      );
      const successorRelativePath = "use-discard-unrecorded-history.md";
      const successorPath = decisionFilePath(
        workspaceRoot,
        successorRelativePath
      );
      await fs.writeFile(successorPath, candidateDecisionBody(), "utf8");
      const discarded = await runSourceCli([
        "evolve",
        "--successor",
        "aligned=" + successorRelativePath,
        "--discard",
        unrecordedIntermediateRelativePath,
        "--relation",
        "修订=" + currentRelativePath,
        "--delete-recorded-decision",
        "--root",
        workspaceRoot
      ]);
      assert.equal(discarded.exitCode, 0, discarded.stderr);
      assert.match(
        discarded.stdout,
        /discarded decision use-unrecorded-intermediate\.md/
      );
      assert.equal(await fileExists(intermediatePath), false);
      const discardedIndex = await readIndex(indexPath);
      assert.equal(
        Object.hasOwn(
          discardedIndex.entries,
          unrecordedIntermediateRelativePath
        ),
        false
      );
      assert.deepEqual(
        findIndexEntry(discardedIndex, successorRelativePath).relations,
        [{ type: "修订", target: currentRelativePath }]
      );
      assert.deepEqual(
        (await validateDecisionRecords({ workspaceRoot })).errors,
        []
      );
    }
  ));

test("evolve discard accepts source-empty final relations", () =>
  withFixtureWorkspace(
    "unrecorded-evolution-implicit-empty",
    async (workspaceRoot) => {
      const { indexPath, intermediatePath } =
        await establishUnrecordedIntermediate(workspaceRoot);
      const successorRelativePath = "accept-source-empty-discard.md";
      const successorPath = decisionFilePath(
        workspaceRoot,
        successorRelativePath
      );
      const successorCandidate = candidateDecisionBody();
      await fs.writeFile(successorPath, successorCandidate, "utf8");
      const discarded = await runSourceCli([
        "evolve",
        "--successor",
        "aligned=" + successorRelativePath,
        "--discard",
        unrecordedIntermediateRelativePath,
        "--delete-recorded-decision",
        "--root",
        workspaceRoot
      ]);
      assert.equal(discarded.exitCode, 0, discarded.stderr);
      assert.equal(await fileExists(intermediatePath), false);
      assert.deepEqual(
        findIndexEntry(await readIndex(indexPath), successorRelativePath)
          .relations,
        []
      );
    }
  ));

test("evolve discard accepts an explicitly empty final relation set", () =>
  withFixtureWorkspace(
    "unrecorded-evolution-empty-relations",
    async (workspaceRoot) => {
      const { indexPath, intermediatePath } =
        await establishUnrecordedIntermediate(workspaceRoot);
      const successorRelativePath = "drop-discard-upstream-history.md";
      const successorPath = decisionFilePath(
        workspaceRoot,
        successorRelativePath
      );
      await fs.writeFile(successorPath, candidateDecisionBody(), "utf8");
      const discarded = await runSourceCli([
        "evolve",
        "--successor",
        "aligned=" + successorRelativePath,
        "--discard",
        unrecordedIntermediateRelativePath,
        "--clear-relations",
        "--delete-recorded-decision",
        "--root",
        workspaceRoot
      ]);
      assert.equal(discarded.exitCode, 0, discarded.stderr);
      assert.equal(await fileExists(intermediatePath), false);
      assert.deepEqual(
        findIndexEntry(await readIndex(indexPath), successorRelativePath)
          .relations,
        []
      );
    }
  ));

test("evolve discard accepts an unrelated archived final relation", () =>
  withFixtureWorkspace(
    "unrecorded-evolution-relation-boundary",
    async (workspaceRoot) => {
      const { indexPath, intermediatePath } =
        await establishUnrecordedIntermediate(workspaceRoot);
      const successorRelativePath = "accept-unrelated-discard-upstream.md";
      const successorPath = decisionFilePath(
        workspaceRoot,
        successorRelativePath
      );
      await fs.writeFile(successorPath, candidateDecisionBody(), "utf8");
      const discarded = await runSourceCli([
        "evolve",
        "--successor",
        "aligned=" + successorRelativePath,
        "--discard",
        unrecordedIntermediateRelativePath,
        "--relation",
        "修订=" + archivedRelativePath,
        "--delete-recorded-decision",
        "--root",
        workspaceRoot
      ]);
      assert.equal(discarded.exitCode, 0, discarded.stderr);
      assert.equal(await fileExists(intermediatePath), false);
      assert.deepEqual(
        findIndexEntry(await readIndex(indexPath), successorRelativePath)
          .relations,
        [{ type: "修订", target: archivedRelativePath }]
      );
    }
  ));

test("evolve discard pauses before deleting a recorded decision", () =>
  withGitFixtureWorkspace(
    "recorded-evolution-discard",
    async (workspaceRoot) => {
      const { indexPath, intermediatePath } =
        await establishUnrecordedIntermediate(workspaceRoot);
      commitWorkspace(workspaceRoot, "record intermediate decision");
      const successorRelativePath = "reject-recorded-discard.md";
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
        "--discard",
        unrecordedIntermediateRelativePath,
        "--relation",
        "修订=" + currentRelativePath,
        "--root",
        workspaceRoot
      ]);
      assert.equal(rejected.exitCode, 1);
      assert.match(rejected.stderr, /has entered Git HEAD/);
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

test("evolve discard flag deletes a recorded decision without reading Git HEAD", () =>
  withGitFixtureWorkspace(
    "recorded-evolution-discard-flag-corrupt-head",
    async (workspaceRoot) => {
      const { indexPath, intermediatePath } =
        await establishUnrecordedIntermediate(workspaceRoot);
      commitWorkspace(workspaceRoot, "record intermediate decision");
      const successorRelativePath = "use-flagged-recorded-discard.md";
      const successorPath = decisionFilePath(
        workspaceRoot,
        successorRelativePath
      );
      await fs.writeFile(successorPath, candidateDecisionBody(), "utf8");
      await fs.writeFile(
        path.join(workspaceRoot, ".git", "HEAD"),
        "invalid Git head\n",
        "utf8"
      );

      const discarded = await runSourceCli([
        "evolve",
        "--successor",
        "aligned=" + successorRelativePath,
        "--discard",
        unrecordedIntermediateRelativePath,
        "--delete-recorded-decision",
        "--root",
        workspaceRoot
      ]);
      assert.equal(discarded.exitCode, 0, discarded.stderr);
      assert.equal(await fileExists(intermediatePath), false);
      assert.deepEqual(
        findIndexEntry(await readIndex(indexPath), successorRelativePath)
          .relations,
        []
      );
    }
  ));

test("evolve discard flag still pauses for an unrecorded final predecessor", () =>
  withGitFixtureWorkspace(
    "recorded-evolution-discard-flag-unrecorded-relation",
    async (workspaceRoot) => {
      const { indexPath, intermediatePath } =
        await establishUnrecordedIntermediate(workspaceRoot);
      commitWorkspace(workspaceRoot, "record intermediate decision");
      const unrecordedPredecessorId = "use-unrecorded-final-predecessor.md";
      const unrecordedPredecessorPath = decisionFilePath(
        workspaceRoot,
        unrecordedPredecessorId
      );
      await fs.writeFile(
        unrecordedPredecessorPath,
        candidateDecisionBody(),
        "utf8"
      );
      await runSuccessfulSourceCli([
        "activate",
        unrecordedPredecessorId,
        "--alignment",
        "aligned",
        "--root",
        workspaceRoot
      ]);
      const successorRelativePath = "use-flagged-unrecorded-relation.md";
      const successorPath = decisionFilePath(
        workspaceRoot,
        successorRelativePath
      );
      const successorCandidate = candidateDecisionBody();
      await fs.writeFile(successorPath, successorCandidate, "utf8");
      const intermediateBefore = await fs.readFile(intermediatePath, "utf8");
      const predecessorBefore = await fs.readFile(
        unrecordedPredecessorPath,
        "utf8"
      );
      const indexBefore = await fs.readFile(indexPath, "utf8");

      const paused = await runSourceCli([
        "evolve",
        "--successor",
        "aligned=" + successorRelativePath,
        "--discard",
        unrecordedIntermediateRelativePath,
        "--delete-recorded-decision",
        "--relation",
        "修订=" + unrecordedPredecessorId,
        "--root",
        workspaceRoot
      ]);
      assert.equal(paused.exitCode, 1);
      assert.match(
        paused.stderr,
        new RegExp(
          "Predecessor decision " +
            unrecordedPredecessorId +
            " has not entered Git HEAD"
        )
      );
      assert.match(paused.stderr, /--keep-unrecorded-history/);
      assert.equal(
        await fs.readFile(successorPath, "utf8"),
        successorCandidate
      );
      assert.equal(
        await fs.readFile(intermediatePath, "utf8"),
        intermediateBefore
      );
      assert.equal(
        await fs.readFile(unrecordedPredecessorPath, "utf8"),
        predecessorBefore
      );
      assert.equal(await fs.readFile(indexPath, "utf8"), indexBefore);
    }
  ));

test("evolve discard rejects a predecessor referenced by another candidate", () =>
  withFixtureWorkspace(
    "referenced-evolution-discard",
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
      const successorRelativePath = "reject-referenced-discard.md";
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
        "--discard",
        unrecordedIntermediateRelativePath,
        "--relation",
        "修订=" + currentRelativePath,
        "--delete-recorded-decision",
        "--root",
        workspaceRoot
      ]);
      assert.equal(rejected.exitCode, 1);
      assert.match(
        rejected.stderr,
        /Cannot discard decision while it is still referenced/
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
