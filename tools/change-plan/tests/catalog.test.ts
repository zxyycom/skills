import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import {
  checkChangePlanCollection,
  listChangePlans,
  showChangePlanDirectory
} from "../src/catalog.ts";
import {
  completedTasks,
  generatedCliPath,
  validProposal,
  withTempRoot,
  writePlan
} from "./support.ts";

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object";
}

async function testListStatuses(tempRoot: string): Promise<void> {
  const lifecycleRoot = path.join(tempRoot, "changes");
  await writePlan(lifecycleRoot, "active-plan");
  await writePlan(lifecycleRoot, "completed-plan", { tasks: completedTasks });
  const archiveRoot = path.join(lifecycleRoot, "archive");
  await writePlan(archiveRoot, "old-plan", {
    metadata: null,
    tasks: completedTasks
  });

  const activeList = await listChangePlans({ changeRoot: lifecycleRoot });
  assert.deepEqual(activeList.errors, []);
  assert.equal(activeList.status, "active");
  assert.deepEqual(
    activeList.entries.map((entry) => entry.changeName),
    ["active-plan", "completed-plan"]
  );
  assert.ok(activeList.entries.every((entry) => entry.status === "active"));
  assert.ok(activeList.entries.every((entry) => (
    entry.stage === "plan"
    && entry.distance?.commitCount === 0
  )));
  const archivedList = await listChangePlans({
    changeRoot: lifecycleRoot,
    status: "archived"
  });
  assert.deepEqual(archivedList.errors, []);
  assert.deepEqual(
    archivedList.entries.map((entry) => [entry.status, entry.changeName]),
    [["archived", "old-plan"]]
  );
  assert.equal(archivedList.entries[0]?.stage, null);
  assert.equal(archivedList.entries[0]?.distance, null);

  const allList = await listChangePlans({
    changeRoot: lifecycleRoot,
    status: "all"
  });
  assert.deepEqual(
    allList.entries.map((entry) => [entry.status, entry.changeName]),
    [
      ["active", "active-plan"],
      ["active", "completed-plan"],
      ["archived", "old-plan"]
    ]
  );
}

async function testStageFilter(tempRoot: string): Promise<void> {
  const lifecycleRoot = path.join(tempRoot, "stage-filter");
  const headCommit = spawnSync(
    "git",
    ["-C", tempRoot, "rev-parse", "HEAD"],
    { encoding: "utf8" }
  ).stdout.trim();
  await writePlan(lifecycleRoot, "draft-change", {
    metadata: { stage: "draft" }
  });
  await writePlan(lifecycleRoot, "plan-change", {
    metadata: { baseCommit: headCommit, stage: "plan" }
  });
  await writePlan(lifecycleRoot, "legacy-change", {
    metadata: { baseCommit: headCommit, stage: "implementation" }
  });

  const draftList = await listChangePlans({
    changeRoot: lifecycleRoot,
    stage: "draft"
  });
  assert.deepEqual(draftList.errors, []);
  assert.deepEqual(
    draftList.entries.map((entry) => [entry.changeName, entry.stage]),
    [["draft-change", "draft"]]
  );

  const planList = await listChangePlans({
    changeRoot: lifecycleRoot,
    stage: "plan"
  });
  assert.deepEqual(
    planList.entries.map((entry) => [entry.changeName, entry.stage]),
    [["plan-change", "plan"]]
  );

  const activeList = await listChangePlans({ changeRoot: lifecycleRoot });
  const legacyEntry = activeList.entries.find(
    (entry) => entry.changeName === "legacy-change"
  );
  assert.equal(legacyEntry?.stage, null);
  assert.equal(legacyEntry?.valid, false);
  assert.ok(legacyEntry?.diagnostics.some(
    (diagnostic) => diagnostic.code === "invalid-metadata"
  ));

  const invalidFilter = await listChangePlans({
    changeRoot: lifecycleRoot,
    stage: "draft",
    status: "all"
  });
  assert.deepEqual(invalidFilter.entries, []);
  assert.match(invalidFilter.errors[0] ?? "", /only valid for active/u);
}

async function testInvalidEntriesRemainDiscoverable(
  tempRoot: string
): Promise<void> {
  const lifecycleRoot = path.join(tempRoot, "invalid-entries");
  const invalidListedDirectory = path.join(lifecycleRoot, "invalid-plan");
  await fs.mkdir(invalidListedDirectory, { recursive: true });
  await fs.writeFile(
    path.join(invalidListedDirectory, "proposal.md"),
    validProposal,
    "utf8"
  );

  const listWithInvalid = await listChangePlans({ changeRoot: lifecycleRoot });
  const invalidListEntry = listWithInvalid.entries.find(
    (entry) => entry.changeName === "invalid-plan"
  );
  assert.equal(listWithInvalid.errors.length, 0);
  assert.equal(invalidListEntry?.valid, false);

  const shownInvalid = await showChangePlanDirectory(invalidListedDirectory);
  assert.equal(shownInvalid.check.valid, false);
  assert.equal(shownInvalid.artifacts["proposal.md"], validProposal);
  assert.equal(shownInvalid.artifacts["design.md"], null);
}

async function testChangeRootDiagnostics(tempRoot: string): Promise<void> {
  const emptyChangeRoot = path.join(tempRoot, "empty-changes");
  await fs.mkdir(emptyChangeRoot);
  const emptyArchivedList = await listChangePlans({
    changeRoot: emptyChangeRoot,
    status: "archived"
  });
  assert.deepEqual(emptyArchivedList.errors, []);
  assert.deepEqual(emptyArchivedList.entries, []);

  const missingRootList = await listChangePlans({
    changeRoot: path.join(tempRoot, "missing-changes")
  });
  assert.equal(missingRootList.entries.length, 0);
  assert.match(missingRootList.errors[0] ?? "", /does not exist/u);

  const nonDirectoryChangeRoot = path.join(tempRoot, "changes-file");
  await fs.writeFile(nonDirectoryChangeRoot, "not a directory", "utf8");
  const nonDirectoryRootList = await listChangePlans({
    changeRoot: nonDirectoryChangeRoot
  });
  assert.equal(nonDirectoryRootList.entries.length, 0);
  assert.match(nonDirectoryRootList.errors[0] ?? "", /must be a directory/u);

  const inaccessibleChangeRoot = `${tempRoot}\0inaccessible-root`;
  const inaccessibleRootList = await listChangePlans({
    changeRoot: inaccessibleChangeRoot
  });
  assert.equal(inaccessibleRootList.entries.length, 0);
  assert.match(inaccessibleRootList.errors[0] ?? "", /cannot access change root/u);

  const blockedArchiveRoot = path.join(tempRoot, "blocked-archive-root");
  await writePlan(blockedArchiveRoot, "blocked-plan", {
    tasks: completedTasks
  });
  await fs.writeFile(path.join(blockedArchiveRoot, "archive"), "not a directory");
  const blockedArchivedList = await listChangePlans({
    changeRoot: blockedArchiveRoot,
    status: "archived"
  });
  assert.match(
    blockedArchivedList.errors[0] ?? "",
    /change archive must be a directory/u
  );
}

async function testCollectionCheckAggregation(
  tempRoot: string
): Promise<void> {
  const lifecycleRoot = path.join(tempRoot, "collection-check");
  await writePlan(lifecycleRoot, "valid-active");
  const invalidDirectory = path.join(lifecycleRoot, "invalid-active");
  await fs.mkdir(invalidDirectory, { recursive: true });
  await fs.writeFile(
    path.join(invalidDirectory, "proposal.md"),
    validProposal,
    "utf8"
  );
  await writePlan(path.join(lifecycleRoot, "archive"), "valid-archived", {
    metadata: null,
    tasks: completedTasks
  });

  const activeResult = await checkChangePlanCollection({
    changeRoot: lifecycleRoot
  });
  assert.equal(activeResult.status, "active");
  assert.equal(activeResult.checkedCount, 2);
  assert.equal(activeResult.validCount, 1);
  assert.equal(activeResult.invalidCount, 1);
  assert.equal(activeResult.valid, false);
  assert.deepEqual(activeResult.errors, []);
  assert.ok(activeResult.entries.some((entry) => (
    entry.changeName === "invalid-active"
    && !entry.valid
    && entry.diagnostics.length > 0
  )));

  const archivedResult = await checkChangePlanCollection({
    changeRoot: lifecycleRoot,
    status: "archived"
  });
  assert.equal(archivedResult.checkedCount, 1);
  assert.equal(archivedResult.validCount, 1);
  assert.equal(archivedResult.invalidCount, 0);
  assert.equal(archivedResult.valid, true);

  const allResult = await checkChangePlanCollection({
    changeRoot: lifecycleRoot,
    status: "all"
  });
  assert.equal(allResult.checkedCount, 3);
  assert.equal(allResult.invalidCount, 1);
  assert.equal(allResult.valid, false);
}

async function testCollectionCheckRootOutcomes(
  tempRoot: string
): Promise<void> {
  const emptyRoot = path.join(tempRoot, "empty-collection");
  await fs.mkdir(emptyRoot);
  const emptyResult = await checkChangePlanCollection({
    changeRoot: emptyRoot
  });
  assert.equal(emptyResult.checkedCount, 0);
  assert.equal(emptyResult.valid, true);

  const emptyArchivedResult = await checkChangePlanCollection({
    changeRoot: emptyRoot,
    status: "archived"
  });
  assert.equal(emptyArchivedResult.checkedCount, 0);
  assert.equal(emptyArchivedResult.valid, true);

  const missingResult = await checkChangePlanCollection({
    changeRoot: path.join(tempRoot, "missing-collection")
  });
  assert.equal(missingResult.checkedCount, 0);
  assert.equal(missingResult.valid, false);
  assert.match(missingResult.errors[0] ?? "", /does not exist/u);
}

async function testShowStatus(
  tempRoot: string
): Promise<void> {
  const lifecycleRoot = path.join(tempRoot, "show-status");
  const activeDirectory = await writePlan(lifecycleRoot, "active-plan");
  const archivedDirectory = await writePlan(
    path.join(lifecycleRoot, "archive"),
    "old-plan",
    { tasks: completedTasks }
  );

  const shownActive = await showChangePlanDirectory(activeDirectory);
  assert.equal(shownActive.status, "active");
  assert.equal(shownActive.check.valid, true);
  assert.equal(shownActive.artifacts["proposal.md"], validProposal);
  const shownArchived = await showChangePlanDirectory(archivedDirectory);
  assert.equal(shownArchived.status, "archived");
}

async function testSymbolicLinksAreNotDiscovered(
  tempRoot: string
): Promise<void> {
  const lifecycleRoot = path.join(tempRoot, "linked-plans");
  const linkedPlanTargetDirectory = await writePlan(
    lifecycleRoot,
    "linked-plan-target",
    { tasks: completedTasks }
  );
  const linkedPlanDirectory = path.join(lifecycleRoot, "linked-plan");
  await fs.symlink(
    linkedPlanTargetDirectory,
    linkedPlanDirectory,
    process.platform === "win32" ? "junction" : "dir"
  );

  const listWithLinkedPlan = await listChangePlans({ changeRoot: lifecycleRoot });
  assert.equal(
    listWithLinkedPlan.entries.some((entry) => entry.changeName === "linked-plan"),
    false
  );
  const linkedRootList = await listChangePlans({
    changeRoot: linkedPlanDirectory
  });
  assert.match(linkedRootList.errors[0] ?? "", /must be a directory/u);
}

async function testShowDoesNotReadSymbolicLinks(
  tempRoot: string
): Promise<void> {
  const externalMarker = "EXTERNAL-SHOW-MARKER";
  const externalDirectory = path.join(tempRoot, "external-change");
  await fs.mkdir(externalDirectory);
  await Promise.all([
    "proposal.md",
    "design.md",
    "tasks.md"
  ].map((artifact) => fs.writeFile(
    path.join(externalDirectory, artifact),
    `${externalMarker}:${artifact}\n`,
    "utf8"
  )));

  const linkedDirectory = path.join(tempRoot, "linked-change");
  await fs.symlink(
    externalDirectory,
    linkedDirectory,
    process.platform === "win32" ? "junction" : "dir"
  );

  const realDirectory = await writePlan(tempRoot, "linked-artifact");
  await fs.rm(path.join(realDirectory, "proposal.md"));
  await fs.symlink(
    path.join(externalDirectory, "proposal.md"),
    path.join(realDirectory, "proposal.md"),
    "file"
  );

  const linkedDirectoryResult = await showChangePlanDirectory(linkedDirectory);
  assert.deepEqual(linkedDirectoryResult.artifacts, {
    "proposal.md": null,
    "design.md": null,
    "tasks.md": null
  });
  assert.doesNotMatch(
    JSON.stringify(linkedDirectoryResult),
    /EXTERNAL-SHOW-MARKER/u
  );

  const linkedArtifactResult = await showChangePlanDirectory(realDirectory);
  assert.equal(linkedArtifactResult.artifacts["proposal.md"], null);
  assert.doesNotMatch(
    JSON.stringify(linkedArtifactResult),
    /EXTERNAL-SHOW-MARKER/u
  );

  for (const changeDirectory of [linkedDirectory, realDirectory]) {
    const cliResult = spawnSync(
      "node",
      [generatedCliPath, "show", changeDirectory, "--json"],
      { encoding: "utf8" }
    );
    assert.equal(cliResult.status, 1);
    assert.equal(cliResult.stderr, "");
    assert.doesNotMatch(cliResult.stdout, /EXTERNAL-SHOW-MARKER/u);
    const parsed: unknown = JSON.parse(cliResult.stdout);
    assert.ok(isRecord(parsed));
    assert.ok(isRecord(parsed.artifacts));
    assert.equal(parsed.artifacts["proposal.md"], null);
  }
}

test("catalog lists active, archived, and all change plans", () => (
  withTempRoot("catalog-statuses", testListStatuses)
));

test("catalog keeps invalid change entries discoverable", () => (
  withTempRoot("catalog-invalid", testInvalidEntriesRemainDiscoverable)
));

test("catalog filters active changes by lifecycle stage", () => (
  withTempRoot("catalog-stage", testStageFilter)
));

test("catalog reports inaccessible and malformed lifecycle roots", () => (
  withTempRoot("catalog-roots", testChangeRootDiagnostics)
));

test("collection check aggregates selected change results", () => (
  withTempRoot("collection-check", testCollectionCheckAggregation)
));

test("collection check distinguishes empty and unavailable roots", () => (
  withTempRoot("collection-check-roots", testCollectionCheckRootOutcomes)
));

test("catalog shows lifecycle status", () => (
  withTempRoot("catalog-show", testShowStatus)
));

test("catalog does not discover symbolic-link change directories", () => (
  withTempRoot("catalog-links", testSymbolicLinksAreNotDiscovered)
));

test("show does not read symbolic-link directories or artifacts", () => (
  withTempRoot("catalog-show-links", testShowDoesNotReadSymbolicLinks)
));
