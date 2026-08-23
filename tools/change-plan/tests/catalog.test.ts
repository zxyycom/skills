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
  const archivedDirectory = await writePlan(archiveRoot, "old-plan", {
    metadata: null,
    tasks: completedTasks
  });
  await fs.rm(path.join(archivedDirectory, "design.md"));

  const activeList = await listChangePlans({ changeRoot: lifecycleRoot });
  assert.deepEqual(activeList.errors, []);
  assert.equal(activeList.status, "active");
  assert.deepEqual(
    activeList.entries.map((entry) => entry.changeName),
    ["active-plan", "completed-plan"]
  );
  assert.ok(activeList.entries.every((entry) => entry.status === "active"));
  assert.ok(
    activeList.entries.every(
      (entry) => entry.stage === "plan" && entry.distance?.commitCount === 0
    )
  );
  const archivedList = await listChangePlans({
    changeRoot: lifecycleRoot,
    status: "archived"
  });
  assert.deepEqual(archivedList.errors, []);
  assert.deepEqual(
    archivedList.entries.map((entry) => [entry.status, entry.changeName]),
    [["archived", "old-plan"]]
  );
  assert.deepEqual(archivedList.entries[0], {
    changeDirectory: archivedDirectory,
    changeName: "old-plan",
    status: "archived"
  });

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
  const headCommit = spawnSync("git", ["-C", tempRoot, "rev-parse", "HEAD"], {
    encoding: "utf8"
  }).stdout.trim();
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
    draftList.entries.map((entry) => [
      entry.changeName,
      entry.status === "active" ? entry.stage : null
    ]),
    [["draft-change", "draft"]]
  );

  const planList = await listChangePlans({
    changeRoot: lifecycleRoot,
    stage: "plan"
  });
  assert.deepEqual(
    planList.entries.map((entry) => [
      entry.changeName,
      entry.status === "active" ? entry.stage : null
    ]),
    [["plan-change", "plan"]]
  );

  const activeList = await listChangePlans({ changeRoot: lifecycleRoot });
  const legacyEntry = activeList.entries.find(
    (entry) => entry.changeName === "legacy-change"
  );
  assert.equal(legacyEntry?.status, "active");
  assert.equal(
    legacyEntry?.status === "active" ? legacyEntry.stage : undefined,
    null
  );
  assert.equal(
    legacyEntry?.status === "active" ? legacyEntry.valid : undefined,
    false
  );
  assert.ok(
    legacyEntry?.status === "active" &&
      legacyEntry.diagnostics.some(
        (diagnostic) => diagnostic.code === "invalid-metadata"
      )
  );

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
  assert.equal(
    invalidListEntry?.status === "active" ? invalidListEntry.valid : undefined,
    false
  );

  const shownInvalid = await showChangePlanDirectory(invalidListedDirectory);
  assert.equal(shownInvalid.status, "active");
  assert.equal(
    shownInvalid.status === "active" ? shownInvalid.check.valid : undefined,
    false
  );
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
  assert.match(
    inaccessibleRootList.errors[0] ?? "",
    /cannot access change root/u
  );

  const blockedArchiveRoot = path.join(tempRoot, "blocked-archive-root");
  await writePlan(blockedArchiveRoot, "blocked-plan", {
    tasks: completedTasks
  });
  await fs.writeFile(
    path.join(blockedArchiveRoot, "archive"),
    "not a directory"
  );
  const blockedArchivedList = await listChangePlans({
    changeRoot: blockedArchiveRoot,
    status: "archived"
  });
  assert.match(
    blockedArchivedList.errors[0] ?? "",
    /change archive must be a directory/u
  );
}

async function testActiveCollectionCheckAggregation(
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
  const archivedDirectory = path.join(
    lifecycleRoot,
    "archive",
    "invalid-archived"
  );
  await fs.mkdir(archivedDirectory, { recursive: true });

  const activeResult = await checkChangePlanCollection({
    changeRoot: lifecycleRoot
  });
  assert.equal(activeResult.checkedCount, 2);
  assert.equal(activeResult.validCount, 1);
  assert.equal(activeResult.invalidCount, 1);
  assert.equal(activeResult.valid, false);
  assert.deepEqual(activeResult.errors, []);
  assert.ok(
    activeResult.entries.some(
      (entry) =>
        entry.changeName === "invalid-active" &&
        !entry.valid &&
        entry.diagnostics.length > 0
    )
  );

  assert.ok(activeResult.entries.every((entry) => entry.status === "active"));
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

  const missingResult = await checkChangePlanCollection({
    changeRoot: path.join(tempRoot, "missing-collection")
  });
  assert.equal(missingResult.checkedCount, 0);
  assert.equal(missingResult.valid, false);
  assert.match(missingResult.errors[0] ?? "", /does not exist/u);
}

async function testShowStatus(tempRoot: string): Promise<void> {
  const lifecycleRoot = path.join(tempRoot, "show-status");
  const activeDirectory = await writePlan(lifecycleRoot, "active-plan");
  const archivedDirectory = await writePlan(
    path.join(lifecycleRoot, "archive"),
    "old-plan",
    { tasks: completedTasks }
  );
  await fs.writeFile(
    path.join(archivedDirectory, "proposal.md"),
    "historical proposal without current headings\n",
    "utf8"
  );
  await fs.rm(path.join(archivedDirectory, "design.md"));
  await fs.rm(path.join(archivedDirectory, "tasks.md"));
  await fs.writeFile(
    path.join(archivedDirectory, ".change-plan.json"),
    "{",
    "utf8"
  );

  const shownActive = await showChangePlanDirectory(activeDirectory);
  assert.equal(shownActive.status, "active");
  assert.equal(shownActive.check.valid, true);
  assert.equal(shownActive.artifacts["proposal.md"], validProposal);
  const shownArchived = await showChangePlanDirectory(archivedDirectory);
  assert.equal(shownArchived.status, "archived");
  assert.equal(shownArchived.check, null);
  assert.deepEqual(
    shownArchived.status === "archived" ? shownArchived.errors : undefined,
    []
  );
  assert.equal(
    shownArchived.artifacts["proposal.md"],
    "historical proposal without current headings\n"
  );
  assert.equal(shownArchived.artifacts["design.md"], null);

  const missingArchived = await showChangePlanDirectory(
    path.join(lifecycleRoot, "archive", "missing-history")
  );
  assert.equal(missingArchived.status, "archived");
  assert.equal(missingArchived.check, null);
  assert.match(
    missingArchived.status === "archived"
      ? (missingArchived.errors[0] ?? "")
      : "",
    /does not exist/u
  );
  assert.ok(
    Object.values(missingArchived.artifacts).every((value) => value === null)
  );
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

  const listWithLinkedPlan = await listChangePlans({
    changeRoot: lifecycleRoot
  });
  assert.equal(
    listWithLinkedPlan.entries.some(
      (entry) => entry.changeName === "linked-plan"
    ),
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
  await Promise.all(
    ["proposal.md", "design.md", "tasks.md"].map((artifact) =>
      fs.writeFile(
        path.join(externalDirectory, artifact),
        `${externalMarker}:${artifact}\n`,
        "utf8"
      )
    )
  );

  const linkedDirectory = path.join(tempRoot, "linked-change");
  await fs.symlink(
    externalDirectory,
    linkedDirectory,
    process.platform === "win32" ? "junction" : "dir"
  );
  const archiveDirectory = path.join(tempRoot, "archive");
  await fs.mkdir(archiveDirectory);
  const archivedLinkedDirectory = path.join(
    archiveDirectory,
    "linked-archived-change"
  );
  await fs.symlink(
    externalDirectory,
    archivedLinkedDirectory,
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

  const archivedLinkedDirectoryResult = await showChangePlanDirectory(
    archivedLinkedDirectory
  );
  assert.equal(archivedLinkedDirectoryResult.status, "archived");
  assert.equal(archivedLinkedDirectoryResult.check, null);
  assert.ok(
    archivedLinkedDirectoryResult.status === "archived" &&
      archivedLinkedDirectoryResult.errors.length > 0
  );
  assert.deepEqual(archivedLinkedDirectoryResult.artifacts, {
    "design.md": null,
    "proposal.md": null,
    "tasks.md": null
  });
  assert.doesNotMatch(
    JSON.stringify(archivedLinkedDirectoryResult),
    /EXTERNAL-SHOW-MARKER/u
  );

  const linkedArtifactResult = await showChangePlanDirectory(realDirectory);
  assert.equal(linkedArtifactResult.artifacts["proposal.md"], null);
  assert.doesNotMatch(
    JSON.stringify(linkedArtifactResult),
    /EXTERNAL-SHOW-MARKER/u
  );

  for (const changeDirectory of [
    linkedDirectory,
    realDirectory,
    archivedLinkedDirectory
  ]) {
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

test("catalog lists active, archived, and all change plans", () =>
  withTempRoot("catalog-statuses", testListStatuses));

test("catalog keeps invalid change entries discoverable", () =>
  withTempRoot("catalog-invalid", testInvalidEntriesRemainDiscoverable));

test("catalog filters active changes by lifecycle stage", () =>
  withTempRoot("catalog-stage", testStageFilter));

test("catalog reports inaccessible and malformed lifecycle roots", () =>
  withTempRoot("catalog-roots", testChangeRootDiagnostics));

test("collection check aggregates active change results", () =>
  withTempRoot("collection-check", testActiveCollectionCheckAggregation));

test("collection check distinguishes empty and unavailable roots", () =>
  withTempRoot("collection-check-roots", testCollectionCheckRootOutcomes));

test("catalog shows lifecycle status", () =>
  withTempRoot("catalog-show", testShowStatus));

test("catalog does not discover symbolic-link change directories", () =>
  withTempRoot("catalog-links", testSymbolicLinksAreNotDiscovered));

test("show does not read symbolic-link directories or artifacts", () =>
  withTempRoot("catalog-show-links", testShowDoesNotReadSymbolicLinks));
