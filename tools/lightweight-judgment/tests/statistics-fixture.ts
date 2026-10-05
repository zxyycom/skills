import fs from "node:fs";
import { DatabaseSync } from "node:sqlite";
import type { SQLInputValue } from "node:sqlite";
import { logFixture } from "./log-fixture.ts";
import { runCli } from "../src/cli.ts";
import { runtime } from "./runtime-fixture.ts";
import { decodeSuccess, object } from "./output.ts";

// Independent DDL keeps current-format behavior and explicit legacy upgrades observable.
const legacy = `CREATE TABLE calls (
 id TEXT PRIMARY KEY, started_at TEXT NOT NULL, updated_at TEXT NOT NULL, finished_at TEXT,
 status TEXT NOT NULL CHECK(status IN ('started','response_received','succeeded','failed','indeterminate')),
 endpoint TEXT NOT NULL, request_model TEXT NOT NULL, response_model TEXT, question_count INTEGER NOT NULL,
 save_request INTEGER NOT NULL, save_response INTEGER NOT NULL, request_json TEXT, response_body BLOB,
 http_status INTEGER, error_kind TEXT, elapsed_ms INTEGER, input_tokens INTEGER, output_tokens INTEGER, cost REAL
) STRICT;
CREATE INDEX calls_started_at ON calls(started_at); CREATE INDEX calls_status ON calls(status);
PRAGMA application_id=1246058033; PRAGMA user_version=1;`;
const metadata = `ALTER TABLE calls ADD COLUMN run_id TEXT; ALTER TABLE calls ADD COLUMN run_index INTEGER;
ALTER TABLE calls ADD COLUMN local_tags TEXT; ALTER TABLE calls ADD COLUMN request_bytes INTEGER;
ALTER TABLE calls ADD COLUMN response_bytes INTEGER;
CREATE UNIQUE INDEX calls_run_index ON calls(run_id,run_index) WHERE run_id IS NOT NULL; PRAGMA user_version=2;`;

export function statisticsFixture(
  version: 1 | 2 = 2,
  encoding: "UTF-8" | "UTF-16le" = "UTF-8"
) {
  const fixture = logFixture();
  const database = new DatabaseSync(fixture.databasePath);
  try {
    database.exec(`PRAGMA encoding = '${encoding}'`);
    database.exec(legacy);
    if (version === 2) database.exec(metadata);
    fs.chmodSync(fixture.databasePath, 0o600);
  } catch (error) {
    try {
      database.close();
    } finally {
      fixture.cleanup();
    }
    throw error;
  }
  let nextId = 0;
  return {
    ...fixture,
    database,
    insert(overrides: Readonly<Record<string, SQLInputValue>> = {}) {
      const base = {
        id: `call-${++nextId}`,
        started_at: "2026-10-01T00:00:00.000Z",
        updated_at: "2026-10-01T00:00:00.000Z",
        status: "succeeded",
        endpoint: "https://first.test/systemone",
        request_model: "typesafe/jev-1.13",
        question_count: 1,
        save_request: 0,
        save_response: 0
      };
      const values = { ...base, ...overrides };
      const entries = Object.entries(values);
      database
        .prepare(
          `INSERT INTO calls (${entries.map(([key]) => key).join(",")}) VALUES (${entries.map(() => "?").join(",")})`
        )
        .run(...entries.map(([, value]) => value));
    },
    async stats(flags: readonly string[] = []) {
      const outcome = await runCli(
        ["stats", "--database", fixture.databasePath, ...flags],
        runtime({
          env: {},
          fetch: async () => {
            throw new Error("stats must not fetch");
          },
          readFile: async () => {
            throw new Error("explicit database must not read config");
          }
        })
      );
      if (outcome.exitCode !== 0) throw new Error(outcome.stdout);
      return decodeSuccess(outcome.stdout).result;
    },
    cleanup() {
      try {
        database.close();
      } finally {
        fixture.cleanup();
      }
    }
  };
}
export function summary(result: Readonly<Record<string, unknown>>) {
  return object(result.summary);
}
export function metric(
  result: Readonly<Record<string, unknown>>,
  field: string
) {
  return object(object(summary(result).metrics)[field]);
}
export function array(value: unknown): readonly unknown[] {
  if (!Array.isArray(value)) throw new Error("expected array");
  return value;
}
