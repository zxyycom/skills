import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { isFileSystemError } from "../../shared/src/node/filesystem.ts";
import { displayDecisionPath } from "./decision-path.ts";
import { decisionIndexFileName } from "./decision-state-index.ts";
import {
  collectSourceFiles,
  validateSourceMembership
} from "./scan-collection.ts";
import type { DecisionScanLocation, SourceFile } from "./scan-contracts.ts";
import {
  loadDecisionIndexForScan,
  type LoadedDecisionIndex
} from "./scan-index.ts";
import { scanSourceFiles } from "./scan-records.ts";
import {
  appendMissingIndexedRecords,
  validateScannedRelationships
} from "./scan-relations.ts";
import { addCollectionError, errorText } from "./scan-support.ts";
import {
  compareDecisionRecords,
  isEstablishedDecisionRecord,
  type DecisionRecord,
  type DecisionScan,
  type DecisionScanOptions
} from "./types.ts";

export {
  missingIndexedDecisionError,
  unindexedDecisionError
} from "./scan-relations.ts";

export function decisionIndexRequiredError(indexRelativePath: string): string {
  return indexRelativePath + " is required";
}

export async function scanDecisionRecords(
  options: DecisionScanOptions = {}
): Promise<DecisionScan> {
  const location = resolveDecisionScanLocation(options);
  const directoryError = await inspectDecisionsDirectory(location);
  if (directoryError !== null)
    return unavailableDecisionScan(location, directoryError);
  const collectionErrors: string[] = [];
  const indexErrors: string[] = [];
  const sourceErrors: string[] = [];
  const loadedIndex = await loadDecisionIndexForScan(location, indexErrors);
  const sourceFiles = await collectScannedSourceFiles(
    location,
    collectionErrors,
    sourceErrors
  );
  const records = await scanCollectedSourceFiles({
    collectionErrors,
    indexErrors,
    loadedIndex,
    location,
    sourceErrors,
    sourceFiles
  });
  records.sort(compareDecisionRecords);
  validateScannedRelationships(records, sourceErrors);
  return successfulDecisionScan({
    collectionErrors,
    indexErrors,
    loadedIndex,
    location,
    records,
    sourceErrors
  });
}

async function collectScannedSourceFiles(
  location: DecisionScanLocation,
  collectionErrors: string[],
  sourceErrors: string[]
): Promise<SourceFile[]> {
  let sourceFiles: SourceFile[] = [];
  try {
    sourceFiles = await collectSourceFiles({
      collectionErrors,
      decisionsDirectory: location.decisionsDirectory,
      decisionsLabel: location.decisionsLabel,
      sourceErrors
    });
  } catch (error) {
    addCollectionError(
      collectionErrors,
      sourceErrors,
      location.decisionsLabel + " could not be read: " + errorText(error)
    );
  }
  return sourceFiles;
}

async function scanCollectedSourceFiles(options: {
  collectionErrors: string[];
  indexErrors: string[];
  loadedIndex: LoadedDecisionIndex;
  location: DecisionScanLocation;
  sourceErrors: string[];
  sourceFiles: readonly SourceFile[];
}): Promise<DecisionRecord[]> {
  const availableDecisionIds = await validateSourceMembership(
    options.sourceFiles,
    options.collectionErrors,
    options.sourceErrors
  );
  const records = await scanSourceFiles({
    availableDecisionIds,
    index: options.loadedIndex.index,
    indexErrors: options.indexErrors,
    indexRelativePath: options.location.indexRelativePath,
    sourceErrors: options.sourceErrors,
    sourceFiles: options.sourceFiles
  });
  appendMissingIndexedRecords(
    records,
    options.loadedIndex.index,
    options.location,
    options.indexErrors
  );
  if (
    !options.loadedIndex.indexExists &&
    records.some(isEstablishedDecisionRecord)
  ) {
    options.indexErrors.push(
      decisionIndexRequiredError(options.location.indexRelativePath)
    );
  }
  return records;
}

function successfulDecisionScan(options: {
  collectionErrors: string[];
  indexErrors: string[];
  loadedIndex: LoadedDecisionIndex;
  location: DecisionScanLocation;
  records: DecisionRecord[];
  sourceErrors: string[];
}): DecisionScan {
  const {
    collectionErrors,
    indexErrors,
    loadedIndex,
    location,
    records,
    sourceErrors
  } = options;
  return {
    collectionErrors,
    decisionsDirectoryAvailable: true,
    decisionsDirectory: location.decisionsDirectory,
    errors: [...sourceErrors, ...indexErrors],
    index: loadedIndex.index,
    indexErrors,
    indexExists: loadedIndex.indexExists,
    indexPath: location.indexPath,
    indexRelativePath: location.indexRelativePath,
    indexText: loadedIndex.indexText,
    records,
    sourceErrors,
    workspaceRoot: location.workspaceRoot
  };
}

function resolveDecisionScanLocation(
  options: DecisionScanOptions
): DecisionScanLocation {
  const workspaceRoot = path.resolve(options.workspaceRoot ?? process.cwd());
  const configuredDecisionDirectory = options.decisionsDir ?? "docs/decisions";
  const decisionsDirectory = path.isAbsolute(configuredDecisionDirectory)
    ? path.resolve(configuredDecisionDirectory)
    : path.resolve(workspaceRoot, configuredDecisionDirectory);
  const indexPath = path.join(decisionsDirectory, decisionIndexFileName);
  return {
    decisionsDirectory,
    decisionsLabel: displayDecisionPath(workspaceRoot, decisionsDirectory),
    indexPath,
    indexRelativePath: displayDecisionPath(workspaceRoot, indexPath),
    workspaceRoot
  };
}

async function inspectDecisionsDirectory(
  location: DecisionScanLocation
): Promise<string | null> {
  try {
    if (!(await fs.stat(location.decisionsDirectory)).isDirectory()) {
      return location.decisionsLabel + " must be a directory";
    }
    return null;
  } catch (error) {
    return isFileSystemError(error, "ENOENT")
      ? location.decisionsLabel + " is required"
      : location.decisionsLabel +
          " could not be inspected: " +
          errorText(error);
  }
}

function unavailableDecisionScan(
  location: DecisionScanLocation,
  error: string
): DecisionScan {
  return {
    collectionErrors: [error],
    decisionsDirectoryAvailable: false,
    decisionsDirectory: location.decisionsDirectory,
    errors: [error],
    index: null,
    indexErrors: [],
    indexExists: false,
    indexPath: location.indexPath,
    indexRelativePath: location.indexRelativePath,
    indexText: "",
    records: [],
    sourceErrors: [error],
    workspaceRoot: location.workspaceRoot
  };
}
