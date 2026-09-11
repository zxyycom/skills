import fs from "node:fs/promises";
import { selectEstablishedDecisionIds, validateDecisionScan } from "./index.ts";
import {
  decisionIndexDiagnostics,
  decisionIndexFileName,
  syncDecisionIndex
} from "./decision-state-index.ts";
import { withDecisionCollectionMutationLock } from "./decision-collection-mutation-lock.ts";
import {
  decisionFileSystemDiagnostic,
  type DecisionDiagnostic,
  type DecisionMutationOutcome
} from "./application-result.ts";
import { scanDecisionRecords } from "./scan.ts";
import type { DecisionScan, DecisionScanOptions } from "./types.ts";
import { preflightDecisionChanges } from "./decision-transaction-preflight.ts";
import {
  applyDecisionChange,
  restoreDecisionChanges
} from "./decision-transaction-files.ts";
import {
  decisionTransactionLockFailure,
  transactionFailure
} from "./decision-transaction-outcome.ts";
export { decisionTransactionLockFailure } from "./decision-transaction-outcome.ts";

export type DecisionFileChange = {
  decisionPath: string;
  expectedText: string;
  nextText: string | null;
  /** Move the replacement text to this path rather than overwriting the source. */
  targetPath?: string;
};

export type DecisionChangePreflight = {
  createdTargetPaths: Set<string>;
  errors: DecisionTransactionIssue[];
  originalBodies: Map<string, string>;
};

export type DecisionTransactionIssue = string | DecisionDiagnostic;

export type DecisionTransactionResult =
  | {
      changed: boolean;
      diagnostics: [];
      errors: [];
      status: "ok";
    }
  | {
      diagnostics: DecisionDiagnostic[];
      errors: string[];
      outcome: DecisionMutationOutcome;
      scope: "Decision Markdown files and derived decision index";
      status: "error";
    };

export async function applyDecisionChanges(options: {
  changes: readonly DecisionFileChange[];
  originalScan: DecisionScan;
  scanOptions: DecisionScanOptions;
}): Promise<DecisionTransactionResult> {
  try {
    return await withDecisionCollectionMutationLock(
      options.originalScan.indexPath,
      async () => await applyLockedDecisionChanges(options)
    );
  } catch (error) {
    return decisionTransactionLockFailure(error);
  }
}

/**
 * Applies already prepared changes while the caller holds the collection lock.
 * Lifecycle commands use this after re-reading their scan and Git baseline in
 * that same lock; direct transaction callers should use applyDecisionChanges.
 */
export async function applyLockedDecisionChanges(options: {
  changes: readonly DecisionFileChange[];
  originalScan: DecisionScan;
  scanOptions: DecisionScanOptions;
}): Promise<DecisionTransactionResult> {
  const { changes, originalScan } = options;
  const preflight = await preflightDecisionChanges(changes, originalScan);
  if (preflight.errors.length > 0) {
    return transactionFailure(preflight.errors, "no-change");
  }
  try {
    return await applyPreflightedDecisionChanges(options, preflight);
  } catch (error) {
    return await recoveredTransactionFailure(
      [
        transactionFileSystemDiagnostic(
          "Failed to update decision files and index.",
          "Decision transaction",
          error
        )
      ],
      originalScan,
      preflight
    );
  }
}

async function applyPreflightedDecisionChanges(
  options: {
    changes: readonly DecisionFileChange[];
    originalScan: DecisionScan;
    scanOptions: DecisionScanOptions;
  },
  preflight: DecisionChangePreflight
): Promise<DecisionTransactionResult> {
  let changed = await applyPreflightDecisionChanges(
    options.changes,
    preflight.createdTargetPaths
  );
  const candidateScan = await scanDecisionRecords(options.scanOptions);
  const hasEstablishedDecision = candidateScan.records.some(
    (record) => record.markdownExists && record.document !== null
  );
  const sourceErrors = await changedDecisionSourceErrors(
    candidateScan,
    hasEstablishedDecision
  );
  if (sourceErrors.length > 0) {
    return await recoveredTransactionFailure(
      sourceErrors,
      options.originalScan,
      preflight
    );
  }
  const synchronized = await synchronizeChangedDecisionIndex(
    candidateScan,
    hasEstablishedDecision,
    changed
  );
  if (synchronized.errors.length > 0) {
    return await recoveredTransactionFailure(
      synchronized.errors,
      options.originalScan,
      preflight
    );
  }
  changed = synchronized.changed;
  const validationErrors = await finalDecisionValidationErrors(
    options.scanOptions,
    hasEstablishedDecision
  );
  if (validationErrors.length > 0) {
    return await recoveredTransactionFailure(
      validationErrors,
      options.originalScan,
      preflight
    );
  }
  return { changed, diagnostics: [], errors: [], status: "ok" };
}

async function applyPreflightDecisionChanges(
  changes: readonly DecisionFileChange[],
  createdTargetPaths: Set<string>
): Promise<boolean> {
  let changed = false;
  for (const change of changes) {
    changed =
      (await applyDecisionChange(change, createdTargetPaths)) || changed;
  }
  return changed;
}

async function changedDecisionSourceErrors(
  scan: DecisionScan,
  hasEstablishedDecision: boolean
): Promise<DecisionTransactionIssue[]> {
  const validation = await validateDecisionScan(scan, {
    allowEmptyDecisionSet: !hasEstablishedDecision,
    checkIndexText: false,
    scanErrorPolicy: "source-only"
  });
  return validation.errors;
}

async function synchronizeChangedDecisionIndex(
  scan: DecisionScan,
  hasEstablishedDecision: boolean,
  changed: boolean
): Promise<{ changed: boolean; errors: DecisionTransactionIssue[] }> {
  if (!hasEstablishedDecision) {
    await fs.rm(scan.indexPath, { force: true });
    return { changed: scan.indexExists || changed, errors: [] };
  }
  const selection = selectEstablishedDecisionIds(scan);
  if (selection.errors.length > 0) {
    return { changed, errors: selection.errors };
  }
  const synchronized = await syncDecisionIndex({
    decisionsDirectory: scan.decisionsDirectory,
    indexPath: decisionIndexFileName,
    mode: "write"
  });
  if (synchronized.status === "error") {
    return {
      changed,
      errors: decisionIndexDiagnostics(synchronized.diagnostics, {
        code: "decision-records.transaction-failed",
        recovery:
          "Inspect the decision files and derived index, then retry the command.",
        target: scan.indexRelativePath
      })
    };
  }
  return { changed: synchronized.state === "written" || changed, errors: [] };
}

async function finalDecisionValidationErrors(
  scanOptions: DecisionScanOptions,
  hasEstablishedDecision: boolean
): Promise<DecisionTransactionIssue[]> {
  const validationScan = await scanDecisionRecords(scanOptions);
  const validation = await validateDecisionScan(validationScan, {
    allowEmptyDecisionSet: !hasEstablishedDecision
  });
  return validation.errors;
}

async function recoveredTransactionFailure(
  errors: readonly DecisionTransactionIssue[],
  originalScan: DecisionScan,
  preflight: DecisionChangePreflight
): Promise<DecisionTransactionResult> {
  const recoveryErrors = await restoreDecisionChanges(originalScan, preflight);
  return transactionFailure(
    [...errors, ...recoveryErrors],
    recoveryErrors.length === 0 ? "rolled-back" : "partial-or-unknown"
  );
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
        "Inspect the decision files and derived index, then retry the command.",
      target
    },
    error
  );
}
