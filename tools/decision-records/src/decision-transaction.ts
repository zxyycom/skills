import fs from "node:fs/promises";
import path from "node:path";
import { isFileSystemError } from "../../shared/src/node/filesystem.ts";
import { selectEstablishedDecisionIds, validateDecisionScan } from "./index.ts";
import {
  decisionIndexDiagnosticMessages,
  decisionIndexFileName,
  syncDecisionIndex
} from "./decision-state-index.ts";
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
  errors: string[];
  originalBodies: Map<string, string>;
};

export async function applyDecisionChanges(options: {
  changes: readonly DecisionFileChange[];
  originalScan: DecisionScan;
  scanOptions: DecisionScanOptions;
}): Promise<string[]> {
  const { changes, originalScan, scanOptions } = options;
  const preflight = await preflightDecisionChanges(changes, originalScan);
  if (preflight.errors.length > 0) {
    return preflight.errors;
  }

  try {
    for (const change of changes) {
      await applyDecisionChange(change, preflight.createdTargetPaths);
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
      return [
        ...sourceValidation.errors,
        ...(await restoreDecisionChanges(originalScan, preflight))
      ];
    }

    if (!hasEstablishedDecision) {
      await fs.rm(candidateScan.indexPath, { force: true });
    } else {
      const selection = selectEstablishedDecisionIds(candidateScan);
      if (selection.errors.length > 0) {
        return [
          ...selection.errors,
          ...(await restoreDecisionChanges(originalScan, preflight))
        ];
      }
      const synchronized = await syncDecisionIndex({
        decisionsDirectory: candidateScan.decisionsDirectory,
        indexPath: decisionIndexFileName,
        mode: "write",
        decisionIds: selection.decisionIds
      });
      if (synchronized.status === "error") {
        return [
          ...decisionIndexDiagnosticMessages(
            synchronized.diagnostics,
            candidateScan.indexRelativePath
          ),
          ...(await restoreDecisionChanges(originalScan, preflight))
        ];
      }
    }

    const validationScan = await scanDecisionRecords(scanOptions);
    const validation = await validateDecisionScan(validationScan, {
      allowEmptyDecisionSet: !hasEstablishedDecision
    });
    if (validation.errors.length > 0) {
      return [
        ...validation.errors,
        ...(await restoreDecisionChanges(originalScan, preflight))
      ];
    }
    return [];
  } catch (error) {
    return [
      "Failed to update decision files and index: " + errorText(error),
      ...(await restoreDecisionChanges(originalScan, preflight))
    ];
  }
}

async function preflightDecisionChanges(
  changes: readonly DecisionFileChange[],
  originalScan: DecisionScan
): Promise<DecisionChangePreflight> {
  const errors: string[] = [];
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
        "Failed to verify decision source before update: " +
          displayPath +
          ": " +
          errorText(error) +
          ". No files were written; review the current files and re-run the command."
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
            "Failed to verify decision move target before update: " +
              displayDecisionPath(
                originalScan.workspaceRoot,
                change.targetPath
              ) +
              ": " +
              errorText(error)
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
        "Failed to verify decision index before update: " +
          originalScan.indexRelativePath +
          ": " +
          errorText(error) +
          ". No files were written; review the current files and re-run the command."
      );
    }
  }
  return { createdTargetPaths, errors, originalBodies };
}

async function applyDecisionChange(
  change: DecisionFileChange,
  createdTargetPaths: Set<string>
): Promise<void> {
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
    return;
  }
  if (change.nextText === null) {
    await fs.rm(change.decisionPath);
    return;
  }
  await ensureRegularDecisionFile(change.decisionPath);
  await fs.writeFile(change.decisionPath, change.nextText, "utf8");
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
): Promise<string[]> {
  const errors: string[] = [];
  for (const targetPath of preflight.createdTargetPaths) {
    try {
      await fs.rm(targetPath, { force: true });
    } catch (error) {
      errors.push(
        "Failed to restore decision move target " +
          targetPath +
          ": " +
          errorText(error)
      );
    }
  }
  for (const [decisionPath, body] of preflight.originalBodies) {
    try {
      await fs.mkdir(path.dirname(decisionPath), { recursive: true });
      await fs.writeFile(decisionPath, body, "utf8");
    } catch (error) {
      errors.push(
        "Failed to restore decision body " +
          decisionPath +
          ": " +
          errorText(error)
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
      "Failed to restore decision index " +
        originalScan.indexRelativePath +
        ": " +
        errorText(error)
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

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
