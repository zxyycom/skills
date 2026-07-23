import path from "node:path";
import {
  createStateIndexRuntime,
  stateIndexQueryMaximumLimit,
  type StateIndexFilter,
  type StateIndexReader
} from "../../index-runtime/src/index.ts";
import {
  defaultTestEvidenceCatalogPath,
  defaultTestEvidenceIndexPath
} from "./schemas.ts";
import { loadTestEvidenceLedgerConfig } from "./config.ts";
import { createDiagnostic, sortUniqueDiagnostics } from "./diagnostics.ts";
import { validateGitState } from "./git-validation.ts";
import { buildIndexedCaseStates } from "./inspection.ts";
import { testEvidenceReportSchemaVersion } from "./schemas.ts";
import {
  createTestEvidenceStateIndexDefinition,
  mapStateIndexDiagnostics,
  testEvidenceLedgerCaseFromState
} from "./state-index.ts";
import type {
  CaseStatus,
  TestEvidenceCaseState,
  TestEvidenceDiagnostic,
  TestEvidenceLedgerConfig,
  TestEvidenceQueryResult,
  VerificationMode
} from "./types.ts";

export type QueryTestEvidenceLedgerOptions = {
  config?: unknown;
  configPath?: string;
  limit?: number;
  offset?: number;
  query?: string;
  status?: CaseStatus | "all";
  triggered?: boolean;
  verification?: VerificationMode | "all";
  workspaceRoot: string;
};

export type TestEvidenceCaseLookupResult = {
  case: TestEvidenceCaseState | null;
  catalogPath: string;
  diagnostics: TestEvidenceDiagnostic[];
  indexPath: string;
};

export const testEvidenceQueryDefaultLimit = 20;

export async function queryTestEvidenceLedger(
  options: QueryTestEvidenceLedgerOptions
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

  const { config, reader, workspaceRoot } = opened;
  const runtime = options.triggered === true
    ? await buildRuntimeQueryState({
      config,
      configPath: opened.configRelativePath,
      reader,
      workspaceRoot
    })
    : {
      diagnostics: [] as TestEvidenceDiagnostic[],
      states: undefined
    };
  if ("error" in runtime) {
    return createQueryFailureResult([
      ...opened.diagnostics,
      ...runtime.error
    ], {
      ...config,
      limit: options.limit,
      offset: options.offset
    });
  }

  const queried = reader.query({
    filters: queryFilters(options),
    limit: options.limit ?? testEvidenceQueryDefaultLimit,
    offset: options.offset,
    sort: [{ direction: "asc", key: "id" }]
  }, { runtimeStates: runtime.states });
  if (queried.status === "error") {
    return createQueryFailureResult([
      ...opened.diagnostics,
      ...mapStateIndexDiagnostics(queried.diagnostics, config.indexPath)
    ], {
      ...config,
      limit: options.limit,
      offset: options.offset
    });
  }

  const cases = queried.value.entries.map((entry) => entry.state);
  const diagnostics = sortUniqueDiagnostics([
    ...opened.diagnostics,
    ...runtime.diagnostics
  ])
    .filter((diagnostic) => diagnostic.code !== "review.trigger")
    .map((diagnostic) => ({ ...diagnostic, blocking: false }));
  return {
    cases,
    catalogPath: config.catalogPath,
    diagnostics,
    incomplete: diagnostics.some((diagnostic) => (
      diagnostic.code !== "review.overdue"
    )),
    indexPath: config.indexPath,
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
        ...opened.diagnostics.map((diagnostic) => ({
          ...diagnostic,
          blocking: false
        })),
        createDiagnostic({
          caseId: options.caseId,
          category: "catalog",
          code: "catalog.case-missing",
          message: `Test evidence case does not exist: ${options.caseId}`,
          severity: "error"
        })
      ],
      indexPath: opened.config.indexPath
    };
  }
  return {
    case: found.value.state,
    catalogPath: opened.config.catalogPath,
    diagnostics: opened.diagnostics.map((diagnostic) => ({
      ...diagnostic,
      blocking: false
    })),
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
    config: TestEvidenceLedgerConfig;
    configRelativePath: string;
    diagnostics: TestEvidenceDiagnostic[];
    reader: StateIndexReader<TestEvidenceCaseState>;
    status: "ok";
    workspaceRoot: string;
  }
> {
  const workspaceRoot = path.resolve(options.workspaceRoot);
  const loadedConfig = await loadTestEvidenceLedgerConfig(
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
  const runtime = createStateIndexRuntime({
    definition: createTestEvidenceStateIndexDefinition({
      config,
      runtime: true
    }),
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
    configRelativePath: loadedConfig.configRelativePath,
    diagnostics: loadedConfig.diagnostics,
    reader: opened.value,
    status: "ok",
    workspaceRoot
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
    incomplete: true,
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

async function buildRuntimeQueryState(options: {
  config: TestEvidenceLedgerConfig;
  configPath: string;
  reader: StateIndexReader<TestEvidenceCaseState>;
  workspaceRoot: string;
}): Promise<
  | {
    diagnostics: TestEvidenceDiagnostic[];
    states: TestEvidenceCaseState[];
  }
  | { error: TestEvidenceDiagnostic[] }
> {
  const indexed = options.reader.all();
  if (indexed.status === "error") {
    return {
      error: mapStateIndexDiagnostics(
        indexed.diagnostics,
        options.config.indexPath
      )
    };
  }
  const states = indexed.value.map((entry) => entry.state);
  const git = await validateGitState({
    catalogPath: options.config.catalogPath,
    configPath: options.configPath,
    indexPath: options.config.indexPath,
    reviewMaxAgeDays: options.config.reviewMaxAgeDays,
    reviewTriggerPolicy: options.config.reviewTriggers,
    scopedCases: states.map(testEvidenceLedgerCaseFromState),
    workspaceRoot: options.workspaceRoot
  });
  return {
    diagnostics: git.diagnostics,
    states: buildIndexedCaseStates({
      reviewTriggers: git.reviewTriggers,
      states
    })
  };
}

function queryFilters(
  options: QueryTestEvidenceLedgerOptions
): StateIndexFilter[] {
  const filters: StateIndexFilter[] = [];
  if (options.status !== undefined && options.status !== "all") {
    filters.push({
      key: "status",
      kind: "exact",
      operator: "all",
      values: [options.status]
    });
  }
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
  if (options.triggered === true) {
    filters.push({
      key: "review-triggered",
      kind: "exact",
      operator: "all",
      values: [true]
    });
  }
  return filters;
}
