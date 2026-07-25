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
import type {
  DecisionScan,
  DecisionScanOptions
} from "./types.ts";

export type DecisionFileChange = {
  decisionPath: string;
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
  const originalBodies = new Map<string, string>();
  try {
    for (const change of changes) {
      originalBodies.set(
        change.decisionPath,
        await fs.readFile(change.decisionPath, "utf8")
      );
    }
  } catch (error) {
    return ["Failed to read decision before update: " + errorText(error)];
  }

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
      allowEmptyDecisionSet: !hasEstablishedDecision,
      scanErrorPolicy: "allow-activation-candidates"
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
