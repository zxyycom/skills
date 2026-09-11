import { operationErrorDetail } from "./error-detail.ts";

export type VersionControlErrorCode =
  | "invalid-path"
  | "not-repository"
  | "operation-failed"
  | "pending-conflict"
  | "pending-recovery-failed"
  | "pending-replacement-failed"
  | "revision-not-found";

export type VersionControlErrorCauseCategory =
  | "access-denied"
  | "busy"
  | "command-failed"
  | "not-repository"
  | "revision-unavailable"
  | "tool-unavailable"
  | "unknown";

export type VersionControlErrorDetails = Readonly<{
  cause?: unknown;
  causeCategory: VersionControlErrorCauseCategory;
  code: VersionControlErrorCode;
  detail?: unknown;
  operation: string;
  target?: string | null;
}>;

const errorCodeLabels: Readonly<Record<VersionControlErrorCode, string>> = {
  "invalid-path": "path validation failed",
  "not-repository": "repository discovery failed",
  "operation-failed": "operation failed",
  "pending-conflict": "pending replacement conflicted",
  "pending-recovery-failed": "pending recovery failed",
  "pending-replacement-failed": "pending replacement failed",
  "revision-not-found": "revision was unavailable"
};

export function classifyVersionControlCause(
  cause: unknown,
  fallback: VersionControlErrorCauseCategory = "unknown"
): VersionControlErrorCauseCategory {
  if (cause instanceof VersionControlError) {
    return cause.causeCategory;
  }
  const code =
    typeof cause === "object" && cause !== null && "code" in cause
      ? cause.code
      : undefined;
  switch (code) {
    case "EACCES":
    case "EPERM":
      return "access-denied";
    case "ENOENT":
      return "tool-unavailable";
    default:
      return fallback;
  }
}

export class VersionControlError extends Error {
  readonly code: VersionControlErrorCode;
  readonly causeCategory: VersionControlErrorCauseCategory;
  readonly detail: string | null;
  readonly operation: string | null;
  readonly target: string | null;

  constructor(detailsOrCode: VersionControlErrorDetails) {
    const details: Readonly<{
      cause?: unknown;
      causeCategory: VersionControlErrorCauseCategory;
      code: VersionControlErrorCode;
      detail: unknown;
      operation: string | null;
      target: string | null;
    }> = {
      cause: detailsOrCode.cause,
      causeCategory: detailsOrCode.causeCategory,
      code: detailsOrCode.code,
      detail: detailsOrCode.detail,
      operation: detailsOrCode.operation,
      target: detailsOrCode.target ?? null
    };
    const detail = operationErrorDetail(details.detail);
    super(
      renderVersionControlError({
        ...details,
        detail
      }),
      details.cause === undefined ? undefined : { cause: details.cause }
    );
    this.name = "VersionControlError";
    this.code = details.code;
    this.causeCategory = details.causeCategory;
    this.detail = detail;
    this.operation = details.operation;
    this.target = details.target ?? null;
  }
}

export function renderVersionControlError(
  details: Readonly<{
    causeCategory: VersionControlErrorCauseCategory;
    code: VersionControlErrorCode;
    detail: string | null;
    operation: string | null;
    target: string | null;
  }>
): string {
  const description =
    details.operation === null
      ? `Version-control ${errorCodeLabel(details.code)}`
      : `Version-control ${errorCodeLabel(details.code)}: ${details.operation}`;
  const target = details.target === null ? "" : `; target: ${details.target}`;
  const detail = details.detail === null ? "" : `; detail: ${details.detail}`;
  return `${description}; cause: ${details.causeCategory}${target}${detail}`;
}

function errorCodeLabel(code: VersionControlErrorCode): string {
  return errorCodeLabels[code];
}
