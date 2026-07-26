import path from "node:path";
import {
  buildStateIndex,
  createStateIndexReader,
  createStateIndexRuntime,
  stateIndexQueryMaximumLimit,
  type StateIndexDiagnostic,
  type StateIndexFilter,
  type StateIndexReader
} from "../../index-runtime/src/index.ts";
import { loadTestEvidenceConfig } from "./config.ts";
import { createDiagnostic } from "./diagnostics.ts";
import {
  defaultTestEvidenceCatalogPath,
  defaultTestEvidenceIndexPath,
  testEvidenceReportSchemaVersion,
  type TestEvidenceIndexMetadata
} from "./schemas.ts";
import {
  createTestEvidenceStateIndexDefinition,
  indexCanBeRebuilt,
  mapStateIndexDiagnostics
} from "./state-index.ts";
import type {
  TestEvidenceCaseIndexState,
  TestEvidenceCaseState,
  TestEvidenceConfig,
  TestEvidenceDiagnostic,
  TestEvidenceQueryResult
} from "./types.ts";

type TestEvidenceReader = Pick<
  StateIndexReader<
    TestEvidenceCaseIndexState,
    TestEvidenceIndexMetadata
  >,
  "get" | "query"
>;

export type QueryTestEvidenceOptions = {
  config?: unknown;
  configPath?: string;
  limit?: number;
  offset?: number;
  query?: string;
  workspaceRoot: string;
};

export type TestEvidenceCaseLookupResult = {
  case: TestEvidenceCaseState | null;
  catalogPath: string;
  diagnostics: TestEvidenceDiagnostic[];
  indexPath: string;
};

export const testEvidenceQueryDefaultLimit = 20;

export async function queryTestEvidence(
  options: QueryTestEvidenceOptions
): Promise<TestEvidenceQueryResult> {
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
  const opened = await openTestEvidenceIndex(options);
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
    limit: options.limit ?? testEvidenceQueryDefaultLimit,
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
    cases: queried.value.entries.map((entry) => publicCaseState(entry.state)),
    catalogPath: opened.config.catalogPath,
    diagnostics: opened.diagnostics,
    indexPath: opened.config.indexPath,
    limit: queried.value.limit,
    offset: queried.value.offset,
    schemaVersion: testEvidenceReportSchemaVersion,
    total: queried.value.total
  };
}

export async function getTestEvidenceCaseState(options: {
  caseId: string;
  config?: unknown;
  configPath?: string;
  workspaceRoot: string;
}): Promise<TestEvidenceCaseLookupResult> {
  const opened = await openTestEvidenceIndex(options);
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
          message: `Test case does not exist: ${options.caseId}`,
          severity: "error"
        })
      ],
      indexPath: opened.config.indexPath
    };
  }
  return {
    case: publicCaseState(found.value.state),
    catalogPath: opened.config.catalogPath,
    diagnostics: opened.diagnostics,
    indexPath: opened.config.indexPath
  };
}

async function openTestEvidenceIndex(options: {
  config?: unknown;
  configPath?: string;
  workspaceRoot: string;
}): Promise<
  | {
    catalogPath: string;
    diagnostics: TestEvidenceDiagnostic[];
    indexPath: string;
    status: "error";
  }
  | {
    config: TestEvidenceConfig;
    diagnostics: TestEvidenceDiagnostic[];
    reader: TestEvidenceReader;
    status: "ok";
  }
> {
  const workspaceRoot = path.resolve(options.workspaceRoot);
  const loadedConfig = await loadTestEvidenceConfig(
    workspaceRoot,
    options.configPath,
    options.config
  );
  if (loadedConfig.config === null) {
    return {
      catalogPath: defaultTestEvidenceCatalogPath,
      diagnostics: loadedConfig.diagnostics,
      indexPath: defaultTestEvidenceIndexPath,
      status: "error"
    };
  }
  const config = loadedConfig.config;
  const definition = createTestEvidenceStateIndexDefinition({ config });
  const runtime = createStateIndexRuntime({
    definition,
    indexPath: config.indexPath,
    root: workspaceRoot
  });
  const opened = await runtime.open();
  if (opened.status === "error") {
    if (
      opened.diagnostics.length === 0
      || !opened.diagnostics.every((entry) => indexCanBeRebuilt(entry.code))
    ) {
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
    const built = await buildStateIndex(definition, { root: workspaceRoot });
    if (built.status === "ok") {
      return {
        config,
        diagnostics: [
          ...loadedConfig.diagnostics,
          ...mapIndexFallbackDiagnostics(
            opened.diagnostics,
            config.catalogPath,
            config.indexPath
          )
        ],
        reader: createStateIndexReader({
          definition,
          index: built.value,
          indexPath: config.indexPath
        }),
        status: "ok"
      };
    }
    return {
      catalogPath: config.catalogPath,
      diagnostics: [
        ...loadedConfig.diagnostics,
        ...mapStateIndexDiagnostics(opened.diagnostics, config.indexPath),
        ...mapStateIndexDiagnostics(
          built.diagnostics,
          config.indexPath,
          false
        )
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

function mapIndexFallbackDiagnostics(
  diagnostics: readonly StateIndexDiagnostic[],
  catalogPath: string,
  indexPath: string
): TestEvidenceDiagnostic[] {
  return diagnostics.map((entry) => createDiagnostic({
    caseId: entry.stateId ?? undefined,
    category: "index",
    code: entry.code,
    message: `${entry.message}. Used current ${catalogPath} in memory for this `
      + `read-only query; run sync-index --write to refresh ${indexPath}`,
    path: entry.path ?? indexPath,
    severity: "warning"
  }));
}

function publicCaseState(
  state: TestEvidenceCaseIndexState
): TestEvidenceCaseState {
  return {
    endLine: state.endLine,
    entries: [...state.entries],
    id: state.id,
    line: state.line,
    sourcePath: state.sourcePath,
    summary: state.summary,
    title: state.title
  };
}

export function createQueryFailureResult(
  diagnostics: readonly TestEvidenceDiagnostic[],
  paths: {
    catalogPath?: string;
    indexPath?: string;
    limit?: number;
    offset?: number;
  } = {}
): TestEvidenceQueryResult {
  return {
    cases: [],
    catalogPath: paths.catalogPath ?? defaultTestEvidenceCatalogPath,
    diagnostics: [...diagnostics],
    indexPath: paths.indexPath ?? defaultTestEvidenceIndexPath,
    limit: validFailureLimit(paths.limit),
    offset: validFailureOffset(paths.offset),
    schemaVersion: testEvidenceReportSchemaVersion,
    total: 0
  };
}

function validFailureLimit(value: number | undefined): number {
  return value !== undefined
    && Number.isSafeInteger(value)
    && value >= 1
    && value <= stateIndexQueryMaximumLimit
    ? value
    : testEvidenceQueryDefaultLimit;
}

function validFailureOffset(value: number | undefined): number {
  return value !== undefined && Number.isSafeInteger(value) && value >= 0
    ? value
    : 0;
}

function queryFilters(
  options: QueryTestEvidenceOptions
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
  return filters;
}
