import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { runCli } from "../src/cli.ts";
import { runtime, args } from "./runtime-fixture.ts";
import { decodeSuccess, decodeFailure, object } from "./output.ts";
import {
  statisticsFixture,
  summary,
  metric,
  array
} from "./statistics-fixture.ts";

test("stats reads legacy v1 without migration or raw retention access", async () => {
  const fixture = statisticsFixture(1);
  try {
    fixture.insert({
      input_tokens: 7,
      output_tokens: 0,
      elapsed_ms: 100,
      request_json: "PRIVATE-REQUEST",
      response_body: Buffer.from("PRIVATE-RESPONSE")
    });
    const before = fs.readFileSync(fixture.databasePath);
    const result = await fixture.stats();
    assert.equal(result.schemaVersion, 1);
    assert.equal(summary(result).calls, 1);
    assert.equal(metric(result, "requestBytes").missing, 1);
    assert.equal(JSON.stringify(result).includes("PRIVATE"), false);
    assert.equal(
      fixture.database.prepare("PRAGMA user_version").get()?.user_version,
      1
    );
    assert.deepEqual(fs.readFileSync(fixture.databasePath), before);
  } finally {
    fixture.cleanup();
  }
});

test(
  "stats rejects nonprivate and symlink files without changing targets",
  { skip: process.platform === "win32" },
  async () => {
    const fixture = statisticsFixture();
    try {
      fixture.insert();
      const before = fs.readFileSync(fixture.databasePath);
      fs.chmodSync(fixture.databasePath, 0o644);
      const blocked = await runCli(
        ["stats", "--database", fixture.databasePath],
        runtime()
      );
      assert.equal(blocked.exitCode, 4);
      fs.chmodSync(fixture.databasePath, 0o600);
      const linked = path.join(fixture.directory, "linked.db");
      fs.symlinkSync(fixture.databasePath, linked);
      assert.equal(
        (await runCli(["stats", "--database", linked], runtime())).exitCode,
        4
      );
      assert.deepEqual(fs.readFileSync(fixture.databasePath), before);
      assert.equal(fs.readlinkSync(linked), fixture.databasePath);
    } finally {
      fixture.cleanup();
    }
  }
);

test("stats uses logging OFF history without resolving keys or invoking HTTP", async () => {
  const fixture = statisticsFixture();
  try {
    fixture.insert();
    const env = { LIGHTWEIGHT_JUDGMENT_CONFIG: "/private/config.json" };
    Object.defineProperty(env, "OPENROUTER_API_KEY", {
      get: () => {
        throw new Error("must not access key");
      }
    });
    const outcome = await runCli(
      ["stats"],
      runtime({
        env,
        readFile: async () =>
          JSON.stringify({
            logging: { enabled: false, databasePath: fixture.databasePath }
          }),
        fetch: async () => {
          assert.fail("must not fetch");
        }
      })
    );
    assert.equal(outcome.exitCode, 0, outcome.stdout);
    assert.equal(decodeSuccess(outcome.stdout).meta.attempts, 0);
    assert.equal(summary(decodeSuccess(outcome.stdout).result).calls, 1);
    const explicit = await runCli(
      ["stats", "--database", fixture.databasePath],
      runtime({
        env,
        readFile: async () => {
          assert.fail("explicit database skips config");
        },
        fetch: async () => {
          assert.fail("must not fetch");
        }
      })
    );
    assert.equal(explicit.exitCode, 0);
  } finally {
    fixture.cleanup();
  }
});

test("stats sees committed active WAL data and preserves a consistent transaction snapshot", async () => {
  const fixture = statisticsFixture();
  try {
    fixture.database.exec(
      "PRAGMA journal_mode=WAL; PRAGMA wal_autocheckpoint=0"
    );
    fixture.insert({ elapsed_ms: 100 });
    assert.ok(fs.statSync(`${fixture.databasePath}-wal`).size > 0);
    const before = fs.readFileSync(fixture.databasePath);
    const result = await fixture.stats();
    assert.equal(summary(result).calls, 1);
    assert.deepEqual(fs.readFileSync(fixture.databasePath), before);
    assert.equal(
      fixture.database.prepare("PRAGMA user_version").get()?.user_version,
      2
    );
    assert.equal(
      fixture.database.prepare("PRAGMA journal_mode").get()?.journal_mode,
      "wal"
    );
    const { openStatisticsDatabase } = await import("../src/call-database.ts");
    const { database: reader } = openStatisticsDatabase(fixture.databasePath);
    try {
      const beforeCount = reader
        .prepare("SELECT COUNT(*) AS count FROM calls")
        .get()?.count;
      fixture.insert({ elapsed_ms: 200 });
      assert.equal(
        reader.prepare("SELECT COUNT(*) AS count FROM calls").get()?.count,
        beforeCount
      );
      assert.equal(beforeCount, 1);
    } finally {
      reader.exec("ROLLBACK");
      reader.close();
    }
    assert.equal(summary(await fixture.stats()).calls, 2);
  } finally {
    fixture.cleanup();
  }
});

test("legacy and migrated NULL tags never inherit prototype names during grouping", async () => {
  const fixture = statisticsFixture(1);
  try {
    fixture.insert();
    const flags = ["--group-by", "tag:constructor,tag:toString,tag:__proto__"];
    for (const version of [1, 2]) {
      if (version === 2) {
        const invoked = await runCli(args, fixture.runtime());
        assert.equal(invoked.exitCode, 0, invoked.stdout);
      }
      const result = await fixture.stats(flags);
      const groups = array(result.groups);
      assert.equal(result.schemaVersion, version);
      assert.equal(groups.length, 1);
      assert.deepEqual(object(object(groups[0]).key), {
        "tag:constructor": null,
        "tag:toString": null,
        "tag:__proto__": null
      });
      assert.equal(object(object(groups[0]).summary).calls, version);
      assert.equal(JSON.stringify(result).includes("undefined"), false);
    }
  } finally {
    fixture.cleanup();
  }
});

test("stats validates stored JSON tag fields without reinterpreting CLI key value text", async () => {
  const fixture = statisticsFixture();
  try {
    fixture.insert({
      local_tags: '{"suite":"a=b","__proto__":"yes","constructor":"owned"}'
    });
    const selected = await fixture.stats([
      "--tag",
      "suite=a=b",
      "--group-by",
      "tag:suite,tag:__proto__,tag:constructor"
    ]);
    const groups = array(selected.groups);
    assert.equal(groups.length, 1);
    assert.deepEqual(object(object(groups[0]).key), {
      "tag:suite": "a=b",
      "tag:__proto__": "yes",
      "tag:constructor": "owned"
    });
    fixture.database
      .prepare("UPDATE calls SET local_tags = ?")
      .run('{"bad=key":"value"}');
    const blocked = await runCli(
      ["stats", "--database", fixture.databasePath],
      runtime()
    );
    assert.equal(blocked.exitCode, 4);
    const output = decodeFailure(blocked.stdout);
    assert.equal(output.error.kind, "storage");
    assert.equal(output.meta.attempts, 0);
    assert.equal(output.meta.persistence, undefined);
    assert.equal(output.result, null);
  } finally {
    fixture.cleanup();
  }
});

test("local run ID constraints apply independently to CLI and stored database values", async () => {
  const fixture = statisticsFixture();
  try {
    fixture.insert({ run_id: "a", run_index: 1, elapsed_ms: 30 });
    for (const runId of ["a", "x".repeat(128)]) {
      fixture.database.prepare("UPDATE calls SET run_id = ?").run(runId);
      const batch = object(
        array(object((await fixture.stats()).batchComparison).batches)[0]
      );
      assert.equal(batch.runId, runId);
      assert.equal(batch.firstState, "measured");
    }
    for (const runId of ["", "a b", "x".repeat(129), "a\u0001b"]) {
      const inference = await runCli(
        [...args, "--run-id", runId, "--run-index", "1"],
        fixture.runtime(
          {},
          {
            fetch: async () => {
              assert.fail("invalid run ID must not fetch");
            }
          }
        )
      );
      assert.equal(inference.exitCode, 2);
      assert.match(
        decodeFailure(inference.stdout).error.message,
        /^--run-id:/u
      );
      fixture.database.prepare("UPDATE calls SET run_id = ?").run(runId);
      const blocked = await runCli(
        ["stats", "--database", fixture.databasePath],
        runtime()
      );
      assert.equal(blocked.exitCode, 4);
      const output = decodeFailure(blocked.stdout);
      assert.equal(output.error.kind, "storage");
      assert.equal(output.result, null);
      assert.equal(output.meta.attempts, 0);
      assert.equal(output.meta.persistence, undefined);
    }
  } finally {
    fixture.cleanup();
  }
});
