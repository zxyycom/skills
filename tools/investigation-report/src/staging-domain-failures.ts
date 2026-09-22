import { VersionControlError } from "../../shared/src/version-control/index.ts";
import type { StateIndexDiagnostic } from "../../index-runtime/src/index.ts";
import { investigationIndexNamespace } from "./investigation-state-index.ts";
import type { InvestigationStageResult } from "./types.ts";
import {
  stageDiagnostic,
  type DomainStageControl
} from "./staging-domain-support.ts";

export type DomainStageFailureState = NonNullable<
  Extract<InvestigationStageResult, { status: "error"; changed: false }>
>["state"];

export function domainFailure(
  control: DomainStageControl,
  codeSuffix: string,
  error: unknown
): InvestigationStageResult {
  const detail =
    error instanceof VersionControlError && error.causeCategory !== undefined
      ? ` (causeCategory: ${error.causeCategory})`
      : error instanceof Error && error.message
        ? `: ${error.message}`
        : "";
  return domainFailureDiagnostics(control, "domain-stage-failed", [
    stageDiagnostic(
      `investigation-report.stage-${codeSuffix}`,
      `the selected Investigation ${control.input.scope} snapshot could not be prepared${detail}`,
      control.indexPath
    )
  ]);
}

export function domainFailureDiagnostics(
  control: DomainStageControl,
  state: DomainStageFailureState,
  diagnostics: readonly StateIndexDiagnostic[]
): InvestigationStageResult {
  return {
    changed: false,
    diagnostics: [...diagnostics],
    indexPath: control.indexPath,
    namespace: investigationIndexNamespace,
    scope: control.input.scope,
    selectedIds: [],
    state,
    status: "error"
  };
}

export function pendingReplacementFailure(
  control: DomainStageControl,
  error: unknown
): InvestigationStageResult {
  const pending = pendingReplacementOutcome(error);
  const state = pendingReplacementState(error);
  return {
    changed: false,
    diagnostics: [
      stageDiagnostic(
        `state-index.${state}`,
        pendingReplacementMessage(error),
        control.indexPath
      )
    ],
    indexPath: control.indexPath,
    namespace: investigationIndexNamespace,
    ...(pending === undefined ? {} : { pending }),
    scope: control.input.scope,
    selectedIds: [],
    state,
    status: "error"
  };
}

function pendingReplacementOutcome(error: unknown):
  | {
      outcome: "no-change" | "partial-or-unknown";
      scope: string;
    }
  | undefined {
  if (
    error instanceof VersionControlError &&
    (error.code === "pending-conflict" ||
      error.code === "pending-recovery-failed")
  ) {
    return {
      outcome:
        error.code === "pending-recovery-failed"
          ? ("partial-or-unknown" as const)
          : ("no-change" as const),
      scope: "Pending investigation snapshot"
    };
  }
  return undefined;
}

function pendingReplacementState(error: unknown): DomainStageFailureState {
  if (
    error instanceof VersionControlError &&
    error.code === "pending-conflict"
  ) {
    return "pending-conflict";
  }
  if (
    error instanceof VersionControlError &&
    error.code === "pending-recovery-failed"
  ) {
    return "pending-recovery-failed";
  }
  return "pending-write-failed";
}

function pendingReplacementMessage(error: unknown): string {
  if (
    error instanceof VersionControlError &&
    error.code === "pending-conflict"
  ) {
    return error.causeCategory === "busy"
      ? "the pending write boundary is busy; wait for any known concurrent operation to finish, then confirm a remaining lock is not stale before retrying"
      : "the current revision or target pending content changed; reread the current revision and target pending content, resolve any existing pending change for this scope, then retry";
  }
  if (
    error instanceof VersionControlError &&
    error.code === "pending-recovery-failed"
  ) {
    return "pending recovery was incomplete; read and reconcile the target range through the version-control API before retrying";
  }
  return "the selected Investigation pending snapshot could not be written";
}
