import fs from "node:fs/promises";
import path from "node:path";
import {
  type StateIndexFilter
} from "../../index-runtime/src/index.ts";
import {
  decisionFailure,
  type DecisionApplicationFailure
} from "./application-result.ts";
import {
  decisionDomainCatalogFileName,
  loadDecisionDomainCatalog,
  type DecisionDomainDefinition
} from "./decision-domain-catalog.ts";
import {
  decisionIndexDiagnosticMessages,
  syncDecisionIndex
} from "./decision-state-index.ts";
import {
  decisionDomainFromRelativePath,
  normalizeDecisionRelativePath
} from "./decision-path.ts";
import {
  decisionScanOptions,
  loadDecisionQueryContext,
  type DecisionLocation
} from "./decision-query-context.ts";
import {
  loadDecisionValidationContext,
  selectDecisionIndexSourcePaths,
  validateDecisionScan
} from "./index.ts";
import {
  traceDecisionRelations,
  type DecisionRelationEdge
} from "./relation-graph.ts";
import {
  compareDecisionRecords,
  type DecisionIndex,
  type DecisionIndexEntry,
  type DecisionListAlignment,
  type DecisionListStatus,
  type DecisionRecord,
  type DecisionScan,
  type DecisionTraceDirection,
  type DecisionValidationResult
} from "./types.ts";

export type { DecisionLocation } from "./decision-query-context.ts";

export type DecisionQueryRequest =
  | {
      command: "check" | "domains";
      location: DecisionLocation;
    }
  | {
      alignment: DecisionListAlignment;
      command: "list";
      domain: string | null;
      fullTime: boolean;
      location: DecisionLocation;
      status: DecisionListStatus;
    }
  | {
      command: "show";
      location: DecisionLocation;
      recordPath: string;
    }
  | {
      command: "sync-index";
      location: DecisionLocation;
      write: boolean;
    }
  | {
      command: "trace";
      direction: DecisionTraceDirection;
      location: DecisionLocation;
      maxDepth: number | null;
      recordPath: string;
    };

type QuerySuccessBase = {
  status: "ok";
  warnings: string[];
};

export type DecisionQuerySuccess =
  | (QuerySuccessBase & {
      command: "check";
      summary: Pick<
        DecisionValidationResult,
        | "activeCount"
        | "alignedCount"
        | "archivedCount"
        | "decisionCount"
        | "domainCount"
        | "unalignedCount"
      >;
    })
  | (QuerySuccessBase & {
      command: "domains";
      domains: DecisionDomainDefinition[];
    })
  | (QuerySuccessBase & {
      command: "list";
      domains: DecisionDomainDefinition[];
      fullTime: boolean;
      records: DecisionRecord[];
    })
  | (QuerySuccessBase & {
      body: string;
      command: "show";
      domain: DecisionDomainDefinition;
      record: DecisionRecord;
    })
  | (QuerySuccessBase & {
      command: "sync-index";
      domainCount: number;
      indexRelativePath: string;
      state: "current" | "written";
      unactivatedPaths: string[];
    })
  | (QuerySuccessBase & {
      command: "trace";
      domains: DecisionDomainDefinition[];
      edges: DecisionRelationEdge[];
      records: DecisionRecord[];
    });

export type DecisionQueryResult =
  | DecisionApplicationFailure
  | DecisionQuerySuccess;

export async function executeDecisionQuery(
  request: DecisionQueryRequest
): Promise<DecisionQueryResult> {
  switch (request.command) {
    case "check":
      return await checkDecisionRecords(request.location);
    case "domains":
      return await queryDecisionDomains(request.location);
    case "list":
      return await listDecisionRecords(request);
    case "show":
      return await showDecisionRecord(request);
    case "sync-index":
      return await synchronizeDecisionIndex(request);
    case "trace":
      return await traceDecisionRecord(request);
  }
}

async function queryDecisionDomains(
  location: DecisionLocation
): Promise<DecisionQueryResult> {
  const workspaceRoot = path.resolve(location.workspaceRoot);
  const decisionsDirectory = path.isAbsolute(location.decisionsDir)
    ? path.resolve(location.decisionsDir)
    : path.resolve(workspaceRoot, location.decisionsDir);
  const loaded = await loadDecisionDomainCatalog(
    path.join(decisionsDirectory, decisionDomainCatalogFileName),
    decisionDomainCatalogFileName
  );
  return loaded.status === "error"
    ? decisionFailure(loaded.errors)
    : {
        command: "domains",
        domains: loaded.value.domains,
        status: "ok",
        warnings: []
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
      alignedCount: result.alignedCount,
      archivedCount: result.archivedCount,
      decisionCount: result.decisionCount,
      domainCount: result.domainCount,
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
  const selectedDomain = request.domain === null
    ? null
    : domainDefinition(context.index, request.domain);
  if (request.domain !== null && selectedDomain === null) {
    return decisionFailure(
      ["Unknown decision domain in decision-domains.json: " + request.domain],
      { exitCode: 2 }
    );
  }
  const filters = listFilters(request);
  const queried = context.reader.all({
    filters,
    sort: [{ direction: "asc", key: "id" }]
  });
  if (queried.status === "error") {
    return indexFailure(queried, context.scan.indexRelativePath);
  }
  const records = indexedRecords(context.scan, queried.value);
  const resultDomainIds = new Set(records.map((record) => record.domain));
  return {
    command: "list",
    domains: selectedDomain === null
      ? context.index.metadata.domains.filter((domain) => resultDomainIds.has(domain.id))
      : [selectedDomain],
    fullTime: request.fullTime,
    records,
    status: "ok",
    warnings: context.warnings
  };
}

async function showDecisionRecord(
  request: Extract<DecisionQueryRequest, { command: "show" }>
): Promise<DecisionQueryResult> {
  const context = await loadDecisionQueryContext(request.location);
  if (context.status === "error") {
    return context;
  }
  const recordPath = normalizeDecisionRelativePath(request.recordPath);
  const matched = context.reader.get(recordPath);
  if (matched.status === "error") {
    return indexFailure(matched, context.scan.indexRelativePath);
  }
  const record = matched.value === null
    ? null
    : findEstablishedRecord(context.scan, matched.value.id);
  if (record === null) {
    return decisionFailure(
      ["Established decision does not exist: " + request.recordPath],
      { presentation: "plain" }
    );
  }
  if (!record.markdownExists) {
    return decisionFailure(
      ["Decision body does not exist: " + record.relativePath],
      { presentation: "plain" }
    );
  }
  const domainId = decisionDomainFromRelativePath(record.relativePath);
  const domain = domainId === null ? null : domainDefinition(context.index, domainId);
  if (domain === null) {
    return decisionFailure([
      "Decision path has no indexed domain: " + record.relativePath
    ]);
  }
  const body = await readDecisionBody(record);
  return body.status === "error"
    ? body
    : {
        body: body.value,
        command: "show",
        domain,
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
  const start = findEstablishedRecord(context.scan, request.recordPath);
  if (start === null) {
    return decisionFailure(
      ["Established decision does not exist: " + request.recordPath],
      { presentation: "plain" }
    );
  }
  const queried = context.reader.all({
    sort: [{ direction: "asc", key: "id" }]
  });
  if (queried.status === "error") {
    return indexFailure(queried, context.scan.indexRelativePath);
  }
  const records = indexedRecords(context.scan, queried.value);
  const trace = traceDecisionRelations(records, start.relativePath, {
    direction: request.direction,
    maxDepth: request.maxDepth
  });
  const tracedRecords = records
    .filter((record) => trace.paths.has(record.relativePath))
    .sort(compareDecisionRecords);
  const domainIds = new Set(tracedRecords.map((record) => record.domain));
  return {
    command: "trace",
    domains: context.index.metadata.domains.filter((domain) => domainIds.has(domain.id)),
    edges: trace.edges,
    records: tracedRecords,
    status: "ok",
    warnings: context.warnings
  };
}

async function synchronizeDecisionIndex(
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
  const selection = selectDecisionIndexSourcePaths(result.scan);
  if (selection.errors.length > 0) {
    return decisionFailure(selection.errors);
  }
  const synchronized = await syncDecisionIndex({
    decisionsDirectory: result.scan.decisionsDirectory,
    mode: request.write ? "write" : "check",
    relativePaths: selection.relativePaths
  });
  if (synchronized.status === "error") {
    if (!request.write && (
      synchronized.state === "index-invalid"
      || synchronized.state === "index-missing"
      || synchronized.state === "index-stale"
    )) {
      return decisionFailure([
        "Decision index is out of sync.",
        "Run sync-index --write to update " + result.scan.indexRelativePath + "."
      ], { presentation: "plain" });
    }
    return decisionFailure(decisionIndexDiagnosticMessages(
      synchronized.diagnostics,
      result.scan.indexRelativePath
    ));
  }
  return {
    command: "sync-index",
    domainCount: result.domainCount,
    indexRelativePath: result.scan.indexRelativePath,
    state: synchronized.state === "written" ? "written" : "current",
    status: "ok",
    unactivatedPaths: activationCandidates(result.scan).map(
      (record) => record.relativePath
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
    ["alignment", request.alignment],
    ["domain", request.domain]
  ] as const) {
    if (value !== null && value !== "all") {
      filters.push({ key, kind: "exact", operator: "all", values: [value] });
    }
  }
  return filters;
}

function indexedRecords(
  scan: DecisionScan,
  entries: readonly DecisionIndexEntry[]
): DecisionRecord[] {
  const recordsByPath = new Map(
    scan.records
      .filter((record) => record.document !== null)
      .map((record) => [record.relativePath, record])
  );
  return entries
    .map((entry) => recordsByPath.get(entry.id))
    .filter((record): record is DecisionRecord => record !== undefined);
}

function findEstablishedRecord(
  scan: DecisionScan,
  value: string
): DecisionRecord | null {
  const recordPath = normalizeDecisionRelativePath(value);
  return scan.records.find((record) => (
    record.relativePath === recordPath && record.document !== null
  )) ?? null;
}

function domainDefinition(
  index: DecisionIndex,
  domainId: string
): DecisionDomainDefinition | null {
  return index.metadata.domains.find((domain) => domain.id === domainId) ?? null;
}

function activationCandidates(scan: DecisionScan): DecisionRecord[] {
  return scan.records
    .filter((record) => record.activationCandidate)
    .sort(compareDecisionRecords);
}

function indexFailure(
  result: { diagnostics: Parameters<typeof decisionIndexDiagnosticMessages>[0] },
  indexRelativePath: string
): DecisionApplicationFailure {
  return decisionFailure(decisionIndexDiagnosticMessages(
    result.diagnostics,
    indexRelativePath
  ));
}

async function readDecisionBody(
  record: DecisionRecord
): Promise<
  | DecisionApplicationFailure
  | { status: "ok"; value: string }
> {
  try {
    return {
      status: "ok",
      value: await fs.readFile(record.decisionPath, "utf8")
    };
  } catch (error) {
    return decisionFailure([
      "Failed to read decision body "
        + record.relativePath
        + ": "
        + errorText(error)
    ]);
  }
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
