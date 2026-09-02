import fs from "node:fs/promises";
import path from "node:path";
import { isFileSystemError } from "../../shared/src/node/filesystem.ts";
import { selectEstablishedDecisionIds, validateDecisionScan } from "./index.ts";
import {
  decisionIndexDiagnostics,
  decisionIndexFileName,
  syncDecisionIndex
} from "./decision-state-index.ts";
import {
  DecisionCollectionLockError,
  withDecisionCollectionMutationLock
} from "./decision-collection-mutation-lock.ts";
import {
  decisionDiagnostic,
  decisionDiagnosticFromReason,
  decisionFileSystemDiagnostic,
  type DecisionDiagnostic,
  type DecisionMutationOutcome
} from "./application-result.ts";
import { scanDecisionRecords } from "./scan.ts";
import { displayDecisionPath } from "./decision-path.ts";
import type { DecisionScan, DecisionScanOptions } from "./types.ts";

export type DecisionFileChange = {
  decisionPath: string;
  expectedText: string;
  nextText: string | null;
  /** Move the replacement text to this path rather than overwriting the source. */
  targetPath?: string;
};

type DecisionChangePreflight = {
  createdTargetPaths: Set<string>;
  errors: DecisionTransactionIssue[];
  originalBodies: Map<string, string>;
};

type DecisionTransactionIssue = string | DecisionDiagnostic;

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

const decisionMutationScope =
  "Decision Markdown files and derived decision index" as const;

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
  const { changes, originalScan, scanOptions } = options;
  const preflight = await preflightDecisionChanges(changes, originalScan);
  if (preflight.errors.length > 0) {
    return transactionFailure(preflight.errors, "no-change");
  }
  try {
    let changed = false;
    for (const change of changes) {
      changed =
        (await applyDecisionChange(change, preflight.createdTargetPaths)) ||
        changed;
    }
    const candidateScan = await scanDecisionRecords(scanOptions);
    const hasEstablishedDecision = candidateScan.records.some(
      (record) => record.markdownExists && record.document !== null
    );
    const sourceValidation = await validateDecisionScan(candidateScan, {
      allowEmptyDecisionSet: !hasEstablishedDecision,
      checkIndexText: false,
      scanErrorPolicy: "source-only"
    });
    if (sourceValidation.errors.length > 0) {
      return await recoveredTransactionFailure(
        sourceValidation.errors,
        originalScan,
        preflight
      );
    }

    if (!hasEstablishedDecision) {
      await fs.rm(candidateScan.indexPath, { force: true });
      changed = candidateScan.indexExists || changed;
    } else {
      const selection = selectEstablishedDecisionIds(candidateScan);
      if (selection.errors.length > 0) {
        return await recoveredTransactionFailure(
          selection.errors,
          originalScan,
          preflight
        );
      }
      const synchronized = await syncDecisionIndex({
        decisionsDirectory: candidateScan.decisionsDirectory,
        indexPath: decisionIndexFileName,
        mode: "write",
        decisionIds: selection.decisionIds
      });
      if (synchronized.status === "error") {
        return await recoveredTransactionFailure(
          decisionIndexDiagnostics(synchronized.diagnostics, {
            code: "decision-records.transaction-failed",
            recovery:
              "Inspect the decision files and derived index, then retry the command.",
            target: candidateScan.indexRelativePath
          }),
          originalScan,
          preflight
        );
      }
      changed = synchronized.state === "written" || changed;
    }

    const validationScan = await scanDecisionRecords(scanOptions);
    const validation = await validateDecisionScan(validationScan, {
      allowEmptyDecisionSet: !hasEstablishedDecision
    });
    if (validation.errors.length > 0) {
      return await recoveredTransactionFailure(
        validation.errors,
        originalScan,
        preflight
      );
    }
    return { changed, diagnostics: [], errors: [], status: "ok" };
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

export function decisionTransactionLockFailure(
  error: unknown
): DecisionTransactionResult {
  if (error instanceof DecisionCollectionLockError) {
    const operationResult = asDecisionTransactionResult(error.operationResult);
    if (
      error.kind === "release-failed" &&
      operationResult?.status === "error"
    ) {
      const diagnostic = collectionLockDiagnostic(
        error,
        operationResult.outcome
      );
      return {
        diagnostics: [...operationResult.diagnostics, diagnostic],
        errors: [...operationResult.errors, diagnostic.reason],
        outcome: operationResult.outcome,
        scope: decisionMutationScope,
        status: "error"
      };
    }
    const outcome: DecisionMutationOutcome =
      error.kind === "release-failed" &&
      operationResult?.status === "ok" &&
      operationResult.changed
        ? "committed-cleanup-pending"
        : "no-change";
    const diagnostic = collectionLockDiagnostic(error, outcome);
    return {
      diagnostics: [diagnostic],
      errors: [diagnostic.reason],
      outcome,
      scope: decisionMutationScope,
      status: "error"
    };
  }
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

function transactionFailure(
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

async function preflightDecisionChanges(
  changes: readonly DecisionFileChange[],
  originalScan: DecisionScan
): Promise<DecisionChangePreflight> {
  const errors: DecisionTransactionIssue[] = [];
  const createdTargetPaths = new Set<string>();
  const moveTargetPaths = new Set<string>();
  const originalBodies = new Map<string, string>();
  for (const change of changes) {
    const displayPath = displayDecisionPath(
      originalScan.workspaceRoot,
      change.decisionPath
    );
    if (originalBodies.has(change.decisionPath)) {
      errors.push(
        "Decision transaction contains the same source more than once: " +
          displayPath +
          ". No files were written."
      );
      continue;
    }
    try {
      const currentText = await readRegularDecisionFile(change.decisionPath);
      originalBodies.set(change.decisionPath, currentText);
      if (currentText !== change.expectedText) {
        errors.push(concurrentChangeError("source", displayPath));
      }
    } catch (error) {
      errors.push(
        transactionFileSystemDiagnostic(
          "Failed to verify decision source before update. No files were written.",
          displayPath,
          error
        )
      );
    }
    if (
      change.targetPath !== undefined &&
      change.targetPath !== change.decisionPath
    ) {
      if (moveTargetPaths.has(change.targetPath)) {
        errors.push(
          "Decision transaction contains the same move target more than once: " +
            displayDecisionPath(originalScan.workspaceRoot, change.targetPath) +
            ". No files were written."
        );
        continue;
      }
      moveTargetPaths.add(change.targetPath);
      try {
        await fs.lstat(change.targetPath);
        errors.push(
          "Decision move target already exists: " +
            displayDecisionPath(originalScan.workspaceRoot, change.targetPath) +
            ". No files were written."
        );
      } catch (error) {
        if (isFileSystemError(error, "ENOENT")) {
          continue;
        } else {
          errors.push(
            transactionFileSystemDiagnostic(
              "Failed to verify decision move target before update. No files were written.",
              displayDecisionPath(
                originalScan.workspaceRoot,
                change.targetPath
              ),
              error
            )
          );
        }
      }
    }
  }

  try {
    const currentIndexText = await readRegularDecisionFile(
      originalScan.indexPath
    );
    if (
      !originalScan.indexExists ||
      currentIndexText !== originalScan.indexText
    ) {
      errors.push(
        concurrentChangeError("index", originalScan.indexRelativePath)
      );
    }
  } catch (error) {
    if (originalScan.indexExists || !isFileSystemError(error, "ENOENT")) {
      errors.push(
        transactionFileSystemDiagnostic(
          "Failed to verify decision index before update. No files were written.",
          originalScan.indexRelativePath,
          error
        )
      );
    }
  }
  return { createdTargetPaths, errors, originalBodies };
}

async function applyDecisionChange(
  change: DecisionFileChange,
  createdTargetPaths: Set<string>
): Promise<boolean> {
  if (
    change.targetPath !== undefined &&
    change.targetPath !== change.decisionPath
  ) {
    if (change.nextText === null) {
      throw new Error("a decision move requires replacement text");
    }
    await fs.mkdir(path.dirname(change.targetPath), { recursive: true });
    const target = await fs.open(change.targetPath, "wx");
    createdTargetPaths.add(change.targetPath);
    try {
      await target.writeFile(change.nextText, "utf8");
    } finally {
      await target.close();
    }
    await fs.rm(change.decisionPath);
    return true;
  }
  if (change.nextText === null) {
    await fs.rm(change.decisionPath);
    return true;
  }
  await ensureRegularDecisionFile(change.decisionPath);
  await fs.writeFile(change.decisionPath, change.nextText, "utf8");
  return change.nextText !== change.expectedText;
}

function concurrentChangeError(
  kind: "index" | "source",
  filePath: string
): string {
  return (
    "Decision " +
    kind +
    " changed after validation: " +
    filePath +
    ". No files were written; review the current files and re-run the command."
  );
}

async function restoreDecisionChanges(
  originalScan: DecisionScan,
  preflight: DecisionChangePreflight
): Promise<DecisionTransactionIssue[]> {
  const errors: DecisionTransactionIssue[] = [];
  for (const targetPath of preflight.createdTargetPaths) {
    try {
      await fs.rm(targetPath, { force: true });
    } catch (error) {
      errors.push(
        transactionFileSystemDiagnostic(
          "Failed to restore decision move target.",
          displayDecisionPath(originalScan.workspaceRoot, targetPath),
          error
        )
      );
    }
  }
  for (const [decisionPath, body] of preflight.originalBodies) {
    try {
      await fs.mkdir(path.dirname(decisionPath), { recursive: true });
      await fs.writeFile(decisionPath, body, "utf8");
    } catch (error) {
      errors.push(
        transactionFileSystemDiagnostic(
          "Failed to restore decision body.",
          displayDecisionPath(originalScan.workspaceRoot, decisionPath),
          error
        )
      );
    }
  }
  try {
    if (originalScan.indexExists) {
      await fs.writeFile(
        originalScan.indexPath,
        originalScan.indexText,
        "utf8"
      );
    } else {
      await fs.rm(originalScan.indexPath, { force: true });
    }
  } catch (error) {
    errors.push(
      transactionFileSystemDiagnostic(
        "Failed to restore decision index.",
        originalScan.indexRelativePath,
        error
      )
    );
  }
  return errors;
}

async function readRegularDecisionFile(filePath: string): Promise<string> {
  await ensureRegularDecisionFile(filePath);
  return await fs.readFile(filePath, "utf8");
}

async function ensureRegularDecisionFile(filePath: string): Promise<void> {
  const entry = await fs.lstat(filePath);
  if (entry.isSymbolicLink() || !entry.isFile()) {
    throw new Error("must be a regular non-symbolic-link file");
  }
}

function transactionFileSystemDiagnostic(
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
  if (value === null || typeof value !== "object" || !("status" in value)) {
    return null;
  }
  const result = value as Partial<DecisionTransactionResult>;
  if (result.status === "ok" && typeof result.changed === "boolean") {
    return result as Extract<DecisionTransactionResult, { status: "ok" }>;
  }
  if (
    result.status === "error" &&
    (result.outcome === "no-change" ||
      result.outcome === "rolled-back" ||
      result.outcome === "partial-or-unknown") &&
    Array.isArray(result.diagnostics) &&
    Array.isArray(result.errors)
  ) {
    return result as Extract<DecisionTransactionResult, { status: "error" }>;
  }
  return null;
}
