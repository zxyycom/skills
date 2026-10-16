import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import {
  investigationRoot,
  runInvestigationCli,
  withTempRoot,
  writeCollection
} from "./v6-support.ts";

test("CLI selected sync publishes by default and keeps --preflight zero-write", async () => {
  await withTempRoot("cli-selected-sync", async (root) => {
    await writeCollection(root, [
      { id: "260828-alpha" },
      { id: "260828-beta" }
    ]);
    const indexPath = path.join(
      investigationRoot(root),
      "investigation-index.json"
    );
    const alphaPath = path.join(investigationRoot(root), "260828-alpha.md");
    const baseline = await fs.readFile(indexPath, "utf8");
    const alpha = await fs.readFile(alphaPath, "utf8");
    await fs.writeFile(
      alphaPath,
      alpha.replace('title: "260828-alpha"', 'title: "Alpha changed"'),
      "utf8"
    );

    const unselected = await runInvestigationCli(root, [
      "sync-index",
      "--select",
      "260828-beta"
    ]);
    assert.equal(unselected.status, 1);
    assert.match(unselected.stderr, /outside the selected sync scope/u);
    assert.equal(await fs.readFile(indexPath, "utf8"), baseline);

    const checked = await runInvestigationCli(root, [
      "sync-index",
      "--select",
      "alpha.md",
      "--preflight"
    ]);
    assert.equal(checked.status, 0, checked.stderr);
    assert.equal(checked.stderr, "");
    assert.match(checked.stdout, /preflight passed.*not published/u);
    assert.doesNotMatch(checked.stdout, /already current/u);
    assert.equal(await fs.readFile(indexPath, "utf8"), baseline);

    const removedWrite = await runInvestigationCli(root, [
      "sync-index",
      "--select",
      "alpha.md",
      "--write"
    ]);
    assert.equal(removedWrite.status, 2);
    assert.match(removedWrite.stderr, /unknown option '--write'/u);
    assert.equal(removedWrite.stdout, "");
    assert.equal(await fs.readFile(indexPath, "utf8"), baseline);

    const written = await runInvestigationCli(root, [
      "sync-index",
      "--select",
      "alpha.md"
    ]);
    assert.equal(written.status, 0, written.stderr);
    assert.match(
      written.stdout,
      /Selected Investigation selectors: alpha\.md\./u
    );
    assert.match(written.stdout, /resolved IDs: 260828-alpha\./u);
    const selectedText = await fs.readFile(indexPath, "utf8");
    assert.notEqual(selectedText, baseline);

    await fs.writeFile(indexPath, baseline, "utf8");
    const full = await runInvestigationCli(root, ["sync-index"]);
    assert.equal(full.status, 0, full.stderr);
    assert.equal(await fs.readFile(indexPath, "utf8"), selectedText);
  });
});

test("CLI full sync preflight accepts recoverable indexes while strict check remains diagnostic", async () => {
  await withTempRoot("cli-full-preview", async (root) => {
    await writeCollection(root, [{ id: "report" }]);
    const indexPath = path.join(
      investigationRoot(root),
      "investigation-index.json"
    );
    const baseline = await fs.readFile(indexPath, "utf8");
    for (const broken of [
      null,
      "not JSON",
      baseline.replace('"schemaVersion": 4', '"schemaVersion": 3')
    ]) {
      if (broken === null) await fs.rm(indexPath);
      else await fs.writeFile(indexPath, broken);
      const before = await fs.readFile(indexPath, "utf8").catch(() => null);
      const preview = await runInvestigationCli(root, [
        "sync-index",
        "--preflight"
      ]);
      assert.equal(preview.status, 0, preview.stderr);
      assert.match(preview.stdout, /preflight passed.*not published/u);
      assert.equal(
        await fs.readFile(indexPath, "utf8").catch(() => null),
        before
      );
      const checked = await runInvestigationCli(root, ["check"]);
      assert.equal(checked.status, 1);
      const selected = await runInvestigationCli(root, [
        "sync-index",
        "--select",
        "report",
        "--preflight"
      ]);
      assert.equal(selected.status, 1);
      assert.match(selected.stderr, /valid baseline/u);
      const written = await runInvestigationCli(root, ["sync-index"]);
      assert.equal(written.status, 0, written.stderr);
      assert.equal(await fs.readFile(indexPath, "utf8"), baseline);
    }
    const current = await runInvestigationCli(root, [
      "sync-index",
      "--preflight"
    ]);
    assert.equal(current.status, 0, current.stderr);
    assert.match(current.stdout, /already current/u);
    assert.doesNotMatch(current.stdout, /not published/u);
  });
});
