export type FailureKind =
  | "configuration"
  | "input"
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

export function fail(kind: FailureKind, path: string, reason: string): never {
  throw new JudgmentFailure(kind, `${path}: ${reason}`, null, undefined, {
    location: path,
    reason
  });
}
