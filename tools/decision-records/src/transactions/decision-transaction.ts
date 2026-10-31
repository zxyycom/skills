import type { DecisionSourceCapture } from "./decision-strict-preparation.ts";
import path from "node:path";
import { RecordAtomicCleanupError } from "../../../record-operations/src/transactions/transaction-files.ts";
import {
  runRecordTransaction,
  type RecordTransactionResult
} from "../../../record-operations/src/transactions/transaction.ts";
import { withDecisionCollectionMutationLock } from "../collection/decision-collection-mutation-lock.ts";
import {
  decisionFileSystemDiagnostic,
  type DecisionDiagnostic,
  type DecisionMutationOutcome
} from "../application-result.ts";
import {
  prepareDecisionTransactionPlan,
  verifyDecisionTransactionMembers,
  type PreparedDecisionTransaction
} from "./decision-transaction-plan.ts";
import {
  decisionTransactionLockFailure,
  transactionFailure
} from "./decision-transaction-outcome.ts";
import type { DecisionPreparationContext } from "../types.ts";
export { decisionTransactionLockFailure } from "./decision-transaction-outcome.ts";

export type DecisionFileChange = {
  decisionPath: string;
  expectedText: string;
  nextText: string | null;
  targetPath?: string;
};
export type DecisionTransactionIssue = string | DecisionDiagnostic;
export type DecisionTransactionFacts = {
  changed?: boolean;
  committed?: boolean;
  verification?: "passed" | "failed-or-unknown" | "not-run";
  sourcePaths?: readonly string[];
};
export type DecisionTransactionResult = DecisionTransactionFacts &
  (
    | { changed: boolean; diagnostics: []; errors: []; status: "ok" }
    | {
        diagnostics: DecisionDiagnostic[];
        errors: string[];
        outcome: DecisionMutationOutcome;
        scope: "Decision Markdown files and derived decision index";
        status: "error";
      }
  );

type DecisionChanges = Readonly<{
  changes: readonly DecisionFileChange[];
  originalScan: DecisionPreparationContext;
}>;
export async function applyDecisionChanges(
  options: DecisionChanges
): Promise<DecisionTransactionResult> {
  return await applyPreparedDecisionTransaction({
    context: options.originalScan,
    changes: options.changes
  });
}
/** The caller prepared domain lifecycle/history while holding the collection lock. */
export async function applyLockedDecisionChanges(
  options: DecisionChanges & { sourceCapture?: DecisionSourceCapture }
): Promise<DecisionTransactionResult> {
  return await runDecisionTransaction(
    {
      context: options.originalScan,
      changes: options.changes,
      lockHeld: true
    },
    options.sourceCapture
  );
}

type DecisionTransactionOptions = Readonly<{
  context: DecisionPreparationContext;
  changes: readonly DecisionFileChange[];
  lockHeld?: boolean;
  preflight?: boolean;
}>;

export async function applyPreparedDecisionTransaction(
  options: DecisionTransactionOptions
): Promise<DecisionTransactionResult> {
  return await runDecisionTransaction(options);
}

async function runDecisionTransaction(
  options: DecisionTransactionOptions,
  sourceCapture?: DecisionSourceCapture
): Promise<DecisionTransactionResult> {
  const operation = async (): Promise<DecisionTransactionResult> => {
    const result = await runRecordTransaction({
      preflight: options.preflight,
      prepare: () =>
        prepareDecisionTransactionPlan(
          options.context,
          options.changes,
          sourceCapture
        ),
      fresh: (value) => verifyDecisionTransactionMembers(value, "before"),
      verify: (value) => verifyDecisionTransactionMembers(value, "after"),
      verifyRecovered: (value) =>
        verifyDecisionTransactionMembers(value, "before")
    });
    return decisionTransactionResult(result, options.context.indexRelativePath);
  };
  try {
    return options.lockHeld === true || options.preflight === true
      ? await operation()
      : await withDecisionCollectionMutationLock(
          options.context.indexPath,
          operation
        );
  } catch (error) {
    return decisionTransactionLockFailure(error);
  }
}

function decisionTransactionResult(
  result: RecordTransactionResult<PreparedDecisionTransaction>,
  target: string
): DecisionTransactionResult {
  const facts = {
    changed: result.changed,
    committed: result.committed,
    verification: result.verification,
    sourcePaths: result.writtenPaths.map((filePath) =>
      result.value === null
        ? filePath
        : path
            .relative(result.value.context.decisionsDirectory, filePath)
            .split(path.sep)
            .join("/")
    )
  };
  if (result.status === "ok")
    return { ...facts, diagnostics: [], errors: [], status: "ok" };
  const errors = result.errors.map((error) =>
    transactionFileSystemDiagnostic(
      "Failed to update or verify Decision files and index.",
      target,
      error
    )
  );
  const cleanup = result.cleanupErrors.map((error) =>
    transactionFileSystemDiagnostic(
      "Decision mutation completed but temporary cleanup failed.",
      error instanceof RecordAtomicCleanupError && result.value !== null
        ? path
            .relative(result.value.context.workspaceRoot, error.temporaryPath)
            .split(path.sep)
            .join("/")
        : target,
      error
    )
  );
  return transactionFailure([...errors, ...cleanup], result.outcome, facts);
}
export function transactionFileSystemDiagnostic(
  reason: string,
  target: string,
  error: unknown
): DecisionDiagnostic {
  return decisionFileSystemDiagnostic(
    {
      code: "decision-records.transaction-failed",
      reason,
      recovery:
        "Inspect and reconcile the Decision files, derived index and cleanup state before running another mutation.",
      target
    },
    error
  );
}
