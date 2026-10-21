import path from "node:path";
import { err, fromThrowable, ok, ResultAsync, type Result } from "neverthrow";
import {
  queryStateIndex,
  stateIndexQueryDefaultLimit,
  type StateIndexQuery,
  type StateIndexQueryOutput,
  type StateIndexResult
} from "../../index-runtime/src/index.ts";
import {
  createInvestigationStateIndexDefinition,
  investigationIndexDiagnosticMessages,
  investigationIndexFileName,
  loadInvestigationIndex,
  loadInvestigationIndexReader
} from "./investigation-state-index.ts";
import { diagnosticFromStateIndexDiagnostic } from "./diagnostics.ts";
import { buildInvestigationListFacets } from "./list-facets.ts";
import { parseInvestigationIndexQueryOptions } from "./options.ts";
import { resolveInvestigationsDirectory } from "./report-path.ts";
import { filterRelationsByEntry } from "./query-search-selection.ts";
import { createInvestigationRelationContext } from "./relation-context.ts";
import {
  defaultInvestigationIndexPath,
  investigationIndexPathForOptions,
  queryFailure,
  queryOperationFailure
} from "./query-results.ts";
import { validateQueryOptions } from "./query-options.ts";
import type {
  InvestigationFilterRelation,
  InvestigationIndexMetadata,
  InvestigationIndexState,
  InvestigationIndexQueryResult
} from "./types.ts";
import type {
  InvestigationIndexQueryFailure,
  PreparedQuery,
  QueryOperationFailure,
  ValidatedQueryOptions
} from "./query.ts";

export function prepareQuery(
  input: unknown
): Result<PreparedQuery, InvestigationIndexQueryFailure> {
  const parsed = parseInvestigationIndexQueryOptions(input);
  if (parsed.isErr()) {
    return err(
      queryFailure({
        errors: parsed.error,
        indexPath: defaultInvestigationIndexPath(),
        kind: "invalid-options",
        limit: stateIndexQueryDefaultLimit,
        offset: 0
      })
    );
  }
  const resolved = resolveInvestigationsDirectory(
    parsed.value.workspaceRoot,
    parsed.value.investigationsDir
  );
  const validated = validateQueryOptions(parsed.value);
  if (resolved.isErr() || validated.isErr()) {
    return err(invalidPreparedQuery(parsed.value, resolved, validated));
  }
  return ok({
    indexPath: path.join(
      resolved.value.investigationsDirectory,
      investigationIndexFileName
    ),
    resolved: resolved.value,
    validated: validated.value
  });
}

function invalidPreparedQuery(
  options: Parameters<typeof validateQueryOptions>[0],
  resolved: ReturnType<typeof resolveInvestigationsDirectory>,
  validated: ReturnType<typeof validateQueryOptions>
): InvestigationIndexQueryFailure {
  const validation = queryValidationDetails(validated);
  return queryFailure({
    errors: [...queryResolutionErrors(resolved), ...validation.errors],
    indexPath: investigationIndexPathForOptions(options),
    kind: "invalid-options",
    limit: validation.limit,
    offset: validation.offset
  });
}

type QueryValidationDetails = Readonly<{
  errors: readonly string[];
  limit: number;
  offset: number;
}>;

function queryValidationDetails(
  validated: ReturnType<typeof validateQueryOptions>
): QueryValidationDetails {
  if (validated.isErr()) return validated.error;
  return {
    errors: [],
    limit: validated.value.limit,
    offset: validated.value.offset
  };
}

function queryResolutionErrors(
  resolved: ReturnType<typeof resolveInvestigationsDirectory>
): readonly string[] {
  if (resolved.isErr()) return resolved.error;
  return [];
}

export function queryValidatedInvestigationIndex(
  investigationsDirectory: string,
  validated: ValidatedQueryOptions
): ResultAsync<InvestigationIndexQueryResult, QueryOperationFailure> {
  const indexPath = path.join(
    investigationsDirectory,
    investigationIndexFileName
  );
  return ResultAsync.fromPromise(
    loadInvestigationIndexReader({ investigationsDirectory }),
    (error) =>
      queryOperationFailure(
        error,
        "the persisted index could not be loaded for the query",
        indexPath
      )
  ).andThen((loaded) => {
    if (loaded.status === "error")
      return err(indexQueryDiagnostics(loaded.diagnostics, indexPath));
    // The loader validated and froze these states; the existing domain
    // relation context consumes the same shape through its query DTO types.
    const entries = Object.entries(loaded.value.index.entries) as Array<
      [string, InvestigationIndexState]
    >;
    return queryInvestigationSnapshot(entries, validated, indexPath, (query) =>
      loaded.value.query(query)
    );
  });
}

export type LoadedInvestigationIndex = Awaited<
  ReturnType<typeof loadInvestigationIndex>
>;
type IndexQuerySelection = Readonly<{
  filters: ValidatedQueryOptions["filters"];
  facets: ReturnType<typeof buildInvestigationListFacets>;
  filterRelations: ReadonlyMap<
    string,
    readonly InvestigationFilterRelation[]
  > | null;
}>;

export function queryLoadedInvestigationIndex(
  loaded: LoadedInvestigationIndex,
  validated: ValidatedQueryOptions,
  indexPath: string
) {
  if (loaded.status === "error")
    return err(indexQueryDiagnostics(loaded.diagnostics, indexPath));
  return queryInvestigationSnapshot(
    Object.entries(loaded.value.entries),
    validated,
    indexPath,
    (query) =>
      queryStateIndex({
        definition: createInvestigationStateIndexDefinition(),
        index: loaded.value,
        query
      })
  );
}

type InvestigationSnapshotQuery = (
  query: StateIndexQuery
) => StateIndexResult<
  StateIndexQueryOutput<InvestigationIndexState, InvestigationIndexMetadata>
>;

function queryInvestigationSnapshot(
  entries: readonly [string, InvestigationIndexState][],
  validated: ValidatedQueryOptions,
  indexPath: string,
  query: InvestigationSnapshotQuery
) {
  const context = createInvestigationRelationContext(entries);
  const facets = buildInvestigationListFacets(context.entries);
  const filterRelations = filterRelationsByEntry(context, validated);
  if (filterRelations.isErr())
    return err({ diagnostics: [], errors: filterRelations.error });
  const related =
    filterRelations.value === null
      ? null
      : new Set(filterRelations.value.keys());
  if (related !== null && related.size === 0)
    return ok(emptyQueryResult(validated, indexPath, facets));
  return runIndexQuery(query, validated, indexPath, {
    filters: selectedFilters(validated, related),
    facets,
    filterRelations: filterRelations.value
  });
}

function emptyQueryResult(
  validated: ValidatedQueryOptions,
  indexPath: string,
  facets: ReturnType<typeof buildInvestigationListFacets>
): InvestigationIndexQueryResult {
  return {
    appliedFilters: validated.appliedFilters,
    diagnostics: [],
    entries: [],
    errors: [],
    facets,
    indexPath,
    limit: validated.limit,
    offset: validated.offset,
    total: 0,
    warnings: []
  };
}

function selectedFilters(
  validated: ValidatedQueryOptions,
  related: ReadonlySet<string> | null
) {
  return related === null
    ? validated.filters
    : [
        ...validated.filters,
        {
          key: "id" as const,
          kind: "exact" as const,
          operator: "any" as const,
          values: [...related]
        }
      ];
}

function runIndexQuery(
  query: InvestigationSnapshotQuery,
  validated: ValidatedQueryOptions,
  indexPath: string,
  selection: IndexQuerySelection
) {
  return fromThrowable(
    () =>
      query({
        filters: selection.filters,
        limit: validated.limit,
        offset: validated.offset,
        sort: [
          { direction: "desc", key: "formed-at" },
          { direction: "asc", key: "id" }
        ]
      }),
    (error) =>
      queryOperationFailure(
        error,
        "the derived index query could not be completed",
        indexPath
      )
  )().andThen((queried) =>
    queried.status === "error"
      ? err(indexQueryDiagnostics(queried.diagnostics, indexPath))
      : ok({
          appliedFilters: validated.appliedFilters,
          diagnostics: [],
          entries: queried.value.entries.map((entry) => ({
            id: entry.id,
            state: entry.state,
            ...(selection.filterRelations?.get(entry.id) === undefined
              ? {}
              : { filterRelations: selection.filterRelations.get(entry.id)! })
          })),
          errors: [],
          facets: selection.facets,
          indexPath,
          limit: queried.value.limit,
          offset: queried.value.offset,
          total: queried.value.total,
          warnings: []
        })
  );
}

function indexQueryDiagnostics(
  diagnostics: Parameters<typeof investigationIndexDiagnosticMessages>[0],
  indexPath: string
): QueryOperationFailure {
  return {
    diagnostics: diagnostics.map((diagnostic) =>
      diagnosticFromStateIndexDiagnostic(diagnostic, {
        recovery:
          "correct the reported derived-index problem, then retry the query",
        target: indexPath
      })
    ),
    errors: investigationIndexDiagnosticMessages(diagnostics, indexPath)
  };
}
