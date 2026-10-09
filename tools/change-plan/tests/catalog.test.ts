import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import {
  checkChangePlanCollection,
  listChangePlans,
  showChangePlanDirectory
} from "../src/catalog.ts";
import { checkChangePlanDirectory } from "../src/check.ts";
import {
  git,
  tracedQuery,
  validProposal,
  withFileSystemRoot,
  withTempRoot,
  writePlan
} from "./support.ts";

test("catalog lists direct active members and excludes private tombstones", async () => {
  await withFileSystemRoot("catalog-active", async (root) => {
    const changes = path.join(root, "changes");
    await writePlan(changes, "archive");
    await writePlan(changes, "valid-plan");
    const invalid = path.join(changes, "invalid-plan");
    await fs.mkdir(invalid, { recursive: true });
    await fs.writeFile(path.join(invalid, "proposal.md"), validProposal);
    await fs.mkdir(path.join(changes, ".change-plan-tombstones", "private"), {
      recursive: true
    });

    const list = await listChangePlans({ changeRoot: changes });
    assert.deepEqual(
      list.entries.map((entry) => entry.changeName),
      ["archive", "invalid-plan", "valid-plan"]
    );
    assert.deepEqual(list.errors, []);
    const collection = await checkChangePlanCollection({ changeRoot: changes });
    assert.equal(collection.checkedCount, 3);
    assert.equal(collection.valid, false);
  });
});

test("show reads only active change artifacts through the current checker", async () => {
  await withTempRoot("catalog-show", async (root) => {
    const change = await writePlan(path.join(root, "changes"), "shown-plan");
    const shown = await showChangePlanDirectory(change);
    assert.equal(shown.check.changeName, "shown-plan");
    assert.equal(shown.check.valid, true);
    assert.notEqual(shown.artifacts["proposal.md"], null);
  });
});

test("catalog shares one Git history per query and preserves each Change exclusion", async () => {
  await withTempRoot("catalog-shared-history", async (root) => {
    const changes = path.join(root, "changes");
    const baseCommit = git(root, ["rev-parse", "HEAD"]);
    const directories: string[] = [];
    for (let index = 0; index < 20; index += 1) {
      directories.push(
        await writePlan(changes, `plan-${index}`, {
          metadata: { stage: "plan", baseCommit }
        })
      );
    }
    await fs.writeFile(
      path.join(directories[0]!, "notes.md"),
      "inside\ninside\n"
    );
    await fs.writeFile(path.join(root, "project.txt"), "outside\n");
    git(root, ["add", "changes/plan-0/notes.md", "project.txt"]);
    git(root, ["commit", "--quiet", "-m", "mixed paths"]);
    git(root, ["commit", "--quiet", "--allow-empty", "-m", "empty revision"]);
    const entries = await Promise.all(
      directories.map(checkChangePlanDirectory)
    );
    entries.sort((left, right) =>
      left.changeName.localeCompare(right.changeName)
    );
    for (const entry of entries) {
      assert.equal(entry.distance?.commitCount, 2);
      assert.equal(
        entry.distance.changedLines,
        entry.changeName === "plan-0" ? 1 : 3
      );
    }
    for (const command of ["list", "check-all"]) {
      const query = await tracedQuery(root, [command, changes]);
      const expected =
        command === "list"
          ? { changeRoot: changes, entries, errors: [] }
          : {
              changeRoot: changes,
              entries,
              errors: [],
              checkedCount: 20,
              validCount: 20,
              invalidCount: 0,
              valid: true
            };
      assert.deepEqual(query.result, expected);
      assert.equal(
        query.commands.filter((line) => line.includes("--first-parent")).length,
        1
      );
      assert.equal(
        query.commands.filter((line) => line.includes("HEAD^{commit}")).length,
        1
      );
      assert.equal(
        query.commands.filter((line) => line.includes("--show-toplevel"))
          .length,
        1
      );
      assert.equal(query.commands.length, 4);
    }
  });
});

test("catalog keeps distinct Plan baselines isolated in one project repository", async () => {
  await withTempRoot("catalog-repository-boundary", async (root) => {
    const changes = path.join(root, "changes");
    const baseCommit = git(root, ["rev-parse", "HEAD"]);
    const older = await writePlan(changes, "older", {
      metadata: { stage: "plan", baseCommit }
    });
    await fs.writeFile(path.join(root, "outside.txt"), "outside\n");
    git(root, ["add", "outside.txt"]);
    git(root, ["commit", "--quiet", "-m", "outside change"]);
    const current = await writePlan(changes, "current");
    await fs.writeFile(path.join(root, "outside.txt"), "outside\nsecond\n");
    git(root, ["add", "outside.txt"]);
    git(root, ["commit", "--quiet", "-m", "second outside change"]);
    const entries = await Promise.all(
      [current, older].map(checkChangePlanDirectory)
    );
    const query = await tracedQuery(root, ["list", changes]);
    assert.deepEqual(query.result, {
      changeRoot: changes,
      entries,
      errors: []
    });
    assert.deepEqual(
      entries.map((entry) => entry.distance?.commitCount),
      [1, 2]
    );
    assert.equal(
      query.commands.filter((line) => line.includes("HEAD^{commit}")).length,
      1
    );
    assert.equal(
      query.commands.filter((line) => line.includes("--first-parent")).length,
      2
    );
    assert.equal(query.commands.length, 6);
  });
});

test("catalog refreshes cached Git snapshots on the next query", async () => {
  await withTempRoot("catalog-query-lifetime", async (root) => {
    const changes = path.join(root, "changes");
    await writePlan(changes, "first");
    await writePlan(changes, "second");
    const before = await listChangePlans({ changeRoot: changes });
    assert.ok(
      before.entries.every((entry) => entry.distance?.commitCount === 0)
    );
    await fs.writeFile(path.join(root, "outside.txt"), "outside\n");
    git(root, ["add", "outside.txt"]);
    git(root, ["commit", "--quiet", "-m", "new HEAD"]);
    const after = await listChangePlans({ changeRoot: changes });
    assert.ok(
      after.entries.every((entry) => entry.distance?.commitCount === 1)
    );
    assert.ok(
      after.entries.every((entry) => entry.distance?.changedLines === 1)
    );
    assert.notEqual(
      before.entries[0]?.distance?.headCommit,
      after.entries[0]?.distance?.headCommit
    );
  });
});

test("catalog draft selection performs no Git queries for excluded Plans", async () => {
  await withTempRoot("catalog-draft-selection", async (root) => {
    const changes = path.join(root, "changes");
    const draft = await writePlan(changes, "draft", {
      metadata: { stage: "draft" }
    });
    await writePlan(changes, "unavailable-plan", {
      metadata: { stage: "plan", baseCommit: "missing-revision" }
    });
    const expected = await checkChangePlanDirectory(draft);
    const query = await tracedQuery(root, [
      "list",
      changes,
      "--stage",
      "draft"
    ]);
    assert.deepEqual(query.result, {
      changeRoot: changes,
      entries: [expected],
      errors: []
    });
    assert.deepEqual(query.commands, []);
  });
});

test("catalog preserves shared baseline and Git failure diagnostics for every Plan", async () => {
  await withTempRoot("catalog-shared-failures", async (root) => {
    const changes = path.join(root, "changes");
    for (const name of ["first", "second"]) {
      await writePlan(changes, name, {
        metadata: { stage: "plan", baseCommit: "missing-revision" }
      });
    }
    const unavailable = await listChangePlans({ changeRoot: changes });
    assert.equal(unavailable.entries.length, 2);
    assert.deepEqual(unavailable.errors, []);
    for (const entry of unavailable.entries) {
      assert.equal(entry.valid, false);
      assert.deepEqual(
        entry.diagnostics.map((item) => item.code),
        ["base-commit-unavailable"]
      );
    }
    await fs.writeFile(
      path.join(root, ".git", "refs", "heads", "main"),
      "broken-revision\n"
    );
    const failed = await listChangePlans({ changeRoot: changes });
    assert.equal(failed.entries.length, 2);
    assert.deepEqual(failed.errors, []);
    for (const entry of failed.entries) {
      assert.equal(entry.valid, false);
      assert.deepEqual(
        entry.diagnostics.map((item) => item.code),
        ["version-control-failed"]
      );
    }
  });
});
