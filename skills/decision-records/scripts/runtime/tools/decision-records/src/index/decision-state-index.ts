/*
 * Synced TypeScript runtime; repository maintenance edits tools/decision-records/src/index/decision-state-index.ts.
 * Installed skill copies may be edited directly; updates overwrite matching files.
 * Repository: https://github.com/zxyycom/skills
 * Source path: tools/decision-records/src/index/decision-state-index.ts
 * Maintained source: https://github.com/zxyycom/skills/blob/main/tools/decision-records/src/index/decision-state-index.ts
 * Skill source directory: https://github.com/zxyycom/skills/tree/main/skills/decision-records
 * Rebuild: bun run sync:decision-records-cli
 */
import {
  decisionIndexSnapshotFromValidatedIndex,
  loadCurrentDecisionIndexSnapshot,
  loadDecisionIndexSnapshot,
  parseDecisionIndexSnapshot,
  snapshotIndex
} from "./decision-index-snapshot.ts";
import {
  buildStateIndex,
  serializeStateIndex,
  syncStateIndex,
  type StateIndexResult,
  type StateSnapshot,
  type StateIndexSyncMode,
  type StateIndexSyncScope,
  type StateIndexSyncResult
} from "../../../index-runtime/src/index.ts";
import {
  createDecisionStateIndexDefinition,
  decisionIndexDefinitionVersion,
  decisionIndexFileName,
  decisionIndexNamespace
} from "./decision-index-definition.ts";
import {
  readDecisionSourceRevision,
  readDecisionStateSnapshot
} from "./decision-index-source.ts";
import { decisionSourceRevision } from "../sources/decision-source-revision.ts";
import {
  buildDecisionStateSnapshotFromSources,
  decisionIndexState
} from "./decision-state-snapshot.ts";
import type {
  DecisionIndex,
  DecisionIndexMetadata,
  DecisionIndexState
} from "../types.ts";

export {
  createDecisionStateIndexDefinition,
  decisionIndexDefinitionVersion,
  decisionIndexFileName,
  decisionIndexNamespace,
  buildDecisionStateSnapshotFromSources,
  decisionIndexState,
  decisionSourceRevision,
  readDecisionSourceRevision,
  readDecisionStateSnapshot
};

type DecisionIndexLoadOptions = {
  decisionsDirectory: string;
  indexPath?: string;
  signal?: AbortSignal;
};

export function parseDecisionIndex(
  text: string,
  sourcePath: string
): StateIndexResult<DecisionIndex> {
  return snapshotIndex(parseDecisionIndexSnapshot(text, sourcePath));
}

export async function loadDecisionIndex(
  options: DecisionIndexLoadOptions
): Promise<StateIndexResult<DecisionIndex>> {
  return snapshotIndex(await loadDecisionIndexSnapshot(options));
}

export async function loadCurrentDecisionIndex(options: {
  decisionsDirectory: string;
  indexPath?: string;
  decisionIds: readonly string[];
  signal?: AbortSignal;
}): Promise<StateIndexResult<DecisionIndex>> {
  return snapshotIndex(await loadCurrentDecisionIndexSnapshot(options));
}

export async function syncDecisionIndex(options: {
  decisionsDirectory: string;
  indexPath?: string;
  mode: StateIndexSyncMode;
  scope?: StateIndexSyncScope;
  signal?: AbortSignal;
}): Promise<StateIndexSyncResult> {
  const definition = createDecisionStateIndexDefinition();
  return await syncStateIndex({
    context: {
      root: options.decisionsDirectory,
      ...(options.signal === undefined ? {} : { signal: options.signal })
    },
    definition,
    indexPath: options.indexPath ?? decisionIndexFileName,
    mode: options.mode,
    ...(options.scope === undefined ? {} : { scope: options.scope })
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
    : snapshotIndex(
        decisionIndexSnapshotFromValidatedIndex(
          built.value,
          decisionIndexFileName
        )
      );
}

export function serializeDecisionIndex(index: DecisionIndex): string {
  return serializeStateIndex(index, createDecisionStateIndexDefinition());
}

export {
  decisionIndexDiagnosticMessages,
  decisionIndexDiagnostics,
  decisionIndexRecovery
} from "./decision-index-diagnostics.ts";
