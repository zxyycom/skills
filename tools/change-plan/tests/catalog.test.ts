import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import {
  checkChangePlanCollection,
  listChangePlans,
  showChangePlanDirectory
} from "../src/catalog.ts";
import {
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
