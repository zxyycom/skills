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
  constructor(
    readonly kind: FailureKind,
    message: string,
    readonly httpStatus: number | null = null,
    readonly retryAfterMs?: number,
    readonly validation?: ValidationDiagnostic
  ) {
    super(message);
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
