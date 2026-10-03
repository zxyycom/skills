import { randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import { openCallDatabase } from "./call-database.ts";
import type { Configuration, LoggingConfiguration } from "./configuration.ts";
import { JudgmentFailure } from "./failure.ts";
import { record } from "./json.ts";
import type { Request } from "./request.ts";
import type { ValidatedResponse } from "./response.ts";

export type PersistenceMeta = Readonly<{
  callId?: string;
  status: "recorded" | "failed";
}>;

export type CallCompletion = Readonly<
  | { ok: true; result: ValidatedResponse }
  | { ok: false; error: JudgmentFailure }
>;

type FinalStatus = "succeeded" | "failed" | "indeterminate";

type UsageSummary = Readonly<{
  model: string | null;
  input: number | null;
  output: number | null;
  cost: number | null;
}>;

function requireChange(changes: number | bigint): void {
  if (changes !== 1 && changes !== 1n)
    throw new JudgmentFailure("storage", "调用记录缺失或未写入。");
}

function nonnegative(value: unknown, integer: boolean): number | null {
  return typeof value === "number" &&
    Number.isFinite(value) &&
    value >= 0 &&
    (!integer || Number.isSafeInteger(value))
    ? value
    : null;
}

function summary(result: ValidatedResponse | undefined): UsageSummary {
  const model = result?.model ?? null;
  const usage = record(result?.usage) ? result.usage : {};
  return {
    model,
    input: nonnegative(usage.input_tokens, true),
    output: nonnegative(usage.output_tokens, true),
    cost: nonnegative(usage.cost, false)
  };
}

// One session owns one durable call. Post-send write failures are latched, never
// substituted for the service result and never interpreted as permission to retry.
export class CallLog {
  readonly id = randomUUID();
  private failed = false;

  private constructor(
    private readonly database: DatabaseSync,
    private readonly config: LoggingConfiguration
  ) {}

  static start(config: Configuration, request: Request, body: string): CallLog {
    const database = openCallDatabase(config.logging.databasePath);
    const log = new CallLog(database, config.logging);
    const now = new Date().toISOString();
    try {
      const written = database
        .prepare(`INSERT INTO calls
        (id, started_at, updated_at, status, endpoint, request_model, question_count,
         save_request, save_response, request_json)
        VALUES (?, ?, ?, 'started', ?, ?, ?, ?, ?, ?)`)
        .run(
          log.id,
          now,
          now,
          config.endpoint,
          request.model,
          Object.keys(request.questions).length,
          Number(config.logging.saveRequest),
          Number(config.logging.saveResponse),
          config.logging.saveRequest ? body : null
        );
      requireChange(written.changes);
      return log;
    } catch {
      database.close();
      throw new JudgmentFailure(
        "storage",
        "无法持久化发送前记录；此次未发送。请检查日志数据库空间、权限与锁占用。"
      );
    }
  }

  received(status: number, body?: Uint8Array): void {
    this.write(() => {
      const written = this.database
        .prepare(`UPDATE calls SET updated_at = ?, http_status = ?,
        status = CASE WHEN ? IS NULL THEN status ELSE 'response_received' END,
        response_body = ? WHERE id = ?`)
        .run(
          new Date().toISOString(),
          status,
          body === undefined ? null : 1,
          this.config.saveResponse && body !== undefined ? body : null,
          this.id
        );
      requireChange(written.changes);
    });
  }

  finish(completion: CallCompletion, elapsedMs: number): PersistenceMeta {
    const kind = completion.ok ? null : completion.error.kind;
    let status: FinalStatus = "failed";
    if (kind === null) status = "succeeded";
    else if (kind === "network" || kind === "timeout") status = "indeterminate";
    const values = summary(completion.ok ? completion.result : undefined);
    this.write(() => {
      const now = new Date().toISOString();
      const written = this.database
        .prepare(`UPDATE calls SET updated_at = ?, finished_at = ?, status = ?,
        error_kind = ?, elapsed_ms = ?, response_model = ?, input_tokens = ?, output_tokens = ?, cost = ?
        WHERE id = ?`)
        .run(
          now,
          now,
          status,
          kind,
          elapsedMs,
          values.model,
          values.input,
          values.output,
          values.cost,
          this.id
        );
      requireChange(written.changes);
    });
    this.write(() => this.database.close());
    return { callId: this.id, status: this.failed ? "failed" : "recorded" };
  }

  private write(operation: () => void): void {
    try {
      operation();
    } catch {
      this.failed = true;
    }
  }
}
