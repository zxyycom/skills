import fs from "node:fs/promises";
import path from "node:path";
import { displayDecisionPath } from "./decision-path.ts";
import { ensureRegularDecisionFile } from "./decision-transaction-preflight.ts";
import { transactionFileSystemDiagnostic } from "./decision-transaction.ts";
import type {
  DecisionChangePreflight,
  DecisionFileChange,
  DecisionTransactionIssue
} from "./decision-transaction.ts";
import type { DecisionScan } from "./types.ts";

export async function applyDecisionChange(
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

export async function restoreDecisionChanges(
  originalScan: DecisionScan,
  preflight: DecisionChangePreflight
): Promise<DecisionTransactionIssue[]> {
  const errors: DecisionTransactionIssue[] = [];
  await restoreCreatedMoveTargets(originalScan, preflight, errors);
  await restoreOriginalDecisionBodies(originalScan, preflight, errors);
  await restoreOriginalDecisionIndex(originalScan, errors);
  return errors;
}

async function restoreCreatedMoveTargets(
  originalScan: DecisionScan,
  preflight: DecisionChangePreflight,
  errors: DecisionTransactionIssue[]
): Promise<void> {
  for (const targetPath of preflight.createdTargetPaths) {
    try {
      await fs.rm(targetPath, { force: true });
    } catch (error) {
      errors.push(
        restoreFilesystemIssue(
          originalScan,
          "Failed to restore decision move target.",
          targetPath,
          error
        )
      );
    }
  }
}

async function restoreOriginalDecisionBodies(
  originalScan: DecisionScan,
  preflight: DecisionChangePreflight,
  errors: DecisionTransactionIssue[]
): Promise<void> {
  for (const [decisionPath, body] of preflight.originalBodies) {
    try {
      await fs.mkdir(path.dirname(decisionPath), { recursive: true });
      await fs.writeFile(decisionPath, body, "utf8");
    } catch (error) {
      errors.push(
        restoreFilesystemIssue(
          originalScan,
          "Failed to restore decision body.",
          decisionPath,
          error
        )
      );
    }
  }
}

async function restoreOriginalDecisionIndex(
  originalScan: DecisionScan,
  errors: DecisionTransactionIssue[]
): Promise<void> {
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
}

function restoreFilesystemIssue(
  originalScan: DecisionScan,
  reason: string,
  filePath: string,
  error: unknown
): DecisionTransactionIssue {
  return transactionFileSystemDiagnostic(
    reason,
    displayDecisionPath(originalScan.workspaceRoot, filePath),
    error
  );
}
