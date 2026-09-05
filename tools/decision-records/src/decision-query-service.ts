import fs from "node:fs/promises";
import path from "node:path";
import {
  FileTextSearchError,
  searchFileText,
  type FileTextSearchMode,
  type FileTextSearchPreview,
  type FileTextSearchTruncation
} from "../../shared/src/file-text-search/index.ts";
import {
  isStateIndexText,
  type StateIndexDiagnostic,
  type StateIndexFilter,
  type StateIndexSyncScope
} from "../../index-runtime/src/index.ts";
import {
  decisionDiagnostic,
  decisionDiagnosticFromReason,
  decisionFailure,
  decisionFileSystemDiagnostic,
  type DecisionApplicationFailure
} from "./application-result.ts";
import {
  decisionIndexDiagnostics,
  decisionIndexFileName,
  loadCurrentDecisionIndex,
  loadDecisionIndex,
  syncDecisionIndex
} from "./decision-state-index.ts";
import { decisionIdFromMarkdown } from "./decision-metadata.ts";
import {
  DecisionCollectionLockError,
  withDecisionCollectionMutationLock
} from "./decision-collection-mutation-lock.ts";
import {
  decisionNameFromId,
  isDecisionId,
  normalizeDecisionSelectorInput,
  parseDatedDecisionId
} from "./decision-path.ts";
import {
  decisionScanOptions,
  loadDecisionQueryContext,
  resolveDecisionLocation,
  type DecisionLocation
} from "./decision-query-context.ts";
import {
  loadDecisionValidationContext,
  selectEstablishedDecisionIds,
  validateDecisionScan
} from "./index.ts";
import {
  traceDecisionRelations,
  type DecisionRelationEdge
} from "./relation-graph.ts";
import { scanDecisionRecords } from "./scan.ts";
import {
  compareDecisionRecords,
  isActivationCandidateRecord,
  isDecisionCandidateRecord,
  isEstablishedDecisionRecord,
  type DecisionAlignment,
  type DecisionCandidateRecord,
  type DecisionId,
  type DecisionIndexEntry,
  type DecisionListAlignment,
  type DecisionListStatus,
  type EstablishedDecisionStatus,
  type DecisionProjection,
  type DecisionRecord,
  type DecisionScan,
  type DecisionTraceDirection,
  type DecisionSourcePath,
  type DecisionTag,
  type DecisionValidationResult
} from "./types.ts";

export type { DecisionLocation } from "./decision-query-context.ts";

export type DecisionQueryRequest =
  | {
      command: "candidates" | "check";
      location: DecisionLocation;
    }
  | {
      alignment: DecisionListAlignment;
      command: "list";
      fullTime: boolean;
      location: DecisionLocation;
      status: DecisionListStatus;
      tags: readonly DecisionTag[];
    }
  | {
      alignment: DecisionListAlignment;
      command: "search";
      location: DecisionLocation;
      match: FileTextSearchMode;
      status: DecisionListStatus;
      tags: readonly DecisionTag[];
      text: string;
    }
  | {
      command: "show-candidate";
      decisionId: string;
      location: DecisionLocation;
    }
  | {
      command: "show";
      decisionId: string;
      location: DecisionLocation;
    }
  | {
      command: "sync-index";
      location: DecisionLocation;
      selectors?: readonly string[];
      write: boolean;
    }
  | {
      command: "trace";
      decisionId: string;
      direction: DecisionTraceDirection;
      location: DecisionLocation;
      maxDepth: number | null;
    };

type QuerySuccessBase = {
  status: "ok";
  warnings: string[];
};

export type IndexedDecisionRecord = {
  alignment: DecisionAlignment | null;
  createdAt: string;
  decisionId: DecisionId;
  projection: DecisionProjection;
  sourcePath: DecisionSourcePath;
  status: EstablishedDecisionStatus;
  tags: DecisionTag[];
};

export type CandidateDecisionRecord = {
  alignment: null;
  bodyReady: boolean;
  createdAt: null;
  decisionId: DecisionId;
  projection: DecisionProjection;
  sourcePath: DecisionSourcePath;
  scaffoldValid: true;
  status: "candidate";
  tags: DecisionTag[];
};

export type DecisionQuerySuccess =
  | (QuerySuccessBase & {
      command: "candidates";
      records: CandidateDecisionRecord[];
    })
  | (QuerySuccessBase & {
      command: "check";
      summary: Pick<
        DecisionValidationResult,
        | "activeCount"
        | "activationCandidateCount"
        | "bodyReadyCandidateCount"
        | "alignedCount"
        | "archivedCount"
        | "decisionCount"
        | "scaffoldCandidateCount"
        | "unalignedCount"
      >;
    })
  | (QuerySuccessBase & {
      command: "list";
      fullTime: boolean;
      records: IndexedDecisionRecord[];
    })
  | (QuerySuccessBase & {
      command: "search";
      records: DecisionSearchRecord[];
      truncation: FileTextSearchTruncation;
    })
  | (QuerySuccessBase & {
      body: string;
      command: "show-candidate";
      record: CandidateDecisionRecord;
    })
  | (QuerySuccessBase & {
      body: string;
      command: "show";
      record: IndexedDecisionRecord;
    })
  | (QuerySuccessBase & {
      changedIds: string[];
      command: "sync-index";
      indexRelativePath: string;
      scope: "all" | "selected";
      selectedIds: string[];
      selectors: string[];
      state: "current" | "unchanged" | "written";
      unactivatedPaths: string[];
    })
  | (QuerySuccessBase & {
      command: "trace";
      edges: DecisionRelationEdge[];
      records: IndexedDecisionRecord[];
    });

export type DecisionQueryResult =
  | DecisionApplicationFailure
  | DecisionQuerySuccess;

type IndexedDecisionState = Pick<DecisionIndexEntry, "state"> & {
  id: string;
};

export async function executeDecisionQuery(
  request: DecisionQueryRequest
): Promise<DecisionQueryResult> {
  switch (request.command) {
    case "candidates":
      return await listDecisionCandidates(request.location);
    case "check":
      return await checkDecisionRecords(request.location);
    case "list":
      return await listDecisionRecords(request);
    case "search":
      return await searchDecisionRecords(request);
    case "show":
      return await showDecisionRecord(request);
    case "show-candidate":
      return await showDecisionCandidate(request);
    case "sync-index":
      return await synchronizeDecisionIndex(request);
    case "trace":
      return await traceDecisionRecord(request);
  }
}

async function listDecisionCandidates(
  location: DecisionLocation
): Promise<DecisionQueryResult> {
  const context = await loadCandidateQueryContext(location);
  if (context.status === "error") {
    return context;
  }
  return {
    command: "candidates",
    records: candidateRecords(context.scan),
    status: "ok",
    warnings: context.warnings
  };
}

async function checkDecisionRecords(
  location: DecisionLocation
): Promise<DecisionQueryResult> {
  const { result } = await loadDecisionValidationContext(
    decisionScanOptions(location),
    { allowEmptyDecisionSet: true }
  );
  if (result.errors.length > 0) {
    return decisionFailure(result.errors);
  }
  return {
    command: "check",
    status: "ok",
    summary: {
      activeCount: result.activeCount,
      activationCandidateCount: result.activationCandidateCount,
      bodyReadyCandidateCount: result.bodyReadyCandidateCount,
      alignedCount: result.alignedCount,
      archivedCount: result.archivedCount,
      decisionCount: result.decisionCount,
      scaffoldCandidateCount: result.scaffoldCandidateCount,
      unalignedCount: result.unalignedCount
    },
    warnings: []
  };
}

async function listDecisionRecords(
  request: Extract<DecisionQueryRequest, { command: "list" }>
): Promise<DecisionQueryResult> {
  const context = await loadDecisionQueryContext(request.location);
  if (context.status === "error") {
    return context;
  }
  const queried = context.reader.all({
    filters: listFilters(request),
    sort: [{ direction: "asc", key: "id" }]
  });
  if (queried.status === "error") {
    return indexFailure(queried, context.indexRelativePath);
  }
  return {
    command: "list",
    fullTime: request.fullTime,
    records: indexedRecords(queried.value),
    status: "ok",
    warnings: []
  };
}

export type DecisionSearchRecord = IndexedDecisionRecord & {
  previews: readonly FileTextSearchPreview[];
};

type DecisionSearchSnapshot = {
  entries: readonly IndexedDecisionRecord[];
  sourcePathToRecord: ReadonlyMap<DecisionSourcePath, IndexedDecisionRecord>;
  warnings: string[];
};

const decisionSearchPreviewPolicy = {
  contextLines: 1,
  maxFiles: 20,
  maxMatchesPerFile: 3,
  maxPreviewCharacters: 12_000
} as const;

async function searchDecisionRecords(
  request: Extract<DecisionQueryRequest, { command: "search" }>
): Promise<DecisionQueryResult> {
  const snapshot = await loadDecisionSearchSnapshot(request.location);
  if (snapshot.status === "error") return snapshot.failure;
  const selected = filterSearchRecords(snapshot.value.entries, request);
  try {
    const searched = await searchFileText({
      preview: decisionSearchPreviewPolicy,
      query: { mode: request.match, text: request.text },
      root: resolveDecisionLocation(request.location).decisionsDirectory,
      selection: {
        kind: "files",
        sourcePaths: selected.map((record) => record.sourcePath)
      }
    });
    const records: DecisionSearchRecord[] = [];
    for (const hit of searched.hits) {
      const record = snapshot.value.sourcePathToRecord.get(
        hit.sourcePath as DecisionSourcePath
      );
      if (record === undefined) {
        return decisionFailure([
          decisionDiagnostic({
            code: "decision-records.search-source-unmapped",
            reason:
              "A searched Decision source path does not map to one indexed Decision ID: " +
              hit.sourcePath,
            recovery:
              "Correct the Decision source and index mapping, then retry the search.",
            target: hit.sourcePath
          })
        ]);
      }
      records.push({ ...record, previews: hit.previews });
    }
    return {
      command: "search",
      records,
      status: "ok",
      truncation: searched.truncation,
      warnings: [
        ...snapshot.value.warnings,
        ...searchTruncationWarnings(searched.truncation)
      ]
    };
  } catch (error) {
    return searchFileFailure(error);
  }
}

async function loadDecisionSearchSnapshot(
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
    if (current.status === "ok") {
      const checked = await syncDecisionIndex({
        decisionsDirectory,
        mode: "check"
      });
      if (checked.status === "ok") {
        const records = Object.entries(current.value.entries)
          .map(([id, entry]) => indexedRecord({ id, state: entry.state }))
          .sort((left, right) =>
            left.sourcePath.localeCompare(right.sourcePath)
          );
        const mapped = decisionSearchMap(records);
        if (mapped.status === "error") return mapped;
        return {
          status: "ok",
          value: {
            entries: records,
            sourcePathToRecord: mapped.value,
            warnings: []
          }
        };
      }
    }
  }

  const { result } = await loadDecisionValidationContext(
    decisionScanOptions(location),
    {
      allowEmptyDecisionSet: true,
      checkIndexText: false,
      scanErrorPolicy: "source-only"
    }
  );
  if (result.errors.length > 0) {
    return {
      failure: sourceFailure(result.errors, "Decision search source"),
      status: "error"
    };
  }
  const records: IndexedDecisionRecord[] = result.scan.records
    .flatMap((record): IndexedDecisionRecord[] => {
      if (
        !isEstablishedDecisionRecord(record) ||
        (record.status !== "active" && record.status !== "archived") ||
        record.createdAt === null
      ) {
        return [];
      }
      return [
        {
          alignment: record.alignment,
          createdAt: record.createdAt,
          decisionId: record.decisionId,
          projection: record.projection,
          sourcePath: record.sourcePath,
          status: record.status,
          tags: [...record.tags]
        }
      ];
    })
    .sort((left, right) => left.sourcePath.localeCompare(right.sourcePath));
  const mapped = decisionSearchMap(records);
  if (mapped.status === "error") return mapped;
  return {
    status: "ok",
    value: {
      entries: records,
      sourcePathToRecord: mapped.value,
      warnings: [
        "The persisted Decision index was unavailable or stale; searched a read-only validated Decision source projection instead."
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
    if (sourcePathToRecord.has(record.sourcePath)) {
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
    }
    sourcePathToRecord.set(record.sourcePath, record);
  }
  return { status: "ok", value: sourcePathToRecord };
}

function filterSearchRecords(
  records: readonly IndexedDecisionRecord[],
  request: Pick<
    Extract<DecisionQueryRequest, { command: "search" }>,
    "alignment" | "status" | "tags"
  >
): IndexedDecisionRecord[] {
  return records.filter(
    (record) =>
      (request.status === "all" || record.status === request.status) &&
      (request.alignment === "all" || record.alignment === request.alignment) &&
      request.tags.every((tag) => record.tags.includes(tag))
  );
}

function searchTruncationWarnings(
  truncation: FileTextSearchTruncation
): string[] {
  const warnings: string[] = [];
  if (truncation.files)
    warnings.push("Decision search result file limit was reached.");
  if (truncation.matches)
    warnings.push("Decision search match preview limit was reached.");
  if (truncation.previewCharacters) {
    warnings.push("Decision search preview character limit was reached.");
  }
  return warnings;
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

async function showDecisionRecord(
  request: Extract<DecisionQueryRequest, { command: "show" }>
): Promise<DecisionQueryResult> {
  const context = await loadDecisionQueryContext(request.location);
  if (context.status === "error") {
    return context;
  }
  const resolved = resolveIndexedDecisionSelector(
    context,
    request.decisionId,
    "Established decision"
  );
  if (resolved.status === "error") return resolved.failure;
  const record = resolved.record;
  const body = await readDecisionBody(context.decisionsDirectory, record);
  return body.status === "error"
    ? body
    : {
        body: body.value,
        command: "show",
        record,
        status: "ok",
        warnings: []
      };
}

async function showDecisionCandidate(
  request: Extract<DecisionQueryRequest, { command: "show-candidate" }>
): Promise<DecisionQueryResult> {
  const context = await loadCandidateQueryContext(request.location);
  if (context.status === "error") {
    return context;
  }
  const resolved = resolveCandidateDecisionSelector(
    context.scan,
    request.decisionId
  );
  if (resolved.status === "error") return resolved.failure;
  const record = resolved.record;
  if (record === null) {
    const normalized = normalizeDecisionSelectorInput(request.decisionId);
    const sourceRecord = context.scan.records.find(
      (candidate) =>
        candidate.markdownExists &&
        (parseDatedDecisionId(normalized)?.id === candidate.decisionId ||
          (parseDatedDecisionId(normalized) === null &&
            isDecisionId(candidate.decisionId) &&
            decisionNameFromId(candidate.decisionId) === normalized))
    );
    if (sourceRecord !== undefined) {
      return decisionFailure(
        [
          "Decision source is not a valid candidate scaffold: " +
            sourceRecord.decisionId,
          ...sourceWarningsForRecord(context.warnings, sourceRecord)
        ],
        { presentation: "plain" }
      );
    }
    return decisionFailure(
      [
        decisionDiagnostic({
          code: "decision-records.candidate-not-found",
          reason: "Decision candidate does not exist: " + request.decisionId,
          recovery:
            "Use candidates to choose a valid candidate Decision ID or unique name, then retry the command.",
          target: request.decisionId
        })
      ],
      { presentation: "plain" }
    );
  }
  const body = await readDecisionBody(context.scan.decisionsDirectory, record);
  return body.status === "error"
    ? body
    : {
        body: body.value,
        command: "show-candidate",
        record,
        status: "ok",
        warnings: context.warnings
      };
}

async function traceDecisionRecord(
  request: Extract<DecisionQueryRequest, { command: "trace" }>
): Promise<DecisionQueryResult> {
  const context = await loadDecisionQueryContext(request.location);
  if (context.status === "error") {
    return context;
  }
  const resolved = resolveIndexedDecisionSelector(
    context,
    request.decisionId,
    "Established decision"
  );
  if (resolved.status === "error") return resolved.failure;
  const queried = context.reader.all({
    sort: [{ direction: "asc", key: "id" }]
  });
  if (queried.status === "error") {
    return indexFailure(queried, context.indexRelativePath);
  }
  const records = indexedRecords(queried.value);
  const trace = traceDecisionRelations(
    records.map((record) => ({
      decisionId: record.decisionId,
      projection: record.projection,
      sourcePath: record.sourcePath,
      status: record.status
    })),
    resolved.record.decisionId,
    {
      direction: request.direction,
      maxDepth: request.maxDepth
    }
  );
  return {
    command: "trace",
    edges: trace.edges,
    records: records
      .filter((record) => trace.decisionIds.has(record.decisionId))
      .sort((left, right) => left.sourcePath.localeCompare(right.sourcePath)),
    status: "ok",
    warnings: []
  };
}

async function synchronizeDecisionIndex(
  request: Extract<DecisionQueryRequest, { command: "sync-index" }>
): Promise<DecisionQueryResult> {
  const { decisionsDirectory } = resolveDecisionLocation(request.location);
  try {
    return await withDecisionCollectionMutationLock(
      path.join(decisionsDirectory, decisionIndexFileName),
      async () => await synchronizeLockedDecisionIndex(request)
    );
  } catch (error) {
    return collectionLockFailure(error);
  }
}

async function synchronizeLockedDecisionIndex(
  request: Extract<DecisionQueryRequest, { command: "sync-index" }>
): Promise<DecisionQueryResult> {
  const { result } = await loadDecisionValidationContext(
    decisionScanOptions(request.location),
    { checkIndexText: false }
  );
  const sourceValidation = await validateDecisionScan(result.scan, {
    checkIndexText: false,
    scanErrorPolicy: "source-only"
  });
  if (sourceValidation.errors.length > 0) {
    return syncIndexNoChange(decisionFailure(sourceValidation.errors));
  }
  const selection = selectEstablishedDecisionIds(result.scan);
  if (selection.errors.length > 0) {
    return syncIndexNoChange(decisionFailure(selection.errors));
  }
  const scope = await selectedDecisionSyncScope({
    candidateIds: selection.decisionIds,
    decisionsDirectory: result.scan.decisionsDirectory,
    indexPath: result.scan.indexRelativePath,
    selectors: request.selectors
  });
  if (scope.status === "error") return syncIndexNoChange(scope.failure);
  const selected = request.selectors !== undefined;
  const synchronized = await syncDecisionIndex({
    decisionsDirectory: result.scan.decisionsDirectory,
    mode: selected && !request.write ? "check" : "write",
    ...(scope.value === undefined ? {} : { scope: scope.value })
  });
  if (synchronized.status === "error") {
    return syncIndexNoChange(
      decisionFailure(
        decisionIndexDiagnostics(synchronized.diagnostics, {
          code: "decision-records.sync-index-failed",
          recovery:
            "Inspect the decision collection and derived index, then retry the command.",
          target: result.scan.indexRelativePath
        })
      )
    );
  }
  return {
    command: "sync-index",
    changedIds: synchronized.changedIds,
    indexRelativePath: result.scan.indexRelativePath,
    scope: synchronized.scope,
    selectedIds: synchronized.selectedIds,
    selectors: request.selectors === undefined ? [] : [...request.selectors],
    state: synchronized.state,
    status: "ok",
    unactivatedPaths: activationCandidates(result.scan).map(
      (record) => record.sourcePath
    ),
    warnings: []
  };
}

async function selectedDecisionSyncScope(options: {
  candidateIds: readonly string[];
  decisionsDirectory: string;
  indexPath: string;
  selectors: readonly string[] | undefined;
}): Promise<
  | Readonly<{ status: "ok"; value: StateIndexSyncScope | undefined }>
  | Readonly<{ failure: DecisionApplicationFailure; status: "error" }>
> {
  if (options.selectors === undefined)
    return { status: "ok", value: undefined };
  const rawValidation = validateDecisionSyncSelectors(options.selectors);
  if (rawValidation.status === "error") return rawValidation;
  const baseline = await loadDecisionIndex({
    decisionsDirectory: options.decisionsDirectory,
    indexPath: decisionIndexFileName
  });
  if (baseline.status === "error") {
    // Let the runtime report its strict selected-baseline diagnostic before a
    // name can be resolved. Standard IDs and names are both valid opaque IDs
    // at this shared boundary, and no candidate can be accepted on this path.
    return {
      status: "ok",
      value: { kind: "selected", selectedIds: rawValidation.selectors }
    };
  }
  const ids = new Set([
    ...Object.keys(baseline.value.entries),
    ...options.candidateIds
  ]);
  const selectedIds: string[] = [];
  const failures: DecisionApplicationFailure[] = [];
  for (const selector of rawValidation.selectors) {
    const normalized = normalizeDecisionSelectorInput(selector);
    const dated = parseDatedDecisionId(normalized);
    const matches =
      dated === null
        ? [...ids]
            .filter(
              (id) => isDecisionId(id) && decisionNameFromId(id) === normalized
            )
            .sort(compareText)
        : ids.has(dated.id)
          ? [dated.id]
          : [];
    if (matches.length === 1) {
      selectedIds.push(matches[0]!);
      continue;
    }
    failures.push(
      decisionFailure([
        decisionDiagnostic({
          code:
            matches.length === 0
              ? "decision-records.selector-not-found"
              : "decision-records.selector-ambiguous",
          reason:
            matches.length === 0
              ? `Decision selector does not resolve in the baseline or current collection: ${normalized}`
              : `Decision name is ambiguous: ${normalized}; choose one standard ID: ${matches.join(", ")}`,
          recovery:
            matches.length === 0
              ? "Use an existing Decision ID or a unique name, then retry the selected sync."
              : "Retry with one listed calendar-valid YYMMDD-name Decision ID.",
          target: normalized
        })
      ])
    );
  }
  if (failures.length > 0) {
    return { failure: mergeDecisionFailures(failures), status: "error" };
  }
  if (new Set(selectedIds).size !== selectedIds.length) {
    return {
      failure: decisionFailure([
        decisionDiagnostic({
          code: "decision-records.selector-duplicate",
          reason:
            "Selected Decision selectors resolve to the same Decision ID.",
          recovery:
            "Select every Decision ID at most once, then retry the selected sync.",
          target: options.indexPath
        })
      ]),
      status: "error"
    };
  }
  return {
    status: "ok",
    value: { kind: "selected", selectedIds: selectedIds.sort(compareText) }
  };
}

function validateDecisionSyncSelectors(
  selectors: readonly string[]
):
  | Readonly<{ selectors: string[]; status: "ok" }>
  | Readonly<{ failure: DecisionApplicationFailure; status: "error" }> {
  const seen = new Set<string>();
  const failures: DecisionApplicationFailure[] = [];
  for (const selector of selectors) {
    if (typeof selector !== "string" || !isStateIndexText(selector)) {
      failures.push(
        decisionFailure([
          decisionDiagnostic({
            code: "decision-records.selector-invalid",
            reason:
              "Selected Decision selectors must be non-empty text without surrounding whitespace or control characters.",
            recovery:
              "Provide a standard Decision ID or unique name, then retry.",
            target:
              typeof selector === "string" ? selector : "<invalid-selector>"
          })
        ])
      );
      continue;
    }
    if (seen.has(selector)) {
      failures.push(
        decisionFailure([
          decisionDiagnostic({
            code: "decision-records.selector-duplicate",
            reason: `Selected Decision selector appears more than once: ${selector}`,
            recovery: "Select every raw selector at most once, then retry.",
            target: selector
          })
        ])
      );
      continue;
    }
    seen.add(selector);
  }
  return failures.length === 0
    ? { selectors: [...selectors], status: "ok" }
    : { failure: mergeDecisionFailures(failures), status: "error" };
}

function mergeDecisionFailures(
  failures: readonly DecisionApplicationFailure[]
): DecisionApplicationFailure {
  return decisionFailure(failures.flatMap((failure) => failure.diagnostics));
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function syncIndexNoChange(
  failure: DecisionApplicationFailure
): DecisionApplicationFailure {
  return {
    ...failure,
    diagnostics: failure.diagnostics.map((diagnostic) => ({
      ...diagnostic,
      outcome: "no-change" as const,
      scope: "Derived decision index"
    }))
  };
}

function listFilters(
  request: Extract<DecisionQueryRequest, { command: "list" }>
): StateIndexFilter[] {
  const filters: StateIndexFilter[] = [];
  for (const [key, value] of [
    ["status", request.status],
    ["alignment", request.alignment]
  ] as const) {
    if (value !== "all") {
      filters.push({ key, kind: "exact", operator: "all", values: [value] });
    }
  }
  if (request.tags.length > 0) {
    filters.push({
      key: "tag",
      kind: "exact",
      operator: "all",
      values: [...request.tags]
    });
  }
  return filters;
}

function indexedRecords(
  entries: readonly IndexedDecisionState[]
): IndexedDecisionRecord[] {
  return entries.map(indexedRecord);
}

function indexedRecord(entry: IndexedDecisionState): IndexedDecisionRecord {
  const state = entry.state;
  if (!isDecisionId(entry.id)) {
    throw new TypeError("indexed decision entry uses an invalid Decision ID");
  }
  const projection = {
    title: state.title,
    purpose: state.purpose,
    background: state.background,
    decision: state.decision,
    relations: state.relations.map(({ type, target }) => ({ type, target }))
  };
  return {
    alignment: state.alignment,
    createdAt: state.createdAt,
    decisionId: entry.id,
    projection,
    sourcePath: state.sourcePath,
    status: state.status,
    tags: [...state.tags]
  };
}

function activationCandidates(scan: DecisionScan): DecisionCandidateRecord[] {
  return scan.records
    .filter(isActivationCandidateRecord)
    .sort(compareDecisionRecords);
}

function candidateRecords(scan: DecisionScan): CandidateDecisionRecord[] {
  return scan.records
    .filter(isDecisionCandidateRecord)
    .sort(compareDecisionRecords)
    .filter((record) => record.relationshipErrors.length === 0)
    .map((record) => ({
      alignment: null,
      bodyReady: record.bodyReady,
      createdAt: null,
      decisionId: record.decisionId,
      projection: record.projection,
      sourcePath: record.sourcePath,
      scaffoldValid: true,
      status: "candidate",
      tags: [...record.tags]
    }));
}

async function loadCandidateQueryContext(location: DecisionLocation): Promise<
  | DecisionApplicationFailure
  | {
      scan: DecisionScan;
      status: "ok";
      warnings: string[];
    }
> {
  const scan = await scanDecisionRecords(decisionScanOptions(location));
  if (!scan.decisionsDirectoryAvailable) {
    return sourceFailure(scan.sourceErrors, "Decision collection");
  }
  if (scan.collectionErrors.length > 0) {
    return sourceFailure(scan.collectionErrors, "Decision collection");
  }
  const hasEstablishedRecord = scan.records.some(
    (record) => record.source.kind === "established"
  );
  const indexProblem = await candidateQueryIndexFailure(
    scan,
    hasEstablishedRecord
  );
  if (indexProblem !== null) return indexProblem;
  return {
    scan,
    status: "ok",
    warnings: scan.sourceErrors.filter(
      (error) => !scan.collectionErrors.includes(error)
    )
  };
}

async function candidateQueryIndexFailure(
  scan: DecisionScan,
  hasEstablishedRecord: boolean
): Promise<DecisionApplicationFailure | null> {
  if (
    scan.indexErrors.length > 0 &&
    (hasEstablishedRecord || scan.indexExists)
  ) {
    return indexFailure(
      { diagnostics: [] },
      scan.indexRelativePath,
      scan.indexErrors
    );
  }
  if (!hasEstablishedRecord && scan.indexExists) {
    return indexFailure({ diagnostics: [] }, scan.indexRelativePath, [
      scan.indexRelativePath +
        " must be absent until the first established decision is indexed"
    ]);
  }
  if (hasEstablishedRecord) {
    const selection = selectEstablishedDecisionIds(scan);
    if (selection.errors.length > 0) {
      return sourceFailure(selection.errors, "Established decision selection");
    }
    const checked = await syncDecisionIndex({
      decisionsDirectory: scan.decisionsDirectory,
      mode: "check"
    });
    if (checked.status === "error") {
      return checked.state === "index-invalid" ||
        checked.state === "index-missing" ||
        checked.state === "index-stale"
        ? indexFailure({ diagnostics: [] }, scan.indexRelativePath, [
            scan.indexRelativePath + " is out of sync; run sync-index"
          ])
        : indexFailure(checked, scan.indexRelativePath);
    }
  }
  return null;
}

function sourceWarningsForRecord(
  warnings: readonly string[],
  record: DecisionRecord
): string[] {
  return [
    ...new Set([
      ...warnings.filter((warning) =>
        warning.startsWith(record.sourcePath + " ")
      ),
      ...record.relationshipErrors
    ])
  ];
}

function indexFailure(
  result: {
    diagnostics: readonly StateIndexDiagnostic[];
  },
  indexRelativePath: string,
  additionalReasons: readonly string[] = []
): DecisionApplicationFailure {
  return decisionFailure([
    ...decisionIndexDiagnostics(result.diagnostics, {
      code: "decision-records.index-query-failed",
      recovery:
        "Run sync-index after correcting the decision Markdown or index problem.",
      target: indexRelativePath
    }),
    ...additionalReasons.map((reason) =>
      decisionDiagnosticFromReason(
        {
          code: "decision-records.index-query-failed",
          recovery:
            "Run sync-index after correcting the decision Markdown or index problem.",
          target: indexRelativePath
        },
        reason
      )
    )
  ]);
}

function sourceFailure(
  reasons: readonly string[],
  target: string
): DecisionApplicationFailure {
  return decisionFailure(
    reasons.map((reason) =>
      decisionDiagnosticFromReason(
        {
          code: "decision-records.source-scan-failed",
          recovery:
            "Restore a readable, valid decision source collection, then retry the command.",
          target
        },
        reason
      )
    )
  );
}

function collectionLockFailure(error: unknown): DecisionApplicationFailure {
  if (error instanceof DecisionCollectionLockError) {
    const operationResult = asDecisionQueryResult(error.operationResult);
    if (
      error.kind === "release-failed" &&
      operationResult?.status === "error"
    ) {
      const diagnostic = collectionLockDiagnostic(error, "no-change");
      return {
        ...operationResult,
        diagnostics: [...operationResult.diagnostics, diagnostic],
        errors: [...operationResult.errors, diagnostic.reason]
      };
    }
    const outcome =
      error.kind === "release-failed" &&
      operationResult?.status === "ok" &&
      operationResult.command === "sync-index" &&
      operationResult.state === "written"
        ? "committed-cleanup-pending"
        : "no-change";
    return decisionFailure([collectionLockDiagnostic(error, outcome)]);
  }
  return decisionFailure([
    decisionDiagnostic({
      code: "decision-records.sync-index-failed",
      outcome: "no-change",
      reason: "Decision index synchronization could not start.",
      recovery:
        "Inspect the decision collection and derived index, then retry the command.",
      scope: "Derived decision index",
      target: "Decision index synchronization"
    })
  ]);
}

async function readDecisionBody(
  decisionsDirectory: string,
  record: CandidateDecisionRecord | IndexedDecisionRecord
): Promise<DecisionApplicationFailure | { status: "ok"; value: string }> {
  try {
    const sourceFilePath = path.join(
      decisionsDirectory,
      ...record.sourcePath.split("/")
    );
    const entry = await fs.lstat(sourceFilePath);
    if (entry.isSymbolicLink() || !entry.isFile()) {
      throw new Error("must be a regular non-symbolic-link file");
    }
    const markdown = await fs.readFile(sourceFilePath, "utf8");
    if (decisionIdFromMarkdown(markdown) !== record.decisionId) {
      throw new Error(
        "frontmatter Decision ID does not match the requested ID"
      );
    }
    return {
      status: "ok",
      value: markdown
    };
  } catch (error) {
    return decisionFailure([
      decisionFileSystemDiagnostic(
        {
          code: "decision-records.decision-body-unavailable",
          reason: "Failed to read decision body " + record.sourcePath + ".",
          recovery:
            "Restore a readable regular decision Markdown file, then retry the command.",
          target: record.sourcePath
        },
        error
      )
    ]);
  }
}

function collectionLockDiagnostic(
  error: DecisionCollectionLockError,
  outcome: "committed-cleanup-pending" | "no-change"
) {
  return decisionDiagnostic({
    ...(error.kind === "access-denied"
      ? { causeCategory: "access-denied" as const }
      : error.kind === "busy"
        ? { causeCategory: "busy" as const }
        : {}),
    code: "decision-records.collection-lock-" + error.kind,
    outcome,
    reason:
      error.kind === "release-failed"
        ? "Decision index synchronization finished, but its collection lock could not be released."
        : "Decision index synchronization could not acquire its collection lock.",
    recovery:
      error.kind === "busy"
        ? "Wait for or confirm the active transaction; only if none is active, inspect the remaining lock before retrying."
        : error.kind === "access-denied"
          ? "Grant the current process access to the decision collection, then retry the command."
          : error.kind === "release-failed"
            ? "Inspect the derived index result and the remaining lock before running another mutation."
            : "Inspect the decision collection lock and its parent directory, then retry the command.",
    scope: "Derived decision index",
    target: "Decision collection mutation lock"
  });
}

function asDecisionQueryResult(value: unknown): DecisionQueryResult | null {
  if (value === null || typeof value !== "object" || !("status" in value)) {
    return null;
  }
  const result = value as Partial<DecisionQueryResult>;
  if (result.status === "error" && Array.isArray(result.diagnostics)) {
    return result as DecisionApplicationFailure;
  }
  if (result.status === "ok" && typeof result.command === "string") {
    return result as DecisionQuerySuccess;
  }
  return null;
}

function resolveIndexedDecisionSelector(
  context: Extract<
    Awaited<ReturnType<typeof loadDecisionQueryContext>>,
    { status: "ok" }
  >,
  selector: string,
  label: string
):
  | { record: IndexedDecisionRecord; status: "ok" }
  | { failure: DecisionApplicationFailure; status: "error" } {
  const normalized = normalizeDecisionSelectorInput(selector);
  const dated = parseDatedDecisionId(normalized);
  if (dated !== null) {
    const matched = context.reader.get(dated.id);
    if (matched.status === "error") {
      return {
        failure: indexFailure(matched, context.indexRelativePath),
        status: "error"
      };
    }
    return matched.value === null
      ? { failure: selectorNotFound(label, normalized), status: "error" }
      : { record: indexedRecord(matched.value), status: "ok" };
  }
  const matched = context.reader.all({
    filters: [
      { key: "name", kind: "exact", operator: "all", values: [normalized] }
    ],
    sort: [{ direction: "asc", key: "id" }]
  });
  if (matched.status === "error") {
    return {
      failure: indexFailure(matched, context.indexRelativePath),
      status: "error"
    };
  }
  if (matched.value.length === 0) {
    return { failure: selectorNotFound(label, normalized), status: "error" };
  }
  if (matched.value.length > 1) {
    return {
      failure: decisionFailure(
        [
          decisionDiagnostic({
            code: "decision-records.decision-ambiguous",
            reason:
              `${label} name is ambiguous: ${normalized}; choose one standard ID: ` +
              matched.value.map((entry) => entry.id).join(", "),
            recovery:
              "Retry with one listed calendar-valid YYMMDD-name Decision ID.",
            target: normalized
          })
        ],
        { presentation: "plain" }
      ),
      status: "error"
    };
  }
  return { record: indexedRecord(matched.value[0]!), status: "ok" };
}

function resolveCandidateDecisionSelector(
  scan: DecisionScan,
  selector: string
):
  | { record: CandidateDecisionRecord | null; status: "ok" }
  | { failure: DecisionApplicationFailure; status: "error" } {
  const normalized = normalizeDecisionSelectorInput(selector);
  const dated = parseDatedDecisionId(normalized);
  const candidates = candidateRecords(scan);
  const matches =
    dated === null
      ? candidates.filter(
          (candidate) => decisionNameFromId(candidate.decisionId) === normalized
        )
      : candidates.filter((candidate) => candidate.decisionId === dated.id);
  if (matches.length === 0) return { record: null, status: "ok" };
  if (matches.length === 1) return { record: matches[0]!, status: "ok" };
  return {
    failure: decisionFailure(
      [
        decisionDiagnostic({
          code: "decision-records.candidate-ambiguous",
          reason:
            `Decision candidate name is ambiguous: ${normalized}; choose one standard ID: ` +
            matches
              .map((candidate) => candidate.decisionId)
              .sort()
              .join(", "),
          recovery:
            "Retry with one listed calendar-valid YYMMDD-name Decision ID.",
          target: normalized
        })
      ],
      { presentation: "plain" }
    ),
    status: "error"
  };
}

function selectorNotFound(
  label: string,
  selector: string
): DecisionApplicationFailure {
  return decisionFailure(
    [
      decisionDiagnostic({
        code: "decision-records.decision-not-found",
        reason: `${label} does not exist: ${selector}`,
        recovery:
          "Use list to choose a Decision ID or unique name, then retry the command.",
        target: selector
      })
    ],
    { presentation: "plain" }
  );
}
