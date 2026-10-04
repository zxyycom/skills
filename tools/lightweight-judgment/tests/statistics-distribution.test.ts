import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { statisticsFixture, summary } from "./statistics-fixture.ts";
import { decodeSuccess, decodeFailure } from "./output.ts";

test("standalone Node stats reads v1 and active WAL without configuration keys network or workspace packages", async () => {
  const fixture = statisticsFixture(1);
  try {
    fixture.database.exec(
      "PRAGMA journal_mode=WAL; PRAGMA wal_autocheckpoint=0"
    );
    fixture.insert({ input_tokens: 9 });
    const entry = path.resolve(
      import.meta.dirname,
      "../../../skills/lightweight-judgment/scripts/lightweight-judgment.mjs"
    );
    const standalone = path.join(fixture.directory, "judgment.mjs");
    fs.copyFileSync(entry, standalone);
    const env = {
      PATH: process.env.PATH,
      HOME: fixture.directory,
      LIGHTWEIGHT_JUDGMENT_CONFIG: path.join(
        fixture.directory,
        "missing-config"
      )
    };
    const before = fs.readFileSync(fixture.databasePath);
    const child = spawnSync(
      "node",
      [standalone, "stats", "--database", fixture.databasePath],
      { cwd: fixture.directory, env, encoding: "utf8" }
    );
    assert.equal(child.status, 0, child.stdout + child.stderr);
    const output = decodeSuccess(child.stdout);
    assert.equal(output.meta.attempts, 0);
    assert.equal(summary(output.result).calls, 1);
    assert.equal(output.result.schemaVersion, 1);
    assert.equal(output.meta.persistence, undefined);
    assert.deepEqual(fs.readFileSync(fixture.databasePath), before);
    assert.equal(
      fixture.database.prepare("PRAGMA user_version").get()?.user_version,
      1
    );
    const absent = path.join(fixture.directory, "absent.db");
    const blocked = spawnSync(
      "node",
      [standalone, "stats", "--database", absent],
      { cwd: fixture.directory, env, encoding: "utf8" }
    );
    assert.equal(blocked.status, 4);
    assert.equal(decodeFailure(blocked.stdout).meta.persistence, undefined);
    assert.equal(fs.existsSync(absent), false);
    const help = spawnSync("node", [standalone, "--help"], {
      cwd: fixture.directory,
      env,
      encoding: "utf8"
    });
    assert.equal(help.status, 0);
    assert.ok(help.stdout.includes("stats"));
  } finally {
    fixture.cleanup();
  }
});
