import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { test } from "node:test";
import { runCli } from "../src/cli.ts";
import { decodeFailure } from "./output.ts";
import { args } from "./runtime-fixture.ts";
import { logFixture } from "./log-fixture.ts";

test("unsupported database versions remain unchanged without sending", async () => {
  const fixture = logFixture();
  try {
    const database = new DatabaseSync(fixture.databasePath);
    database.exec(
      "PRAGMA application_id = 1246058033; PRAGMA user_version = 3; CREATE TABLE retained (value TEXT); INSERT INTO retained VALUES ('keep')"
    );
    database.close();
    fs.chmodSync(fixture.databasePath, 0o600);
    const before = fs.readFileSync(fixture.databasePath);
    let sent = 0;
    const result = await runCli(
      args,
      fixture.runtime(
        {},
        {
          fetch: async () => {
            sent++;
            throw new Error("must not send");
          }
        }
      )
    );
    const output = decodeFailure(result.stdout);
    assert.equal(result.exitCode, 4);
    assert.equal(output.error.kind, "storage");
    assert.equal(output.meta.attempts, 0);
    assert.equal(output.meta.persistence?.status, "failed");
    assert.equal(sent, 0);
    assert.deepEqual(fs.readFileSync(fixture.databasePath), before);
    assert.match(output.error.message, /migrations\/README\.md/u);
  } finally {
    fixture.cleanup();
  }
});

test(
  "symlink access rejects an otherwise usable database without changing its target",
  { skip: process.platform === "win32" },
  async () => {
    const fixture = logFixture();
    try {
      const accepted = await runCli(args, fixture.runtime());
      assert.equal(accepted.exitCode, 0);
      const before = fs.readFileSync(fixture.databasePath);
      const symlink = path.join(fixture.directory, "linked.sqlite3");
      fs.symlinkSync(fixture.databasePath, symlink);
      let sent = 0;
      const blocked = await runCli(
        args,
        fixture.runtime(
          { databasePath: symlink },
          {
            fetch: async () => {
              sent++;
              throw new Error("must not send");
            }
          }
        )
      );
      const output = decodeFailure(blocked.stdout);
      assert.equal(blocked.exitCode, 4);
      assert.equal(output.error.kind, "storage");
      assert.match(output.error.message, /不接受符号链接/u);
      assert.equal(output.meta.attempts, 0);
      assert.equal(output.meta.persistence?.status, "failed");
      assert.equal(sent, 0);
      assert.equal(fs.readlinkSync(symlink), fixture.databasePath);
      assert.deepEqual(fs.readFileSync(fixture.databasePath), before);
    } finally {
      fixture.cleanup();
    }
  }
);
