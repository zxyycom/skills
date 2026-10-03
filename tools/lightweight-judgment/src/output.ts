import { JudgmentFailure } from "./failure.ts";
import { stringifyJson, type JsonValue } from "./json.ts";

export type CliOutcome = Readonly<{
  exitCode: 0 | 2 | 3;
  stdout: string;
  stderr: string;
}>;

export type InvocationState = {
  attempts: 0 | 1;
  started: number | undefined;
  requestModel: string | undefined;
  apiKey: string | undefined;
};

type InvocationMeta = Readonly<{
  requestModel?: string;
  elapsedMs: number;
  attempts: 0 | 1;
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
    attempts: state.attempts
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
    exitCode: 0,
    stdout: `${stringifyJson({ ok: true, result, meta: meta(state, now), error: null })}\n`,
    stderr: ""
  };
}

export function failureOutcome(
  error: unknown,
  state: Readonly<InvocationState>,
  now: number
): CliOutcome {
  const fallbackKind = state.attempts === 0 ? "input" : "invalid_response";
  const failure =
    error instanceof JudgmentFailure
      ? error
      : new JudgmentFailure(
          fallbackKind,
          "执行失败；请核对输入、运行环境或服务状态。"
        );
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
  return {
    exitCode: ["input", "configuration"].includes(failure.kind) ? 2 : 3,
    stdout: `${stringifyJson({ ok: false, result: null, meta: meta(state, now), error: detail })}\n`,
    stderr: `${message}\n`
  };
}
