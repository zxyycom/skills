import {
  FileTextSearchError,
  searchFileText
} from "../../shared/src/file-text-search/index.ts";
import { diagnosticFromError } from "./diagnostics.ts";
import { searchFailure } from "./query-results.ts";
import {
  filterRelationsByEntry,
  selectSearchEntries
} from "./query-search-selection.ts";
import type {
  InvestigationFilterRelation,
  InvestigationSearchEntry,
  InvestigationSearchResult
} from "./types.ts";
import type { InvestigationSnapshotEntry, PreparedSearch } from "./query.ts";

type SearchSnapshot = Readonly<{
  entries: readonly InvestigationSnapshotEntry[];
  indexPath: string;
  investigationsDirectory: string;
  prepared: PreparedSearch;
  warnings: readonly string[];
}>;

/** Searches selected report source text from a single validated index snapshot. */
export async function searchSnapshot(
  snapshot: SearchSnapshot
): Promise<InvestigationSearchResult> {
  const selected = selectSearchEntries(snapshot.entries, snapshot.prepared);
  if (selected.isErr())
    return searchFailure(
      selected.error,
      snapshot.indexPath,
      [],
      snapshot.warnings
    );
  const filterRelations = filterRelationsByEntry(
    snapshot.entries,
    snapshot.prepared.validated
  );
  if (filterRelations.isErr())
    return searchFailure(
      filterRelations.error,
      snapshot.indexPath,
      [],
      snapshot.warnings
    );
  const sourceMap = sourceEntryMap(selected.value);
  if (sourceMap instanceof Error)
    return searchFailure([sourceMap.message], snapshot.indexPath);
  try {
    const searched = await searchSelectedSources(snapshot, selected.value);
    const entries = searchHitEntries(
      searched.hits,
      sourceMap,
      filterRelations.value
    );
    if (entries instanceof Error)
      return searchFailure([entries.message], snapshot.indexPath);
    return successfulSearch(snapshot, entries, searched.truncation);
  } catch (error) {
    return unavailableSearchFailure(snapshot, error);
  }
}

function sourceEntryMap(
  entries: readonly InvestigationSnapshotEntry[]
): Map<string, InvestigationSnapshotEntry> | Error {
  const result = new Map<string, InvestigationSnapshotEntry>();
  for (const entry of entries) {
    if (result.has(entry.state.sourcePath))
      return new Error("investigation sourcePath mapping is not unique");
    result.set(entry.state.sourcePath, entry);
  }
  return result;
}

async function searchSelectedSources(
  snapshot: SearchSnapshot,
  entries: readonly InvestigationSnapshotEntry[]
) {
  return await searchFileText({
    limits: {
      maxCandidateFiles: 2_000,
      maxFileBytes: 2 * 1024 * 1024,
      maxTotalBytes: 20 * 1024 * 1024
    },
    preview: {
      contextLines: 1,
      maxFiles: snapshot.prepared.validated.limit,
      maxMatchesPerFile: 3,
      maxPreviewCharacters: 24_000
    },
    query: {
      mode: snapshot.prepared.validated.match,
      text: snapshot.prepared.query
    },
    root: snapshot.investigationsDirectory,
    selection: {
      kind: "files",
      sourcePaths: entries.map((entry) => entry.state.sourcePath)
    }
  });
}

function searchHitEntries(
  hits: Awaited<ReturnType<typeof searchFileText>>["hits"],
  entryBySourcePath: ReadonlyMap<string, InvestigationSnapshotEntry>,
  filterRelations: ReadonlyMap<
    string,
    readonly InvestigationFilterRelation[]
  > | null
): InvestigationSearchEntry[] | Error {
  const entries: InvestigationSearchEntry[] = [];
  for (const hit of hits) {
    const entry = entryBySourcePath.get(hit.sourcePath);
    if (entry === undefined)
      return new Error(
        "investigation search returned a source path outside its index snapshot"
      );
    entries.push({
      formedAt: entry.state.formedAt,
      id: entry.id,
      previews: hit.previews,
      question: entry.state.question,
      sourcePath: hit.sourcePath,
      tags: entry.state.tags,
      title: entry.state.title,
      ...(filterRelations?.get(entry.id) === undefined
        ? {}
        : { filterRelations: filterRelations.get(entry.id)! })
    });
  }
  return entries;
}

function successfulSearch(
  snapshot: SearchSnapshot,
  entries: InvestigationSearchEntry[],
  truncation: Awaited<ReturnType<typeof searchFileText>>["truncation"]
): InvestigationSearchResult {
  return {
    diagnostics: [],
    entries,
    errors: [],
    indexPath: snapshot.indexPath,
    status: "ok",
    truncation,
    warnings: [...snapshot.warnings]
  };
}

function unavailableSearchFailure(
  snapshot: SearchSnapshot,
  error: unknown
): InvestigationSearchResult {
  const fileError = error instanceof FileTextSearchError ? error : null;
  return searchFailure(
    ["investigation file search could not be completed"],
    snapshot.indexPath,
    [
      diagnosticFromError({
        code:
          fileError === null
            ? "investigation-report.file-search-unavailable"
            : `investigation-report.file-search-${fileError.code}`,
        error,
        reason: "the selected investigation Markdown could not be searched",
        recovery: "restore the selected formal report and retry the search",
        target: fileError?.sourcePath ?? snapshot.indexPath
      })
    ],
    snapshot.warnings
  );
}
