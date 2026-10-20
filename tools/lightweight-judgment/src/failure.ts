export type FailureKind =
  | "configuration"
  | "input"
  | "storage"
  | "authentication"
  | "rate_limit"
  | "timeout"
  | "network"
  | "http"
  | "invalid_response";

export type ValidationDiagnostic = Readonly<{
  location: string;
  reason: string;
}>;

export class JudgmentFailure extends Error {
  readonly kind: FailureKind;
  readonly httpStatus: number | null;
  readonly retryAfterMs?: number;
  readonly validation?: ValidationDiagnostic;

  constructor(
    kind: FailureKind,
    message: string,
    httpStatus: number | null = null,
    retryAfterMs?: number,
    validation?: ValidationDiagnostic
  ) {
    super(message);
    this.kind = kind;
    this.httpStatus = httpStatus;
    this.retryAfterMs = retryAfterMs;
    this.validation = validation;
  }
}

export function normalizeFailure(
  error: unknown,
  fallbackKind: "input" | "invalid_response"
): JudgmentFailure {
  return error instanceof JudgmentFailure
    ? error
    : new JudgmentFailure(
        fallbackKind,
        "执行失败；请核对输入、运行环境或服务状态。"
      );
}

export function fail(kind: FailureKind, path: string, reason: string): never {
  throw new JudgmentFailure(kind, `${path}: ${reason}`, null, undefined, {
    location: path,
    reason
  });
}
