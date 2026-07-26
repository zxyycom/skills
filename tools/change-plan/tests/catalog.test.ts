import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import {
  listChangePlans as listBundledChangePlans,
  showChangePlanDirectory as showBundledChangePlanDirectory
} from "../../../skills/change-plan/scripts/change-plan.mjs";
import {
  listChangePlans,
  showChangePlanDirectory
} from "../src/catalog.ts";
import {
  completedTasks,
  validProposal,
  withTempRoot,
  writePlan
} from "./support.ts";

async function testListStatuses(tempRoot: string): Promise<void> {
  const lifecycleRoot = path.join(tempRoot, "changes");
  await writePlan(lifecycleRoot, "active-plan");
  await writePlan(lifecycleRoot, "completed-plan", { tasks: completedTasks });
  const archiveRoot = path.join(lifecycleRoot, "archive");
  await writePlan(archiveRoot, "old-plan", { tasks: completedTasks });

  const activeList = await listChangePlans({ changeRoot: lifecycleRoot });
  assert.deepEqual(activeList.errors, []);
  assert.equal(activeList.status, "active");
  assert.deepEqual(
    activeList.entries.map((entry) => entry.changeName),
    ["active-plan", "completed-plan"]
  );
  assert.ok(activeList.entries.every((entry) => entry.status === "active"));
  assert.deepEqual(
    await listBundledChangePlans({ changeRoot: lifecycleRoot }),
    activeList
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

async function testShowStatusAndBundledParity(
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
  assert.deepEqual(
    await showBundledChangePlanDirectory(activeDirectory),
    shownActive
  );

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

test("catalog lists active, archived, and all change plans", () => (
  withTempRoot("catalog-statuses", testListStatuses)
));

test("catalog keeps invalid change entries discoverable", () => (
  withTempRoot("catalog-invalid", testInvalidEntriesRemainDiscoverable)
));

test("catalog reports inaccessible and malformed lifecycle roots", () => (
  withTempRoot("catalog-roots", testChangeRootDiagnostics)
));

test("catalog shows lifecycle status with bundled API parity", () => (
  withTempRoot("catalog-show", testShowStatusAndBundledParity)
));

test("catalog does not discover symbolic-link change directories", () => (
  withTempRoot("catalog-links", testSymbolicLinksAreNotDiscovered)
));
