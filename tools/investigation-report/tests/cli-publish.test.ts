import assert from "node:assert/strict";

import fs from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";

import { investigationRoot, withTempRoot } from "./fixture-support.ts";
import { runInvestigationCli } from "./cli-support.ts";

import { candidatePath, createReadyCandidate } from "./publish-support.ts";

test("publish preflight leaves candidates untouched and normal publish establishes only its explicit selection", async () => {
  await withTempRoot("publish-selection", async (root) => {
    await createReadyCandidate(root, "first.md");
    await createReadyCandidate(root, "second.md");
    const firstCandidate = await fs.readFile(
      candidatePath(root, "first.md"),
      "utf8"
    );
    const secondCandidate = await fs.readFile(
      candidatePath(root, "second.md"),
      "utf8"
    );
    const preflight = await runInvestigationCli(root, [
      "publish",
      "first.md",
      "--preflight"
    ]);
    assert.equal(preflight.status, 0, preflight.stderr);
    assert.match(
      preflight.stdout,
      /no candidate, formal report, resource, index, or pending state was changed/u
    );
    assert.match(preflight.stdout, /relation review \(preflight\):/u);
    assert.match(preflight.stdout, /first: establish/u);
    assert.equal(
      await fs.readFile(candidatePath(root, "first.md"), "utf8"),
      firstCandidate
    );
    await assert.rejects(
      fs.access(path.join(investigationRoot(root), "first.md"))
    );
    await assert.rejects(
      fs.access(path.join(investigationRoot(root), "investigation-index.json"))
    );

    const published = await runInvestigationCli(root, ["publish", "first.md"]);
    assert.equal(published.status, 0, published.stderr);
    assert.match(published.stdout, /relation review \(committed\):/u);
    assert.match(published.stdout, /first: establish/u);
    assert.equal(
      await fs.readFile(path.join(investigationRoot(root), "first.md"), "utf8"),
      firstCandidate
    );
    await assert.rejects(fs.access(candidatePath(root, "first.md")));
    assert.equal(
      await fs.readFile(candidatePath(root, "second.md"), "utf8"),
      secondCandidate
    );
    const checked = await runInvestigationCli(root, ["check"]);
    assert.equal(checked.status, 0, checked.stderr);
  });
});
