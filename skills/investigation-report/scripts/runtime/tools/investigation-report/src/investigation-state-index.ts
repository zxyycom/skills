/*
 * Synced TypeScript runtime; repository maintenance edits tools/investigation-report/src/investigation-state-index.ts.
 * Installed skill copies may be edited directly; updates overwrite matching files.
 * Repository: https://github.com/zxyycom/skills
 * Source path: tools/investigation-report/src/investigation-state-index.ts
 * Maintained source: https://github.com/zxyycom/skills/blob/main/tools/investigation-report/src/investigation-state-index.ts
 * Skill source directory: https://github.com/zxyycom/skills/tree/main/skills/investigation-report
 * Rebuild: bun run sync:investigation-report-check
 */
import { createInvestigationRelationContext } from "./relation-context.ts";
import { loadRecordQuery } from "../../record-operations/src/query.ts";
import { checkCollectedRecordIndex } from "../../record-operations/src/check.ts";
import {
  expectationOf,
  loadCurrentStateIndex,
  loadStateIndex,
  syncStateIndex,
  type StateIndex,
  type StateIndexContext,
  type StateIndexDiagnostic,
  type StateIndexResult,
  type StateIndexSyncMode,
  type StateIndexSyncScope,
  type StateIndexSyncResult,
  type StateSnapshot
} from "../../index-runtime/src/index.ts";
import {
  createInvestigationStateIndexDefinition,
  investigationIndexDefinitionVersion,
  investigationIndexNamespace
} from "./investigation-index-definition.ts";
import { sanitizeInvestigationDiagnosticText } from "./diagnostics.ts";
import {
  discoverInvestigationReportIds,
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
  discoverInvestigationReportIds,
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
  const indexPath = options.indexPath ?? investigationIndexFileName;
  const definition = createInvestigationStateIndexDefinition();
  const context = stateIndexContext(
    options.investigationsDirectory,
    options.signal
  );
  return await loadCurrentStateIndex({
    context,
    definition,
    indexPath
  });
}

export async function loadInvestigationIndex(options: {
  investigationsDirectory: string;
  indexPath?: string;
  signal?: AbortSignal;
}): Promise<
  StateIndexResult<
    StateIndex<InvestigationIndexState, InvestigationIndexMetadata>
  >
> {
  const definition = createInvestigationStateIndexDefinition();
  return await loadStateIndex({
    context: stateIndexContext(options.investigationsDirectory, options.signal),
    definition,
    expectation: expectationOf(definition),
    indexPath: options.indexPath ?? investigationIndexFileName
  });
}

export async function loadInvestigationIndexReader(options: {
  investigationsDirectory: string;
  indexPath?: string;
  signal?: AbortSignal;
  requiresRelations?: boolean;
}) {
  const definition = createInvestigationStateIndexDefinition();
  const loaded = await loadRecordQuery({
    context: stateIndexContext(options.investigationsDirectory, options.signal),
    definition,
    expectation: expectationOf(definition),
    indexPath: options.indexPath ?? investigationIndexFileName,
    project: (reader) => ({
      status: "ok",
      diagnostics: [],
      value: {
        reader,
        relations: createInvestigationRelationContext(
          Object.entries(reader.index.entries) as [
            string,
            InvestigationIndexState
          ][]
        )
      }
    }),
    requiresRelations: options.requiresRelations === true,
    relationErrors: (projection) => projection.relations.errors(),
    relationFailureCode: "investigation-index.relation-invalid"
  });
  return loaded.status === "error"
    ? loaded
    : {
        status: "ok" as const,
        diagnostics: [],
        value: loaded.value.reader,
        relations: loaded.value.relations
      };
}

/** Query operation projection; no domain graph audit unless the consumer depends on it. */
export async function loadInvestigationQueryIndex(options: {
  investigationsDirectory: string;
  requiresRelations?: boolean;
}) {
  const loaded = await loadInvestigationIndexReader(options);
  return loaded.status === "error"
    ? loaded
    : {
        diagnostics: loaded.diagnostics,
        status: "ok" as const,
        value: loaded.value.index as StateIndex<
          InvestigationIndexState,
          InvestigationIndexMetadata
        >,
        relations: loaded.relations
      };
}

export async function syncInvestigationStateIndex(options: {
  investigationsDirectory: string;
  indexPath?: string;
  mode: StateIndexSyncMode;
  scope?: StateIndexSyncScope;
  signal?: AbortSignal;
  snapshot: StateSnapshot<InvestigationIndexState, InvestigationIndexMetadata>;
}): Promise<StateIndexSyncResult> {
  const context = stateIndexContext(
    options.investigationsDirectory,
    options.signal
  );
  return await syncStateIndex({
    context,
    definition: createInvestigationStateIndexDefinition({
      snapshot: options.snapshot
    }),
    indexPath: options.indexPath ?? investigationIndexFileName,
    mode: options.mode,
    ...(options.scope === undefined ? {} : { scope: options.scope })
  });
}

/** Checks the complete first-acquired projection, not end-of-check freshness. */
export async function checkInvestigationStateSnapshot(
  options: Readonly<{
    investigationsDirectory: string;
    snapshot: StateSnapshot<
      InvestigationIndexState,
      InvestigationIndexMetadata
    >;
  }>
): Promise<StateIndexSyncResult> {
  const definition = createInvestigationStateIndexDefinition({
    snapshot: options.snapshot
  });
  return await checkCollectedRecordIndex({
    context: { root: options.investigationsDirectory },
    definition,
    indexPath: investigationIndexFileName,
    snapshot: options.snapshot
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
      sanitizeInvestigationDiagnosticText(diagnostic.message)
    ]
      .filter((part) => part.length > 0)
      .join(" ");
  });
}

function stateIndexContext(
  root: string,
  signal: AbortSignal | undefined
): StateIndexContext {
  return { root, ...(signal === undefined ? {} : { signal }) };
}
