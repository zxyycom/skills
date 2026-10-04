import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { test } from "node:test";
import * as v from "valibot";
import { logFixture, rows } from "./log-fixture.ts";
import { object } from "./output.ts";
import { request } from "./runtime-fixture.ts";

type Contention = "release" | "held" | "error" | "not-wal";

function journalWorker(directory: string, databasePath: string): string {
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
      apiKey: "journal-fake-key",
      logging: { enabled: true, databasePath }
    }),
    { mode: 0o600 }
  );
  const worker = path.join(directory, "journal-worker.ts");
  fs.copyFileSync(
    new URL("./journal-worker-fixture.ts", import.meta.url),
    worker
  );
  return worker;
}

const workerResultSchema = v.strictObject({
  code: v.picklist([0, 2, 3, 4]),
  output: v.unknown(),
  attempts: v.pipe(v.number(), v.safeInteger(), v.minValue(1)),
  fetches: v.pipe(v.number(), v.safeInteger(), v.minValue(0)),
  journalMs: v.pipe(v.number(), v.finite(), v.minValue(0))
});
type WorkerResult = Readonly<v.InferOutput<typeof workerResultSchema>>;

function controlledJournal(
  directory: string,
  databasePath: string,
  mode: Contention,
  signal?: AbortSignal
): Promise<WorkerResult> {
  const worker = journalWorker(directory, databasePath);
  return new Promise((resolve, reject) => {
    const child = spawn(
      "node",
      [
        worker,
        mode,
        path.join(directory, "judgment.mjs"),
        path.join(directory, "config.json"),
        path.join(directory, "continue"),
        JSON.stringify(request)
      ],
      {
        stdio: ["ignore", "pipe", "pipe"]
      }
    );
    let blocker: DatabaseSync | undefined;
    let pending = "";
    let stderr = "";
    let outcome: WorkerResult | undefined;
    let failure: Error | undefined;
    let release: ReturnType<typeof setTimeout> | undefined;
    const unlock = () => {
      const database = blocker;
      blocker = undefined;
      if (database === undefined) return;
      try {
        database.exec("ROLLBACK");
      } finally {
        database.close();
      }
    };
    // Failures are latched; resolution and fixture deletion wait for close.
    const fail = (error: unknown) => {
      failure ??= error instanceof Error ? error : new Error(String(error));
      clearTimeout(release);
      child.kill("SIGKILL");
    };
    const abort = () => fail(new Error("controlled journal test aborted"));
    signal?.addEventListener("abort", abort, { once: true });
    if (signal?.aborted) abort();
    const timeout = setTimeout(
      () => fail(new Error("controlled journal worker timed out")),
      20000
    );
    const observe = (line: string) => {
      if (line === "COMMITTED") {
        if (blocker !== undefined)
          throw new Error("duplicate COMMITTED marker");
        blocker = new DatabaseSync(databasePath, { timeout: 5000 });
        blocker.exec("BEGIN IMMEDIATE");
        fs.writeFileSync(path.join(directory, "continue"), "go");
      } else if (line === "JOURNAL" && mode === "release") {
        release = setTimeout(() => {
          try {
            unlock();
          } catch (error) {
            fail(error);
          }
        }, 150);
      } else if (line.startsWith("RESULT ")) {
        if (outcome !== undefined) throw new Error("duplicate RESULT marker");
        const raw: unknown = JSON.parse(line.slice(7));
        outcome = v.parse(workerResultSchema, raw);
      }
    };
    child.stdout.on("data", (chunk: Buffer) => {
      if (failure !== undefined) return;
      try {
        pending += chunk.toString();
        const lines = pending.split("\n");
        pending = lines.pop() ?? "";
        for (const line of lines) observe(line);
      } catch (error) {
        fail(error);
      }
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    child.once("error", fail);
    child.once("close", (code, terminationSignal) => {
      clearTimeout(timeout);
      clearTimeout(release);
      signal?.removeEventListener("abort", abort);
      try {
        unlock();
      } catch (error) {
        failure ??= error instanceof Error ? error : new Error(String(error));
      }
      if (failure !== undefined) reject(failure);
      else if (
        code !== 0 ||
        terminationSignal !== null ||
        outcome === undefined ||
        pending !== ""
      )
        reject(
          new Error(
            `journal worker failed (code=${code}, signal=${terminationSignal}): ${stderr}`
          )
        );
      else resolve(outcome);
    });
  });
}

test("writer WAL transition waits for a competing post-COMMIT lock then sends exactly once", async (context) => {
  const fixture = logFixture();
  try {
    const result = await controlledJournal(
      fixture.directory,
      fixture.databasePath,
      "release",
      context.signal
    );
    assert.equal(result.code, 0);
    assert.equal(result.fetches, 1);
    assert.ok(typeof result.attempts === "number" && result.attempts > 1);
    const database = new DatabaseSync(fixture.databasePath);
    assert.equal(
      database.prepare("PRAGMA journal_mode").get()?.journal_mode,
      "wal"
    );
    database.close();
    assert.equal(rows(fixture.databasePath).length, 1);
    assert.equal(rows(fixture.databasePath)[0].status, "succeeded");
  } finally {
    fixture.cleanup();
  }
});

test(
  "writer WAL transition exhausts one five-second BUSY budget without sending",
  { timeout: 10000 },
  async (context) => {
    const fixture = logFixture();
    try {
      const result = await controlledJournal(
        fixture.directory,
        fixture.databasePath,
        "held",
        context.signal
      );
      assert.equal(result.code, 4);
      assert.equal(result.fetches, 0);
      assert.ok(typeof result.attempts === "number" && result.attempts > 1);
      assert.ok(
        typeof result.journalMs === "number" &&
          result.journalMs >= 4900 &&
          result.journalMs < 7000
      );
      assert.equal(object(object(result.output).error).kind, "storage");
      assert.equal(object(object(result.output).meta).attempts, 0);
      assert.equal(rows(fixture.databasePath).length, 0);
    } finally {
      fixture.cleanup();
    }
  }
);

test("writer WAL transition does not retry non-BUSY initialization failures", async (context) => {
  const fixture = logFixture();
  try {
    const result = await controlledJournal(
      fixture.directory,
      fixture.databasePath,
      "error",
      context.signal
    );
    assert.equal(result.code, 4);
    assert.equal(result.fetches, 0);
    assert.equal(result.attempts, 1);
    assert.equal(rows(fixture.databasePath).length, 0);
  } finally {
    fixture.cleanup();
  }
});

test("writer WAL transition rejects a returned mode other than WAL without sending", async (context) => {
  const fixture = logFixture();
  try {
    const result = await controlledJournal(
      fixture.directory,
      fixture.databasePath,
      "not-wal",
      context.signal
    );
    assert.equal(result.code, 4);
    assert.equal(result.fetches, 0);
    assert.equal(result.attempts, 1);
    assert.equal(rows(fixture.databasePath).length, 0);
  } finally {
    fixture.cleanup();
  }
});
