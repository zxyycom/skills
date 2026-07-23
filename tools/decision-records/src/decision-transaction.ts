import fs from "node:fs/promises";
import path from "node:path";
import type { HeadDecisionPathsResult } from "./head-decision-paths.ts";
import { expectedIndex, validateDecisionScan } from "./index.ts";
import {
  decisionIndexRequiredError,
  missingIndexedDecisionError,
  scanDecisionRecords,
  unindexedDecisionError
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
  headDecisionPaths: HeadDecisionPathsResult;
  originalScan: DecisionScan;
  registerPaths?: ReadonlySet<string>;
  scanOptions: DecisionScanOptions;
}): Promise<string[]> {
  const {
    changes,
    headDecisionPaths,
    originalScan,
    registerPaths = new Set<string>(),
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
        await removeEmptyArea(path.dirname(change.decisionPath));
      } else {
        await fs.writeFile(change.decisionPath, change.nextText, "utf8");
      }
    }

    const candidateScan = await scanDecisionRecords(scanOptions);
    const hasDecisionMarkdown = candidateScan.records.some(
      (record) => record.markdownExists
    );
    const sourceValidation = validateDecisionScan(
      candidateScan,
      headDecisionPaths,
      {
        allowEmptyDecisionSet: !hasDecisionMarkdown,
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

    if (!hasDecisionMarkdown) {
      await fs.rm(candidateScan.indexPath, { force: true });
      await fs.rmdir(candidateScan.decisionsDirectory);
      return [];
    }

    const permittedIndexErrors = new Set(candidateScan.activationCandidateErrors);
    for (const relativePath of registerPaths) {
      permittedIndexErrors.add(
        unindexedDecisionError(candidateScan.indexRelativePath, relativePath)
      );
    }
    for (const change of changes.filter((candidate) => candidate.nextText === null)) {
      const originalRecord = originalScan.records.find(
        (record) => record.decisionPath === change.decisionPath && record.indexed
      );
      if (originalRecord) {
        permittedIndexErrors.add(
          missingIndexedDecisionError(
            candidateScan.indexRelativePath,
            originalRecord.relativePath
          )
        );
      }
    }
    if (!originalScan.indexExists && registerPaths.size > 0) {
      permittedIndexErrors.add(
        decisionIndexRequiredError(candidateScan.indexRelativePath)
      );
    }
    const unexpectedIndexErrors = candidateScan.indexErrors.filter(
      (error) => !permittedIndexErrors.has(error)
    );
    if (unexpectedIndexErrors.length > 0) {
      return [
        ...unexpectedIndexErrors,
        ...await restoreDecisionChanges(originalScan, originalBodies)
      ];
    }

    const generated = expectedIndex(candidateScan, {
      includeUnindexedPaths: registerPaths
    });
    if (generated.errors.length > 0 || generated.text === null) {
      return [
        ...generated.errors,
        ...await restoreDecisionChanges(originalScan, originalBodies)
      ];
    }
    await fs.writeFile(candidateScan.indexPath, generated.text, "utf8");

    const validationScan = await scanDecisionRecords(scanOptions);
    const validation = validateDecisionScan(validationScan, headDecisionPaths, {
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

async function removeEmptyArea(areaDirectory: string): Promise<void> {
  if ((await fs.readdir(areaDirectory)).length === 0) {
    await fs.rmdir(areaDirectory);
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
