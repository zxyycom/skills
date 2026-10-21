import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdir, writeFile, appendFile } from "node:fs/promises";
import path from "node:path";
import { performance } from "node:perf_hooks";
import * as v from "valibot";

const scratch = import.meta.dirname;
const outputRoot = path.join(scratch, "results");
const measurementSchema = v.object({
  domain: v.picklist(["decision", "investigation"]),
  operation: v.string(),
  size: v.number(),
  elapsedMs: v.number(),
  cpuUserMs: v.number(),
  cpuSystemMs: v.number(),
  maxRssKiB: v.number(),
  heapBeforeBytes: v.number(),
  heapAfterBytes: v.number(),
  summary: v.record(v.string(), v.unknown())
});
export type ChildObservation = Readonly<{
  exitCode: number | null;
  signal: NodeJS.Signals | null;
  timedOut: boolean;
  processWallMs: number;
  stdout: string;
  stderr: string;
}>;
export async function runChild(
  args: readonly string[],
  timeoutMs: number
): Promise<ChildObservation> {
  const started = performance.now();
  const child = spawn(process.execPath, args, {
    cwd: scratch,
    stdio: ["ignore", "pipe", "pipe"],
    detached: true,
    env: { ...process.env, LC_ALL: "C", TZ: "UTC" }
  });
  let stdout = "";
  let stderr = "";
  let timedOut = false;
  const limit = 1024 * 1024;
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", (chunk: string) => {
    stdout += chunk;
    if (stdout.length > limit) child.kill("SIGKILL");
  });
  child.stderr.on("data", (chunk: string) => {
    stderr += chunk;
    if (stderr.length > limit) child.kill("SIGKILL");
  });
  const timeout = setTimeout(() => {
    timedOut = true;
    if (child.pid !== undefined) process.kill(-child.pid, "SIGKILL");
  }, timeoutMs);
  const result = await new Promise<
    Readonly<{ exitCode: number | null; signal: NodeJS.Signals | null }>
  >((resolve, reject) => {
    child.once("error", reject);
    child.once("close", (exitCode, signal) => resolve({ exitCode, signal }));
  }).finally(() => clearTimeout(timeout));
  assert.ok(
    stdout.length <= limit && stderr.length <= limit,
    "worker output exceeded evidence limit"
  );
  return {
    ...result,
    timedOut,
    processWallMs: performance.now() - started,
    stdout,
    stderr
  };
}
const decisionOperations = [
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
] as const;
const investigationOperations = [
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
] as const;
async function collect(): Promise<void> {
  await mkdir(outputRoot, { recursive: true });
  const rawFile = path.join(outputRoot, "observations.jsonl");
  await writeFile(rawFile, "", { flag: "wx" });
  for (const size of [10000, 100000]) {
    for (const domain of ["decision", "investigation"] as const) {
      const root = path.join(scratch, "datasets", `${domain}-${size}`);
      const worker = path.join(scratch, `${domain}-worker.ts`);
      process.stdout.write(`PREPARE ${domain} ${size}\n`);
      const preparation = await runChild(
        [worker, "prepare", root, String(size)],
        900000
      );
      await writeFile(
        path.join(outputRoot, `${domain}-${size}-prepare.json`),
        JSON.stringify(preparation, null, 2) + "\n",
        { flag: "wx" }
      );
      assert.equal(preparation.exitCode, 0, preparation.stderr);
      assert.equal(preparation.timedOut, false);
      process.stdout.write(preparation.stdout);
      for (const operation of domain === "decision"
        ? decisionOperations
        : investigationOperations) {
        let repetitions = 3;
        for (let sample = 1; sample <= repetitions; sample += 1) {
          const observation = await runChild(
            [worker, operation, root, String(size)],
            180000
          );
          let parsed: v.InferOutput<typeof measurementSchema> | null = null;
          if (observation.exitCode === 0 && !observation.timedOut) {
            const external: unknown = JSON.parse(observation.stdout);
            parsed = v.parse(measurementSchema, external);
            assert.equal(parsed.domain, domain);
            assert.equal(parsed.operation, operation);
            assert.equal(parsed.size, size);
            assert.ok(
              parsed.summary.status === "ok" ||
                parsed.summary.status === "error"
            );
          }
          const record = {
            domain,
            operation,
            size,
            sample,
            observation,
            measurement: parsed
          };
          await appendFile(rawFile, JSON.stringify(record) + "\n");
          process.stdout.write(
            `${domain} ${size} ${operation} #${sample}: ${parsed === null ? `FAILED ${observation.exitCode}/${observation.signal}` : `${Math.round(parsed.elapsedMs)}ms ${parsed.summary.status} ${Math.round(parsed.maxRssKiB / 1024)}MiB`} wall=${Math.round(observation.processWallMs)}ms\n`
          );
          // Slow or failed operations receive one observation, not a latency percentile.
          if (
            sample === 1 &&
            (parsed === null || observation.processWallMs > 20000)
          )
            repetitions = 1;
        }
      }
    }
  }
}
if (process.argv[1] === import.meta.filename) await collect();
