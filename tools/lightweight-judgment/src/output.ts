import { normalizeFailure } from "./failure.ts";
import type { ApiKey } from "./configuration.ts";
import { stringifyJson, type JsonValue } from "./json.ts";
import type { PersistenceMeta } from "./call-log.ts";

export type CliOutcome = Readonly<{
  exitCode: 0 | 2 | 3 | 4;
  stdout: string;
  stderr: string;
}>;

export type InvocationState = {
  attempts: 0 | 1;
  started: number | undefined;
  requestModel: string | undefined;
  apiKey: ApiKey | undefined;
  persistence?: PersistenceMeta;
};

type InvocationMeta = Readonly<{
  requestModel?: string;
  elapsedMs: number;
  attempts: 0 | 1;
  persistence?: PersistenceMeta;
}>;

function meta(state: Readonly<InvocationState>, now: number): InvocationMeta {
  const elapsedMs =
    state.started === undefined
      ? 0
      : Math.max(0, Math.round(now - state.started));
  return {
    ...(state.requestModel === undefined
      ? {}
      : { requestModel: state.requestModel }),
    elapsedMs,
    attempts: state.attempts,
    ...(state.persistence === undefined
      ? {}
      : { persistence: state.persistence })
  };
}

export function successOutcome(
  result: JsonValue,
  state: Readonly<InvocationState>,
  now: number
): CliOutcome {
  // The API key is never inserted into this envelope. Preserve valid response fields;
  // do not mutate JSON tokens, keys, or data because a short key matches their text.
  return {
    exitCode: state.persistence?.status === "failed" ? 4 : 0,
    stdout: `${stringifyJson({ ok: true, result, meta: meta(state, now), error: null })}\n`,
    stderr: persistenceDiagnostic(state)
  };
}

export function failureOutcome(
  error: unknown,
  state: Readonly<InvocationState>,
  now: number
): CliOutcome {
  const fallbackKind = state.attempts === 0 ? "input" : "invalid_response";
  const failure = normalizeFailure(error, fallbackKind);
  const message = state.apiKey
    ? failure.message.split(state.apiKey).join("[REDACTED]")
    : failure.message;
  const detail = {
    kind: failure.kind,
    message,
    httpStatus: failure.httpStatus,
    ...(failure.retryAfterMs === undefined
      ? {}
      : { retryAfterMs: failure.retryAfterMs })
  };
  let exitCode: CliOutcome["exitCode"] = 3;
  if (["input", "configuration"].includes(failure.kind)) exitCode = 2;
  if (failure.kind === "storage" || state.persistence?.status === "failed")
    exitCode = 4;
  return {
    exitCode,
    stdout: `${stringifyJson({ ok: false, result: null, meta: meta(state, now), error: detail })}\n`,
    stderr: `${message}\n${persistenceDiagnostic(state)}`
  };
}

function persistenceDiagnostic(state: Readonly<InvocationState>): string {
  return state.persistence?.status === "failed"
    ? "调用记录未完整落盘；请保留当前输出并检查数据库。不要仅因日志失败自动重发。\n"
    : "";
}
