import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import {
  archiveChangePlanDirectory as archiveBundledChangePlanDirectory
} from "../../../skills/change-plan/scripts/change-plan.mjs";
import { archiveChangePlanDirectory } from "../src/archive.ts";
import {
  completedTasks,
  validProposal,
  withTempRoot,
  writePlan
} from "./support.ts";

async function testContentGates(tempRoot: string): Promise<void> {
  const invalidListedDirectory = path.join(
    tempRoot,
    "invalid-content",
    "invalid-plan"
  );
  await fs.mkdir(invalidListedDirectory, { recursive: true });
  await fs.writeFile(
    path.join(invalidListedDirectory, "proposal.md"),
    validProposal,
    "utf8"
  );
  const structurallyInvalidArchive = await archiveChangePlanDirectory(
    invalidListedDirectory
  );
  assert.equal(structurallyInvalidArchive.archived, false);
  assert.match(structurallyInvalidArchive.error ?? "", /must pass check/u);

  const activeDirectory = await writePlan(
    path.join(tempRoot, "incomplete"),
    "active-plan"
  );
  const incompleteArchive = await archiveChangePlanDirectory(activeDirectory);
  assert.equal(incompleteArchive.archived, false);
  assert.notEqual(incompleteArchive.check, null);
  assert.match(incompleteArchive.error ?? "", /all tasks must be completed/u);
  assert.equal(await fs.stat(activeDirectory).then(() => true), true);

  const completedDraftDirectory = await writePlan(
    path.join(tempRoot, "draft-stage"),
    "completed-draft",
    {
      metadata: { schemaVersion: 1, stage: "draft" },
      tasks: completedTasks
    }
  );
  const draftArchive = await archiveChangePlanDirectory(
    completedDraftDirectory
  );
  assert.equal(draftArchive.archived, false);
  assert.match(draftArchive.error ?? "", /implementation stage/u);
  assert.equal(await fs.stat(completedDraftDirectory).then(() => true), true);
}

async function testPathGates(tempRoot: string): Promise<void> {
  const lifecycleRoot = path.join(tempRoot, "path-gates");
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
  const linkedArchive = await archiveChangePlanDirectory(linkedPlanDirectory);
  assert.equal(linkedArchive.archived, false);
  assert.equal(linkedArchive.check, null);
  assert.match(linkedArchive.error, /must not be a symbolic link/u);

  const archivedDirectory = await writePlan(
    path.join(lifecycleRoot, "archive"),
    "old-plan",
    { tasks: completedTasks }
  );
  const alreadyArchived = await archiveChangePlanDirectory(archivedDirectory);
  assert.equal(alreadyArchived.archived, false);
  assert.equal(alreadyArchived.check, null);
  assert.match(alreadyArchived.error ?? "", /already archived/u);

  const filePath = path.join(tempRoot, "not-a-directory");
  await fs.writeFile(filePath, "file", "utf8");
  const fileArchive = await archiveChangePlanDirectory(filePath);
  assert.equal(fileArchive.archived, false);
  assert.equal(fileArchive.check, null);
  assert.match(fileArchive.error, /must be a directory/u);

  const inaccessibleArchive = await archiveChangePlanDirectory(
    `${tempRoot}\0inaccessible-archive`
  );
  assert.equal(inaccessibleArchive.archived, false);
  assert.equal(inaccessibleArchive.check, null);
  assert.match(inaccessibleArchive.error, /cannot inspect change directory/u);
}

async function testTargetGates(tempRoot: string): Promise<void> {
  const lifecycleRoot = path.join(tempRoot, "target-gates");
  const archiveRoot = path.join(lifecycleRoot, "archive");
  const collisionDirectory = await writePlan(
    lifecycleRoot,
    "collision-plan",
    { tasks: completedTasks }
  );
  await writePlan(archiveRoot, "collision-plan", { tasks: completedTasks });
  const collisionArchive = await archiveChangePlanDirectory(collisionDirectory);
  assert.equal(collisionArchive.archived, false);
  assert.match(collisionArchive.error ?? "", /target already exists/u);
  assert.equal(await fs.stat(collisionDirectory).then(() => true), true);

  const blockedArchiveRoot = path.join(tempRoot, "blocked-archive-root");
  const blockedDirectory = await writePlan(
    blockedArchiveRoot,
    "blocked-plan",
    { tasks: completedTasks }
  );
  await fs.writeFile(path.join(blockedArchiveRoot, "archive"), "not a directory");
  const blockedArchive = await archiveChangePlanDirectory(blockedDirectory);
  assert.equal(blockedArchive.archived, false);
  assert.match(blockedArchive.error ?? "", /regular directory/u);
}

async function testSuccessfulArchive(tempRoot: string): Promise<void> {
  const lifecycleRoot = path.join(tempRoot, "successful-archive");
  const completedDirectory = await writePlan(
    lifecycleRoot,
    "completed-plan",
    { tasks: completedTasks }
  );
  await fs.writeFile(
    path.join(completedDirectory, "evidence.md"),
    "验证证据。\n",
    "utf8"
  );
  const completedArchive = await archiveChangePlanDirectory(completedDirectory);
  assert.equal(completedArchive.archived, true);
  assert.equal(completedArchive.error, null);
  await assert.rejects(fs.stat(completedDirectory), { code: "ENOENT" });
  assert.equal(
    await fs.stat(completedArchive.archivedDirectory).then((stat) => stat.isDirectory()),
    true
  );
  assert.equal(
    await fs.readFile(
      path.join(completedArchive.archivedDirectory, "evidence.md"),
      "utf8"
    ),
    "验证证据。\n"
  );

  const bundledDirectory = await writePlan(
    lifecycleRoot,
    "bundled-plan",
    { tasks: completedTasks }
  );
  const bundledArchive = await archiveBundledChangePlanDirectory(bundledDirectory);
  assert.equal(bundledArchive.archived, true);
  assert.equal(
    await fs.stat(bundledArchive.archivedDirectory).then((stat) => stat.isDirectory()),
    true
  );
}

test("archive rejects plans that fail content gates", () => (
  withTempRoot("archive-content", testContentGates)
));

test("archive rejects unsafe source paths", () => (
  withTempRoot("archive-paths", testPathGates)
));

test("archive rejects invalid target directories", () => (
  withTempRoot("archive-targets", testTargetGates)
));

test("archive moves complete plans and preserves their content", () => (
  withTempRoot("archive-success", testSuccessfulArchive)
));
