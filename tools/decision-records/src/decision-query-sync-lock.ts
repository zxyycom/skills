import {
  decisionDiagnostic,
  decisionFailure,
  type DecisionApplicationFailure
} from "./application-result.ts";
import { DecisionCollectionLockError } from "./decision-collection-mutation-lock.ts";
import type {
  DecisionQueryResult,
  DecisionQuerySuccess
} from "./decision-query-contract.ts";

export function collectionLockFailure(
  error: unknown
): DecisionApplicationFailure {
  if (error instanceof DecisionCollectionLockError) {
    const operationResult = asDecisionQueryResult(error.operationResult);
    if (
      error.kind === "release-failed" &&
      operationResult?.status === "error"
    ) {
      const diagnostic = collectionLockDiagnostic(error, "no-change");
      return {
        ...operationResult,
        diagnostics: [...operationResult.diagnostics, diagnostic],
        errors: [...operationResult.errors, diagnostic.reason]
      };
    }
    const outcome =
      error.kind === "release-failed" &&
      operationResult?.status === "ok" &&
      operationResult.command === "sync-index" &&
      operationResult.state === "written"
        ? "committed-cleanup-pending"
        : "no-change";
    return decisionFailure([collectionLockDiagnostic(error, outcome)]);
  }
  return decisionFailure([
    decisionDiagnostic({
      code: "decision-records.sync-index-failed",
      outcome: "no-change",
      reason: "Decision index synchronization could not start.",
      recovery:
        "Inspect the decision collection and derived index, then retry the command.",
      scope: "Derived decision index",
      target: "Decision index synchronization"
    })
  ]);
}

function collectionLockDiagnostic(
  error: DecisionCollectionLockError,
  outcome: "committed-cleanup-pending" | "no-change"
) {
  return decisionDiagnostic({
    ...(error.kind === "access-denied"
      ? { causeCategory: "access-denied" as const }
      : error.kind === "busy"
        ? { causeCategory: "busy" as const }
        : {}),
    code: "decision-records.collection-lock-" + error.kind,
    outcome,
    reason:
      error.kind === "release-failed"
        ? "Decision index synchronization finished, but its collection lock could not be released."
        : "Decision index synchronization could not acquire its collection lock.",
    recovery:
      error.kind === "busy"
        ? "Wait for or confirm the active transaction; only if none is active, inspect the remaining lock before retrying."
        : error.kind === "access-denied"
          ? "Grant the current process access to the decision collection, then retry the command."
          : error.kind === "release-failed"
            ? "Inspect the derived index result and the remaining lock before running another mutation."
            : "Inspect the decision collection lock and its parent directory, then retry the command.",
    scope: "Derived decision index",
    target: "Decision collection mutation lock"
  });
}

function asDecisionQueryResult(value: unknown): DecisionQueryResult | null {
  return hasQueryResultStatus(value) ? queryResultForStatus(value) : null;
}
function hasQueryResultStatus(value: unknown): value is { status: unknown } {
  return value !== null && typeof value === "object" && "status" in value;
}
function queryResultForStatus(value: {
  status: unknown;
}): DecisionQueryResult | null {
  const result = value as Partial<DecisionQueryResult>;
  if (result.status === "error")
    return Array.isArray(result.diagnostics)
      ? (result as DecisionApplicationFailure)
      : null;
  return result.status === "ok" && typeof result.command === "string"
    ? (result as DecisionQuerySuccess)
    : null;
}
