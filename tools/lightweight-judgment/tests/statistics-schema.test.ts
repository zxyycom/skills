import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { runCli } from "../src/cli.ts";
import { runtime, args } from "./runtime-fixture.ts";
import { decodeFailure } from "./output.ts";
import { statisticsFixture, summary } from "./statistics-fixture.ts";

test("ordinary logged inference atomically upgrades v1 while preserving old rows", async () => {
  const fixture = statisticsFixture(1);
  try {
    fixture.insert({
      id: "legacy",
      input_tokens: 11,
      request_json: "retained"
    });
    const outcome = await runCli(
      [...args, "--run-id", "new", "--run-index", "1"],
      fixture.runtime()
    );
    assert.equal(outcome.exitCode, 0, outcome.stdout);
    assert.equal(
      fixture.database.prepare("PRAGMA user_version").get()?.user_version,
      2
    );
    const legacy = fixture.database
      .prepare(
        "SELECT request_json, input_tokens, run_id, request_bytes FROM calls WHERE id='legacy'"
      )
      .get();
    assert.deepEqual(
      { ...legacy },
      {
        request_json: "retained",
        input_tokens: 11,
        run_id: null,
        request_bytes: null
      }
    );
    const newer = fixture.database
      .prepare(
        "SELECT run_id,run_index,request_bytes FROM calls WHERE id <> 'legacy'"
      )
      .get();
    assert.equal(newer?.run_id, "new");
    assert.equal(newer?.run_index, 1);
    assert.ok(
      typeof newer?.request_bytes === "number" && newer.request_bytes > 0
    );
  } finally {
    fixture.cleanup();
  }
});

test("stats missing foreign unsupported and malformed databases fail without creation or mutation", async () => {
  const fixture = statisticsFixture();
  try {
    const missing = path.join(fixture.directory, "absent", "calls.db");
    const missingResult = await runCli(
      ["stats", "--database", missing],
      runtime()
    );
    assert.equal(missingResult.exitCode, 4);
    assert.equal(fs.existsSync(path.dirname(missing)), false);
    assert.equal(
      decodeFailure(missingResult.stdout).meta.persistence,
      undefined
    );
    assert.match(missingResult.stderr, /不创建数据库/u);
    for (const change of [
      "PRAGMA application_id=0",
      "PRAGMA application_id=1246058033; PRAGMA user_version=3",
      "PRAGMA user_version=2; ALTER TABLE calls ADD COLUMN foreign_column TEXT"
    ]) {
      fixture.database.exec(change);
      const before = fs.readFileSync(fixture.databasePath);
      const blocked = await runCli(
        ["stats", "--database", fixture.databasePath],
        runtime()
      );
      assert.equal(blocked.exitCode, 4);
      assert.equal(decodeFailure(blocked.stdout).error.kind, "storage");
      assert.equal(decodeFailure(blocked.stdout).meta.persistence, undefined);
      assert.deepEqual(fs.readFileSync(fixture.databasePath), before);
    }
  } finally {
    fixture.cleanup();
  }
});

test("stats and writer reject altered fixed index layouts without mutating databases", async () => {
  const changes = [
    {
      version: 1,
      sql: "DROP INDEX calls_started_at; CREATE INDEX calls_started_at ON calls(started_at) WHERE status='failed'"
    },
    {
      version: 1,
      sql: "DROP INDEX calls_started_at; CREATE UNIQUE INDEX calls_started_at ON calls(started_at)"
    },
    {
      version: 1,
      sql: "DROP INDEX calls_started_at; CREATE INDEX calls_started_at ON calls(started_at DESC)"
    },
    {
      version: 2,
      sql: "DROP INDEX calls_status; CREATE INDEX calls_status ON calls(status) WHERE status='failed'"
    },
    {
      version: 2,
      sql: "DROP INDEX calls_status; CREATE UNIQUE INDEX calls_status ON calls(status)"
    },
    {
      version: 2,
      sql: "DROP INDEX calls_status; CREATE INDEX calls_status ON calls(status COLLATE NOCASE)"
    },
    {
      version: 2,
      sql: "DROP INDEX calls_run_index; CREATE INDEX calls_run_index ON calls(run_id,run_index) WHERE run_id IS NOT NULL"
    },
    {
      version: 2,
      sql: "DROP INDEX calls_run_index; CREATE UNIQUE INDEX calls_run_index ON calls(run_id,run_index)"
    },
    {
      version: 2,
      sql: "DROP INDEX calls_run_index; CREATE UNIQUE INDEX calls_run_index ON calls(run_id,run_index) WHERE run_id IS NOT NULL AND run_index > 0"
    },
    {
      version: 2,
      sql: "DROP INDEX calls_run_index; CREATE UNIQUE INDEX calls_run_index ON calls(run_id,run_index DESC) WHERE run_id IS NOT NULL"
    }
  ] as const;
  for (const change of changes) {
    const fixture = statisticsFixture(change.version);
    try {
      fixture.insert({ elapsed_ms: 100 });
      assert.equal(summary(await fixture.stats()).calls, 1);
      fixture.database.exec(change.sql);
      const before = fs.readFileSync(fixture.databasePath);
      const blocked = await runCli(
        ["stats", "--database", fixture.databasePath],
        runtime()
      );
      assert.equal(blocked.exitCode, 4, change.sql);
      const output = decodeFailure(blocked.stdout);
      assert.equal(output.error.kind, "storage");
      assert.equal(output.meta.attempts, 0);
      assert.equal(output.meta.persistence, undefined);
      assert.equal(output.result, null);
      const writer = await runCli(
        args,
        fixture.runtime(
          {},
          {
            fetch: async () => {
              assert.fail("altered index must block HTTP");
            }
          }
        )
      );
      assert.equal(writer.exitCode, 4, change.sql);
      assert.equal(decodeFailure(writer.stdout).meta.attempts, 0);
      assert.deepEqual(fs.readFileSync(fixture.databasePath), before);
      assert.equal(
        fixture.database.prepare("PRAGMA user_version").get()?.user_version,
        change.version
      );
    } finally {
      fixture.cleanup();
    }
  }
});
