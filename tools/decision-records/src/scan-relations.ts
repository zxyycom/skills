import path from "node:path";
import { isDecisionId } from "./decision-path.ts";
import {
  createScannedRelationshipSnapshot,
  validateScannedRelationshipSnapshot
} from "./scan-relationship-snapshot.ts";
import type {
  DecisionScanLocation,
  DecisionStoredIndexEntry
} from "./scan-contracts.ts";
import type {
  DecisionId,
  DecisionIndex,
  DecisionProjection,
  DecisionRecord
} from "./types.ts";
export function unindexedDecisionError(
  indexRelativePath: string,
  decisionId: string
): string {
  return indexRelativePath + " does not include Decision ID " + decisionId;
}

export function missingIndexedDecisionError(
  indexRelativePath: string,
  decisionId: string
): string {
  return indexRelativePath + " references missing Decision ID " + decisionId;
}

export function appendMissingIndexedRecords(
  records: DecisionRecord[],
  index: DecisionIndex | null,
  location: DecisionScanLocation,
  indexErrors: string[]
): void {
  if (index === null) {
    return;
  }
  const recordIds = new Set(records.map((record) => record.decisionId));
  for (const [rawDecisionId, storedEntry] of Object.entries(index.entries)) {
    if (recordIds.has(rawDecisionId)) {
      continue;
    }
    if (!isDecisionId(rawDecisionId)) {
      indexErrors.push(
        location.indexRelativePath +
          " contains invalid Decision ID " +
          rawDecisionId
      );
      continue;
    }
    indexErrors.push(
      missingIndexedDecisionError(location.indexRelativePath, rawDecisionId)
    );
    records.push(
      recordFromIndexEntry({
        decisionsDirectory: location.decisionsDirectory,
        decisionId: rawDecisionId,
        entry: storedEntry
      })
    );
  }
}

function recordFromIndexEntry(options: {
  decisionsDirectory: string;
  decisionId: DecisionId;
  entry: DecisionStoredIndexEntry;
}): DecisionRecord {
  const { decisionsDirectory, decisionId, entry } = options;
  const state = entry;
  return {
    activationCandidate: false,
    bodyReady: false,
    scaffoldValid: false,
    alignment: state.alignment ?? null,
    createdAt: state.createdAt,
    decisionId,
    decisionPath: path.join(decisionsDirectory, ...state.sourcePath.split("/")),
    document: null,
    markdownExists: false,
    projection: selectProjection(state),
    relationshipErrors: [],
    source: { kind: "missing" },
    sourcePath: state.sourcePath,
    status: state.status,
    tags: [...state.tags]
  };
}

export function validateScannedRelationships(
  records: readonly DecisionRecord[],
  sourceErrors: string[]
): void {
  validateScannedRelationshipSnapshot(
    createScannedRelationshipSnapshot(records),
    sourceErrors
  );
}

export function selectProjection(
  source: DecisionProjection
): DecisionProjection {
  return {
    background: source.background,
    decision: source.decision,
    purpose: source.purpose,
    relations: source.relations,
    title: source.title
  };
}

export function emptyDecisionProjection(): DecisionProjection {
  return {
    background: "",
    decision: "",
    purpose: "",
    relations: [],
    title: ""
  };
}
