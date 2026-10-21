import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import * as v from "valibot";
const root = path.join(import.meta.dirname, "results");
const metric = v.object({
  domain: v.string(),
  operation: v.string(),
  size: v.number(),
  elapsedMs: v.number(),
  cpuUserMs: v.number(),
  cpuSystemMs: v.number(),
  maxRssKiB: v.number(),
  summary: v.record(v.string(), v.unknown())
});
const rowSchema = v.object({
  domain: v.string(),
  operation: v.string(),
  size: v.number(),
  sample: v.number(),
  observation: v.object({
    exitCode: v.nullable(v.number()),
    signal: v.nullable(v.string()),
    timedOut: v.boolean(),
    processWallMs: v.number(),
    stdout: v.string(),
    stderr: v.string()
  }),
  measurement: v.nullable(metric)
});
const lines = (await fs.readFile(path.join(root, "observations.jsonl"), "utf8"))
  .trim()
  .split("\n");
const rows = lines.map((line) => {
  const raw: unknown = JSON.parse(line);
  return v.parse(rowSchema, raw);
});
const groups = Map.groupBy(
  rows,
  (row) => `${row.domain}:${row.size}:${row.operation}`
);
assert.equal(groups.size, 124, "incomplete operation matrix");
const expectedDecision = [
  "list",
  "list-page",
  "list-tag",
  "list-related",
  "list-type",
  "show-id",
  "show-name",
  "trace",
  "metadata-rare",
  "metadata-common",
  "metadata-zero",
  "content-unfiltered-cap",
  "content-tag",
  "content-related",
  "check-full",
  "sync-preflight",
  "sync-write",
  "candidates",
  "micro-index-read",
  "micro-json-parse",
  "micro-parse-index",
  "micro-load-index",
  "micro-source-revision",
  "micro-markdown-parse",
  "micro-list-projection",
  "micro-relation-build",
  "micro-relation-validate"
];
const expectedInvestigation = [
  "list",
  "list-page",
  "list-tag",
  "list-related",
  "list-type",
  "show-id",
  "show-name",
  "trace",
  "trace-capped",
  "metadata-rare",
  "metadata-common",
  "metadata-zero",
  "content-unfiltered",
  "content-tag",
  "content-related",
  "check-id",
  "check-full",
  "sync-preflight",
  "sync-current",
  "sync-write",
  "relations-preflight",
  "rename-preflight",
  "publish-preflight",
  "candidates",
  "show-candidate",
  "micro-read-index",
  "micro-json-parse",
  "micro-parse-index",
  "micro-load-index",
  "micro-read-sources",
  "micro-parse-markdown",
  "micro-query-loaded",
  "micro-build-index",
  "micro-graph-build",
  "micro-graph-validate"
];
function statistics(values: readonly number[]) {
  if (values.length === 0) return null;
  const sorted = values.toSorted((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return {
    median:
      sorted.length % 2 === 0
        ? ((sorted[middle - 1] ?? NaN) + (sorted[middle] ?? NaN)) / 2
        : sorted[middle],
    min: sorted[0],
    max: sorted.at(-1)
  };
}
const summary = [];
for (const domain of ["decision", "investigation"])
  for (const size of [10000, 100000])
    for (const operation of domain === "decision"
      ? expectedDecision
      : expectedInvestigation) {
      const samples = groups.get(`${domain}:${size}:${operation}`);
      assert.ok(samples !== undefined);
      const first = samples[0];
      assert.ok(first !== undefined);
      const expectedCount =
        first.measurement === null || first.observation.processWallMs > 20000
          ? 1
          : 3;
      assert.equal(samples.length, expectedCount);
      assert.deepEqual(
        samples.map((row) => row.sample),
        Array.from({ length: expectedCount }, (_, i) => i + 1)
      );
      const expectedStatus =
        (domain === "decision" &&
          size === 100000 &&
          operation === "content-unfiltered-cap") ||
        (domain === "investigation" &&
          (operation === "content-unfiltered" ||
            (size === 100000 && operation === "content-tag")))
          ? "error"
          : "ok";
      const measured = samples.flatMap((row) =>
        row.measurement === null ? [] : [row.measurement]
      );
      for (const sample of measured)
        assert.equal(
          sample.summary.status,
          expectedStatus,
          `${domain}/${size}/${operation}`
        );
      summary.push({
        domain,
        size,
        operation,
        n: samples.length,
        completed: measured.length,
        expectedStatus,
        actualStatuses: [
          ...new Set(measured.map((sample) => sample.summary.status))
        ],
        failures: samples
          .filter((row) => row.measurement === null)
          .map((row) => ({
            exitCode: row.observation.exitCode,
            signal: row.observation.signal,
            timedOut: row.observation.timedOut,
            stderr: row.observation.stderr
          })),
        elapsedMs: statistics(measured.map((sample) => sample.elapsedMs)),
        processWallMs: statistics(
          samples.map((row) => row.observation.processWallMs)
        ),
        cpuMs: statistics(
          measured.map((sample) => sample.cpuUserMs + sample.cpuSystemMs)
        ),
        maxRssMiB: statistics(measured.map((sample) => sample.maxRssKiB / 1024))
      });
    }
await fs.writeFile(
  path.join(root, "summary.json"),
  JSON.stringify(
    {
      audit: {
        expectedGroups: 124,
        actualGroups: groups.size,
        totalSamples: rows.length,
        failedSamples: rows.filter((row) => row.measurement === null).length
      },
      operations: summary
    },
    null,
    2
  ) + "\n"
);
const header =
  "domain,size,operation,n,completed,expected_status,actual_status,elapsed_ms,minimum_ms,maximum_ms,wall_ms,max_rss_mib";
const csv = summary.map((row) =>
  [
    row.domain,
    row.size,
    row.operation,
    row.n,
    row.completed,
    row.expectedStatus,
    row.completed === 0 ? "worker-failed" : row.actualStatuses.join("|"),
    row.elapsedMs?.median ?? "",
    row.elapsedMs?.min ?? "",
    row.elapsedMs?.max ?? "",
    row.processWallMs?.median ?? "",
    row.maxRssMiB?.max ?? ""
  ].join(",")
);
await fs.writeFile(
  path.join(root, "summary.csv"),
  [header, ...csv].join("\n") + "\n"
);
process.stdout.write(
  JSON.stringify({
    groups: groups.size,
    samples: rows.length,
    failures: summary.filter((row) => row.failures.length > 0)
  }) + "\n"
);
