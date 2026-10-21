import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import * as v from "valibot";
const root = path.join(import.meta.dirname, "results");
const measurement = v.object({
  domain: v.string(),
  operation: v.string(),
  size: v.number(),
  elapsedMs: v.number(),
  maxRssKiB: v.number(),
  summary: v.record(v.string(), v.unknown())
});
const observation = v.object({
  exitCode: v.nullable(v.number()),
  signal: v.nullable(v.string()),
  timedOut: v.boolean(),
  processWallMs: v.number(),
  stderr: v.string()
});
const shape = v.object({
  kind: v.literal("shape"),
  domain: v.string(),
  operation: v.string(),
  size: v.number(),
  measurement: v.nullable(measurement),
  observation
});
const cli = v.object({
  kind: v.literal("cli"),
  domain: v.string(),
  operation: v.string(),
  size: v.number(),
  exitCode: v.nullable(v.number()),
  timedOut: v.boolean(),
  processWallMs: v.number(),
  stdoutBytes: v.number(),
  stdoutPrefix: v.string(),
  stdoutSha256: v.string(),
  stderr: v.string()
});
const stage = v.object({
  kind: v.literal("stage"),
  domain: v.string(),
  size: v.number(),
  scope: v.string(),
  measurement: v.nullable(measurement),
  observation,
  pendingPaths: v.array(v.string())
});
async function lines(name: string) {
  return (await fs.readFile(path.join(root, name), "utf8"))
    .trim()
    .split("\n")
    .map((line) => {
      const raw: unknown = JSON.parse(line);
      return raw;
    });
}
const supplemental = (await lines("supplement.jsonl")).map((raw) =>
  v.parse(v.variant("kind", [shape, cli]), raw)
);
const shapes = supplemental.filter((row) => row.kind === "shape");
const cliRows = supplemental.filter((row) => row.kind === "cli");
assert.equal(shapes.length, 75);
assert.equal(cliRows.length, 12);
const keys = new Set(shapes.map((row) => `${row.operation}:${row.size}`));
assert.equal(keys.size, 75);
for (const size of [1000, 10000, 100000])
  for (const domain of ["decision", "investigation"])
    for (const shapeName of ["merge", "star", "chain", "split"])
      for (const action of ["build", "validate", "trace"])
        assert.ok(keys.has(`${domain}-${shapeName}-${action}:${size}`));
for (const size of [1000, 10000, 100000])
  assert.ok(keys.has(`investigation-merge-evidence:${size}`));
for (const row of shapes)
  if (row.measurement !== null)
    assert.equal(row.measurement.summary.status, "ok");
const setup = v.object({
  kind: v.literal("setup"),
  domain: v.string(),
  size: v.number()
});
const stageAll = (await lines("stage.jsonl")).map((raw) =>
  v.parse(v.variant("kind", [setup, stage]), raw)
);
const stages = stageAll.filter((row) => row.kind === "stage");
assert.equal(stages.length, 12);
assert.equal(stageAll.filter((row) => row.kind === "setup").length, 4);
const stageKeys = new Set(
  stages.map((row) => `${row.domain}:${row.size}:${row.scope}`)
);
assert.equal(stageKeys.size, 12);
const metrics = v.object({
  elapsedMs: v.number(),
  maxRssKiB: v.number(),
  cpu: v.object({ user: v.number(), system: v.number() })
});
const summary = {
  shapes: shapes.map((row) => ({
    domain: row.domain,
    size: row.size,
    operation: row.operation,
    elapsedMs: row.measurement?.elapsedMs ?? null,
    processWallMs: row.observation.processWallMs,
    maxRssMiB:
      row.measurement === null ? null : row.measurement.maxRssKiB / 1024,
    timedOut: row.observation.timedOut,
    summary: row.measurement?.summary ?? null
  })),
  cli: cliRows.map((row) => {
    assert.equal(row.exitCode, 0);
    assert.equal(row.timedOut, false);
    const line = row.stderr
      .split("\n")
      .find((line) => line.startsWith("PERF_METRICS "));
    assert.ok(line !== undefined);
    const raw: unknown = JSON.parse(line.slice("PERF_METRICS ".length));
    const parsed = v.parse(metrics, raw);
    return {
      domain: row.domain,
      size: row.size,
      operation: row.operation,
      processWallMs: row.processWallMs,
      stdoutBytes: row.stdoutBytes,
      maxRssMiB: parsed.maxRssKiB / 1024,
      stdoutSha256: row.stdoutSha256
    };
  }),
  stage: stages.map((row) => ({
    domain: row.domain,
    size: row.size,
    scope: row.scope,
    elapsedMs: row.measurement?.elapsedMs ?? null,
    processWallMs: row.observation.processWallMs,
    maxRssMiB:
      row.measurement === null ? null : row.measurement.maxRssKiB / 1024,
    timedOut: row.observation.timedOut,
    exitCode: row.observation.exitCode,
    stderr: row.observation.stderr,
    summary: row.measurement?.summary ?? null,
    pendingPaths: row.pendingPaths
  }))
};
await fs.writeFile(
  path.join(root, "extra-summary.json"),
  JSON.stringify(summary, null, 2) + "\n"
);
process.stdout.write(
  JSON.stringify({
    shapes: shapes.length,
    cli: cliRows.length,
    stage: stages.length,
    shapeFailures: shapes.filter((row) => row.measurement === null).length,
    stageFailures: stages.filter((row) => row.measurement === null).length
  }) + "\n"
);
