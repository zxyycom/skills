import path from "node:path";
import {
  createStateIndexReader,
  sameStateSourceRevision,
  type StateIndexReader
} from "../../index-runtime/src/index.ts";
import {
  decisionFailure,
  type DecisionApplicationFailure
} from "./application-result.ts";
import {
  createDecisionStateIndexDefinition,
  decisionIndexFileName,
  decisionIndexDiagnostics,
  decisionIndexRecovery,
  decisionSourceRevision,
  loadDecisionIndex,
  readDecisionSourceRevision
} from "./decision-state-index.ts";
import { displayDecisionPath } from "./decision-path.ts";
import type {
  DecisionIndex,
  DecisionIndexMetadata,
  DecisionIndexState,
  DecisionScanOptions
} from "./types.ts";

export type DecisionLocation = {
  decisionsDir: string;
  workspaceRoot: string;
};

export type DecisionQueryContext = {
  decisionsDirectory: string;
  index: DecisionIndex;
  indexRelativePath: string;
  reader: StateIndexReader<DecisionIndexState, DecisionIndexMetadata>;
  status: "ok";
  warnings: string[];
};

type ResolvedDecisionLocation = {
  decisionsDirectory: string;
  workspaceRoot: string;
};

export async function loadDecisionQueryContext(
  location: DecisionLocation,
  options: { collectionStaleness?: boolean } = {}
): Promise<DecisionApplicationFailure | DecisionQueryContext> {
  const { decisionsDirectory, workspaceRoot } =
    resolveDecisionLocation(location);
  const indexPath = path.join(decisionsDirectory, decisionIndexFileName);
  const indexRelativePath = displayDecisionPath(workspaceRoot, indexPath);
  const currentIndex = await loadDecisionIndex({
    decisionsDirectory
  });
  if (currentIndex.status === "error") {
    return decisionFailure(
      decisionIndexDiagnostics(currentIndex.diagnostics, {
        code: "decision-records.index-query-failed",
        recovery: decisionIndexRecovery(
          currentIndex.diagnostics,
          "Run sync-index after correcting the decision Markdown or index problem."
        ),
        target: indexRelativePath
      })
    );
  }
  const stale =
    options.collectionStaleness === false
      ? false
      : await decisionIndexStale(decisionsDirectory, currentIndex.value);
  return {
    decisionsDirectory,
    index: currentIndex.value,
    indexRelativePath,
    reader: createStateIndexReader({
      definition: createDecisionStateIndexDefinition(),
      index: currentIndex.value,
      indexPath: indexRelativePath
    }),
    status: "ok",
    warnings: stale ? [persistedSnapshotWarning] : []
  };
}

/**
 * Compares the persisted index source revision with the current established
 * Markdown revision. A mismatch — or any failure to read the current
 * revision — is treated as a known source change: read-only queries keep
 * serving the persisted snapshot and report its boundary, while strict check
 * and mutations own the actual source diagnosis.
 */
export async function decisionIndexStale(
  decisionsDirectory: string,
  index: DecisionIndex
): Promise<boolean> {
  let currentRevision: ReturnType<typeof decisionSourceRevision>;
  try {
    currentRevision = await readDecisionSourceRevision(
      decisionsDirectory,
      undefined
    );
  } catch {
    return true;
  }
  return !sameStateSourceRevision(index.sourceRevision, currentRevision);
}

export const persistedSnapshotWarning =
  "The persisted Decision index is stale; this result reflects the last published index snapshot, not the current decision Markdown. Run sync-index to publish the current projection before drawing conclusions about the complete collection.";

export const persistedSnapshotBodyWarning =
  "The persisted Decision index is stale; the metadata reflects the last published index snapshot while the body is read from the current decision Markdown. Run sync-index to publish the current projection.";

/**
 * The decisions directory is a workspace-relative path by location contract;
 * callers received it from the CLI boundary or the scan location API.
 */
export function resolveDecisionLocation(
  location: DecisionLocation
): ResolvedDecisionLocation {
  const workspaceRoot = path.resolve(location.workspaceRoot);
  return {
    decisionsDirectory: path.resolve(workspaceRoot, location.decisionsDir),
    workspaceRoot
  };
}

export function decisionScanOptions(
  location: DecisionLocation
): DecisionScanOptions {
  return {
    decisionsDir: location.decisionsDir,
    workspaceRoot: location.workspaceRoot
  };
}
