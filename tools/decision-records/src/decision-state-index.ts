import {
  buildStateIndex,
  loadCurrentStateIndex,
  loadStateIndex,
  parseStateIndex,
  queryStateIndex,
  serializeStateIndex,
  syncStateIndex,
  type StateIndex,
  type StateIndexContext,
  type StateIndexDiagnostic,
  type StateIndexResult,
  type StateSnapshot,
  type StateIndexSyncMode,
  type StateIndexSyncResult
} from "../../index-runtime/src/index.ts";
import {
  createDecisionStateIndexDefinition,
  decisionIndexDefinitionVersion,
  decisionIndexNamespace
} from "./decision-index-definition.ts";
import {
  readDecisionSourceRevision,
  readDecisionStateSnapshot
} from "./decision-index-source.ts";
import { decisionSourceRevision } from "./decision-source-revision.ts";
import {
  buildDecisionStateSnapshotFromSources,
  decisionIndexState
} from "./decision-state-snapshot.ts";
import type {
  DecisionIndex,
  DecisionIndexMetadata,
  DecisionIndexState,
  DecisionSource
} from "./types.ts";

export {
  createDecisionStateIndexDefinition,
  decisionIndexDefinitionVersion,
  decisionIndexNamespace,
  buildDecisionStateSnapshotFromSources,
  decisionIndexState,
  decisionSourceRevision,
  readDecisionSourceRevision,
  readDecisionStateSnapshot
};

export type { DecisionSource };

export const decisionIndexFileName = "decision-index.json";

export function parseDecisionIndex(
  text: string,
  sourcePath: string
): StateIndexResult<DecisionIndex> {
  const parsed = parseStateIndex({
    definition: createDecisionStateIndexDefinition(),
    expectation: {
      definitionVersion: decisionIndexDefinitionVersion,
      namespace: decisionIndexNamespace
    },
    sourcePath,
    text
  });
  if (parsed.status === "error") {
    return parsed;
  }
  return validateDecisionIndex(parsed.value, sourcePath);
}

export async function loadDecisionIndex(options: {
  decisionsDirectory: string;
  indexPath?: string;
  signal?: AbortSignal;
}): Promise<StateIndexResult<DecisionIndex>> {
  const indexPath = options.indexPath ?? decisionIndexFileName;
  const loaded = await loadStateIndex({
    context: {
      root: options.decisionsDirectory,
      ...(options.signal === undefined ? {} : { signal: options.signal })
    },
    definition: createDecisionStateIndexDefinition(),
    expectation: {
      definitionVersion: decisionIndexDefinitionVersion,
      namespace: decisionIndexNamespace
    },
    indexPath
  });
  return loaded.status === "error"
    ? loaded
    : validateDecisionIndex(loaded.value, indexPath);
}

export async function loadCurrentDecisionIndex(options: {
  decisionsDirectory: string;
  indexPath?: string;
  decisionIds: readonly string[];
  signal?: AbortSignal;
}): Promise<StateIndexResult<DecisionIndex>> {
  const indexPath = options.indexPath ?? decisionIndexFileName;
  const context: StateIndexContext = {
    root: options.decisionsDirectory,
    ...(options.signal === undefined ? {} : { signal: options.signal })
  };
  const definition = createDecisionStateIndexDefinition({
    decisionIds: options.decisionIds
  });
  const current = await loadCurrentStateIndex({
    context,
    definition,
    indexPath
  });
  if (current.status === "error") {
    return current;
  }
  const validated = validateDecisionIndex(current.value, indexPath);
  if (validated.status === "error") {
    return validated;
  }
  return validateDecisionIndexMembership(
    validated.value,
    options.decisionIds,
    indexPath
  );
}

export async function syncDecisionIndex(options: {
  decisionsDirectory: string;
  indexPath?: string;
  mode: StateIndexSyncMode;
  decisionIds: readonly string[];
  signal?: AbortSignal;
}): Promise<StateIndexSyncResult> {
  const definition = createDecisionStateIndexDefinition({
    decisionIds: options.decisionIds
  });
  return await syncStateIndex({
    context: {
      root: options.decisionsDirectory,
      ...(options.signal === undefined ? {} : { signal: options.signal })
    },
    definition,
    indexPath: options.indexPath ?? decisionIndexFileName,
    mode: options.mode
  });
}

export async function buildDecisionIndexFromSnapshot(
  snapshot: StateSnapshot<DecisionIndexState, DecisionIndexMetadata>,
  signal?: AbortSignal
): Promise<StateIndexResult<DecisionIndex>> {
  const definition = createDecisionStateIndexDefinition();
  const built = await buildStateIndex({
    ...definition,
    read: async () => snapshot
  }, {
    root: ".",
    ...(signal === undefined ? {} : { signal })
  });
  return built.status === "error"
    ? built
    : validateDecisionIndex(built.value, decisionIndexFileName);
}

export function serializeDecisionIndex(index: DecisionIndex): string {
  return serializeStateIndex(index, createDecisionStateIndexDefinition());
}

export function decisionIndexDiagnosticMessages(
  diagnostics: readonly StateIndexDiagnostic[],
  displayPath?: string
): string[] {
  return diagnostics.map((diagnostic) => {
    const source = diagnostic.path === null
      ? displayPath
      : displayPath === undefined || diagnostic.path !== decisionIndexFileName
        ? diagnostic.path
        : displayPath;
    return [
      ...(source === undefined ? [] : [source]),
      diagnostic.stateId === null ? "" : `[${diagnostic.stateId}]`,
      diagnostic.message
    ].filter((part) => part.length > 0).join(" ");
  });
}

function validateDecisionIndexMembership(
  index: DecisionIndex,
  decisionIds: readonly string[],
  sourcePath: string
): StateIndexResult<DecisionIndex> {
  const expectedPaths = [...new Set(decisionIds)].sort(compareText);
  const indexedPaths = Object.keys(index.entries).sort(compareText);
  if (
    expectedPaths.length === indexedPaths.length
    && expectedPaths.every((entry, entryIndex) => (
      entry === indexedPaths[entryIndex]
    ))
  ) {
    return { diagnostics: [], status: "ok", value: index };
  }

  const expectedPathSet = new Set(expectedPaths);
  const indexedPathSet = new Set(indexedPaths);
  const missingPaths = expectedPaths.filter((entry) => !indexedPathSet.has(entry));
  const unexpectedPaths = indexedPaths.filter((entry) => !expectedPathSet.has(entry));
  const details = [
    ...(missingPaths.length === 0
      ? []
      : ["missing: " + missingPaths.join(", ")]),
    ...(unexpectedPaths.length === 0
      ? []
      : ["unexpected: " + unexpectedPaths.join(", ")])
  ];
  return failure(
    "decision-index.membership-mismatch",
    "index entries do not match the complete established Markdown set"
      + (details.length === 0 ? "" : "; " + details.join("; ")),
    sourcePath
  );
}

function validateDecisionIndex(
  index: StateIndex<DecisionIndexState, DecisionIndexMetadata>,
  sourcePath: string
): StateIndexResult<DecisionIndex> {
  const validated = queryStateIndex({
    definition: createDecisionStateIndexDefinition(),
    index,
    query: { limit: 1 }
  });
  if (validated.status === "error") {
    return {
      diagnostics: validated.diagnostics.map((diagnostic) => ({
        ...diagnostic,
        path: diagnostic.path ?? sourcePath
      })),
      status: "error",
      value: null
    };
  }
  return {
    diagnostics: [],
    status: "ok",
    value: index as DecisionIndex
  };
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function failure<Value>(
  code: string,
  message: string,
  sourcePath: string
): StateIndexResult<Value> {
  return {
    diagnostics: [{
      code,
      message,
      path: sourcePath,
      stateId: null
    }],
    status: "error",
    value: null
  };
}
