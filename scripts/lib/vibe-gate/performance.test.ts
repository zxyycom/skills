import assert from "node:assert/strict";
import test from "node:test";
import {
  evaluateGatePerformance,
  type GatePerformanceInput
} from "./performance.ts";

function evaluate(
  durations: readonly (number | null)[] | null,
  overrides: Partial<GatePerformanceInput> = {}
) {
  return evaluateGatePerformance({
    enforceBudget: true,
    totalWallClockMs: 100,
    checkDurations:
      durations?.map((durationMs, index) => ({
        checkId: `check-${index}`,
        durationMs
      })) ?? null,
    ...overrides
  });
}

test("Gate quick performance rejects each budget at and above its strict boundary", () => {
  for (const offset of [-1, 0, 1]) {
    const cases = [
      {
        metric: "totalWallClockMs",
        durations: [100],
        wall: 30_000 + offset,
        limit: 30_000
      },
      {
        metric: "p90Ms",
        durations: [
          ...Array<number>(8).fill(0),
          10_000 + offset,
          10_000 + offset
        ],
        wall: 100,
        limit: 10_000
      },
      { metric: "meanMs", durations: [5_000 + offset], wall: 100, limit: 5_000 }
    ];
    for (const { metric, durations, wall, limit } of cases) {
      const report = evaluate(durations, { totalWallClockMs: wall });
      assert.equal(report.status, "available");
      assert.equal(report.passed, offset < 0, `${metric}: ${offset}`);
      assert.deepEqual(
        report.violations,
        offset < 0 ? [] : [{ metric, actualMs: limit + offset, limitMs: limit }]
      );
    }
  }
});

test("Gate performance uses nearest-rank P90 for small and unordered samples", () => {
  for (const { samples, mean, p90 } of [
    { samples: [7], mean: 7, p90: 7 },
    { samples: [3, 1], mean: 2, p90: 3 },
    { samples: [90, 10, 100, 20, 30, 40, 50, 60, 70, 80], mean: 55, p90: 90 },
    {
      samples: [110, 90, 10, 100, 20, 30, 40, 50, 60, 70, 80],
      mean: 60,
      p90: 100
    }
  ]) {
    const report = evaluate(samples);
    assert.equal(report.meanMs, mean);
    assert.equal(report.p90Ms, p90);
    assert.equal(report.sampleCount, samples.length);
    assert.equal(report.passed, true);
  }
});

test("Gate performance excludes native nulls without discarding measured zero", () => {
  const slow = evaluate([null, 10_000, ...Array<null>(20).fill(null)]);
  assert.equal(slow.sampleCount, 1);
  assert.equal(slow.meanMs, 10_000);
  assert.equal(slow.p90Ms, 10_000);
  assert.equal(slow.passed, false);
  const zero = evaluate([null, 0, null], { totalWallClockMs: 0 });
  assert.equal(zero.sampleCount, 1);
  assert.equal(zero.meanMs, 0);
  assert.equal(zero.p90Ms, 0);
  assert.equal(zero.passed, true);
});

test("Gate enforced performance treats missing wall or execution samples as unavailable", () => {
  for (const samples of [null, [], [null, null]]) {
    const report = evaluate(samples);
    assert.equal(report.status, "unavailable");
    assert.equal(report.passed, false);
    assert.equal(report.sampleCount, 0);
    assert.equal(report.meanMs, null);
    assert.equal(report.p90Ms, null);
    assert.deepEqual(report.issues, ["check-durations-missing"]);
  }
  const missingWall = evaluate([1], { totalWallClockMs: null });
  assert.equal(missingWall.status, "unavailable");
  assert.equal(missingWall.totalWallClockMs, null);
  assert.equal(missingWall.passed, false);
  assert.deepEqual(missingWall.issues, ["wall-clock-missing"]);
});

test("Gate performance rejects invalid measurements with bounded JSON-safe reporting", () => {
  for (const invalid of [-1, NaN, Infinity, -Infinity]) {
    const wall = evaluate([1], { totalWallClockMs: invalid });
    assert.equal(wall.status, "invalid");
    assert.equal(wall.totalWallClockMs, null);
    assert.equal(wall.passed, false);
    assert.deepEqual(wall.issues, ["wall-clock-invalid"]);
    const checks = evaluate([1, invalid]);
    assert.equal(checks.status, "invalid");
    assert.equal(checks.passed, false);
    assert.equal(checks.meanMs, null);
    assert.equal(checks.p90Ms, null);
    assert.deepEqual(checks.issues, ["check-duration-invalid"]);
  }
  const bounded = evaluate(null, {
    totalWallClockMs: NaN,
    checkDurations: Array.from({ length: 100 }, () => ({
      checkId: "untrusted\n\u001b[31m",
      durationMs: Infinity
    }))
  });
  assert.deepEqual(bounded.issues, [
    "wall-clock-invalid",
    "check-duration-invalid"
  ]);
  assert.ok(JSON.stringify(bounded).length < 500);
  assert.ok(!JSON.stringify(bounded).includes("untrusted"));
  const extreme = evaluate([Number.MAX_VALUE, Number.MAX_VALUE]);
  assert.equal(extreme.status, "available");
  assert.equal(extreme.meanMs, Number.MAX_VALUE);
  assert.equal(extreme.p90Ms, Number.MAX_VALUE);
  assert.equal(extreme.violations.length, 2);
});

test("Gate report-only performance preserves violations and measurement status without blocking", () => {
  const enforced = evaluate([10_000], { totalWallClockMs: 30_000 });
  const reportOnly = evaluate([10_000], {
    totalWallClockMs: 30_000,
    enforceBudget: false
  });
  assert.equal(enforced.passed, false);
  assert.equal(reportOnly.passed, true);
  assert.equal(reportOnly.status, "available");
  assert.deepEqual(reportOnly, {
    ...enforced,
    enforceBudget: false,
    passed: true
  });
  assert.equal(reportOnly.violations.length, 3);
  for (const report of [
    evaluate(null, { enforceBudget: false }),
    evaluate([NaN], { enforceBudget: false })
  ]) {
    assert.equal(report.passed, true);
    assert.notEqual(report.status, "available");
    assert.equal(report.meanMs, null);
    assert.equal(report.p90Ms, null);
    assert.ok(report.issues.length > 0);
  }
});
