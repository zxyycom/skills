import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { JudgmentFailure } from "./failure.ts";

const applicationId = 1246058033;

const schema = `
CREATE TABLE calls (
  id TEXT PRIMARY KEY,
  started_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  finished_at TEXT,
  status TEXT NOT NULL CHECK(status IN ('started','response_received','succeeded','failed','indeterminate')),
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
CREATE INDEX calls_started_at ON calls(started_at);
CREATE INDEX calls_status ON calls(status);
PRAGMA application_id = ${applicationId};
PRAGMA user_version = 1;
`;

function prepareFile(file: string): void {
  fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  try {
    fs.closeSync(fs.openSync(file, "wx", 0o600));
  } catch (error) {
    if (!(error instanceof Error && "code" in error && error.code === "EEXIST"))
      throw error;
  }
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

function initialize(database: DatabaseSync): void {
  database.exec("BEGIN IMMEDIATE");
  try {
    const id = database.prepare("PRAGMA application_id").get()?.application_id;
    const version = database.prepare("PRAGMA user_version").get()?.user_version;
    const tables = database
      .prepare("SELECT name FROM sqlite_master WHERE name NOT LIKE 'sqlite_%'")
      .all();
    if (id === 0 && version === 0 && tables.length === 0) database.exec(schema);
    else if (id !== applicationId || version !== 1) {
      throw new JudgmentFailure(
        "storage",
        "日志数据库不是受支持的调用记录库；请选择独立路径，不覆盖已有数据库。"
      );
    }
    database.exec("COMMIT");
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
  database.exec("PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL");
}

export function openCallDatabase(file: string): DatabaseSync {
  let database: DatabaseSync | undefined;
  try {
    prepareFile(file);
    database = new DatabaseSync(file, { timeout: 5000 });
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
