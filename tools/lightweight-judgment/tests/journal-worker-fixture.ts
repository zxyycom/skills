import fs from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { pathToFileURL } from "node:url";
import type { productionRuntime, runCli } from "../src/cli.ts";

type CliModule = Readonly<{
  runCli: typeof runCli;
  productionRuntime: typeof productionRuntime;
}>;

function isCliModule(value: unknown): value is CliModule {
  return (
    value !== null &&
    typeof value === "object" &&
    "runCli" in value &&
    typeof value.runCli === "function" &&
    "productionRuntime" in value &&
    typeof value.productionRuntime === "function"
  );
}

const [mode, bundle, config, marker, request] = process.argv.slice(2);
if (
  (mode !== "release" &&
    mode !== "held" &&
    mode !== "error" &&
    mode !== "not-wal") ||
  bundle === undefined ||
  config === undefined ||
  marker === undefined ||
  request === undefined
)
  throw new Error("invalid journal worker arguments");
const imported: unknown = await import(pathToFileURL(bundle).href);
if (!isCliModule(imported)) throw new Error("missing standalone CLI exports");
// oxlint-disable-next-line typescript/unbound-method -- Isolated prototype interception must capture the original native method; exec.call(this, sql) below restores the live SQLite receiver.
const exec = DatabaseSync.prototype.exec;
// oxlint-disable-next-line typescript/unbound-method -- Capture prepare before replacement to observe WAL attempts; prepare.call(this, sql) below preserves its required native receiver.
const prepare = DatabaseSync.prototype.prepare;
const sleeper = new Int32Array(new SharedArrayBuffer(4));
let attempts = 0;
let fetches = 0;
let journalStarted: number | undefined;

// Intercept after the REAL schema transaction COMMIT, in this isolated process.
// The parent acquires a competing SQLite lock before releasing the marker.
DatabaseSync.prototype.exec = function (sql) {
  const result = exec.call(this, sql);
  if (sql === "COMMIT") {
    console.log("COMMITTED");
    const deadline = performance.now() + 20000;
    while (!fs.existsSync(marker)) {
      if (performance.now() >= deadline)
        throw new Error("parent marker timed out");
      Atomics.wait(sleeper, 0, 0, 5);
    }
  }
  return result;
};
DatabaseSync.prototype.prepare = function (sql) {
  if (sql !== "PRAGMA journal_mode=WAL") return prepare.call(this, sql);
  attempts++;
  if (attempts === 1) {
    journalStarted = performance.now();
    console.log("JOURNAL");
  }
  if (mode === "error")
    throw Object.assign(new Error("synthetic non-BUSY"), { errcode: 10 });
  const statement = prepare.call(this, sql);
  if (mode === "not-wal") statement.get = () => ({ journal_mode: "delete" });
  return statement;
};
const result = await imported.runCli(
  ["--config", config, "json", "--json", request],
  {
    ...imported.productionRuntime(),
    async fetch() {
      fetches++;
      return new Response(
        '{"model":"jev-journal-test","answers":{"answer":{"type":"noul","noul":0.2}}}'
      );
    }
  }
);
if (journalStarted === undefined)
  throw new Error("journal phase was not reached");
const output: unknown = JSON.parse(result.stdout);
console.log(
  "RESULT " +
    JSON.stringify({
      code: result.exitCode,
      output,
      attempts,
      fetches,
      journalMs: performance.now() - journalStarted
    })
);
