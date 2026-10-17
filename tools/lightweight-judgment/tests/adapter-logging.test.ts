import assert from "node:assert/strict";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import { runCli } from "../src/cli.ts";
import { configured, input, openai, usage } from "./adapter-fixture.ts";
import { runtime } from "./runtime-fixture.ts";
import { object, decodeSuccess } from "./output.ts";
import { logFixture } from "./log-fixture.ts";
import { statisticsFixture, array, summary } from "./statistics-fixture.ts";
import fs from "node:fs";

test("schema v3 logs actual wire and carrier under request permission and stores usage once even on legitimate refusals", async () => {
  for (const saveRequest of [false, true])
    for (const saveResponse of [false, true]) {
      const fixture = logFixture();
      try {
        const raw = {
          model: "gpt-6-luna",
          answers: [{ type: "refusal", name: "q0" }],
          usage
        };
        let wire = "";
        let clock = 0;
        const outcome = await runCli(
          ["json", "--json", input("private state")],
          configured(
            {
              ...openai,
              logging: {
                enabled: true,
                databasePath: fixture.databasePath,
                saveRequest,
                saveResponse
              }
            },
            {
              now: () => ++clock,
              fetch: async (_url, init) => {
                assert.ok(typeof init.body === "string");
                wire = init.body;
                return new Response(JSON.stringify(raw));
              }
            }
          )
        );
        assert.equal(outcome.exitCode, 0, outcome.stdout);
        const envelope = decodeSuccess(outcome.stdout);
        assert.equal(object(envelope.normalized).completion, "refused");
        const db = new DatabaseSync(fixture.databasePath);
        try {
          const row = db.prepare("SELECT * FROM calls").get();
          assert.equal(row?.adapter_contract, "openai-decisions/v1");
          assert.equal(row?.request_json, saveRequest ? wire : null);
          assert.equal(
            row?.carrier_json,
            saveRequest
              ? input("private state").slice(0, -1) + ',"model":"gpt-6-luna"}'
              : null
          );
          assert.equal(row?.response_body === null, !saveResponse);
          assert.equal(row?.input_tokens, 23);
          assert.equal(row?.output_tokens, 0);
          assert.equal(row?.cost, null);
          assert.equal(row?.status, "succeeded");
          assert.equal(row?.request_bytes, Buffer.byteLength(wire));
          assert.equal(row?.elapsed_ms, envelope.meta.elapsedMs);
        } finally {
          db.close();
        }
      } finally {
        fixture.cleanup();
      }
    }
});

test("explicit v2 to v3 migration preserves old values and unknown adapters while normal calls and stats never upgrade", async () => {
  const migration = fs.readFileSync(
    new URL(
      "../../../skills/lightweight-judgment/migrations/log-v2-to-v3/migrate.sql",
      import.meta.url
    ),
    "utf8"
  );
  const fixture = statisticsFixture(2);
  try {
    fixture.insert({
      save_request: 1,
      save_response: 1,
      request_json: "private",
      response_body: Buffer.from([255, 0, 128]),
      input_tokens: 0,
      cost: 0,
      run_id: "batch",
      run_index: 1
    });
    const rows = fixture.database.prepare("SELECT * FROM calls").all();
    const before = fs.readFileSync(fixture.databasePath);
    const blocked = await runCli(
      ["stats", "--database", fixture.databasePath],
      runtime()
    );
    assert.equal(blocked.exitCode, 4);
    assert.deepEqual(fs.readFileSync(fixture.databasePath), before);
    fixture.database.exec(migration);
    assert.deepEqual(
      fixture.database.prepare("SELECT * FROM calls").all(),
      rows.map((row) =>
        Object.assign(Object.create(null), row, {
          adapter_contract: null,
          carrier_json: null
        })
      )
    );
    assert.equal(
      fixture.database.prepare("PRAGMA integrity_check").get()?.integrity_check,
      "ok"
    );
    fixture.insert({
      adapter_contract: "openai-decisions/v1",
      run_id: "batch",
      run_index: 2,
      elapsed_ms: 1
    });
    const stats = await fixture.stats(["--group-by", "adapterContract"]);
    const groups = array(stats.groups).map(object);
    assert.equal(summary(stats).calls, 2);
    assert.deepEqual(
      groups.map((g) => object(g.key).adapterContract),
      ["openai-decisions/v1", null]
    );
    const filtered = await fixture.stats([
      "--adapter-contract",
      "openai-decisions/v1"
    ]);
    assert.equal(summary(filtered).calls, 1);
    assert.equal(
      object(array(object(filtered.batchComparison).batches)[0]).partial,
      true
    );
    const bytes = fs.readFileSync(fixture.databasePath);
    assert.throws(() => fixture.database.exec(migration));
    fixture.database.exec("ROLLBACK");
    assert.deepEqual(fs.readFileSync(fixture.databasePath), bytes);
  } finally {
    fixture.cleanup();
  }
  for (const mutate of [
    "ALTER TABLE calls ADD COLUMN alien TEXT",
    "DROP INDEX calls_status;CREATE INDEX calls_status ON calls(status DESC)",
    "CREATE TABLE foreign_table(x TEXT)"
  ]) {
    const f = statisticsFixture(2);
    try {
      f.database.exec(mutate);
      const before = fs.readFileSync(f.databasePath);
      assert.throws(() => f.database.exec(migration));
      f.database.exec("ROLLBACK");
      assert.deepEqual(fs.readFileSync(f.databasePath), before);
    } finally {
      f.cleanup();
    }
  }
});
