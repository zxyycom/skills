import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { DatabaseSync } from "node:sqlite";
import { runCli } from "../src/cli.ts";
import { runtime, args } from "./runtime-fixture.ts";
import { decodeSuccess, decodeFailure } from "./output.ts";
import { statisticsFixture, summary, metric } from "./statistics-fixture.ts";

const upgradeSql = fs.readFileSync(
  new URL(
    "../../../skills/lightweight-judgment/migrations/log-v1-to-v2/migrate.sql",
    import.meta.url
  ),
  "utf8"
);

test("bundled migration SQL upgrades a v1 copy while preserving original rows and enabling current reads and writes", async () => {
  const fixture = statisticsFixture(1);
  try {
    fixture.insert({
      id: "legacy",
      input_tokens: 11,
      save_request: 1,
      request_json: "retained"
    });
    const originalRows = fixture.database.prepare("SELECT * FROM calls").all();
    const before = fs.readFileSync(fixture.databasePath);
    const copyPath = path.join(fixture.directory, "upgraded.sqlite3");
    fixture.database.prepare("VACUUM INTO ?").run(copyPath);
    fs.chmodSync(copyPath, 0o600);
    const copy = new DatabaseSync(copyPath);
    try {
      copy.exec(upgradeSql);
      assert.equal(copy.prepare("PRAGMA user_version").get()?.user_version, 2);
      assert.equal(
        copy.prepare("PRAGMA integrity_check").get()?.integrity_check,
        "ok"
      );
      assert.deepEqual(
        copy
          .prepare("SELECT * FROM calls")
          .all()
          .map((row) => ({ ...row })),
        originalRows.map((row) => ({
          ...row,
          run_id: null,
          run_index: null,
          local_tags: null,
          request_bytes: 8,
          response_bytes: null
        }))
      );
      const stats = await runCli(["stats", "--database", copyPath], runtime());
      assert.equal(stats.exitCode, 0, stats.stdout);
      const result = decodeSuccess(stats.stdout).result;
      assert.equal(result.schemaVersion, 2);
      assert.equal(summary(result).calls, 1);
      const outcome = await runCli(
        [...args, "--run-id", "new", "--run-index", "1"],
        fixture.runtime({ databasePath: copyPath })
      );
      assert.equal(outcome.exitCode, 0, outcome.stdout);
      const newer = copy
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
      copy.close();
    }
    assert.equal(
      fixture.database.prepare("PRAGMA user_version").get()?.user_version,
      1
    );
    assert.deepEqual(
      fixture.database.prepare("SELECT * FROM calls").all(),
      originalRows
    );
    assert.deepEqual(fs.readFileSync(fixture.databasePath), before);
  } finally {
    fixture.cleanup();
  }
});

test("bundled migration SQL backfills exact retained bytes without inventing local metadata", async () => {
  const fixture = statisticsFixture(1);
  try {
    fixture.insert({
      id: "retained",
      status: "failed",
      error_kind: "invalid_response",
      save_request: 1,
      save_response: 1,
      request_json:
        '{"state":{"text":"中🙂","run_id":"not-local","tags":{"suite":"body"}}}',
      response_body: Buffer.from([0xff, 0x00, 0x80])
    });
    fixture.insert({
      id: "started",
      status: "started",
      save_request: 1,
      save_response: 1,
      request_json: '{"state":"x"}'
    });
    fixture.insert({
      id: "empty-response",
      status: "response_received",
      save_response: 1,
      response_body: Buffer.alloc(0)
    });
    fixture.insert({ id: "not-retained", input_tokens: 11 });
    fixture.database.exec(upgradeSql);
    for (const [id, requestBytes, responseBytes] of [
      ["retained", 73, 3],
      ["started", 13, null],
      ["empty-response", null, 0],
      ["not-retained", null, null]
    ] as const) {
      const row = fixture.database
        .prepare(
          "SELECT request_bytes, response_bytes, run_id, run_index, local_tags FROM calls WHERE id = ?"
        )
        .get(id);
      assert.deepEqual(
        { ...row },
        {
          request_bytes: requestBytes,
          response_bytes: responseBytes,
          run_id: null,
          run_index: null,
          local_tags: null
        }
      );
    }
    const result = await fixture.stats();
    assert.equal(summary(result).calls, 4);
    assert.equal(metric(result, "requestBytes").count, 2);
    assert.equal(metric(result, "requestBytes").missing, 2);
    assert.equal(metric(result, "requestBytes").sum, 86);
    assert.equal(metric(result, "responseBytes").count, 2);
    assert.equal(metric(result, "responseBytes").missing, 2);
    assert.equal(metric(result, "responseBytes").sum, 3);
  } finally {
    fixture.cleanup();
  }
});

test("bundled migration SQL rejects non UTF8 databases before deriving request byte lengths", () => {
  const fixture = statisticsFixture(1, "UTF-16le");
  try {
    fixture.insert({ save_request: 1, request_json: '{"state":"中🙂"}' });
    assert.equal(
      fixture.database.prepare("PRAGMA encoding").get()?.encoding,
      "UTF-16le"
    );
    const before = fs.readFileSync(fixture.databasePath);
    assert.throws(() => fixture.database.exec(upgradeSql));
    fixture.database.exec("ROLLBACK");
    assert.deepEqual(fs.readFileSync(fixture.databasePath), before);
  } finally {
    fixture.cleanup();
  }
});

test("bundled migration SQL rejects foreign or unsupported versions and rolls back partial upgrades", () => {
  for (const change of [
    "PRAGMA application_id=0",
    "PRAGMA user_version=2",
    "PRAGMA user_version=3",
    "ALTER TABLE calls ADD COLUMN response_bytes INTEGER",
    "CREATE INDEX calls_run_index ON calls(status)"
  ]) {
    const fixture = statisticsFixture(1);
    try {
      fixture.insert({
        input_tokens: 11,
        save_request: 1,
        request_json: "retained"
      });
      fixture.database.exec(change);
      const before = fs.readFileSync(fixture.databasePath);
      assert.throws(() => fixture.database.exec(upgradeSql));
      fixture.database.exec("ROLLBACK");
      assert.deepEqual(fs.readFileSync(fixture.databasePath), before);
    } finally {
      fixture.cleanup();
    }
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
      sql: "DROP INDEX calls_started_at; CREATE INDEX calls_started_at ON calls(started_at) WHERE status='failed'"
    },
    {
      sql: "DROP INDEX calls_started_at; CREATE UNIQUE INDEX calls_started_at ON calls(started_at)"
    },
    {
      sql: "DROP INDEX calls_started_at; CREATE INDEX calls_started_at ON calls(started_at DESC)"
    },
    {
      sql: "DROP INDEX calls_status; CREATE INDEX calls_status ON calls(status) WHERE status='failed'"
    },
    {
      sql: "DROP INDEX calls_status; CREATE UNIQUE INDEX calls_status ON calls(status)"
    },
    {
      sql: "DROP INDEX calls_status; CREATE INDEX calls_status ON calls(status COLLATE NOCASE)"
    },
    {
      sql: "DROP INDEX calls_run_index; CREATE INDEX calls_run_index ON calls(run_id,run_index) WHERE run_id IS NOT NULL"
    },
    {
      sql: "DROP INDEX calls_run_index; CREATE UNIQUE INDEX calls_run_index ON calls(run_id,run_index)"
    },
    {
      sql: "DROP INDEX calls_run_index; CREATE UNIQUE INDEX calls_run_index ON calls(run_id,run_index) WHERE run_id IS NOT NULL AND run_index > 0"
    },
    {
      sql: "DROP INDEX calls_run_index; CREATE UNIQUE INDEX calls_run_index ON calls(run_id,run_index DESC) WHERE run_id IS NOT NULL"
    }
  ] as const;
  for (const change of changes) {
    const fixture = statisticsFixture();
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
        2
      );
    } finally {
      fixture.cleanup();
    }
  }
});
