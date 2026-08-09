import {
  loadCurrentStateIndex,
  loadStateIndex,
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
  readInvestigationResourceMetadata,
  readInvestigationSourceRevision,
  readInvestigationStateSnapshot
} from "./investigation-index-source.ts";
import { investigationSourceRevision } from "./investigation-source-revision.ts";
import { investigationResourcesDirectoryName } from "./resource-reference.ts";
import { investigationIndexFileName } from "./report-path.ts";
import type {
  InvestigationIndexMetadata,
  InvestigationIndexState,
  InvestigationResourceSource,
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

export type {
  InvestigationIndexMetadata,
  InvestigationResourceSource,
  InvestigationSource
};

export async function loadCurrentInvestigationIndex(options: {
  investigationsDirectory: string;
  indexPath?: string;
  signal?: AbortSignal;
}): Promise<StateIndexResult<StateIndex<
  InvestigationIndexState,
  InvestigationIndexMetadata
>>> {
  const context = stateIndexContext(
    options.investigationsDirectory,
    options.signal
  );
  const definition = createInvestigationStateIndexDefinition();
  const indexPath = options.indexPath ?? investigationIndexFileName;
  const loaded = await loadCurrentStateIndex({
    context,
    definition,
    indexPath
  });
  if (
    loaded.status === "ok"
    || !loaded.diagnostics.some((entry) => entry.code === "state-index.index-stale")
  ) {
    return loaded;
  }
  return {
    ...loaded,
    diagnostics: [
      ...loaded.diagnostics,
      ...await investigationResourceChangeDiagnostics({
        context,
        definition,
        indexPath
      })
    ]
  };
}

export async function syncInvestigationStateIndex(options: {
  investigationsDirectory: string;
  indexPath?: string;
  mode: StateIndexSyncMode;
  signal?: AbortSignal;
  snapshot?: StateSnapshot<
    InvestigationIndexState,
    InvestigationIndexMetadata
  >;
}): Promise<StateIndexSyncResult> {
  const context = stateIndexContext(
    options.investigationsDirectory,
    options.signal
  );
  const definition = options.snapshot === undefined
    ? createInvestigationStateIndexDefinition()
    : createInvestigationStateIndexDefinition({ snapshot: options.snapshot });
  const indexPath = options.indexPath ?? investigationIndexFileName;
  const synchronized = await syncStateIndex({
    context,
    definition,
    indexPath,
    mode: options.mode
  });
  if (
    synchronized.status === "ok"
    || !synchronized.diagnostics.some((entry) => entry.code === "state-index.index-stale")
  ) {
    return synchronized;
  }
  return {
    ...synchronized,
    diagnostics: [
      ...synchronized.diagnostics,
      ...await investigationResourceChangeDiagnostics({
        context,
        definition,
        indexPath
      })
    ]
  };
}

export function investigationIndexDiagnosticMessages(
  diagnostics: readonly StateIndexDiagnostic[],
  displayPath: string = investigationIndexFileName
): string[] {
  return diagnostics.map((diagnostic) => {
    const source = diagnostic.path === null
      ? displayPath
      : diagnostic.path === investigationIndexFileName
        ? displayPath
        : diagnostic.path;
    return [
      source,
      diagnostic.stateId === null ? "" : `[${diagnostic.stateId}]`,
      diagnostic.message
    ].filter((part) => part.length > 0).join(" ");
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

async function investigationResourceChangeDiagnostics(options: {
  context: StateIndexContext;
  definition: ReturnType<typeof createInvestigationStateIndexDefinition>;
  indexPath: string;
}): Promise<StateIndexDiagnostic[]> {
  const indexed = await loadStateIndex({
    context: options.context,
    definition: options.definition,
    expectation: {
      definitionVersion: investigationIndexDefinitionVersion,
      namespace: investigationIndexNamespace
    },
    indexPath: options.indexPath
  });
  if (indexed.status === "error") {
    return [];
  }

  let current: InvestigationIndexMetadata;
  try {
    current = await readInvestigationResourceMetadata(
      options.context.root,
      options.context.signal
    );
  } catch (error) {
    return [{
      code: "investigation-resource.read-failed",
      message: `resource pool could not be read: ${errorText(error)}`,
      path: investigationResourcesDirectoryName,
      stateId: null
    }];
  }
  const indexedById = new Map(
    indexed.value.metadata.resources.map((resource) => [
      resource.id,
      resource.sha256
    ])
  );
  const currentById = new Map(current.resources.map((resource) => [
    resource.id,
    resource.sha256
  ]));
  const ids = [...new Set([
    ...indexedById.keys(),
    ...currentById.keys()
  ])].sort(compareText);
  return ids.flatMap((id) => {
    const indexedSha256 = indexedById.get(id);
    const currentSha256 = currentById.get(id);
    if (indexedSha256 === undefined) {
      return [resourceDiagnostic(
        "investigation-resource.added",
        id,
        "resource was added since the index was generated"
      )];
    }
    if (currentSha256 === undefined) {
      return [resourceDiagnostic(
        "investigation-resource.removed",
        id,
        "resource was removed since the index was generated"
      )];
    }
    return indexedSha256 === currentSha256
      ? []
      : [resourceDiagnostic(
        "investigation-resource.changed",
        id,
        "resource content changed since the index was generated"
      )];
  });
}

function resourceDiagnostic(
  code: string,
  id: string,
  message: string
): StateIndexDiagnostic {
  return {
    code,
    message,
    path: `${investigationResourcesDirectoryName}/${id}`,
    stateId: null
  };
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
