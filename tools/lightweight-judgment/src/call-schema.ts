import type { DatabaseSync } from "node:sqlite";
import { JudgmentFailure } from "./failure.ts";

export const applicationId = 1246058033;
export type CallDatabaseVersion = 1 | 2;
export const callStatuses = [
  "started",
  "response_received",
  "succeeded",
  "failed",
  "indeterminate"
] as const;
export type CallStatus = (typeof callStatuses)[number];
type CallIndex = Readonly<{
  name: string;
  columns: readonly string[];
  unique: 0 | 1;
  partial: 0 | 1;
  sql: string;
}>;
const baseIndexes: readonly CallIndex[] = [
  {
    name: "calls_started_at",
    columns: ["started_at"],
    unique: 0,
    partial: 0,
    sql: "CREATE INDEX calls_started_at ON calls(started_at)"
  },
  {
    name: "calls_status",
    columns: ["status"],
    unique: 0,
    partial: 0,
    sql: "CREATE INDEX calls_status ON calls(status)"
  }
];
const runIndex: CallIndex = {
  name: "calls_run_index",
  columns: ["run_id", "run_index"],
  unique: 1,
  partial: 1,
  sql: "CREATE UNIQUE INDEX calls_run_index ON calls(run_id, run_index) WHERE run_id IS NOT NULL"
};
const baseColumns = [
  ["id", "TEXT", 1, 1],
  ["started_at", "TEXT", 1, 0],
  ["updated_at", "TEXT", 1, 0],
  ["finished_at", "TEXT", 0, 0],
  ["status", "TEXT", 1, 0],
  ["endpoint", "TEXT", 1, 0],
  ["request_model", "TEXT", 1, 0],
  ["response_model", "TEXT", 0, 0],
  ["question_count", "INTEGER", 1, 0],
  ["save_request", "INTEGER", 1, 0],
  ["save_response", "INTEGER", 1, 0],
  ["request_json", "TEXT", 0, 0],
  ["response_body", "BLOB", 0, 0],
  ["http_status", "INTEGER", 0, 0],
  ["error_kind", "TEXT", 0, 0],
  ["elapsed_ms", "INTEGER", 0, 0],
  ["input_tokens", "INTEGER", 0, 0],
  ["output_tokens", "INTEGER", 0, 0],
  ["cost", "REAL", 0, 0]
] as const;
const metadataColumns = [
  ["run_id", "TEXT", 0, 0],
  ["run_index", "INTEGER", 0, 0],
  ["local_tags", "TEXT", 0, 0],
  ["request_bytes", "INTEGER", 0, 0],
  ["response_bytes", "INTEGER", 0, 0]
] as const;
export const migration = `
ALTER TABLE calls ADD COLUMN run_id TEXT;
ALTER TABLE calls ADD COLUMN run_index INTEGER;
ALTER TABLE calls ADD COLUMN local_tags TEXT;
ALTER TABLE calls ADD COLUMN request_bytes INTEGER;
ALTER TABLE calls ADD COLUMN response_bytes INTEGER;
${runIndex.sql};
PRAGMA user_version = 2;`;
export const schema = `
CREATE TABLE calls (
  id TEXT PRIMARY KEY,
  started_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  finished_at TEXT,
  status TEXT NOT NULL CHECK(status IN (${callStatuses.map((status) => `'${status}'`).join(",")})),
  endpoint TEXT NOT NULL,
  request_model TEXT NOT NULL,
  response_model TEXT,
  question_count INTEGER NOT NULL,
  save_request INTEGER NOT NULL,
  save_response INTEGER NOT NULL,
  request_json TEXT,
  response_body BLOB,
  http_status INTEGER,
  error_kind TEXT,
  elapsed_ms INTEGER,
  input_tokens INTEGER,
  output_tokens INTEGER,
  cost REAL
) STRICT;
${baseIndexes.map((index) => index.sql).join(";\n")};
PRAGMA application_id = ${applicationId};
PRAGMA user_version = 1;`;

function unsupported(): never {
  throw new JudgmentFailure(
    "storage",
    "数据库不是受支持的调用记录库或 schema 已改变；请选择正确的日志数据库。"
  );
}

type Column = readonly [string, string, number, number];
type SqlRow = Readonly<Record<string, unknown>>;

function columnMatches(actual: SqlRow, expected: Column | undefined): boolean {
  if (expected === undefined) return false;
  return (
    actual.name === expected[0] &&
    actual.type === expected[1] &&
    actual.notnull === expected[2] &&
    actual.pk === expected[3] &&
    actual.dflt_value === null
  );
}
function validateColumns(database: DatabaseSync, version: 1 | 2): void {
  const expected =
    version === 1 ? baseColumns : [...baseColumns, ...metadataColumns];
  const actual = database.prepare("PRAGMA table_info(calls)").all();
  if (
    actual.length !== expected.length ||
    !actual.every((column, index) => columnMatches(column, expected[index]))
  ) {
    unsupported();
  }
}
function normalizedSql(sql: string): string {
  return sql.replace(/\s+/gu, "").toLowerCase();
}
function validateTable(database: DatabaseSync, version: 1 | 2): void {
  const tableSql = database
    .prepare("SELECT sql FROM sqlite_master WHERE name='calls'")
    .get()?.sql;
  const baseSql = schema.slice(
    schema.indexOf("CREATE TABLE"),
    schema.indexOf(";")
  );
  const expectedSql =
    version === 1
      ? baseSql
      : baseSql.replace(
          ") STRICT",
          ", run_id TEXT, run_index INTEGER, local_tags TEXT, request_bytes INTEGER, response_bytes INTEGER) STRICT"
        );
  if (
    typeof tableSql !== "string" ||
    normalizedSql(tableSql) !== normalizedSql(expectedSql)
  ) {
    unsupported();
  }
  const table = database
    .prepare("PRAGMA table_list")
    .all()
    .find((row) => row.name === "calls");
  if (table?.strict !== 1 || table.type !== "table") {
    unsupported();
  }
}
function objectMatches(row: SqlRow, expected: string | undefined): boolean {
  return (
    row.name === expected &&
    row.type === (row.name === "calls" ? "table" : "index")
  );
}
function validateObjects(database: DatabaseSync, version: 1 | 2): void {
  const objects = database
    .prepare(
      "SELECT type, name FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' ORDER BY name"
    )
    .all();
  const names =
    version === 1
      ? ["calls", "calls_started_at", "calls_status"]
      : ["calls", "calls_run_index", "calls_started_at", "calls_status"];
  if (
    objects.length !== names.length ||
    !objects.every((row, index) => objectMatches(row, names[index]))
  ) {
    unsupported();
  }
}
function validateIndex(database: DatabaseSync, expected: CallIndex): void {
  const info = database.prepare(`PRAGMA index_info(${expected.name})`).all();
  if (
    info.length !== expected.columns.length ||
    info.some((row, index) => row.name !== expected.columns[index])
  ) {
    unsupported();
  }
  const index = database
    .prepare("PRAGMA index_list(calls)")
    .all()
    .find((row) => row.name === expected.name);
  const sql = database
    .prepare("SELECT sql FROM sqlite_master WHERE name = ?")
    .get(expected.name)?.sql;
  if (
    index?.unique !== expected.unique ||
    index.partial !== expected.partial ||
    index.origin !== "c" ||
    typeof sql !== "string" ||
    normalizedSql(sql) !== normalizedSql(expected.sql)
  ) {
    unsupported();
  }
}
// Header identity alone is insufficient: both readers and writers validate the fixed layout.
export function callDatabaseVersion(
  database: DatabaseSync
): CallDatabaseVersion {
  const id = database.prepare("PRAGMA application_id").get()?.application_id;
  const version = database.prepare("PRAGMA user_version").get()?.user_version;
  if (id !== applicationId || (version !== 1 && version !== 2)) {
    unsupported();
  }
  validateColumns(database, version);
  validateTable(database, version);
  validateObjects(database, version);
  for (const index of baseIndexes) validateIndex(database, index);
  if (version === 2) validateIndex(database, runIndex);
  return version;
}
