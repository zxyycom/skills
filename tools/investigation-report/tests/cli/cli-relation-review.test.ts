import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { test } from "node:test";

import { investigationRoot, withTempRoot } from "../support/fixture-support.ts";
import { runInvestigationCli } from "./cli-support.ts";
import { writeCollection } from "../support/collection-support.ts";

test("CLI set-relations preflight renders the expected review without writes", async () => {
  await withTempRoot("relation-cli-preflight", async (root) => {
    await writeCollection(root, [
      { id: "base" },
      { id: "next", relations: [{ target: "base", type: "补充" }] }
    ]);
    const reportPath = `${investigationRoot(root)}/next.md`;
    const indexPath = `${investigationRoot(root)}/investigation-index.json`;
    const [beforeReport, beforeIndex] = await Promise.all([
      fs.readFile(reportPath, "utf8"),
      fs.readFile(indexPath, "utf8")
    ]);
    const preview = await runInvestigationCli(root, [
      "set-relations",
      "--source",
      "next",
      "--relation",
      "补充=base",
      "--relation-summary",
      "base=expected summary",
      "--preflight"
    ]);
    assert.equal(preview.status, 0, preview.stderr);
    assert.equal(preview.stderr, "");
    assert.match(preview.stdout, /relation preflight passed/u);
    assert.match(preview.stdout, /relation review \(preflight\):/u);
    assert.match(
      preview.stdout,
      /summary changed: next --补充--> base \[无摘要\] -> next --补充--> base "expected summary"/u
    );
    assert.deepEqual(
      await Promise.all([
        fs.readFile(reportPath, "utf8"),
        fs.readFile(indexPath, "utf8")
      ]),
      [beforeReport, beforeIndex]
    );
  });
});
