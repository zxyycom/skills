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
  type StateIndexFilesystemDiagnostic,
  type StateIndexResult,
  type StateSnapshot,
  type StateIndexSyncMode,
  type StateIndexSyncResult
} from "../../index-runtime/src/index.ts";
import {
  decisionDiagnostic,
  type DecisionDiagnostic
} from "./application-result.ts";
import { operationErrorDetail } from "../../shared/src/version-control/error-detail.ts";
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
  DecisionIndexState
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
  const built = await buildStateIndex(
    {
      ...definition,
      read: async () => snapshot
    },
    {
      root: ".",
      ...(signal === undefined ? {} : { signal })
    }
  );
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
    const source =
      diagnostic.path === null
        ? displayPath
        : displayPath === undefined || diagnostic.path !== decisionIndexFileName
          ? diagnostic.path
          : displayPath;
    const message = [
      ...(source === undefined ? [] : [source]),
      diagnostic.stateId === null ? "" : `[${diagnostic.stateId}]`,
      diagnostic.message
    ]
      .filter((part) => part.length > 0)
      .join(" ");
    return diagnostic.filesystem === undefined
      ? message
      : message + filesystemDiagnosticMarker(diagnostic.filesystem);
  });
}

export function decisionIndexDiagnostics(
  diagnostics: readonly StateIndexDiagnostic[],
  options: Readonly<{
    code: string;
    recovery: string;
    target: string;
  }>
): DecisionDiagnostic[] {
  return diagnostics.map((diagnostic) => {
    const target = indexDiagnosticTarget(diagnostic, options.target);
    if (diagnostic.filesystem === undefined) {
      return decisionDiagnostic({
        code: options.code,
        reason: diagnostic.message,
        recovery: options.recovery,
        target
      });
    }
    const filesystem = diagnostic.filesystem;
    return decisionDiagnostic({
      causeCategory: filesystem.causeCategory,
      code: options.code,
      ...(filesystem.detail === null ? {} : { detail: filesystem.detail }),
      reason:
        "The derived Decision index filesystem operation could not complete.",
      recovery: recoveryForIndexFilesystemCause(filesystem, options.recovery),
      target
    });
  });
}

function indexDiagnosticTarget(
  diagnostic: StateIndexDiagnostic,
  fallback: string
): string {
  const filesystemTarget = diagnostic.filesystem?.target;
  return (
    (filesystemTarget === null || filesystemTarget === undefined
      ? null
      : operationErrorDetail(filesystemTarget)) ??
    diagnostic.path ??
    fallback
  );
}

function recoveryForIndexFilesystemCause(
  filesystem: StateIndexFilesystemDiagnostic,
  fallback: string
): string {
  switch (filesystem.causeCategory) {
    case "access-denied":
      return "Grant the current process filesystem access to the decision collection, then retry the command.";
    case "not-found":
      return "Restore the required Decision source or derived index, then retry the command.";
    case "unknown":
      return fallback;
  }
}

function filesystemDiagnosticMarker(
  filesystem: StateIndexFilesystemDiagnostic
): string {
  return (
    " " +
    (operationErrorDetail(filesystem.detail) ?? "filesystem operation failed") +
    " [decision-filesystem:" +
    filesystem.causeCategory +
    "]"
  );
}

function validateDecisionIndexMembership(
  index: DecisionIndex,
  decisionIds: readonly string[],
  sourcePath: string
): StateIndexResult<DecisionIndex> {
  const expectedIds = [...new Set(decisionIds)].sort(compareText);
  const indexedIds = Object.keys(index.entries).sort(compareText);
  if (
    expectedIds.length === indexedIds.length &&
    expectedIds.every((entry, entryIndex) => entry === indexedIds[entryIndex])
  ) {
    return { diagnostics: [], status: "ok", value: index };
  }

  const expectedIdSet = new Set(expectedIds);
  const indexedIdSet = new Set(indexedIds);
  const missingIds = expectedIds.filter((entry) => !indexedIdSet.has(entry));
  const unexpectedIds = indexedIds.filter((entry) => !expectedIdSet.has(entry));
  const details = [
    ...(missingIds.length === 0 ? [] : ["missing: " + missingIds.join(", ")]),
    ...(unexpectedIds.length === 0
      ? []
      : ["unexpected: " + unexpectedIds.join(", ")])
  ];
  return failure(
    "decision-index.membership-mismatch",
    "index entries do not match the complete established Markdown set" +
      (details.length === 0 ? "" : "; " + details.join("; ")),
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
    // The state-index parser and decision definition have validated this exact
    // schema and key projection before it crosses the public decision boundary.
    value: {
      ...index,
      definitionVersion: decisionIndexDefinitionVersion,
      namespace: decisionIndexNamespace
    } as DecisionIndex
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
    diagnostics: [
      {
        code,
        message,
        path: sourcePath,
        stateId: null
      }
    ],
    status: "error",
    value: null
  };
}
