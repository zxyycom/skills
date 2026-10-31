import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { prepareCandidateResources } from "../../src/candidates/candidate-read-resources.ts";
import { withTempRoot } from "../support/fixture-support.ts";

test("root-level malformed resource cannot be assigned to a prefix-matching candidate owner", async () => {
  await withTempRoot("candidate-root-resource", async (root) => {
    execFileSync("git", ["init", "--quiet", root]);
    const collection = path.join(root, "docs", "investigations");
    const resources = path.join(collection, "_resources");
    await fs.mkdir(resources, { recursive: true });
    await fs.writeFile(path.join(resources, "261028-alphaz"), "not owned");
    for (const owner of [
      "261028-alpha",
      "261028-alphax",
      "261028-unselected"
    ]) {
      await fs.mkdir(path.join(resources, owner), { recursive: true });
      await fs.writeFile(path.join(resources, owner, "owned.txt"), owner);
    }
    execFileSync("git", ["-C", root, "add", "docs/investigations/_resources"]);
    const result = await prepareCandidateResources(
      collection,
      true,
      new Map(),
      ["261028-alpha", "261028-alphax"]
    );
    assert.equal(result.resources?.status, "ready");
    assert.deepEqual(result.ownerWarnings, [
      "_resources/261028-alpha/owned.txt must be referenced by its owner report 261028-alpha",
      "_resources/261028-alphax/owned.txt must be referenced by its owner report 261028-alphax"
    ]);
  });
});
