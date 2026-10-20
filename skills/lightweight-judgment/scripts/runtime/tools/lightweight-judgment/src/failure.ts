/*
 * Synced TypeScript runtime; repository maintenance edits tools/lightweight-judgment/src/failure.ts.
 * Installed skill copies may be edited directly; updates overwrite matching files.
 * Repository: https://github.com/zxyycom/skills
 * Source path: tools/lightweight-judgment/src/failure.ts
 * Maintained source: https://github.com/zxyycom/skills/blob/main/tools/lightweight-judgment/src/failure.ts
 * Skill source directory: https://github.com/zxyycom/skills/tree/main/skills/lightweight-judgment
 * Rebuild: bun run sync:lightweight-judgment-cli
 */
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
