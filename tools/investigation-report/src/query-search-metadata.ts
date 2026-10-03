import {
  metadataSearchFacts,
  publishedSearchWarning,
  searchLimitWarnings
} from "../../shared/src/file-text-search/record-search-info.ts";
import {
  createTextSearchMatcher,
  matchTextSegments,
  TextSearchMatcherError
} from "../../shared/src/file-text-search/index.ts";
import {
  diagnosticFromError,
  diagnosticFromStateIndexDiagnostic
} from "./diagnostics.ts";
import { loadInvestigationIndex } from "./investigation-state-index.ts";
import { investigationIndexCurrentness } from "./index-staleness.ts";
import { compareText, searchFailure } from "./query-results.ts";
import { investigationMetadataSearchFields } from "./types.ts";
import type {
  InvestigationSearchFilters,
  InvestigationSearchInfo,
  InvestigationIndexState,
  InvestigationMetadataMatchedRelation,
  InvestigationMetadataSearchEntry,
  InvestigationMetadataSearchField,
  InvestigationSearchResult
} from "./types.ts";
import type { PreparedSearch, InvestigationSnapshotEntry } from "./query.ts";
import { selectSearchEntries } from "./query-search-selection.ts";
export { relatedInvestigationIds } from "./query-search-selection.ts";

type InvestigationMetadataSegment =
  | Readonly<{ field: InvestigationMetadataSearchField; kind: "field" }>
  | Readonly<{
      kind: "relation";
      relation: InvestigationMetadataMatchedRelation;
    }>;

export async function searchInvestigationMetadata(
  investigationsDirectory: string,
  indexPath: string,
  prepared: PreparedSearch
): Promise<InvestigationSearchResult> {
  const loaded = await loadInvestigationIndex({ investigationsDirectory });
  if (loaded.status === "error")
    return metadataIndexFailure(loaded.diagnostics, indexPath);
  const currentness = await investigationIndexCurrentness(
    investigationsDirectory,
    loaded.value
  );
  const matcher = metadataMatcher(prepared);
  if (matcher instanceof Error)
    return metadataMatcherFailure(matcher, indexPath);
  const selected = selectSearchEntries(
    Object.entries(loaded.value.entries).map(([id, state]) => ({ id, state })),
    prepared
  );
  if (selected.isErr()) return searchFailure(selected.error, indexPath);
  return metadataSearchResult(
    matcher,
    selected.value.entries,
    prepared,
    indexPath,
    selected.value.filterRelations,
    selected.value.filters,
    { kind: "published-index", currentness, fallback: false }
  );
}

function metadataIndexFailure(
  diagnostics: Parameters<typeof diagnosticFromStateIndexDiagnostic>[0][],
  indexPath: string
): InvestigationSearchResult {
  const recovery =
    "Run investigation-report check to diagnose the collection, then run sync-index after correcting the problem.";
  return searchFailure(
    [
      "the published investigation index could not be loaded for metadata search"
    ],
    indexPath,
    diagnostics.map((diagnostic) =>
      diagnosticFromStateIndexDiagnostic(diagnostic, {
        recovery,
        target: indexPath
      })
    )
  );
}

function metadataMatcher(
  prepared: PreparedSearch
): ReturnType<typeof createTextSearchMatcher> | Error {
  try {
    return createTextSearchMatcher({
      mode: prepared.validated.match,
      text: prepared.query
    });
  } catch (error) {
    return error instanceof Error
      ? error
      : new Error("metadata matcher failed");
  }
}

function metadataSearchResult(
  matcher: ReturnType<typeof createTextSearchMatcher>,
  selected: readonly InvestigationSnapshotEntry[],
  prepared: PreparedSearch,
  indexPath: string,
  filterRelations: ReadonlyMap<
    string,
    readonly import("./types.ts").InvestigationFilterRelation[]
  > | null,
  filters: InvestigationSearchFilters,
  source: InvestigationSearchInfo["source"]
): InvestigationSearchResult {
  const entries: InvestigationMetadataSearchEntry[] = [];
  for (const entry of [...selected].sort(compareSearchSourcePath)) {
    const matched = metadataEntryMatch(matcher, entry, indexPath);
    if (matched instanceof Error)
      return metadataMatcherFailure(matched, indexPath);
    if (matched !== null)
      entries.push({
        ...matched,
        ...(filterRelations?.get(entry.id) === undefined
          ? {}
          : { filterRelations: filterRelations.get(entry.id)! })
      });
  }
  const returned = entries.slice(0, prepared.validated.limit);
  const facts = metadataSearchFacts(
    entries.length,
    returned.length,
    prepared.validated.limit
  );
  return {
    searchInfo: {
      query: {
        text: prepared.query,
        in: "metadata",
        match: prepared.validated.match,
        filters,
        limits: facts.limits
      },
      source,
      counts: facts.counts,
      coverage: facts.coverage
    },
    diagnostics: [],
    entries: returned,
    errors: [],
    indexPath,
    status: "ok",
    truncation: {
      files: entries.length > returned.length,
      matches: false,
      previewCharacters: false
    },
    warnings: [
      ...publishedSearchWarning(source.currentness, "Investigation"),
      ...searchLimitWarnings(facts.coverage)
    ]
  };
}

function compareSearchSourcePath(
  left: InvestigationSnapshotEntry,
  right: InvestigationSnapshotEntry
): number {
  return compareText(left.state.sourcePath, right.state.sourcePath);
}

function metadataEntryMatch(
  matcher: ReturnType<typeof createTextSearchMatcher>,
  entry: InvestigationSnapshotEntry,
  _indexPath: string
): InvestigationMetadataSearchEntry | null | Error {
  try {
    const matches = matchTextSegments(matcher, metadataSegments(entry));
    if (matches.length === 0) return null;
    return metadataMatchEntry(
      entry,
      matches.map(({ identifier }) => identifier)
    );
  } catch (error) {
    return error instanceof Error
      ? error
      : new Error("metadata matcher failed");
  }
}

function metadataMatchEntry(
  entry: InvestigationSnapshotEntry,
  identifiers: readonly InvestigationMetadataSegment[]
): InvestigationMetadataSearchEntry {
  const matchedFields = new Set<InvestigationMetadataSearchField>();
  const matchedRelations: InvestigationMetadataMatchedRelation[] = [];
  for (const identifier of identifiers) {
    if (identifier.kind === "field") matchedFields.add(identifier.field);
    else matchedRelations.push(identifier.relation);
  }
  return {
    formedAt: entry.state.formedAt,
    id: entry.id,
    matchedFields: investigationMetadataSearchFields.filter((field) =>
      matchedFields.has(field)
    ),
    matchedRelations,
    question: entry.state.question,
    sourcePath: entry.state.sourcePath,
    tags: entry.state.tags,
    title: entry.state.title
  };
}

function metadataSegments(
  entry: Readonly<{ id: string; state: InvestigationIndexState }>
): readonly Readonly<{
  identifier: InvestigationMetadataSegment;
  text: string;
}>[] {
  const fields: readonly (readonly [
    InvestigationMetadataSearchField,
    string
  ])[] = [
    ["id", entry.id],
    ["name", entry.state.name],
    ["title", entry.state.title],
    ["question", entry.state.question],
    ...entry.state.tags.map((tag) => ["tags", tag] as const)
  ];
  return [
    ...fields.map(([field, text]) => ({
      identifier: { field, kind: "field" } as const,
      text
    })),
    ...entry.state.relations.flatMap((relation) => {
      const summary = relation.summary;
      return summary === undefined || summary.trim().length === 0
        ? []
        : [
            {
              identifier: {
                kind: "relation" as const,
                relation: {
                  summary,
                  target: relation.target,
                  type: relation.type
                }
              },
              text: summary
            }
          ];
    })
  ];
}

function metadataMatcherFailure(
  error: unknown,
  indexPath: string
): InvestigationSearchResult {
  return searchFailure(
    ["investigation metadata search could not be completed"],
    indexPath,
    [
      diagnosticFromError({
        code: "investigation-report.metadata-search-failed",
        error,
        reason:
          error instanceof TextSearchMatcherError
            ? error.message
            : "the investigation metadata search operation failed",
        recovery: "correct the metadata search query, then retry",
        target: indexPath
      })
    ]
  );
}
