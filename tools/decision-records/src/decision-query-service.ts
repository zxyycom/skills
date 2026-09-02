import fs from "node:fs/promises";
import path from "node:path";
import {
  type StateIndexDiagnostic,
  type StateIndexFilter
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
  syncDecisionIndex
} from "./decision-state-index.ts";
import {
  DecisionCollectionLockError,
  withDecisionCollectionMutationLock
} from "./decision-collection-mutation-lock.ts";
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
  isDecisionCandidateRecord,
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

async function showDecisionRecord(
  request: Extract<DecisionQueryRequest, { command: "show" }>
): Promise<DecisionQueryResult> {
  if (!isDecisionId(request.decisionId)) {
    return invalidDecisionIdFailure(request.decisionId);
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
      [
        decisionDiagnostic({
          code: "decision-records.decision-not-found",
          reason: "Established decision does not exist: " + request.decisionId,
          recovery:
            "Use list to choose an established Decision ID, then retry the command.",
          target: request.decisionId
        })
      ],
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
    return invalidDecisionIdFailure(request.decisionId);
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
        ? [
            decisionDiagnostic({
              code: "decision-records.candidate-not-found",
              reason:
                "Decision candidate does not exist: " + request.decisionId,
              recovery:
                "Use candidates to choose a valid candidate Decision ID, then retry the command.",
              target: request.decisionId
            })
          ]
        : [
            "Decision source is not a valid candidate scaffold: " +
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
    return invalidDecisionIdFailure(request.decisionId);
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
      [
        decisionDiagnostic({
          code: "decision-records.decision-not-found",
          reason: "Established decision does not exist: " + request.decisionId,
          recovery:
            "Use list to choose an established Decision ID, then retry the command.",
          target: request.decisionId
        })
      ],
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
  const synchronized = await syncDecisionIndex({
    decisionsDirectory: result.scan.decisionsDirectory,
    mode: "write",
    decisionIds: selection.decisionIds
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
    indexRelativePath: result.scan.indexRelativePath,
    state: synchronized.state === "written" ? "written" : "current",
    status: "ok",
    unactivatedPaths: activationCandidates(result.scan).map(
      (record) => record.sourcePath
    ),
    warnings: []
  };
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
      decisionIds: selection.decisionIds,
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
    return {
      status: "ok",
      value: await fs.readFile(sourceFilePath, "utf8")
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

function invalidDecisionIdFailure(
  decisionId: string
): DecisionApplicationFailure {
  return decisionFailure(
    [
      decisionDiagnostic({
        code: "decision-records.decision-id-invalid",
        reason: "Decision ID is invalid: " + decisionId,
        recovery:
          "Provide a Decision ID that is a Markdown basename, then retry the command.",
        target: "Decision ID argument"
      })
    ],
    { exitCode: 2, presentation: "plain" }
  );
}
