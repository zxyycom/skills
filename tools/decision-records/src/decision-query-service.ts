import fs from "node:fs/promises";
import path from "node:path";
import { type StateIndexFilter } from "../../index-runtime/src/index.ts";
import {
  decisionFailure,
  type DecisionApplicationFailure
} from "./application-result.ts";
import {
  decisionIndexDiagnosticMessages,
  decisionIndexFileName,
  syncDecisionIndex
} from "./decision-state-index.ts";
import { withDecisionCollectionMutationLock } from "./decision-collection-mutation-lock.ts";
import { isDecisionId } from "./decision-path.ts";
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
      command: "show-candidate";
      decisionId: DecisionId;
      location: DecisionLocation;
    }
  | {
      command: "show";
      decisionId: DecisionId;
      location: DecisionLocation;
    }
  | {
      command: "sync-index";
      location: DecisionLocation;
    }
  | {
      command: "trace";
      decisionId: DecisionId;
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
  createdAt: null;
  decisionId: DecisionId;
  projection: DecisionProjection;
  sourcePath: DecisionSourcePath;
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
        | "alignedCount"
        | "archivedCount"
        | "decisionCount"
        | "unalignedCount"
      >;
    })
  | (QuerySuccessBase & {
      command: "list";
      fullTime: boolean;
      records: IndexedDecisionRecord[];
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
      command: "sync-index";
      indexRelativePath: string;
      state: "current" | "written";
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
    decisionScanOptions(location)
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
      alignedCount: result.alignedCount,
      archivedCount: result.archivedCount,
      decisionCount: result.decisionCount,
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

async function showDecisionRecord(
  request: Extract<DecisionQueryRequest, { command: "show" }>
): Promise<DecisionQueryResult> {
  if (!isDecisionId(request.decisionId)) {
    return decisionFailure(["Decision ID is invalid: " + request.decisionId], {
      exitCode: 2,
      presentation: "plain"
    });
  }
  const context = await loadDecisionQueryContext(request.location);
  if (context.status === "error") {
    return context;
  }
  const matched = context.reader.get(request.decisionId);
  if (matched.status === "error") {
    return indexFailure(matched, context.indexRelativePath);
  }
  const record = matched.value === null ? null : indexedRecord(matched.value);
  if (record === null) {
    return decisionFailure(
      ["Established decision does not exist: " + request.decisionId],
      { presentation: "plain" }
    );
  }
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
  if (!isDecisionId(request.decisionId)) {
    return decisionFailure(["Decision ID is invalid: " + request.decisionId], {
      exitCode: 2,
      presentation: "plain"
    });
  }
  const context = await loadCandidateQueryContext(request.location);
  if (context.status === "error") {
    return context;
  }
  const record =
    candidateRecords(context.scan).find(
      (candidate) => candidate.decisionId === request.decisionId
    ) ?? null;
  if (record === null) {
    const sourceRecord =
      context.scan.records.find(
        (candidate) =>
          candidate.decisionId === request.decisionId &&
          candidate.markdownExists
      ) ?? null;
    const targetWarnings =
      sourceRecord === null
        ? []
        : sourceWarningsForRecord(context.warnings, sourceRecord);
    return decisionFailure(
      sourceRecord === null
        ? ["Decision candidate does not exist: " + request.decisionId]
        : [
            "Decision source is not a valid reviewable candidate: " +
              request.decisionId,
            ...targetWarnings
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
  if (!isDecisionId(request.decisionId)) {
    return decisionFailure(["Decision ID is invalid: " + request.decisionId], {
      exitCode: 2,
      presentation: "plain"
    });
  }
  const context = await loadDecisionQueryContext(request.location);
  if (context.status === "error") {
    return context;
  }
  const matched = context.reader.get(request.decisionId);
  if (matched.status === "error") {
    return indexFailure(matched, context.indexRelativePath);
  }
  if (matched.value === null) {
    return decisionFailure(
      ["Established decision does not exist: " + request.decisionId],
      { presentation: "plain" }
    );
  }
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
    request.decisionId,
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
    return decisionFailure([
      "Decision index synchronization could not start: " +
        errorText(error) +
        ". No files were written."
    ]);
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
    return decisionFailure(sourceValidation.errors);
  }
  const selection = selectEstablishedDecisionIds(result.scan);
  if (selection.errors.length > 0) {
    return decisionFailure(selection.errors);
  }
  const synchronized = await syncDecisionIndex({
    decisionsDirectory: result.scan.decisionsDirectory,
    mode: "write",
    decisionIds: selection.decisionIds
  });
  if (synchronized.status === "error") {
    return decisionFailure(
      decisionIndexDiagnosticMessages(
        synchronized.diagnostics,
        result.scan.indexRelativePath
      )
    );
  }
  return {
    command: "sync-index",
    indexRelativePath: result.scan.indexRelativePath,
    state: synchronized.state === "written" ? "written" : "current",
    status: "ok",
    unactivatedPaths: activationCandidates(result.scan).map(
      (record) => record.sourcePath
    ),
    warnings: []
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
  return activationCandidates(scan)
    .filter((record) => record.relationshipErrors.length === 0)
    .map((record) => ({
      alignment: null,
      createdAt: null,
      decisionId: record.decisionId,
      projection: record.projection,
      sourcePath: record.sourcePath,
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
    return decisionFailure(scan.sourceErrors);
  }
  if (scan.collectionErrors.length > 0) {
    return decisionFailure(scan.collectionErrors);
  }
  const hasEstablishedRecord = scan.records.some(
    (record) => record.source.kind === "established"
  );
  if (
    scan.indexErrors.length > 0 &&
    (hasEstablishedRecord || scan.indexExists)
  ) {
    return decisionFailure(scan.indexErrors);
  }
  if (!hasEstablishedRecord && scan.indexExists) {
    return decisionFailure([
      scan.indexRelativePath +
        " must be absent until the first established decision is indexed"
    ]);
  }
  if (hasEstablishedRecord) {
    const selection = selectEstablishedDecisionIds(scan);
    if (selection.errors.length > 0) {
      return decisionFailure(selection.errors);
    }
    const checked = await syncDecisionIndex({
      decisionsDirectory: scan.decisionsDirectory,
      decisionIds: selection.decisionIds,
      mode: "check"
    });
    if (checked.status === "error") {
      return checked.state === "index-invalid" ||
        checked.state === "index-missing" ||
        checked.state === "index-stale"
        ? decisionFailure([
            scan.indexRelativePath + " is out of sync; run sync-index"
          ])
        : indexFailure(checked, scan.indexRelativePath);
    }
  }
  return {
    scan,
    status: "ok",
    warnings: scan.sourceErrors.filter(
      (error) => !scan.collectionErrors.includes(error)
    )
  };
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
    diagnostics: Parameters<typeof decisionIndexDiagnosticMessages>[0];
  },
  indexRelativePath: string
): DecisionApplicationFailure {
  return decisionFailure(
    decisionIndexDiagnosticMessages(result.diagnostics, indexRelativePath)
  );
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
    return {
      status: "ok",
      value: await fs.readFile(sourceFilePath, "utf8")
    };
  } catch (error) {
    return decisionFailure([
      "Failed to read decision body " +
        record.sourcePath +
        ": " +
        errorText(error)
    ]);
  }
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
