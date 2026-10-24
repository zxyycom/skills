/*
 * Synced TypeScript runtime; repository maintenance edits tools/investigation-report/src/query-search-metadata.ts.
 * Installed skill copies may be edited directly; updates overwrite matching files.
 * Repository: https://github.com/zxyycom/skills
 * Source path: tools/investigation-report/src/query-search-metadata.ts
 * Maintained source: https://github.com/zxyycom/skills/blob/main/tools/investigation-report/src/query-search-metadata.ts
 * Skill source directory: https://github.com/zxyycom/skills/tree/main/skills/investigation-report
 * Rebuild: bun run sync:investigation-report-check
 */
import { collectRecordMetadataWindow } from "../../record-operations/src/query.ts";
import { err, ok } from "neverthrow";
import {
  metadataSearchFacts,
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
import { loadInvestigationQueryIndex } from "./investigation-state-index.ts";
import { type InvestigationRelationContext } from "./relation-context.ts";
import { compareText, searchFailure } from "./query-results.ts";
import { investigationMetadataSearchFields } from "./types.ts";
import type {
  InvestigationIndexState,
  InvestigationMetadataMatchedRelation,
  InvestigationMetadataSearchEntry,
  InvestigationMetadataSearchField,
  InvestigationSearchResult
} from "./types.ts";
import type { PreparedSearch, InvestigationSnapshotEntry } from "./query.ts";
import {
  selectSearchEntries,
  type InvestigationSearchSelection
} from "./query-search-selection.ts";
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
  const loaded = await loadInvestigationQueryIndex({
    investigationsDirectory,
    requiresRelations:
      prepared.validated.relatedTo !== undefined ||
      prepared.validated.relationType !== undefined
  });
  if (loaded.status === "error")
    return metadataIndexFailure(loaded.diagnostics, indexPath);
  return searchLoadedInvestigationMetadata(
    loaded.relations,
    indexPath,
    prepared
  );
}

/** Projects metadata matches from one already validated published snapshot. */
export function searchLoadedInvestigationMetadata(
  context: InvestigationRelationContext,
  indexPath: string,
  prepared: PreparedSearch
): InvestigationSearchResult {
  const matcher = metadataMatcher(prepared);
  if (matcher instanceof Error)
    return metadataMatcherFailure(matcher, indexPath);
  const selected = selectSearchEntries(context, prepared);
  if (selected.isErr())
    return searchFailure({
      errors: selected.error,
      indexPath,
      failureKind: "operation"
    });
  return metadataSearchResult(matcher, selected.value, prepared, indexPath);
}

function metadataIndexFailure(
  diagnostics: Parameters<typeof diagnosticFromStateIndexDiagnostic>[0][],
  indexPath: string
): InvestigationSearchResult {
  const recovery =
    "Run investigation-report check to diagnose the collection, then run sync-index after correcting the problem.";
  return searchFailure({
    errors: [
      "the published investigation index could not be loaded for metadata search"
    ],
    indexPath,
    diagnostics: diagnostics.map((diagnostic) =>
      diagnosticFromStateIndexDiagnostic(diagnostic, {
        recovery,
        target: indexPath
      })
    ),
    failureKind: "operation"
  });
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
  selection: InvestigationSearchSelection,
  prepared: PreparedSearch,
  indexPath: string
): InvestigationSearchResult {
  const window = collectRecordMetadataWindow({
    entries: [...selection.entries].sort(compareSearchSourcePath),
    limit: prepared.validated.limit,
    match: (entry) => {
      try {
        const matches = matchTextSegments(matcher, metadataSegments(entry));
        return ok(
          matches.length === 0
            ? null
            : matches.map(({ identifier }) => identifier)
        );
      } catch (error) {
        return err(error);
      }
    },
    project: (entry, evidence) => ({
      ...metadataMatchEntry(entry, evidence),
      ...(selection.filterRelations?.get(entry.id) === undefined
        ? {}
        : { filterRelations: selection.filterRelations.get(entry.id)! })
    })
  });
  if (window.isErr()) return metadataMatcherFailure(window.error, indexPath);
  const returned = window.value.entries;
  const facts = metadataSearchFacts(
    window.value.matched,
    returned.length,
    prepared.validated.limit
  );
  return {
    searchInfo: {
      query: {
        text: prepared.query,
        in: "metadata",
        match: prepared.validated.match,
        filters: selection.filters,
        limits: facts.limits
      },
      source: {
        kind: "published-index",
        currentness: "unchecked",
        fallback: false
      },
      counts: facts.counts,
      coverage: facts.coverage
    },
    diagnostics: [],
    entries: returned,
    errors: [],
    indexPath,
    status: "ok",
    truncation: {
      files: window.value.matched > returned.length,
      matches: false,
      previewCharacters: false
    },
    warnings: searchLimitWarnings(facts.coverage)
  };
}

function compareSearchSourcePath(
  left: InvestigationSnapshotEntry,
  right: InvestigationSnapshotEntry
): number {
  return compareText(left.state.sourcePath, right.state.sourcePath);
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
  return searchFailure({
    errors: ["investigation metadata search could not be completed"],
    indexPath,
    diagnostics: [
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
    ],
    failureKind: "operation"
  });
}
