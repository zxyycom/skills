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

test("archive pauses before preserving an unrecorded established decision", () => (
  withFixtureWorkspace("archive-unrecorded", async (workspaceRoot) => {
  initializeGitRepository(workspaceRoot);
  commitWorkspace(workspaceRoot);
  const decisionsDirectory = path.join(workspaceRoot, "docs", "decisions");
  const indexPath = path.join(decisionsDirectory, "decision-index.json");
  const unrecordedRelativePath =
    "decision-records/use-unrecorded-archive-target.md";
  const unrecordedPath = decisionFilePath(workspaceRoot, unrecordedRelativePath);
  await fs.writeFile(
    unrecordedPath,
    candidateDecisionBody(),
    "utf8"
  );
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
  assert.match(paused.stderr, /meaningless evolution history/);
  assert.equal(await fs.readFile(unrecordedPath, "utf8"), decisionBeforeWarning);
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
  })
));
const unrecordedIntermediateRelativePath =
  "decision-records/use-unrecorded-intermediate.md";

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
  await fs.writeFile(
    intermediatePath,
    candidateDecisionBody(),
    "utf8"
  );
  await runSuccessfulSourceCli([
    "evolve",
    unrecordedIntermediateRelativePath,
    "--alignment",
    "aligned",
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

test("unrecorded decision evolution pauses until history is explicitly preserved", () => (
  withFixtureWorkspace("unrecorded-evolution-keep", async (workspaceRoot) => {
  const { indexPath, intermediatePath } = await establishUnrecordedIntermediate(
    workspaceRoot
  );
  const successorRelativePath =
    "decision-records/use-preserved-unrecorded-history.md";
  const successorPath = decisionFilePath(workspaceRoot, successorRelativePath);
  const successorCandidate = candidateDecisionBody();
  await fs.writeFile(successorPath, successorCandidate, "utf8");
  const intermediateBeforeWarning = await fs.readFile(intermediatePath, "utf8");
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
  assert.match(paused.stderr, /have not entered Git HEAD/);
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
  })
));

test("evolve collapses an unrecorded intermediate with explicit final relations", () => (
  withFixtureWorkspace("unrecorded-evolution-collapse", async (workspaceRoot) => {
  const { indexPath, intermediatePath } = await establishUnrecordedIntermediate(
    workspaceRoot
  );
  const successorRelativePath =
    "decision-records/use-collapsed-unrecorded-history.md";
  const successorPath = decisionFilePath(workspaceRoot, successorRelativePath);
  await fs.writeFile(
    successorPath,
    candidateDecisionBody(),
    "utf8"
  );
  const collapsed = await runSourceCli([
    "evolve",
    successorRelativePath,
    "--alignment",
    "aligned",
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
  assert.deepEqual((await validateDecisionRecords({ workspaceRoot })).errors, []);
  })
));

test("evolve collapse accepts an empty final relation set", () => (
  withFixtureWorkspace("unrecorded-evolution-empty-relations", async (workspaceRoot) => {
  const { indexPath, intermediatePath } = await establishUnrecordedIntermediate(
    workspaceRoot
  );
  const successorRelativePath =
    "decision-records/drop-collapsed-upstream-history.md";
  const successorPath = decisionFilePath(workspaceRoot, successorRelativePath);
  await fs.writeFile(
    successorPath,
    candidateDecisionBody(),
    "utf8"
  );
  const collapsed = await runSourceCli([
    "evolve",
    successorRelativePath,
    "--alignment",
    "aligned",
    "--collapse-unrecorded",
    unrecordedIntermediateRelativePath,
    "--root",
    workspaceRoot
  ]);
  assert.equal(collapsed.exitCode, 0, collapsed.stderr);
  assert.equal(await fileExists(intermediatePath), false);
  assert.deepEqual(
    findIndexEntry(await readIndex(indexPath), successorRelativePath).relations,
    []
  );
  })
));

test("evolve collapse rejects archived relations outside the intermediate boundary", () => (
  withFixtureWorkspace("unrecorded-evolution-relation-boundary", async (workspaceRoot) => {
  const { indexPath, intermediatePath } = await establishUnrecordedIntermediate(
    workspaceRoot
  );
  const successorRelativePath =
    "decision-records/reject-unrelated-collapsed-upstream.md";
  const successorPath = decisionFilePath(workspaceRoot, successorRelativePath);
  const successorCandidate = candidateDecisionBody();
  await fs.writeFile(successorPath, successorCandidate, "utf8");
  const intermediateBefore = await fs.readFile(intermediatePath, "utf8");
  const indexBefore = await fs.readFile(indexPath, "utf8");
  const rejected = await runSourceCli([
    "evolve",
    successorRelativePath,
    "--alignment",
    "aligned",
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
    /unless it is a direct predecessor of the collapsed decision/
  );
  assert.equal(await fs.readFile(successorPath, "utf8"), successorCandidate);
  assert.equal(await fs.readFile(intermediatePath, "utf8"), intermediateBefore);
  assert.equal(await fs.readFile(indexPath, "utf8"), indexBefore);
  })
));

test("evolve collapse rejects a predecessor recorded in Git HEAD", () => (
  withFixtureWorkspace("recorded-evolution-collapse", async (workspaceRoot) => {
  const { indexPath, intermediatePath } = await establishUnrecordedIntermediate(
    workspaceRoot
  );
  commitWorkspace(workspaceRoot, "record intermediate decision");
  const successorRelativePath =
    "decision-records/reject-recorded-collapse.md";
  const successorPath = decisionFilePath(workspaceRoot, successorRelativePath);
  const successorCandidate = candidateDecisionBody();
  await fs.writeFile(successorPath, successorCandidate, "utf8");
  const intermediateBefore = await fs.readFile(intermediatePath, "utf8");
  const indexBefore = await fs.readFile(indexPath, "utf8");
  const rejected = await runSourceCli([
    "evolve",
    successorRelativePath,
    "--alignment",
    "aligned",
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
  assert.equal(await fs.readFile(intermediatePath, "utf8"), intermediateBefore);
  assert.equal(await fs.readFile(indexPath, "utf8"), indexBefore);
  })
));

test("evolve collapse rejects a predecessor referenced by another candidate", () => (
  withFixtureWorkspace("referenced-evolution-collapse", async (workspaceRoot) => {
  const { indexPath, intermediatePath } = await establishUnrecordedIntermediate(
    workspaceRoot
  );
  const referencingRelativePath =
    "decision-records/reference-unrecorded-intermediate.md";
  const referencingPath = decisionFilePath(workspaceRoot, referencingRelativePath);
  const referencingCandidate = candidateDecisionBody({
    relationTarget: unrecordedIntermediateRelativePath
  });
  await fs.writeFile(referencingPath, referencingCandidate, "utf8");
  const successorRelativePath =
    "decision-records/reject-referenced-collapse.md";
  const successorPath = decisionFilePath(workspaceRoot, successorRelativePath);
  const successorCandidate = candidateDecisionBody();
  await fs.writeFile(successorPath, successorCandidate, "utf8");
  const intermediateBefore = await fs.readFile(intermediatePath, "utf8");
  const indexBefore = await fs.readFile(indexPath, "utf8");
  const rejected = await runSourceCli([
    "evolve",
    successorRelativePath,
    "--alignment",
    "aligned",
    "--collapse-unrecorded",
    unrecordedIntermediateRelativePath,
    "--relation",
    "修订=" + currentRelativePath,
    "--root",
    workspaceRoot
  ]);
  assert.equal(rejected.exitCode, 1);
  assert.match(rejected.stderr, /relationship 修订 target must be archived/);
  assert.ok(rejected.stderr.includes(referencingRelativePath));
  assert.equal(await fs.readFile(successorPath, "utf8"), successorCandidate);
  assert.equal(await fs.readFile(referencingPath, "utf8"), referencingCandidate);
  assert.equal(await fs.readFile(intermediatePath, "utf8"), intermediateBefore);
  assert.equal(await fs.readFile(indexPath, "utf8"), indexBefore);
  })
));
