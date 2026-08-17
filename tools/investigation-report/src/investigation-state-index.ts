import {
  loadCurrentStateIndex,
  syncStateIndex,
  type StateIndex,
  type StateIndexContext,
  type StateIndexDiagnostic,
  type StateIndexResult,
  type StateIndexSyncMode,
  type StateIndexSyncResult,
  type StateSnapshot
} from "../../index-runtime/src/index.ts";
import {
  createInvestigationStateIndexDefinition,
  investigationIndexDefinitionVersion,
  investigationIndexNamespace
} from "./investigation-index-definition.ts";
import {
  discoverInvestigationTopicPaths,
  readInvestigationSourceRevision,
  readInvestigationStateSnapshot
} from "./investigation-index-source.ts";
import { investigationSourceRevision } from "./investigation-source-revision.ts";
import { investigationIndexFileName } from "./report-path.ts";
import type {
  InvestigationIndexMetadata,
  InvestigationIndexState,
  InvestigationSource
} from "./types.ts";

export {
  createInvestigationStateIndexDefinition,
  discoverInvestigationTopicPaths,
  investigationIndexDefinitionVersion,
  investigationIndexFileName,
  investigationIndexNamespace,
  investigationSourceRevision,
  readInvestigationSourceRevision,
  readInvestigationStateSnapshot
};

export type { InvestigationIndexMetadata, InvestigationSource };

export async function loadCurrentInvestigationIndex(options: {
  investigationsDirectory: string;
  indexPath?: string;
  signal?: AbortSignal;
}): Promise<
  StateIndexResult<
    StateIndex<InvestigationIndexState, InvestigationIndexMetadata>
  >
> {
  const context = stateIndexContext(
    options.investigationsDirectory,
    options.signal
  );
  const definition = createInvestigationStateIndexDefinition();
  const indexPath = options.indexPath ?? investigationIndexFileName;
  return await loadCurrentStateIndex({
    context,
    definition,
    indexPath
  });
}

export async function syncInvestigationStateIndex(options: {
  investigationsDirectory: string;
  indexPath?: string;
  mode: StateIndexSyncMode;
  signal?: AbortSignal;
  snapshot?: StateSnapshot<InvestigationIndexState, InvestigationIndexMetadata>;
}): Promise<StateIndexSyncResult> {
  const context = stateIndexContext(
    options.investigationsDirectory,
    options.signal
  );
  const definition =
    options.snapshot === undefined
      ? createInvestigationStateIndexDefinition()
      : createInvestigationStateIndexDefinition({ snapshot: options.snapshot });
  const indexPath = options.indexPath ?? investigationIndexFileName;
  return await syncStateIndex({
    context,
    definition,
    indexPath,
    mode: options.mode
  });
}

export function investigationIndexDiagnosticMessages(
  diagnostics: readonly StateIndexDiagnostic[],
  displayPath: string = investigationIndexFileName
): string[] {
  return diagnostics.map((diagnostic) => {
    const source =
      diagnostic.path === null
        ? displayPath
        : diagnostic.path === investigationIndexFileName
          ? displayPath
          : diagnostic.path;
    return [
      source,
      diagnostic.stateId === null ? "" : `[${diagnostic.stateId}]`,
      diagnostic.message
    ]
      .filter((part) => part.length > 0)
      .join(" ");
  });
}

function stateIndexContext(
  root: string,
  signal: AbortSignal | undefined
): StateIndexContext {
  return {
    root,
    ...(signal === undefined ? {} : { signal })
  };
}
