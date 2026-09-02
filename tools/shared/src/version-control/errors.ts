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
  switch (code) {
    case "invalid-path":
      return "path validation failed";
    case "not-repository":
      return "repository discovery failed";
    case "operation-failed":
      return "operation failed";
    case "pending-conflict":
      return "pending replacement conflicted";
    case "pending-recovery-failed":
      return "pending recovery failed";
    case "pending-replacement-failed":
      return "pending replacement failed";
    case "revision-not-found":
      return "revision was unavailable";
  }
}
