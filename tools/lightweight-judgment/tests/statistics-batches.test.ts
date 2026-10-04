import assert from "node:assert/strict";
import fs from "node:fs";
import { test } from "node:test";
import { runCli } from "../src/cli.ts";
import { runtime, args } from "./runtime-fixture.ts";
import { decodeFailure, object } from "./output.ts";
import { statisticsFixture, array } from "./statistics-fixture.ts";
import { logFixture } from "./log-fixture.ts";

test("local metadata validates before send stays outside HTTP and logs exact UTF8 bytes independent of bodies", async () => {
  const fixture = logFixture();
  try {
    let sent = 0;
    for (const flags of [
      ["--run-id", "batch"],
      ["--run-index", "1"],
      ["--run-id", "batch", "--run-index", "0"],
      ["--tag", "x=1", "--tag", "x=2"]
    ]) {
      const blocked = await runCli(
        [...args, ...flags],
        fixture.runtime(
          {},
          {
            fetch: async () => {
              assert.fail("invalid metadata must not fetch");
            }
          }
        )
      );
      assert.equal(blocked.exitCode, 2);
    }
    assert.equal(fs.existsSync(fixture.databasePath), false);
    const response =
      '{"model":"jev-1.13","answers":{"answer":{"type":"noul","noul":0}},"id":"中文"}';
    let sentBody = "";
    const outcome = await runCli(
      [
        ...args,
        "--run-id",
        "batch",
        "--run-index",
        "1",
        "--tag",
        "__proto__=yes"
      ],
      fixture.runtime(
        { saveRequest: false, saveResponse: false },
        {
          fetch: async (_url, init) => {
            sent++;
            assert.equal(typeof init.body, "string");
            if (typeof init.body !== "string")
              assert.fail("expected string body");
            sentBody = init.body;
            assert.equal(sentBody.includes("batch"), false);
            assert.equal(sentBody.includes("__proto__"), false);
            return new Response(response);
          }
        }
      )
    );
    assert.equal(outcome.exitCode, 0, outcome.stdout);
    const { rows } = await import("./log-fixture.ts");
    const row = rows(fixture.databasePath)[0];
    assert.equal(row?.request_json, null);
    assert.equal(row?.response_body, null);
    assert.equal(row?.request_bytes, Buffer.byteLength(sentBody));
    assert.equal(row?.response_bytes, Buffer.byteLength(response));
    assert.equal(row?.local_tags, '{"__proto__":"yes"}');
    const duplicate = await runCli(
      [...args, "--run-id", "batch", "--run-index", "1"],
      fixture.runtime(
        {},
        {
          fetch: async () => {
            sent++;
            assert.fail("duplicate run index must not fetch");
          }
        }
      )
    );
    assert.equal(duplicate.exitCode, 4);
    assert.equal(decodeFailure(duplicate.stdout).meta.attempts, 0);
    assert.equal(sent, 1);
    const literal = await runCli(
      [
        "ask",
        "--type",
        "noul",
        "--text",
        "stats",
        "--question",
        "yes",
        "--dry-run"
      ],
      runtime()
    );
    assert.equal(literal.exitCode, 0, literal.stdout);
  } finally {
    fixture.cleanup();
  }
});

test("batch comparisons use explicit index one and nearest rank P50 rather than chronological or averaged median", async () => {
  const fixture = statisticsFixture();
  try {
    fixture.insert({
      run_id: "ordered",
      run_index: 2,
      elapsed_ms: 300,
      started_at: "2026-10-01T00:00:00.000Z"
    });
    fixture.insert({
      run_id: "ordered",
      run_index: 1,
      elapsed_ms: 900,
      started_at: "2026-10-01T00:01:00.000Z"
    });
    fixture.insert({ run_id: "ordered", run_index: 3, elapsed_ms: 1000 });
    fixture.insert({ elapsed_ms: 99999 });
    const compared = object((await fixture.stats()).batchComparison);
    const batch = object(array(compared.batches)[0]);
    assert.equal(batch.firstState, "measured");
    assert.equal(batch.laterP50Ms, 300);
    assert.equal(batch.firstMinusLaterP50Ms, 600);
    assert.equal(batch.firstOverLaterP50, 3);
    assert.equal(compared.unbatchedCalls, 1);
    assert.equal(compared.comparableRuns, 1);
    assert.equal(
      object(object(compared.firstElapsedMs).percentiles)["50"],
      900
    );
    assert.equal(
      object(object(compared.laterElapsedMs).percentiles)["50"],
      300
    );
    assert.equal(batch.partial, false);
    assert.equal(object(batch.first).callId, "call-2");
  } finally {
    fixture.cleanup();
  }
});

test("batch missing unfinished and filtered first calls remain distinct and partial cohorts never relabel earliest rows", async () => {
  const fixture = statisticsFixture();
  try {
    fixture.insert({ run_id: "missing", run_index: 2, elapsed_ms: 10 });
    fixture.insert({ run_id: "unfinished", run_index: 1, status: "started" });
    fixture.insert({ run_id: "unfinished", run_index: 2, elapsed_ms: 20 });
    fixture.insert({
      run_id: "filtered",
      run_index: 1,
      elapsed_ms: 100,
      request_model: "jev-old",
      started_at: "2026-09-01T00:00:00.000Z"
    });
    fixture.insert({ run_id: "filtered", run_index: 2, elapsed_ms: 30 });
    const result = await fixture.stats([
      "--from",
      "2026-10-01T00:00:00Z",
      "--request-model",
      "typesafe/jev-1.13"
    ]);
    const compared = object(result.batchComparison);
    const batches = array(compared.batches).map(object);
    assert.deepEqual(
      batches.map((item) => [item.runId, item.firstState, item.partial]),
      [
        ["filtered", "filtered", true],
        ["missing", "missing", false],
        ["unfinished", "unfinished", false]
      ]
    );
    assert.equal(compared.comparableRuns, 0);
    assert.equal(batches[0]?.first, null);
    assert.equal(batches[0]?.totalCalls, 2);
    assert.equal(object(compared.firstElapsedMs).count, 0);
    assert.equal(object(compared.firstElapsedMs).missing, 1);
    assert.equal(object(compared.laterElapsedMs).count, 3);
    const timeOnly = object(
      (
        await fixture.stats([
          "--from",
          "2026-10-01T00:00:00Z",
          "--run-id",
          "filtered"
        ])
      ).batchComparison
    );
    assert.equal(object(array(timeOnly.batches)[0]).firstState, "filtered");
    const modelOnly = object(
      (
        await fixture.stats([
          "--request-model",
          "typesafe/jev-1.13",
          "--run-id",
          "filtered"
        ])
      ).batchComparison
    );
    assert.equal(object(array(modelOnly.batches)[0]).firstState, "filtered");
  } finally {
    fixture.cleanup();
  }
});
