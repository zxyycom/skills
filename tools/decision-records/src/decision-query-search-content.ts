import {
  searchRecordText,
  type RecordTextSearchResult
} from "../../shared/src/file-text-search/record-search.ts";
import {
  contentSearchFacts,
  searchLimitWarnings
} from "../../shared/src/file-text-search/record-search-info.ts";
import { FileTextSearchError } from "../../shared/src/file-text-search/index.ts";
import {
  decisionDiagnostic,
  decisionFailure,
  type DecisionApplicationFailure
} from "./application-result.ts";
import { loadDecisionValidationContext } from "./index.ts";
import {
  decisionScanOptions,
  resolveDecisionLocation,
  type DecisionLocation
} from "./decision-query-context.ts";
import {
  loadCurrentDecisionIndex,
  loadDecisionIndex,
  syncDecisionIndex
} from "./decision-state-index.ts";
import type {
  DecisionContentSearchRecord,
  DecisionFilteredRecord,
  DecisionQueryRequest,
  DecisionQueryResult,
  DecisionSearchSnapshot,
  DecisionSearchFilters,
  IndexedDecisionRecord
} from "./decision-query-contract.ts";
import { indexedRecord, sourceFailure } from "./decision-query-records.ts";
import { filterSearchRecords } from "./decision-query-search-filter.ts";
import {
  isEstablishedDecisionRecord,
  type DecisionSourcePath
} from "./types.ts";

const decisionSearchPreviewPolicy = {
  contextLines: 1,
  maxFiles: 20,
  maxMatchesPerFile: 3,
  maxPreviewCharacters: 12_000
} as const;

export async function searchDecisionContent(
  request: Extract<DecisionQueryRequest, { command: "search" }>
): Promise<DecisionQueryResult> {
  const snapshot = await loadDecisionSearchSnapshot(request.location);
  if (snapshot.status === "error") return snapshot.failure;
  const selected = filterSearchRecords(snapshot.value.entries, request);
  if (selected.status === "error") return selected.failure;
  try {
    const searched = await searchRecordText({
      preview: decisionSearchPreviewPolicy,
      query: { mode: request.match, text: request.text },
      root: resolveDecisionLocation(request.location).decisionsDirectory,
      selection: {
        kind: "files",
        sourcePaths: selected.records.map((record) => record.sourcePath)
      }
    });
    const records: DecisionContentSearchRecord[] = [];
    const selectedBySourcePath = new Map(
      selected.records.map((record) => [record.sourcePath, record])
    );
    for (const hit of searched.hits) {
      const record = searchedDecisionRecord(
        selectedBySourcePath,
        hit.sourcePath as DecisionSourcePath,
        hit.previews
      );
      if ("status" in record && record.status === "error") return record;
      records.push(record);
    }
    return contentSearchSuccess(
      request,
      selected.filters,
      snapshot.value,
      records,
      searched
    );
  } catch (error) {
    return searchFileFailure(error);
  }
}

function contentSearchSuccess(
  request: Extract<DecisionQueryRequest, { command: "search" }>,
  filters: DecisionSearchFilters,
  snapshot: DecisionSearchSnapshot,
  records: DecisionContentSearchRecord[],
  searched: RecordTextSearchResult
): Extract<DecisionQueryResult, { command: "search"; in: "content" }> {
  const facts = contentSearchFacts(searched);
  return {
    searchInfo: {
      query: {
        text: request.text,
        in: "content",
        match: request.match,
        filters,
        limits: facts.limits
      },
      source: snapshot.source,
      counts: facts.counts,
      coverage: facts.coverage
    },
    command: "search",
    in: "content",
    records,
    status: "ok",
    truncation: searched.truncation,
    warnings: [...snapshot.warnings, ...searchLimitWarnings(facts.coverage)]
  };
}

function searchedDecisionRecord(
  recordsBySourcePath: ReadonlyMap<DecisionSourcePath, DecisionFilteredRecord>,
  sourcePath: DecisionSourcePath,
  previews: DecisionContentSearchRecord["previews"]
): DecisionContentSearchRecord | DecisionApplicationFailure {
  const record = recordsBySourcePath.get(sourcePath);
  if (record !== undefined) return { ...record, previews };
  return decisionFailure([
    decisionDiagnostic({
      code: "decision-records.search-source-unmapped",
      reason:
        "A searched Decision source path does not map to one indexed Decision ID: " +
        sourcePath,
      recovery:
        "Correct the Decision source and index mapping, then retry the search.",
      target: sourcePath
    })
  ]);
}

export async function loadDecisionSearchSnapshot(
  location: DecisionLocation
): Promise<
  | { status: "ok"; value: DecisionSearchSnapshot }
  | { failure: DecisionApplicationFailure; status: "error" }
> {
  const { decisionsDirectory } = resolveDecisionLocation(location);
  const persisted = await loadDecisionIndex({ decisionsDirectory });
  if (persisted.status === "ok") {
    const current = await loadCurrentDecisionIndex({
      decisionsDirectory,
      decisionIds: Object.keys(persisted.value.entries)
    });
    const checked =
      current.status === "ok"
        ? await syncDecisionIndex({ decisionsDirectory, mode: "check" })
        : null;
    if (current.status === "ok" && checked?.status === "ok") {
      const entries = Object.entries(current.value.entries)
        .map(([id, state]) => indexedRecord({ id, state }))
        .sort((left, right) => left.sourcePath.localeCompare(right.sourcePath));
      const mapped = decisionSearchMap(entries);
      if (mapped.status === "error") return mapped;
      return {
        status: "ok",
        value: {
          entries,
          sourcePathToRecord: mapped.value,
          warnings: [],
          source: {
            kind: "validated-source",
            currentness: "current",
            fallback: false
          }
        }
      };
    }
  }
  return await sourceSearchSnapshot(location);
}

async function sourceSearchSnapshot(
  location: DecisionLocation
): Promise<
  | { status: "ok"; value: DecisionSearchSnapshot }
  | { failure: DecisionApplicationFailure; status: "error" }
> {
  const { result } = await loadDecisionValidationContext(
    decisionScanOptions(location),
    {
      allowEmptyDecisionSet: true,
      checkIndexText: false,
      scanErrorPolicy: "source-only"
    }
  );
  if (result.errors.length > 0)
    return {
      failure: sourceFailure(result.errors, "Decision search source"),
      status: "error"
    };
  const entries = result.scan.records
    .flatMap((record): IndexedDecisionRecord[] =>
      isEstablishedDecisionRecord(record)
        ? [
            {
              alignment: record.alignment,
              createdAt: record.createdAt,
              decisionId: record.decisionId,
              projection: record.projection,
              sourcePath: record.sourcePath,
              status: record.status,
              tags: [...record.tags]
            }
          ]
        : []
    )
    .sort((left, right) => left.sourcePath.localeCompare(right.sourcePath));
  const mapped = decisionSearchMap(entries);
  if (mapped.status === "error") return mapped;
  return {
    status: "ok",
    value: {
      entries,
      sourcePathToRecord: mapped.value,
      source: {
        kind: "validated-source",
        currentness: "current",
        fallback: true
      },
      warnings: [
        "search source: validated-source fallback; the persisted Decision index was unavailable or stale; searched a read-only validated Decision source projection instead. Run sync-index to publish the current projection."
      ]
    }
  };
}

function decisionSearchMap(records: readonly IndexedDecisionRecord[]):
  | {
      status: "ok";
      value: ReadonlyMap<DecisionSourcePath, IndexedDecisionRecord>;
    }
  | { failure: DecisionApplicationFailure; status: "error" } {
  const sourcePathToRecord = new Map<
    DecisionSourcePath,
    IndexedDecisionRecord
  >();
  for (const record of records) {
    if (sourcePathToRecord.has(record.sourcePath))
      return {
        failure: decisionFailure([
          decisionDiagnostic({
            code: "decision-records.search-source-ambiguous",
            reason:
              "A Decision source path maps to more than one Decision ID: " +
              record.sourcePath,
            recovery:
              "Correct the Decision source projection, then retry the search.",
            target: record.sourcePath
          })
        ]),
        status: "error"
      };
    sourcePathToRecord.set(record.sourcePath, record);
  }
  return { status: "ok", value: sourcePathToRecord };
}

function searchFileFailure(error: unknown): DecisionApplicationFailure {
  const reason =
    error instanceof FileTextSearchError
      ? error.message
      : "The file text search operation failed.";
  const target =
    error instanceof FileTextSearchError && error.sourcePath !== null
      ? error.sourcePath
      : "Decision search";
  return decisionFailure([
    decisionDiagnostic({
      code: "decision-records.search-failed",
      reason,
      recovery:
        "Correct the Decision search input or source collection, then retry.",
      target
    })
  ]);
}
