import {
  renderRecordDiagnosticCauses,
  safeDiagnosticLocator,
  safeDiagnosticText
} from "../../record-operations/src/diagnostic-text.ts";
import type {
  RecordDiagnosticCause,
  RecordDiagnosticSource
} from "../../record-operations/src/history-index.ts";
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

export type InvestigationDiagnosticSource = RecordDiagnosticSource;

export type InvestigationDiagnosticCause = RecordDiagnosticCause;

/** Command-lifetime facts shared by operation adapters and CLI rendering. */
export type InvestigationDiagnostic = Readonly<{
  causes?: readonly InvestigationDiagnosticCause[];
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
  source?: InvestigationDiagnosticSource;
  target: string;
}>;

type InvestigationDiagnosticContext = Pick<
  InvestigationDiagnostic,
  "code" | "mutation" | "reason" | "recovery" | "source" | "target"
>;

type InvestigationIndexDiagnosticContext = Pick<
  InvestigationDiagnosticContext,
  "mutation" | "recovery" | "source" | "target"
>;

export function diagnosticFromError(
  options: InvestigationDiagnosticContext & Readonly<{ error: unknown }>
): InvestigationDiagnostic {
  const context = genericInvestigationDiagnostic(options);
  if (options.error instanceof VersionControlError) {
    return {
      ...context,
      causeCategory: options.error.causeCategory,
      detail: options.error.detail,
      operation: options.error.operation
    };
  }
  const causeCategory = fileSystemCauseCategory(options.error);
  return {
    ...context,
    ...(causeCategory === null ? {} : { causeCategory }),
    detail: operationErrorDetail(options.error)
  };
}

export function genericInvestigationDiagnostic(
  options: InvestigationDiagnosticContext &
    Pick<InvestigationDiagnostic, "causes">
): InvestigationDiagnostic {
  return {
    ...(options.causes === undefined ? {} : { causes: options.causes }),
    code: options.code,
    ...(options.mutation === undefined ? {} : { mutation: options.mutation }),
    reason: options.reason,
    recovery: options.recovery,
    ...(options.source === undefined ? {} : { source: options.source }),
    target: options.target
  };
}

export function diagnosticFromStateIndexDiagnostic(
  diagnostic: StateIndexDiagnostic,
  options: InvestigationIndexDiagnosticContext
): InvestigationDiagnostic {
  const boundary = diagnostic.filesystem ?? diagnostic.versionControl;
  const facts =
    boundary === undefined
      ? internalStateIndexDiagnosticFacts(diagnostic)
      : boundaryStateIndexDiagnosticFacts(diagnostic, boundary);
  return {
    ...genericInvestigationDiagnostic({
      ...options,
      code: diagnostic.code,
      reason: facts.reason,
      target: boundary?.target ?? diagnostic.path ?? options.target
    }),
    ...facts
  };
}

type StateIndexDiagnosticFacts = Pick<
  InvestigationDiagnostic,
  "causeCategory" | "detail" | "operation" | "reason"
>;

type StateIndexBoundaryDiagnostic = Readonly<{
  causeCategory: InvestigationDiagnostic["causeCategory"];
  detail: string | null;
  operation: string | null;
}>;

function boundaryStateIndexDiagnosticFacts(
  diagnostic: StateIndexDiagnostic,
  boundary: StateIndexBoundaryDiagnostic
): StateIndexDiagnosticFacts {
  return {
    ...(boundary.causeCategory === undefined
      ? {}
      : { causeCategory: boundary.causeCategory }),
    detail: boundary.detail,
    operation: boundary.operation,
    reason: sanitizeInvestigationDiagnosticText(diagnostic.message)
  };
}

function internalStateIndexDiagnosticFacts(
  diagnostic: StateIndexDiagnostic
): StateIndexDiagnosticFacts {
  const systemFailure = isStateIndexSystemFailure(diagnostic.code);
  const detail = sanitizeInvestigationDiagnosticText(diagnostic.message);
  return {
    ...(systemFailure ? { causeCategory: "unknown" as const } : {}),
    ...(systemFailure
      ? { detail, operation: stateIndexOperation(diagnostic.code) }
      : {}),
    reason: systemFailure ? stateIndexReason(diagnostic.code) : detail
  };
}

export function renderInvestigationDiagnostic(
  diagnostic: InvestigationDiagnostic
): string[] {
  return [
    `[${safeDiagnosticLocator(diagnostic.code)}] ${safeDiagnosticLocator(diagnostic.target)}`,
    `  reason: ${sanitizeInvestigationDiagnosticText(diagnostic.reason)}`,
    `  next: ${sanitizeInvestigationDiagnosticText(diagnostic.recovery)}`,
    ...(diagnostic.source === undefined
      ? []
      : [
          `  source: ${diagnostic.source.kind}`,
          `  revision: ${safeDiagnosticLocator(diagnostic.source.revision)}`,
          `  path: ${`"${safeDiagnosticLocator(diagnostic.source.path)}"`}`
        ]),
    ...(diagnostic.causeCategory === undefined
      ? []
      : [`  causeCategory: ${diagnostic.causeCategory}`]),
    ...(diagnostic.operation === undefined || diagnostic.operation === null
      ? []
      : [`  operation: ${safeDiagnosticText(diagnostic.operation)}`]),
    ...(diagnostic.detail === undefined || diagnostic.detail === null
      ? []
      : [
          `  detail: ${sanitizeInvestigationDiagnosticText(diagnostic.detail)}`
        ]),
    ...renderRecordDiagnosticCauses(diagnostic.causes ?? []),
    ...(diagnostic.mutation === undefined
      ? []
      : [
          `  scope: ${safeDiagnosticLocator(diagnostic.mutation.scope)}`,
          `  outcome: ${diagnostic.mutation.outcome}`
        ])
  ];
}

export function sanitizeInvestigationDiagnosticText(value: unknown): string {
  return safeDiagnosticText(value);
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
