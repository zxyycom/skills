import {
  VersionControlError,
  type VersionControlErrorCauseCategory
} from "../../shared/src/version-control/index.ts";
import { operationErrorDetail } from "../../shared/src/version-control/error-detail.ts";
import type { StateIndexDiagnostic } from "../../index-runtime/src/index.ts";

export type InvestigationMutationOutcome =
  | "no-change"
  | "rolled-back"
  | "partial-or-unknown"
  | "committed-cleanup-pending";

export type InvestigationMutationDiagnostic = Readonly<{
  outcome: InvestigationMutationOutcome;
  scope: string;
}>;

/**
 * The small, command-lifetime diagnostic contract owned by Investigation
 * Report. It deliberately does not retain an Error or introduce a shared
 * renderer registry: callers need only stable facts for the final CLI line.
 */
export type InvestigationDiagnostic = Readonly<{
  causeCategory?:
    | VersionControlErrorCauseCategory
    | "access-denied"
    | "not-found"
    | "unknown";
  code: string;
  detail?: string | null;
  mutation?: InvestigationMutationDiagnostic;
  operation?: string | null;
  reason: string;
  recovery: string;
  target: string;
}>;

export function diagnosticFromError(
  options: Readonly<{
    code: string;
    error: unknown;
    mutation?: InvestigationMutationDiagnostic;
    reason: string;
    recovery: string;
    target: string;
  }>
): InvestigationDiagnostic {
  if (options.error instanceof VersionControlError) {
    return {
      causeCategory: options.error.causeCategory,
      code: options.code,
      detail: options.error.detail,
      ...(options.mutation === undefined ? {} : { mutation: options.mutation }),
      operation: options.error.operation,
      reason: options.reason,
      recovery: options.recovery,
      target: options.target
    };
  }
  const causeCategory = fileSystemCauseCategory(options.error);
  return {
    ...(causeCategory === null ? {} : { causeCategory }),
    code: options.code,
    detail: errorDetail(options.error),
    ...(options.mutation === undefined ? {} : { mutation: options.mutation }),
    reason: options.reason,
    recovery: options.recovery,
    target: options.target
  };
}

export function genericInvestigationDiagnostic(
  options: Readonly<{
    code: string;
    mutation?: InvestigationMutationDiagnostic;
    reason: string;
    recovery: string;
    target: string;
  }>
): InvestigationDiagnostic {
  return {
    code: options.code,
    ...(options.mutation === undefined ? {} : { mutation: options.mutation }),
    reason: options.reason,
    recovery: options.recovery,
    target: options.target
  };
}

export function diagnosticFromStateIndexDiagnostic(
  diagnostic: StateIndexDiagnostic,
  options: Readonly<{
    mutation?: InvestigationMutationDiagnostic;
    recovery: string;
    target: string;
  }>
): InvestigationDiagnostic {
  if (diagnostic.filesystem !== undefined) {
    return {
      causeCategory: diagnostic.filesystem.causeCategory,
      code: diagnostic.code,
      detail: diagnostic.filesystem.detail,
      ...(options.mutation === undefined ? {} : { mutation: options.mutation }),
      operation: diagnostic.filesystem.operation,
      reason: sanitizeInvestigationDiagnosticText(diagnostic.message),
      recovery: options.recovery,
      target: diagnostic.filesystem.target ?? diagnostic.path ?? options.target
    };
  }
  if (diagnostic.versionControl !== undefined) {
    return {
      causeCategory: diagnostic.versionControl.causeCategory,
      code: diagnostic.code,
      detail: diagnostic.versionControl.detail,
      ...(options.mutation === undefined ? {} : { mutation: options.mutation }),
      operation: diagnostic.versionControl.operation,
      reason: sanitizeInvestigationDiagnosticText(diagnostic.message),
      recovery: options.recovery,
      target:
        diagnostic.versionControl.target ?? diagnostic.path ?? options.target
    };
  }
  const systemFailure = isStateIndexSystemFailure(diagnostic.code);
  const detail = sanitizeInvestigationDiagnosticText(diagnostic.message);
  return {
    ...(systemFailure ? { causeCategory: "unknown" as const } : {}),
    code: diagnostic.code,
    ...(systemFailure
      ? { detail, operation: stateIndexOperation(diagnostic.code) }
      : {}),
    ...(options.mutation === undefined ? {} : { mutation: options.mutation }),
    reason: systemFailure ? stateIndexReason(diagnostic.code) : detail,
    recovery: options.recovery,
    target: diagnostic.path ?? options.target
  };
}

export function renderInvestigationDiagnostic(
  diagnostic: InvestigationDiagnostic
): string[] {
  return [
    `[${diagnostic.code}] ${diagnostic.target}`,
    `  reason: ${sanitizeInvestigationDiagnosticText(diagnostic.reason)}`,
    `  next: ${sanitizeInvestigationDiagnosticText(diagnostic.recovery)}`,
    ...(diagnostic.causeCategory === undefined
      ? []
      : [`  causeCategory: ${diagnostic.causeCategory}`]),
    ...(diagnostic.operation === undefined || diagnostic.operation === null
      ? []
      : [`  operation: ${diagnostic.operation}`]),
    ...(diagnostic.detail === undefined || diagnostic.detail === null
      ? []
      : [
          `  detail: ${sanitizeInvestigationDiagnosticText(diagnostic.detail)}`
        ]),
    ...(diagnostic.mutation === undefined
      ? []
      : [
          `  scope: ${diagnostic.mutation.scope}`,
          `  outcome: ${diagnostic.mutation.outcome}`
        ])
  ];
}

export function sanitizeInvestigationDiagnosticText(value: unknown): string {
  return operationErrorDetail(value) ?? "unavailable error detail";
}

function fileSystemCauseCategory(
  error: unknown
): "access-denied" | "unknown" | null {
  const code =
    typeof error === "object" && error !== null
      ? Reflect.get(error, "code")
      : undefined;
  if (code === "EACCES" || code === "EPERM") return "access-denied";
  return code === undefined ? null : "unknown";
}

function errorDetail(error: unknown): string | null {
  return operationErrorDetail(error);
}

function isStateIndexSystemFailure(code: string): boolean {
  return (
    code === "state-index.index-path-invalid" ||
    code === "state-index.index-read-failed" ||
    code === "state-index.index-write-failed" ||
    code === "state-index.revision-read-failed" ||
    code === "state-index.source-read-failed"
  );
}

function stateIndexOperation(code: string): string {
  if (code === "state-index.index-write-failed") return "write derived index";
  if (code === "state-index.revision-read-failed")
    return "read derived index revision";
  if (code === "state-index.source-read-failed")
    return "read derived index source";
  if (code === "state-index.index-path-invalid")
    return "resolve derived index path";
  return "read derived index";
}

function stateIndexReason(code: string): string {
  if (code === "state-index.index-write-failed")
    return "the derived index write could not be verified";
  if (code === "state-index.revision-read-failed")
    return "the derived index revision could not be read";
  if (code === "state-index.source-read-failed")
    return "the derived index source could not be read";
  if (code === "state-index.index-path-invalid")
    return "the derived index path could not be resolved";
  return "the derived index could not be read";
}
