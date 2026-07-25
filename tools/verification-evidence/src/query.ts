import path from "node:path";
import {
  createStateIndexRuntime,
  stateIndexQueryMaximumLimit,
  type StateIndexFilter,
  type StateIndexReader
} from "../../index-runtime/src/index.ts";
import { loadVerificationEvidenceConfig } from "./config.ts";
import { createDiagnostic } from "./diagnostics.ts";
import {
  defaultVerificationEvidenceCatalogPath,
  defaultVerificationEvidenceIndexPath,
  verificationEvidenceReportSchemaVersion,
  type VerificationEvidenceIndexMetadata
} from "./schemas.ts";
import {
  createVerificationEvidenceStateIndexDefinition,
  mapStateIndexDiagnostics
} from "./state-index.ts";
import type {
  VerificationCaseState,
  VerificationEvidenceConfig,
  VerificationEvidenceDiagnostic,
  VerificationEvidenceQueryResult,
  VerificationKind
} from "./types.ts";

export type QueryVerificationEvidenceOptions = {
  config?: unknown;
  configPath?: string;
  limit?: number;
  offset?: number;
  query?: string;
  verification?: VerificationKind | "all";
  workspaceRoot: string;
};

export type VerificationCaseLookupResult = {
  case: VerificationCaseState | null;
  catalogPath: string;
  diagnostics: VerificationEvidenceDiagnostic[];
  indexPath: string;
};

export const verificationEvidenceQueryDefaultLimit = 20;

export async function queryVerificationEvidence(
  options: QueryVerificationEvidenceOptions
): Promise<VerificationEvidenceQueryResult> {
  if (options.query !== undefined && options.query.trim().length === 0) {
    return createQueryFailureResult([createDiagnostic({
      category: "index",
      code: "query.text-invalid",
      message: "query text must contain at least one non-whitespace character",
      severity: "error"
    })], {
      limit: options.limit,
      offset: options.offset
    });
  }
  const opened = await openVerificationEvidenceIndex(options);
  if (opened.status === "error") {
    return createQueryFailureResult(opened.diagnostics, {
      catalogPath: opened.catalogPath,
      indexPath: opened.indexPath,
      limit: options.limit,
      offset: options.offset
    });
  }

  const queried = opened.reader.query({
    filters: queryFilters(options),
    limit: options.limit ?? verificationEvidenceQueryDefaultLimit,
    offset: options.offset,
    sort: [{ direction: "asc", key: "id" }]
  });
  if (queried.status === "error") {
    return createQueryFailureResult([
      ...opened.diagnostics,
      ...mapStateIndexDiagnostics(
        queried.diagnostics,
        opened.config.indexPath
      )
    ], {
      catalogPath: opened.config.catalogPath,
      indexPath: opened.config.indexPath,
      limit: options.limit,
      offset: options.offset
    });
  }

  return {
    cases: queried.value.entries.map((entry) => entry.state),
    catalogPath: opened.config.catalogPath,
    diagnostics: opened.diagnostics,
    indexPath: opened.config.indexPath,
    limit: queried.value.limit,
    offset: queried.value.offset,
    schemaVersion: verificationEvidenceReportSchemaVersion,
    total: queried.value.total
  };
}

export async function getVerificationCaseState(options: {
  caseId: string;
  config?: unknown;
  configPath?: string;
  workspaceRoot: string;
}): Promise<VerificationCaseLookupResult> {
  const opened = await openVerificationEvidenceIndex(options);
  if (opened.status === "error") {
    return {
      case: null,
      catalogPath: opened.catalogPath,
      diagnostics: opened.diagnostics,
      indexPath: opened.indexPath
    };
  }
  const found = opened.reader.get(options.caseId);
  if (found.status === "error") {
    return {
      case: null,
      catalogPath: opened.config.catalogPath,
      diagnostics: [
        ...opened.diagnostics,
        ...mapStateIndexDiagnostics(
          found.diagnostics,
          opened.config.indexPath
        )
      ],
      indexPath: opened.config.indexPath
    };
  }
  if (found.value === null) {
    return {
      case: null,
      catalogPath: opened.config.catalogPath,
      diagnostics: [
        ...opened.diagnostics,
        createDiagnostic({
          caseId: options.caseId,
          category: "catalog",
          code: "catalog.case-missing",
          message: `Verification case does not exist: ${options.caseId}`,
          severity: "error"
        })
      ],
      indexPath: opened.config.indexPath
    };
  }
  return {
    case: found.value.state,
    catalogPath: opened.config.catalogPath,
    diagnostics: opened.diagnostics,
    indexPath: opened.config.indexPath
  };
}

async function openVerificationEvidenceIndex(options: {
  config?: unknown;
  configPath?: string;
  workspaceRoot: string;
}): Promise<
  | {
    catalogPath: string;
    diagnostics: VerificationEvidenceDiagnostic[];
    indexPath: string;
    status: "error";
  }
  | {
    config: VerificationEvidenceConfig;
    diagnostics: VerificationEvidenceDiagnostic[];
    reader: StateIndexReader<
      VerificationCaseState,
      VerificationEvidenceIndexMetadata
    >;
    status: "ok";
  }
> {
  const workspaceRoot = path.resolve(options.workspaceRoot);
  const loadedConfig = await loadVerificationEvidenceConfig(
    workspaceRoot,
    options.configPath,
    options.config
  );
  if (loadedConfig.config === null) {
    return {
      catalogPath: defaultVerificationEvidenceCatalogPath,
      diagnostics: loadedConfig.diagnostics,
      indexPath: defaultVerificationEvidenceIndexPath,
      status: "error"
    };
  }
  const config = loadedConfig.config;
  const runtime = createStateIndexRuntime({
    definition: createVerificationEvidenceStateIndexDefinition({ config }),
    indexPath: config.indexPath,
    root: workspaceRoot
  });
  const opened = await runtime.open();
  if (opened.status === "error") {
    return {
      catalogPath: config.catalogPath,
      diagnostics: [
        ...loadedConfig.diagnostics,
        ...mapStateIndexDiagnostics(opened.diagnostics, config.indexPath)
      ],
      indexPath: config.indexPath,
      status: "error"
    };
  }
  return {
    config,
    diagnostics: loadedConfig.diagnostics,
    reader: opened.value,
    status: "ok"
  };
}

export function createQueryFailureResult(
  diagnostics: readonly VerificationEvidenceDiagnostic[],
  paths: {
    catalogPath?: string;
    indexPath?: string;
    limit?: number;
    offset?: number;
  } = {}
): VerificationEvidenceQueryResult {
  return {
    cases: [],
    catalogPath: paths.catalogPath ?? defaultVerificationEvidenceCatalogPath,
    diagnostics: [...diagnostics],
    indexPath: paths.indexPath ?? defaultVerificationEvidenceIndexPath,
    limit: validFailureLimit(paths.limit),
    offset: validFailureOffset(paths.offset),
    schemaVersion: verificationEvidenceReportSchemaVersion,
    total: 0
  };
}

function validFailureLimit(value: number | undefined): number {
  return value !== undefined
    && Number.isSafeInteger(value)
    && value >= 1
    && value <= stateIndexQueryMaximumLimit
    ? value
    : verificationEvidenceQueryDefaultLimit;
}

function validFailureOffset(value: number | undefined): number {
  return value !== undefined && Number.isSafeInteger(value) && value >= 0
    ? value
    : 0;
}

function queryFilters(
  options: QueryVerificationEvidenceOptions
): StateIndexFilter[] {
  const filters: StateIndexFilter[] = [];
  if (options.query !== undefined) {
    filters.push({
      key: "search",
      kind: "text",
      operator: "all",
      text: options.query.trim()
    });
  }
  if (
    options.verification !== undefined
    && options.verification !== "all"
  ) {
    filters.push({
      key: "verification",
      kind: "exact",
      operator: "all",
      values: [options.verification]
    });
  }
  return filters;
}
