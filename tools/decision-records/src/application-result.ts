import {
  VersionControlError,
  type VersionControlErrorCauseCategory
} from "../../shared/src/version-control/index.ts";
import { isFileSystemError } from "../../shared/src/node/filesystem.ts";
import { operationErrorDetail } from "../../shared/src/version-control/error-detail.ts";

export type DecisionFailurePresentation = "command" | "plain";

export type DecisionMutationOutcome =
  | "committed-cleanup-pending"
  | "no-change"
  | "partial-or-unknown"
  | "rolled-back";

export type DecisionDiagnosticCauseCategory =
  | VersionControlErrorCauseCategory
  | "not-found";

export type DecisionDiagnostic = Readonly<{
  causeCategory?: DecisionDiagnosticCauseCategory;
  code: string;
  detail?: string | null;
  outcome?: DecisionMutationOutcome;
  reason: string;
  recovery: string;
  scope?: string;
  target: string;
}>;

type LegacyDecisionDiagnostic = string | DecisionDiagnostic;

const fileSystemDiagnosticMarker =
  /\s*\[decision-filesystem:(access-denied|not-found|unknown)\]\s*/u;

export type DecisionApplicationFailure = {
  diagnostics: DecisionDiagnostic[];
  /** Compatibility summary for current in-process consumers. */
  errors: string[];
  exitCode: 1 | 2;
  presentation: DecisionFailurePresentation;
  status: "error";
};

export type DecisionApplicationAttention = {
  diagnostics: DecisionDiagnostic[];
  exitCode: 1;
  status: "attention";
  /** Compatibility summary for current in-process consumers. */
  warnings: string[];
};

export function decisionFailure(
  inputs: readonly LegacyDecisionDiagnostic[],
  options: {
    exitCode?: 1 | 2;
    presentation?: DecisionFailurePresentation;
  } = {}
): DecisionApplicationFailure {
  const diagnostics = inputs.map((input) =>
    typeof input === "string" ? legacyFailureDiagnostic(input) : input
  );
  return {
    diagnostics,
    errors: diagnostics.map((diagnostic) => diagnostic.reason),
    exitCode: options.exitCode ?? 1,
    presentation: options.presentation ?? "command",
    status: "error"
  };
}

export function decisionAttention(
  inputs: readonly LegacyDecisionDiagnostic[]
): DecisionApplicationAttention {
  const diagnostics = inputs.map((input) =>
    typeof input === "string" ? legacyAttentionDiagnostic(input) : input
  );
  return {
    diagnostics,
    exitCode: 1,
    status: "attention",
    warnings: diagnostics.map((diagnostic) => diagnostic.reason)
  };
}

export function decisionDiagnostic(
  options: DecisionDiagnostic
): DecisionDiagnostic {
  return options;
}

/**
 * Represents a filesystem error in an intermediate string without preserving an
 * unsafe raw Error message. Consumers must pass the resulting string through
 * `decisionDiagnosticFromReason` before rendering it to a user.
 */
export function decisionFileSystemErrorText(error: unknown): string {
  const causeCategory =
    isFileSystemError(error, "EACCES") || isFileSystemError(error, "EPERM")
      ? "access-denied"
      : "unknown";
  return (
    (operationErrorDetail(error) ?? "filesystem operation failed") +
    " [decision-filesystem:" +
    causeCategory +
    "]"
  );
}

/** Turns a known, human-readable reason into a stable filesystem diagnostic. */
export function decisionDiagnosticFromReason(
  options: Omit<DecisionDiagnostic, "reason">,
  reason: string
): DecisionDiagnostic {
  const match = fileSystemDiagnosticMarker.exec(reason);
  if (match === null) {
    return { ...options, reason };
  }
  const causeCategory = match[1] as "access-denied" | "not-found" | "unknown";
  const detail = operationErrorDetail(
    reason.replace(fileSystemDiagnosticMarker, "")
  );
  return {
    ...options,
    causeCategory,
    ...(detail === null ? {} : { detail }),
    reason: "The Decision Records filesystem operation could not complete.",
    recovery:
      causeCategory === "access-denied"
        ? "Grant the current process filesystem access to the decision collection, then retry the command."
        : options.recovery
  };
}

export function decisionFileSystemDiagnostic(
  options: Omit<DecisionDiagnostic, "causeCategory" | "detail" | "reason"> & {
    reason: string;
  },
  error: unknown
): DecisionDiagnostic {
  const { reason, ...diagnosticOptions } = options;
  return {
    ...decisionDiagnosticFromReason(
      diagnosticOptions,
      decisionFileSystemErrorText(error)
    ),
    reason
  };
}

export function decisionVersionControlFailure(
  options: Readonly<{
    action: string;
    outcome?: DecisionMutationOutcome;
    scope?: string;
    target: string;
  }>,
  error: unknown
): DecisionApplicationFailure {
  return decisionFailure([decisionVersionControlDiagnostic(options, error)]);
}

export function decisionVersionControlDiagnostic(
  options: Readonly<{
    action: string;
    outcome?: DecisionMutationOutcome;
    scope?: string;
    target: string;
  }>,
  error: unknown
): DecisionDiagnostic {
  if (error instanceof VersionControlError) {
    return {
      causeCategory: error.causeCategory,
      code: "decision-records.version-control-" + error.code,
      ...(error.detail === null ? {} : { detail: error.detail }),
      ...(options.outcome === undefined ? {} : { outcome: options.outcome }),
      reason:
        "Failed to " +
        options.action +
        (error.operation === null ? "" : ": " + error.operation) +
        ".",
      recovery: recoveryForVersionControlCause(error.causeCategory),
      ...(options.scope === undefined ? {} : { scope: options.scope }),
      target: error.target ?? options.target
    };
  }
  return {
    code: "decision-records.version-control-unavailable",
    ...(options.outcome === undefined ? {} : { outcome: options.outcome }),
    reason: "Could not " + options.action + ".",
    recovery:
      "Check that the version-control workspace is available, then retry the command.",
    ...(options.scope === undefined ? {} : { scope: options.scope }),
    target: options.target
  };
}

function legacyFailureDiagnostic(reason: string): DecisionDiagnostic {
  return decisionDiagnosticFromReason(
    {
      code: "decision-records.command-failed",
      recovery:
        "Correct the reported decision-records problem, then retry the command.",
      target: "Decision Records command"
    },
    reason
  );
}

function legacyAttentionDiagnostic(reason: string): DecisionDiagnostic {
  return decisionDiagnosticFromReason(
    {
      code: "decision-records.command-attention",
      recovery:
        "Review the reported decision state before retrying the command.",
      target: "Decision Records command"
    },
    reason
  );
}

function recoveryForVersionControlCause(
  causeCategory: VersionControlErrorCauseCategory
): string {
  switch (causeCategory) {
    case "access-denied":
      return "Grant the current process the required repository access, then retry the command.";
    case "busy":
      return "Wait for or confirm the active process; only if none is active, inspect the remaining lock before retrying.";
    case "not-repository":
      return "Run the command from a workspace that is inside the required version-control repository.";
    case "revision-unavailable":
      return "Inspect the requested revision or Git HEAD, then retry with an available revision.";
    case "tool-unavailable":
      return "Make the configured version-control tool available to the current process, then retry.";
    default:
      return "Inspect the repository state and the reported detail, then retry the command.";
  }
}
