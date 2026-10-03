import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { pathToFileURL } from "node:url";
import { decodeSuccess } from "./output.ts";
import { logFixture, rows } from "./log-fixture.ts";
import { request } from "./runtime-fixture.ts";

function isolatedWorker(directory: string, databasePath: string): string {
  const bundle = path.join(directory, "judgment.mjs");
  fs.copyFileSync(
    new URL(
      "../../../skills/lightweight-judgment/scripts/lightweight-judgment.mjs",
      import.meta.url
    ),
    bundle
  );
  const config = path.join(directory, "config.json");
  fs.writeFileSync(
    config,
    JSON.stringify({
      apiKey: "isolated-fake-key",
      logging: {
        enabled: true,
        databasePath,
        saveRequest: true,
        saveResponse: true
      }
    }),
    { mode: 0o600 }
  );
  const worker = path.join(directory, "worker.mjs");
  fs.writeFileSync(
    worker,
    `
    import { runCli, productionRuntime } from ${JSON.stringify(pathToFileURL(bundle).href)};
    const mode = process.argv[2];
    let clocks = 0;
    const result = await runCli(["--config", ${JSON.stringify(config)}, "json", "--json", ${JSON.stringify(JSON.stringify(request))}], {
      ...productionRuntime(),
      now() {
        clocks++;
        if (mode === "after-response" && clocks === 2) process.kill(process.pid, "SIGKILL");
        return performance.now();
      },
      async fetch() {
        if (mode === "after-send") process.kill(process.pid, "SIGKILL");
        return new Response(' {"model":"jev-process-test","answers":{"answer":{"type":"noul","noul":0.2}}} ');
      }
    });
    process.stdout.write(result.stdout);
    process.stderr.write(result.stderr);
    process.exitCode = result.exitCode;
  `
  );
  return worker;
}

function execute(
  worker: string,
  mode: string
): Promise<
  Readonly<{
    code: number | null;
    signal: string | null;
    stdout: string;
    stderr: string;
  }>
> {
  return new Promise((resolve, reject) => {
    const child = spawn("node", [worker, mode], {
      cwd: path.dirname(worker),
      stdio: ["ignore", "pipe", "pipe"]
    });
    let stdout = "";
    let stderr = "";
    const timeout = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error("isolated worker timed out"));
    }, 20000);
    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    child.on("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.on("close", (code, signal) => {
      clearTimeout(timeout);
      resolve({ code, signal, stdout, stderr });
    });
  });
}

test("isolated concurrent Node processes append distinct durable calls without losing earlier records", async () => {
  const fixture = logFixture();
  try {
    const worker = isolatedWorker(fixture.directory, fixture.databasePath);
    const outcomes = await Promise.all(
      Array.from({ length: 8 }, () => execute(worker, "complete"))
    );
    const ids = outcomes.map((outcome) => {
      assert.equal(outcome.code, 0, outcome.stderr);
      assert.equal(outcome.stderr, "");
      return decodeSuccess(outcome.stdout).meta.persistence?.callId;
    });
    assert.equal(new Set(ids).size, 8);
    const records = rows(fixture.databasePath);
    assert.equal(records.length, 8);
    assert.deepEqual(new Set(records.map((row) => row.id)), new Set(ids));
    assert.ok(
      records.every(
        (row) =>
          row.status === "succeeded" && row.response_body instanceof Uint8Array
      )
    );
  } finally {
    fixture.cleanup();
  }
});

test("SIGKILL preserves send intent and received bytes without replaying unfinished calls", async () => {
  const fixture = logFixture();
  try {
    const worker = isolatedWorker(fixture.directory, fixture.databasePath);
    const sent = await execute(worker, "after-send");
    assert.equal(sent.signal, "SIGKILL");
    const started = rows(fixture.databasePath);
    assert.equal(started.length, 1);
    assert.equal(started[0].status, "started");
    assert.equal(started[0].response_body, null);
    assert.equal(started[0].finished_at, null);
    assert.equal(typeof started[0].request_json, "string");
    const received = await execute(worker, "after-response");
    assert.equal(received.signal, "SIGKILL");
    const after = rows(fixture.databasePath);
    const raw = after.find((row) => row.status === "response_received");
    assert.ok(raw);
    assert.equal(raw.finished_at, null);
    assert.ok(raw.response_body instanceof Uint8Array);
    assert.equal(
      new TextDecoder().decode(raw.response_body),
      ' {"model":"jev-process-test","answers":{"answer":{"type":"noul","noul":0.2}}} '
    );
    assert.equal((await execute(worker, "complete")).code, 0);
    const final = rows(fixture.databasePath);
    assert.equal(final.length, 3);
    assert.deepEqual(
      final.find((row) => row.id === started[0].id),
      started[0]
    );
    assert.deepEqual(
      final.find((row) => row.id === raw.id),
      raw
    );
    assert.equal(final.filter((row) => row.status === "succeeded").length, 1);
  } finally {
    fixture.cleanup();
  }
});
