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
import { planChangePlanDirectory } from "../src/lifecycle.ts";
import { finalizeChangePlanDirectory } from "../src/finalize.ts";
import { inspectChangeRootRepositoryBoundary } from "../src/repository-boundary.ts";
import { git, tracedQuery, withFileSystemRoot, writePlan } from "./support.ts";

test("Change commands reject a repository anywhere in the active root before Git or writes", async () => {
  await withFileSystemRoot("catalog-nested-repository", async (root) => {
    const changes = path.join(root, "changes");
    const target = await writePlan(changes, "target", {
      metadata: { stage: "draft" }
    });
    const nested = path.join(changes, "other", "evidence", "source");
    await fs.mkdir(nested, { recursive: true });
    git(nested, ["init", "--quiet", "--initial-branch=main"]);
    const metadataBefore = await fs.readFile(
      path.join(target, ".change-plan.json"),
      "utf8"
    );
    for (const args of [
      ["list", changes],
      ["list", changes, "--stage", "draft"],
      ["check-all", changes],
      ["check", target],
      ["show", target],
      ["plan", target],
      ["finalize", target, "--preflight"],
      ["finalize", target]
    ]) {
      const query = await tracedQuery(root, args, 1);
      assert.deepEqual(query.commands, []);
    }
    const list = await listChangePlans({ changeRoot: changes });
    assert.deepEqual(list.entries, []);
    assert.equal(list.errors.length, 1);
    assert.match(list.errors[0]!, /Change root must not contain repositories/u);
    assert.ok(list.errors[0]!.includes(nested));
    assert.equal(
      (await checkChangePlanCollection({ changeRoot: changes })).valid,
      false
    );
    const checked = await checkChangePlanDirectory(target);
    assert.deepEqual(
      checked.diagnostics.map((item) => item.code),
      ["change-root-contains-repository"]
    );
    const shown = await showChangePlanDirectory(target);
    assert.equal(shown.check.valid, false);
    assert.deepEqual(shown.artifacts, {
      "proposal.md": null,
      "design.md": null,
      "tasks.md": null
    });
    const plan = await planChangePlanDirectory(target);
    assert.equal(plan.success, false);
    for (const preflight of [true, false]) {
      const finalized = await finalizeChangePlanDirectory(target, {
        preflight
      });
      assert.equal(finalized.changed, false);
    }
    assert.equal(
      await fs.readFile(path.join(target, ".change-plan.json"), "utf8"),
      metadataBefore
    );
    assert.deepEqual((await fs.readdir(changes)).sort(), ["other", "target"]);
  });
});

test("Change repository boundary rejects directory, gitfile, symlink, and bare layouts", async () => {
  await withFileSystemRoot("catalog-repository-markers", async (root) => {
    for (const kind of ["directory", "gitfile", "symlink", "bare"]) {
      const changes = path.join(root, kind);
      await writePlan(changes, "draft", { metadata: { stage: "draft" } });
      const nested = path.join(changes, "draft", "attachments");
      await fs.mkdir(nested);
      const marker = path.join(nested, ".git");
      if (kind === "directory") await fs.mkdir(marker);
      else if (kind === "gitfile")
        await fs.writeFile(marker, "gitdir: unavailable\n");
      else if (kind === "symlink")
        await fs.symlink(path.join(root, "unavailable"), marker);
      else git(nested, ["init", "--quiet", "--bare"]);
      const failure = await inspectChangeRootRepositoryBoundary(changes);
      assert.equal(failure?.code, "change-root-contains-repository");
      assert.ok(failure?.message.includes(nested));
      assert.equal(
        (await listChangePlans({ changeRoot: changes })).errors.length,
        1
      );
    }
    const changes = path.join(root, "root-marker");
    await fs.mkdir(changes);
    await fs.writeFile(path.join(changes, ".git"), "gitdir: unavailable\n");
    assert.equal(
      (await inspectChangeRootRepositoryBoundary(changes))?.code,
      "change-root-contains-repository"
    );
  });
});

test("Change repository boundary skips external symlink targets and private tombstones", async () => {
  await withFileSystemRoot("catalog-boundary-scope", async (root) => {
    const changes = path.join(root, "changes");
    await writePlan(changes, "draft", { metadata: { stage: "draft" } });
    const external = path.join(root, "external");
    await fs.mkdir(path.join(external, ".git"), { recursive: true });
    await fs.symlink(external, path.join(changes, "external-link"), "dir");
    await fs.mkdir(
      path.join(changes, ".change-plan-tombstones", "private", ".git"),
      { recursive: true }
    );
    const list = await listChangePlans({ changeRoot: changes });
    assert.deepEqual(list.errors, []);
    assert.equal(list.entries.length, 1);
    assert.equal(list.entries[0]?.valid, true);
  });
});

test("Change repository boundary fails closed when its root cannot be safely read", async () => {
  await withFileSystemRoot("catalog-boundary-read-failed", async (root) => {
    const target = await writePlan(root, "target", {
      metadata: { stage: "draft" }
    });
    const linked = path.join(root, "linked");
    await fs.symlink(root, linked, "dir");
    for (const unavailable of [
      linked,
      path.join(root, "absent"),
      path.join(target, "proposal.md")
    ]) {
      assert.equal(
        (await inspectChangeRootRepositoryBoundary(unavailable))?.code,
        "change-root-read-failed"
      );
    }
    const check = await checkChangePlanDirectory(path.join(linked, "target"));
    assert.deepEqual(
      check.diagnostics.map((item) => item.code),
      ["change-root-read-failed"]
    );
  });
});
