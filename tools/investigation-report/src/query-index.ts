import path from "node:path";
import { err, fromThrowable, ok, ResultAsync, type Result } from "neverthrow";
import {
  queryStateIndex,
  stateIndexQueryDefaultLimit
} from "../../index-runtime/src/index.ts";
import {
  createInvestigationStateIndexDefinition,
  investigationIndexDiagnosticMessages,
  investigationIndexFileName,
  loadCurrentInvestigationIndex
} from "./investigation-state-index.ts";
import { diagnosticFromStateIndexDiagnostic } from "./diagnostics.ts";
import { buildInvestigationListFacets } from "./list-facets.ts";
import { parseInvestigationIndexQueryOptions } from "./options.ts";
import { resolveInvestigationsDirectory } from "./report-path.ts";
import {
  filterRelationsByEntry,
  relatedInvestigationIds
} from "./query-search-selection.ts";
import {
  defaultInvestigationIndexPath,
  investigationIndexPathForOptions,
  queryFailure,
  queryOperationFailure
} from "./query-results.ts";
import { validateQueryOptions } from "./query-options.ts";
import type { InvestigationIndexQueryResult } from "./types.ts";
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
    loadCurrentInvestigationIndex({ investigationsDirectory }),
    (error) =>
      queryOperationFailure(
        error,
        "the derived index could not be loaded for the query",
        indexPath
      )
  ).andThen((loaded) =>
    queryLoadedInvestigationIndex(loaded, validated, indexPath)
  );
}

export type LoadedInvestigationIndex = Awaited<
  ReturnType<typeof loadCurrentInvestigationIndex>
>;

function queryLoadedInvestigationIndex(
  loaded: LoadedInvestigationIndex,
  validated: ValidatedQueryOptions,
  indexPath: string
) {
  if (loaded.status === "error")
    return err(indexQueryDiagnostics(loaded.diagnostics, indexPath));
  const entries = Object.entries(loaded.value.entries).map(([id, state]) => ({
    id,
    state
  }));
  const facets = buildInvestigationListFacets(entries);
  const related = relatedInvestigationIds(entries, validated);
  if (related.isErr()) return err({ diagnostics: [], errors: related.error });
  const filterRelations = filterRelationsByEntry(entries, validated);
  if (filterRelations.isErr())
    return err({ diagnostics: [], errors: filterRelations.error });
  if (related.value !== null && related.value.size === 0)
    return ok(emptyQueryResult(validated, indexPath, facets));
  return runIndexQuery(
    loaded.value,
    selectedFilters(validated, related.value),
    validated,
    indexPath,
    facets,
    filterRelations.value
  );
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
    total: 0
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
  index: Extract<LoadedInvestigationIndex, { status: "ok" }>["value"],
  filters: ValidatedQueryOptions["filters"],
  validated: ValidatedQueryOptions,
  indexPath: string,
  facets: ReturnType<typeof buildInvestigationListFacets>,
  filterRelations: ReadonlyMap<
    string,
    readonly import("./types.ts").InvestigationFilterRelation[]
  > | null
) {
  return fromThrowable(
    () =>
      queryStateIndex({
        definition: createInvestigationStateIndexDefinition(),
        index,
        query: {
          filters,
          limit: validated.limit,
          offset: validated.offset,
          sort: [
            { direction: "desc", key: "formed-at" },
            { direction: "asc", key: "id" }
          ]
        }
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
            ...(filterRelations?.get(entry.id) === undefined
              ? {}
              : { filterRelations: filterRelations.get(entry.id)! })
          })),
          errors: [],
          facets,
          indexPath,
          limit: queried.value.limit,
          offset: queried.value.offset,
          total: queried.value.total
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
