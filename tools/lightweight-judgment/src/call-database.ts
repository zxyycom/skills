import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { JudgmentFailure } from "./failure.ts";

import {
  migration,
  schema,
  callDatabaseVersion,
  type CallDatabaseVersion
} from "./call-schema.ts";
export { callDatabaseVersion } from "./call-schema.ts";
const lockTimeoutMs = 5000;
const walRetryDelayMs = 10;
const sqlitePrimaryCodeRange = 256;
const sqliteBusyCode = 5;

export function requirePrivateFile(file: string): void {
  const stat = fs.lstatSync(file);
  if (
    !stat.isFile() ||
    (process.platform !== "win32" && (stat.mode & 0o077) !== 0)
  ) {
    throw new JudgmentFailure(
      "storage",
      "日志数据库须为私有普通文件（POSIX 权限 0600），不接受符号链接。"
    );
  }
}

function prepareFile(file: string): void {
  fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  try {
    fs.closeSync(fs.openSync(file, "wx", 0o600));
  } catch (error) {
    if (!(error instanceof Error && "code" in error && error.code === "EEXIST"))
      throw error;
  }
  requirePrivateFile(file);
}

function isSqliteBusy(error: unknown): boolean {
  return (
    error instanceof Error &&
    "errcode" in error &&
    typeof error.errcode === "number" &&
    error.errcode % sqlitePrimaryCodeRange === sqliteBusyCode
  );
}

function enableWriterWal(database: DatabaseSync): void {
  const deadline = performance.now() + lockTimeoutMs;
  const sleeper = new Int32Array(new SharedArrayBuffer(4));
  // Journal transitions can bypass SQLite's busy handler. Own one bounded wait
  // here, rather than multiplying the connection's ordinary 5-second timeout.
  database.exec("PRAGMA busy_timeout=0");
  while (true) {
    try {
      const mode = database
        .prepare("PRAGMA journal_mode=WAL")
        .get()?.journal_mode;
      if (mode !== "wal") throw new Error("SQLite did not enable WAL");
      database.exec(
        `PRAGMA synchronous=FULL; PRAGMA busy_timeout=${lockTimeoutMs}`
      );
      return;
    } catch (error) {
      const remaining = deadline - performance.now();
      if (!isSqliteBusy(error) || remaining <= 0) throw error;
      Atomics.wait(sleeper, 0, 0, Math.min(walRetryDelayMs, remaining));
    }
  }
}

function initialize(database: DatabaseSync): void {
  database.exec("BEGIN IMMEDIATE");
  try {
    const id = database.prepare("PRAGMA application_id").get()?.application_id;
    const version = database.prepare("PRAGMA user_version").get()?.user_version;
    const objects = database
      .prepare("SELECT name FROM sqlite_master WHERE name NOT LIKE 'sqlite_%'")
      .all();
    if (id === 0 && version === 0 && objects.length === 0)
      database.exec(schema);
    const current = callDatabaseVersion(database);
    if (current === 1) database.exec(migration);
    database.exec("COMMIT");
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
  enableWriterWal(database);
}

export function openCallDatabase(file: string): DatabaseSync {
  let database: DatabaseSync | undefined;
  try {
    prepareFile(file);
    database = new DatabaseSync(file, { timeout: lockTimeoutMs });
    initialize(database);
    return database;
  } catch (error) {
    database?.close();
    if (error instanceof JudgmentFailure) throw error;
    throw new JudgmentFailure(
      "storage",
      "无法创建或打开日志数据库；请检查配置中的 logging.databasePath、权限、空间与锁占用。此次未发送。"
    );
  }
}

export function openStatisticsDatabase(
  file: string
): Readonly<{ database: DatabaseSync; version: CallDatabaseVersion }> {
  let database: DatabaseSync | undefined;
  let snapshot = false;
  try {
    requirePrivateFile(file);
    database = new DatabaseSync(file, {
      readOnly: true,
      timeout: lockTimeoutMs
    });
    database.exec("BEGIN");
    snapshot = true;
    const version = callDatabaseVersion(database);
    return { database, version };
  } catch (error) {
    try {
      if (snapshot) database?.exec("ROLLBACK");
    } finally {
      database?.close();
    }
    if (error instanceof JudgmentFailure) throw error;
    throw new JudgmentFailure(
      "storage",
      "无法只读打开日志数据库；请用 --database 指定已有私有调用记录库，检查路径、权限与锁占用。stats 不创建数据库。"
    );
  }
}
