import {
  decisionDiagnostic,
  decisionDiagnosticFromReason,
  type DecisionDiagnostic,
  type DecisionMutationOutcome
} from "./application-result.ts";
import { DecisionCollectionLockError } from "./decision-collection-mutation-lock.ts";
import { transactionFileSystemDiagnostic } from "./decision-transaction.ts";
import type {
  DecisionTransactionIssue,
  DecisionTransactionResult
} from "./decision-transaction.ts";

const decisionMutationScope =
  "Decision Markdown files and derived decision index" as const;

export function decisionTransactionLockFailure(
  error: unknown
): DecisionTransactionResult {
  if (!(error instanceof DecisionCollectionLockError))
    return transactionStartFailure(error);
  const operationResult = asDecisionTransactionResult(error.operationResult);
  const releaseFailure = releasedTransactionFailure(error, operationResult);
  if (releaseFailure !== null) return releaseFailure;
  return collectionLockFailure(error, operationResult);
}

function transactionStartFailure(error: unknown): DecisionTransactionResult {
  return transactionFailure(
    [
      transactionFileSystemDiagnostic(
        "Decision transaction could not start.",
        "Decision transaction",
        error
      )
    ],
    "no-change"
  );
}

function releasedTransactionFailure(
  error: DecisionCollectionLockError,
  operationResult: DecisionTransactionResult | null
): DecisionTransactionResult | null {
  if (error.kind !== "release-failed" || operationResult?.status !== "error")
    return null;
  const diagnostic = collectionLockDiagnostic(error, operationResult.outcome);
  return {
    diagnostics: [...operationResult.diagnostics, diagnostic],
    errors: [...operationResult.errors, diagnostic.reason],
    outcome: operationResult.outcome,
    scope: decisionMutationScope,
    status: "error"
  };
}

function collectionLockFailure(
  error: DecisionCollectionLockError,
  operationResult: DecisionTransactionResult | null
): DecisionTransactionResult {
  const outcome = lockFailureOutcome(error, operationResult);
  const diagnostic = collectionLockDiagnostic(error, outcome);
  return {
    diagnostics: [diagnostic],
    errors: [diagnostic.reason],
    outcome,
    scope: decisionMutationScope,
    status: "error"
  };
}

function lockFailureOutcome(
  error: DecisionCollectionLockError,
  operationResult: DecisionTransactionResult | null
): DecisionMutationOutcome {
  return error.kind === "release-failed" &&
    operationResult?.status === "ok" &&
    operationResult.changed
    ? "committed-cleanup-pending"
    : "no-change";
}

export function transactionFailure(
  errors: readonly DecisionTransactionIssue[],
  outcome: DecisionMutationOutcome
): DecisionTransactionResult {
  const diagnostics = errors.map((error) =>
    typeof error === "string"
      ? decisionDiagnosticFromReason(
          {
            code: "decision-records.transaction-failed",
            outcome,
            recovery:
              outcome === "no-change"
                ? "Correct the reported precondition, then retry the command."
                : outcome === "rolled-back"
                  ? "Review the reported failure; the decision files and index were restored before retrying."
                  : outcome === "committed-cleanup-pending"
                    ? "Inspect the completed decision files and cleanup state before running another mutation."
                    : "Inspect and reconcile the decision files and index before retrying.",
            scope: decisionMutationScope,
            target: "Decision transaction"
          },
          error
        )
      : {
          ...error,
          outcome,
          scope: decisionMutationScope
        }
  );
  return {
    diagnostics,
    errors: diagnostics.map((diagnostic) =>
      diagnostic.detail === undefined || diagnostic.detail === null
        ? diagnostic.reason
        : diagnostic.reason + ": " + diagnostic.detail
    ),
    outcome,
    scope: decisionMutationScope,
    status: "error"
  };
}

function collectionLockDiagnostic(
  error: DecisionCollectionLockError,
  outcome: DecisionMutationOutcome
): DecisionDiagnostic {
  return decisionDiagnostic({
    code:
      "decision-records.collection-lock-" +
      (error.kind === "busy" ? "busy" : error.kind),
    ...(error.kind === "access-denied"
      ? { causeCategory: "access-denied" as const }
      : error.kind === "busy"
        ? { causeCategory: "busy" as const }
        : {}),
    outcome,
    reason:
      error.kind === "release-failed"
        ? "The decision transaction finished, but its collection lock could not be released."
        : "The decision transaction could not acquire its collection lock.",
    recovery:
      error.kind === "busy"
        ? "Wait for or confirm the active transaction; only if none is active, inspect the remaining lock before retrying."
        : error.kind === "access-denied"
          ? "Grant the current process access to the decision collection, then retry the command."
          : error.kind === "release-failed"
            ? "Inspect the decision transaction result and the remaining lock before running another mutation."
            : "Inspect the decision collection lock and its parent directory, then retry the command.",
    scope: decisionMutationScope,
    target: "Decision collection mutation lock"
  });
}

function asDecisionTransactionResult(
  value: unknown
): DecisionTransactionResult | null {
  if (value === null || typeof value !== "object" || !("status" in value))
    return null;
  const result = value as Partial<DecisionTransactionResult>;
  return successfulTransactionResult(result) ?? failedTransactionResult(result);
}

function successfulTransactionResult(
  result: Partial<DecisionTransactionResult>
): Extract<DecisionTransactionResult, { status: "ok" }> | null {
  return result.status === "ok" && typeof result.changed === "boolean"
    ? (result as Extract<DecisionTransactionResult, { status: "ok" }>)
    : null;
}

function failedTransactionResult(
  result: Partial<DecisionTransactionResult>
): Extract<DecisionTransactionResult, { status: "error" }> | null {
  if (result.status !== "error" || !validFailureOutcome(result.outcome))
    return null;
  if (!Array.isArray(result.diagnostics) || !Array.isArray(result.errors))
    return null;
  return result as Extract<DecisionTransactionResult, { status: "error" }>;
}

function validFailureOutcome(value: unknown): value is DecisionMutationOutcome {
  return (
    value === "no-change" ||
    value === "rolled-back" ||
    value === "partial-or-unknown"
  );
}
