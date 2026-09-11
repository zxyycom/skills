import fs from "node:fs/promises";
import { isFileSystemError } from "../../shared/src/node/filesystem.ts";
import { displayDecisionPath } from "./decision-path.ts";
import { transactionFileSystemDiagnostic } from "./decision-transaction.ts";
import type {
  DecisionChangePreflight,
  DecisionFileChange,
  DecisionTransactionIssue
} from "./decision-transaction.ts";
import type { DecisionScan } from "./types.ts";

export async function preflightDecisionChanges(
  changes: readonly DecisionFileChange[],
  originalScan: DecisionScan
): Promise<DecisionChangePreflight> {
  const errors: DecisionTransactionIssue[] = [];
  const createdTargetPaths = new Set<string>();
  const moveTargetPaths = new Set<string>();
  const originalBodies = new Map<string, string>();
  for (const change of changes) {
    await preflightDecisionChange(change, originalScan.workspaceRoot, {
      errors,
      moveTargetPaths,
      originalBodies
    });
  }
  await preflightDecisionIndex(originalScan, errors);
  return { createdTargetPaths, errors, originalBodies };
}

type DecisionChangePreflightContext = Readonly<{
  errors: DecisionTransactionIssue[];
  moveTargetPaths: Set<string>;
  originalBodies: Map<string, string>;
}>;

async function preflightDecisionChange(
  change: DecisionFileChange,
  workspaceRoot: string,
  context: DecisionChangePreflightContext
): Promise<void> {
  const displayPath = displayDecisionPath(workspaceRoot, change.decisionPath);
  if (context.originalBodies.has(change.decisionPath)) {
    context.errors.push(
      "Decision transaction contains the same source more than once: " +
        displayPath +
        ". No files were written."
    );
    return;
  }
  try {
    const currentText = await readRegularDecisionFile(change.decisionPath);
    context.originalBodies.set(change.decisionPath, currentText);
    if (currentText !== change.expectedText) {
      context.errors.push(concurrentChangeError("source", displayPath));
    }
  } catch (error) {
    context.errors.push(
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
    await preflightDecisionMoveTarget(
      change.targetPath,
      workspaceRoot,
      context
    );
  }
}

async function preflightDecisionMoveTarget(
  targetPath: string,
  workspaceRoot: string,
  context: DecisionChangePreflightContext
): Promise<void> {
  const displayPath = displayDecisionPath(workspaceRoot, targetPath);
  if (context.moveTargetPaths.has(targetPath)) {
    context.errors.push(
      "Decision transaction contains the same move target more than once: " +
        displayPath +
        ". No files were written."
    );
    return;
  }
  context.moveTargetPaths.add(targetPath);
  try {
    await fs.lstat(targetPath);
    context.errors.push(
      "Decision move target already exists: " +
        displayPath +
        ". No files were written."
    );
  } catch (error) {
    if (!isFileSystemError(error, "ENOENT")) {
      context.errors.push(
        transactionFileSystemDiagnostic(
          "Failed to verify decision move target before update. No files were written.",
          displayPath,
          error
        )
      );
    }
  }
}

async function preflightDecisionIndex(
  originalScan: DecisionScan,
  errors: DecisionTransactionIssue[]
): Promise<void> {
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

async function readRegularDecisionFile(filePath: string): Promise<string> {
  await ensureRegularDecisionFile(filePath);
  return await fs.readFile(filePath, "utf8");
}

export async function ensureRegularDecisionFile(
  filePath: string
): Promise<void> {
  const entry = await fs.lstat(filePath);
  if (entry.isSymbolicLink() || !entry.isFile()) {
    throw new Error("must be a regular non-symbolic-link file");
  }
}
