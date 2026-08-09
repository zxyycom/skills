import fs from "node:fs/promises";
import path from "node:path";
import {
  selectDecisionIndexSourcePaths,
  validateDecisionScan
} from "./index.ts";
import {
  decisionIndexDiagnosticMessages,
  decisionIndexFileName,
  syncDecisionIndex
} from "./decision-state-index.ts";
import {
  scanDecisionRecords
} from "./scan.ts";
import { displayDecisionPath } from "./decision-path.ts";
import type {
  DecisionScan,
  DecisionScanOptions
} from "./types.ts";

export type DecisionFileChange = {
  decisionPath: string;
  expectedText: string;
  nextText: string | null;
};

export async function applyDecisionChanges(options: {
  changes: readonly DecisionFileChange[];
  originalScan: DecisionScan;
  scanOptions: DecisionScanOptions;
}): Promise<string[]> {
  const {
    changes,
    originalScan,
    scanOptions
  } = options;
  const preflight = await preflightDecisionChanges(changes, originalScan);
  if (preflight.errors.length > 0) {
    return preflight.errors;
  }
  const originalBodies = preflight.originalBodies;

  try {
    for (const change of changes) {
      if (change.nextText === null) {
        await fs.rm(change.decisionPath);
        await removeEmptyDomainDirectory(path.dirname(change.decisionPath));
      } else {
        await fs.writeFile(change.decisionPath, change.nextText, "utf8");
      }
    }

    const candidateScan = await scanDecisionRecords(scanOptions);
    const hasEstablishedDecision = candidateScan.records.some(
      (record) => record.markdownExists && record.document !== null
    );
    const sourceValidation = await validateDecisionScan(
      candidateScan,
      {
        allowEmptyDecisionSet: !hasEstablishedDecision,
        checkIndexText: false,
        scanErrorPolicy: "source-only"
      }
    );
    if (sourceValidation.errors.length > 0) {
      return [
        ...sourceValidation.errors,
        ...await restoreDecisionChanges(originalScan, originalBodies)
      ];
    }

    if (!hasEstablishedDecision) {
      await fs.rm(candidateScan.indexPath, { force: true });
    } else {
      const selection = selectDecisionIndexSourcePaths(candidateScan);
      if (selection.errors.length > 0) {
        return [
          ...selection.errors,
          ...await restoreDecisionChanges(originalScan, originalBodies)
        ];
      }
      const synchronized = await syncDecisionIndex({
        decisionsDirectory: candidateScan.decisionsDirectory,
        indexPath: decisionIndexFileName,
        mode: "write",
        relativePaths: selection.relativePaths
      });
      if (synchronized.status === "error") {
        return [
          ...decisionIndexDiagnosticMessages(
            synchronized.diagnostics,
            candidateScan.indexRelativePath
          ),
          ...await restoreDecisionChanges(originalScan, originalBodies)
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
        ...await restoreDecisionChanges(originalScan, originalBodies)
      ];
    }
    return [];
  } catch (error) {
    return [
      "Failed to update decision files and index: " + errorText(error),
      ...await restoreDecisionChanges(originalScan, originalBodies)
    ];
  }
}

async function preflightDecisionChanges(
  changes: readonly DecisionFileChange[],
  originalScan: DecisionScan
): Promise<{
  errors: string[];
  originalBodies: Map<string, string>;
}> {
  const errors: string[] = [];
  const originalBodies = new Map<string, string>();
  for (const change of changes) {
    const displayPath = displayDecisionPath(
      originalScan.workspaceRoot,
      change.decisionPath
    );
    if (originalBodies.has(change.decisionPath)) {
      errors.push(
        "Decision transaction contains the same source more than once: "
          + displayPath
          + ". No files were written."
      );
      continue;
    }
    try {
      const currentText = await fs.readFile(change.decisionPath, "utf8");
      originalBodies.set(change.decisionPath, currentText);
      if (currentText !== change.expectedText) {
        errors.push(concurrentChangeError("source", displayPath));
      }
    } catch (error) {
      errors.push(
        "Failed to verify decision source before update: "
          + displayPath
          + ": "
          + errorText(error)
          + ". No files were written; review the current files and re-run the command."
      );
    }
  }

  try {
    const currentIndexText = await fs.readFile(originalScan.indexPath, "utf8");
    if (!originalScan.indexExists || currentIndexText !== originalScan.indexText) {
      errors.push(concurrentChangeError(
        "index",
        originalScan.indexRelativePath
      ));
    }
  } catch (error) {
    if (originalScan.indexExists || !isMissingFileError(error)) {
      errors.push(
        "Failed to verify decision index before update: "
          + originalScan.indexRelativePath
          + ": "
          + errorText(error)
          + ". No files were written; review the current files and re-run the command."
      );
    }
  }

  return { errors, originalBodies };
}

function concurrentChangeError(kind: "index" | "source", filePath: string): string {
  return "Decision "
    + kind
    + " changed after validation: "
    + filePath
    + ". No files were written; review the current files and re-run the command.";
}

function isMissingFileError(error: unknown): boolean {
  return error instanceof Error
    && "code" in error
    && error.code === "ENOENT";
}

async function removeEmptyDomainDirectory(domainDirectory: string): Promise<void> {
  if ((await fs.readdir(domainDirectory)).length === 0) {
    await fs.rmdir(domainDirectory);
  }
}

async function restoreDecisionChanges(
  originalScan: DecisionScan,
  originalBodies: ReadonlyMap<string, string>
): Promise<string[]> {
  const errors: string[] = [];
  for (const [decisionPath, body] of originalBodies) {
    try {
      await fs.mkdir(path.dirname(decisionPath), { recursive: true });
      await fs.writeFile(decisionPath, body, "utf8");
    } catch (error) {
      errors.push(
        "Failed to restore decision body "
        + decisionPath
        + ": "
        + errorText(error)
      );
    }
  }

  try {
    if (originalScan.indexExists) {
      await fs.writeFile(originalScan.indexPath, originalScan.indexText, "utf8");
    } else {
      await fs.rm(originalScan.indexPath, { force: true });
    }
  } catch (error) {
    errors.push(
      "Failed to restore decision index "
      + originalScan.indexRelativePath
      + ": "
      + errorText(error)
    );
  }
  return errors;
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
