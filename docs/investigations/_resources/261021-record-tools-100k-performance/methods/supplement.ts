import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { appendFile } from "node:fs/promises";
import path from "node:path";
import { performance } from "node:perf_hooks";
import * as v from "valibot";
import { runChild } from "./collector.ts";
const scratch = import.meta.dirname;
const rawFile = path.join(scratch, "results", "supplement.jsonl");
const measurementSchema = v.object({
  domain: v.picklist(["decision", "investigation"]),
  operation: v.string(),
  size: v.number(),
  elapsedMs: v.number(),
  maxRssKiB: v.number(),
  summary: v.record(v.string(), v.unknown())
});
async function shapes(): Promise<void> {
  for (const size of [1000, 10000, 100000]) {
    for (const domain of ["decision", "investigation"]) {
      for (const shape of ["merge", "star", "chain", "split"]) {
        for (const action of ["build", "validate", "trace"]) {
          const operation = `${domain}-${shape}-${action}`;
          const observation = await runChild(
            [
              path.join(scratch, "shape-worker.ts"),
              operation,
              path.join(scratch, "unused-root"),
              String(size)
            ],
            120000
          );
          const external: unknown =
            observation.exitCode === 0 ? JSON.parse(observation.stdout) : null;
          const measurement =
            external === null ? null : v.parse(measurementSchema, external);
          if (measurement !== null) {
            assert.equal(measurement.operation, operation);
            assert.equal(measurement.size, size);
            assert.equal(measurement.summary.status, "ok");
          }
          await appendFile(
            rawFile,
            JSON.stringify({
              kind: "shape",
              domain,
              operation,
              size,
              observation,
              measurement
            }) + "\n"
          );
          process.stdout.write(
            `${operation} ${size}: ${measurement?.elapsedMs ?? "failed"}ms\n`
          );
        }
      }
    }
    const operation = "investigation-merge-evidence";
    const observation = await runChild(
      [
        path.join(scratch, "shape-worker.ts"),
        operation,
        path.join(scratch, "unused-root"),
        String(size)
      ],
      120000
    );
    const external: unknown =
      observation.exitCode === 0 ? JSON.parse(observation.stdout) : null;
    const measurement =
      external === null ? null : v.parse(measurementSchema, external);
    if (measurement !== null) {
      assert.equal(measurement.size, size);
      assert.equal(measurement.summary.status, "ok");
    }
    await appendFile(
      rawFile,
      JSON.stringify({
        kind: "shape",
        domain: "investigation",
        operation,
        size,
        observation,
        measurement
      }) + "\n"
    );
    process.stdout.write(
      `${operation} ${size}: ${measurement?.elapsedMs ?? "failed"}ms\n`
    );
  }
}
async function cli(): Promise<void> {
  for (const size of [10000, 100000]) {
    for (const domain of ["decision", "investigation"] as const) {
      const relative =
        domain === "decision"
          ? "decision-records/scripts/decision-records.ts"
          : "investigation-report/scripts/check-investigations.ts";
      for (const operation of ["list", "metadata-common", "metadata-rare"]) {
        const command =
          operation === "list"
            ? ["list"]
            : [
                "search",
                operation === "metadata-common" ? "record" : "needle",
                "--in",
                "metadata"
              ];
        const args = [
          "--import",
          path.join(scratch, "cli-metrics.ts"),
          path.join(scratch, "source/skills", relative),
          "--root",
          path.join(scratch, "datasets", `${domain}-${size}`),
          ...command
        ];
        const startedAt = new Date().toISOString();
        const started = performance.now();
        const child = spawn(process.execPath, args, {
          cwd: scratch,
          stdio: ["ignore", "pipe", "pipe"],
          detached: true
        });
        let stdoutBytes = 0;
        let prefix = "";
        let stderr = "";
        let timedOut = false;
        const hash = createHash("sha256");
        child.stdout.on("data", (chunk: Buffer) => {
          stdoutBytes += chunk.length;
          hash.update(chunk);
          if (prefix.length < 2000)
            prefix += chunk.toString("utf8").slice(0, 2000 - prefix.length);
        });
        child.stderr.setEncoding("utf8");
        child.stderr.on("data", (chunk: string) => {
          stderr += chunk;
        });
        const timeout = setTimeout(() => {
          timedOut = true;
          if (child.pid !== undefined) process.kill(-child.pid, "SIGKILL");
        }, 180000);
        const exit = await new Promise<
          Readonly<{ exitCode: number | null; signal: NodeJS.Signals | null }>
        >((resolve, reject) => {
          child.once("error", reject);
          child.once("close", (exitCode, signal) =>
            resolve({ exitCode, signal })
          );
        }).finally(() => clearTimeout(timeout));
        const observation = {
          kind: "cli",
          domain,
          operation,
          size,
          startedAt,
          ...exit,
          timedOut,
          processWallMs: performance.now() - started,
          stdoutBytes,
          stdoutPrefix: prefix,
          stdoutSha256: hash.digest("hex"),
          stderr
        };
        await appendFile(rawFile, JSON.stringify(observation) + "\n");
        assert.equal(exit.exitCode, 0, stderr);
        assert.equal(timedOut, false);
        assert.ok(stdoutBytes > 0);
        assert.match(stderr, /PERF_METRICS /u);
        process.stdout.write(
          `CLI ${domain} ${operation} ${size}: ${Math.round(observation.processWallMs)}ms ${stdoutBytes} bytes\n`
        );
      }
    }
  }
}
const phase = process.argv[2];
assert.ok(phase === "shapes" || phase === "cli");
if (phase === "shapes") await shapes();
else await cli();
