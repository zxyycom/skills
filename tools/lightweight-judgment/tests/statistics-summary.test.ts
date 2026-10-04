import assert from "node:assert/strict";
import { test } from "node:test";
import { runCli } from "../src/cli.ts";
import { distribution } from "../src/statistics-summary.ts";
import { runtime } from "./runtime-fixture.ts";
import { decodeFailure, object } from "./output.ts";
import {
  statisticsFixture,
  summary,
  metric,
  array
} from "./statistics-fixture.ts";

test("stats fixed nearest rank quantiles NULL coverage and bucket boundaries remain request level", async () => {
  const fixture = statisticsFixture();
  try {
    for (const [elapsed, tokens, bytes] of [
      [100, 0, 0],
      [300, 10, 100],
      [1000, 20, 200]
    ])
      fixture.insert({
        elapsed_ms: elapsed ?? null,
        input_tokens: tokens ?? null,
        output_tokens: 0,
        request_bytes: bytes ?? null,
        question_count: 2
      });
    fixture.insert({ status: "started" });
    const result = await fixture.stats([
      "--percentiles",
      "50,100",
      "--bucket",
      "requestBytes=100,200"
    ]);
    assert.equal(object(result.method).quantiles, "nearest-rank-ceil(p/100*n)");
    assert.deepEqual(object(metric(result, "elapsedMs").percentiles), {
      "50": 300,
      "100": 1000
    });
    assert.equal(metric(result, "inputTokens").sum, 30);
    assert.equal(metric(result, "inputTokens").count, 3);
    assert.equal(metric(result, "inputTokens").missing, 1);
    assert.equal(metric(result, "outputTokens").sum, 0);
    assert.equal(summary(result).unfinished, 1);
    const bucket = object(array(summary(result).buckets)[0]);
    assert.equal(bucket.missing, 1);
    assert.deepEqual(
      array(bucket.intervals).map((item) => object(item).count),
      [1, 1, 1]
    );
    const empty = await fixture.stats(["--status", "failed"]);
    assert.equal(summary(empty).calls, 0);
    assert.equal(metric(empty, "inputTokens").sum, null);
    assert.equal(object(metric(empty, "elapsedMs").percentiles)["50"], null);
  } finally {
    fixture.cleanup();
  }
});

test("stats UTC half open windows and combined exact filters exclude boundaries and SQL injection", async () => {
  const fixture = statisticsFixture();
  try {
    fixture.insert({
      started_at: "2026-10-01T00:00:00.000Z",
      response_model: "real-a",
      local_tags: '{"suite":"a"}'
    });
    fixture.insert({
      started_at: "2026-10-01T01:00:00.000Z",
      response_model: "real-b",
      status: "failed"
    });
    fixture.insert({
      started_at: "2026-10-01T02:00:00.000Z",
      local_tags: '{"suite":"a"}'
    });
    const flags = [
      "--from",
      "2026-10-01T00:00:00Z",
      "--to",
      "2026-10-01T02:00:00Z",
      "--response-model",
      "real-a",
      "--request-model",
      "typesafe/jev-1.13",
      "--endpoint",
      "https://first.test/systemone",
      "--status",
      "succeeded",
      "--tag",
      "suite=a"
    ];
    assert.equal(summary(await fixture.stats(flags)).calls, 1);
    assert.equal(
      summary(await fixture.stats(["--endpoint", "' OR 1=1 --"])).calls,
      0
    );
    assert.equal(
      summary(await fixture.stats(["--tag", "suite=' OR 1=1 --"])).calls,
      0
    );
    assert.equal(
      fixture.database.prepare("SELECT COUNT(*) AS n FROM calls").get()?.n,
      3
    );
  } finally {
    fixture.cleanup();
  }
});

test("stats prototype named tags group safely and retain errors repeated calls and endpoint isolated costs", async () => {
  const fixture = statisticsFixture();
  try {
    fixture.insert({
      local_tags: '{"__proto__":"yes","constructor":"x"}',
      cost: 1,
      error_kind: "timeout",
      status: "indeterminate",
      input_tokens: 5
    });
    fixture.insert({
      local_tags: '{"__proto__":"yes","constructor":"x"}',
      cost: 2,
      input_tokens: 5
    });
    fixture.insert({
      endpoint: "https://second.test/systemone",
      local_tags: '{"__proto__":"no"}',
      cost: 3
    });
    const result = await fixture.stats([
      "--group-by",
      "endpoint,tag:__proto__,tag:constructor,status"
    ]);
    assert.equal(summary(result).calls, 3);
    assert.equal(metric(result, "inputTokens").sum, 10);
    assert.equal(array(result.groups).length, 3);
    assert.deepEqual(
      array(summary(result).reportedCostByEndpoint).map(
        (item) => object(object(item).distribution).sum
      ),
      [3, 3]
    );
    assert.deepEqual(
      array(summary(result).errors).map((item) => object(item)),
      [{ kind: "timeout", count: 1 }]
    );
    assert.equal(
      summary(
        await fixture.stats([
          "--tag",
          "__proto__=yes",
          "--tag",
          "constructor=x"
        ])
      ).calls,
      2
    );
  } finally {
    fixture.cleanup();
  }
});

test("stats invalid tags windows buckets and row budgets reject rather than truncate or round unsafe sums", async () => {
  const fixture = statisticsFixture();
  try {
    fixture.insert({ input_tokens: Number.MAX_SAFE_INTEGER });
    fixture.insert({ input_tokens: 1 });
    for (const flags of [
      ["--tag", "x=1", "--tag", "x=2"],
      ["--tag", "x');DROP=1"],
      ["--from", "2026-02-30T00:00:00Z"],
      ["--to", "2026-01-01T00:00:00+00:00"],
      ["--bucket", "requestBytes=20,10"],
      ["--group-by", "request_json"],
      ["--percentiles", "0,50"],
      ["--max-rows", "9007199254740992"]
    ]) {
      const outcome = await runCli(
        ["stats", "--database", fixture.databasePath, ...flags],
        runtime()
      );
      assert.equal(outcome.exitCode, 2, outcome.stdout);
      assert.equal(decodeFailure(outcome.stdout).meta.attempts, 0);
    }
    for (const flags of [[], ["--max-rows", "1"]]) {
      const outcome = await runCli(
        ["stats", "--database", fixture.databasePath, ...flags],
        runtime()
      );
      assert.equal(outcome.exitCode, 4);
      assert.equal(decodeFailure(outcome.stdout).result, null);
    }
    fixture.database.exec("UPDATE calls SET input_tokens=1");
    assert.equal(summary(await fixture.stats(["--max-rows", "2"])).calls, 2);
  } finally {
    fixture.cleanup();
  }
});

test("stats nearest rank uses exact decimal ranks at integer boundaries and tiny positive percentiles", () => {
  const hundreds = Array.from({ length: 100 }, (_, index) => index + 1);
  const percentiles = [7, 14, 28, 56];
  assert.deepEqual(
    { ...object(object(distribution(hundreds, percentiles)).percentiles) },
    {
      "7": 7,
      "14": 14,
      "28": 28,
      "56": 56
    }
  );
  const thousands = Array.from({ length: 5000 }, (_, index) => index + 1);
  assert.equal(
    object(object(distribution(thousands, [0.14])).percentiles)["0.14"],
    7
  );
  assert.equal(
    object(object(distribution(hundreds, [Number.MIN_VALUE])).percentiles)[
      String(Number.MIN_VALUE)
    ],
    1
  );
});

test("stats invalid tag grouping diagnoses group by keys before database access", async () => {
  for (const key of ["", "bad key", "bad=key", "x".repeat(65), "1invalid"]) {
    const outcome = await runCli(
      [
        "stats",
        "--database",
        "/absent/never-opened.sqlite3",
        "--group-by",
        `tag:${key}`
      ],
      runtime()
    );
    assert.equal(outcome.exitCode, 2);
    const output = decodeFailure(outcome.stdout);
    assert.equal(output.error.kind, "input");
    assert.match(output.error.message, /^--group-by: tag:<key>/u);
    assert.match(output.error.message, /\[A-Za-z_\]\[A-Za-z0-9_.-\]\{0,63\}/u);
    assert.equal(output.error.message.includes("key=value"), false);
    assert.equal(output.error.message.includes("唯一"), false);
    assert.equal(outcome.stderr, `${output.error.message}\n`);
    assert.equal(output.meta.attempts, 0);
    assert.equal(output.meta.persistence, undefined);
    assert.equal(output.result, null);
  }
});
