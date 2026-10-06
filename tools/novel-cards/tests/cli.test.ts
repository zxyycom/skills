import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";
import { runCli } from "../src/cli.ts";
import { cli, markdown, project, put } from "./test-support.ts";
const entry = path.resolve(
  import.meta.dirname,
  "../../../skills/novel-cards/scripts/novel-cards.mjs"
);

test("CLI rejects invalid usage and reports missing index with stable channels", async () => {
  await project(async (root) => {
    await put(root, "a", markdown("a"));
    for (const args of [
      ["sync-index"],
      ["show", "a", "--write"],
      ["expand", "a", "--depth", "21"],
      ["expand", "a", "--max-cards", "0"],
      ["check", "--depth", "1"],
      ["show", "a", "--root", root],
      ["show", "a", "--include-reference", "--include-reference"],
      ["expand", "a", "--depth=1", "--depth", "2"],
      ["expand", "a", "--max-cards=10", "--max-cards", "20"],
      ["sync-index", "--write", "--write"],
      ["show"],
      ["show", "a", "extra"],
      ["check", "a"],
      ["show", "a", "--root="],
      ["check", "--include-reference"],
      ["expand", "a", "--depth", "1.5"],
      ["find"],
      ["find", "--title", "a", "--chapter", "1"],
      ["find", "--title", "a", "--scope", "a"],
      ["find", "--chapter", "0"],
      ["find", "--chapter", "1", "--scope", "../a"],
      ["history"],
      ["new-id", "a"],
      ["recover"],
      ["apply-transition", "--write"],
      ["unknown"]
    ]) {
      const result = await cli(root, args);
      assert.equal(result.status, 2, JSON.stringify(args));
      assert.equal(result.stdout, "");
      assert.notEqual(result.stderr, "");
    }
    const missing = await cli(root, ["check"]);
    assert.equal(missing.status, 1);
    assert.match(missing.stdout, /index-invalid/u);
    assert.match(missing.stderr, /index-invalid/u);
    const synchronized = await cli(root, ["sync-index", "--write"]);
    assert.equal(synchronized.status, 0);
    assert.equal(synchronized.stderr, "");
    const absent = await cli(root, ["show", "absent"]);
    assert.equal(absent.status, 1);
    assert.match(absent.stdout, /card-not-found/u);
    const expanded = await cli(root, [
      "expand",
      "a",
      "--depth=0",
      "--max-cards=1"
    ]);
    assert.equal(expanded.status, 0);
    assert.match(expanded.stdout, /"complete":true/u);
    const help: string[] = [];
    assert.equal(
      await runCli(["--help"], {
        stdout: (text) => help.push(text),
        stderr: () => assert.fail("help has no diagnostics")
      }),
      0
    );
    assert.equal(help.length, 1);
    assert.match(help[0] ?? "", /Novel Cards/u);
  });
});

test("distributed CLI runs without workspace dependencies and importing has no side effects", async () => {
  await project(async (root) => {
    const standalone = path.join(root, "novel-cards.mjs");
    await fs.copyFile(entry, standalone);
    const imported = spawnSync(
      "node",
      [
        "--input-type=module",
        "-e",
        `await import(${JSON.stringify(pathToFileURL(standalone).href)});process.stdout.write('imported');`
      ],
      {
        cwd: root,
        encoding: "utf8",
        env: { PATH: process.env.PATH, HOME: root }
      }
    );
    assert.equal(imported.status, 0);
    assert.equal(imported.stdout, "imported");
    assert.equal(imported.stderr, "");
    await assert.rejects(fs.stat(path.join(root, "card-index.json")), {
      code: "ENOENT"
    });
    await put(root, "card", markdown("card"));
    const sync = spawnSync(
      "node",
      [standalone, "sync-index", "--write", "--root", root],
      { cwd: root, encoding: "utf8" }
    );
    assert.equal(sync.status, 0);
    assert.equal(sync.stderr, "");
    const shown = spawnSync(
      "node",
      [standalone, "show", "card", "--root", root],
      { cwd: root, encoding: "utf8" }
    );
    assert.equal(shown.status, 0);
    assert.match(shown.stdout, /"id":"card"/u);
    const check = spawnSync("node", [standalone, "check", "--root", root], {
      cwd: root,
      encoding: "utf8"
    });
    assert.equal(check.status, 0);
    assert.match(check.stdout, /"cardCount":1/u);
    const invalidUsage = spawnSync(
      "node",
      [standalone, "show", "cards/card.md", "--root", root],
      { cwd: root, encoding: "utf8" }
    );
    assert.equal(invalidUsage.status, 2);
    assert.equal(invalidUsage.stdout, "");
    assert.notEqual(invalidUsage.stderr, "");
    const absent = spawnSync(
      "node",
      [standalone, "show", "absent", "--root", root],
      { cwd: root, encoding: "utf8" }
    );
    assert.equal(absent.status, 1);
    assert.equal(absent.stdout.trim().split("\n").length, 1);
    assert.match(absent.stdout, /card-not-found/u);
    assert.match(absent.stderr, /card-not-found/u);
  });
});
