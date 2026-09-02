import path from "node:path";
import {
  buildStateIndex,
  createStateIndexReader,
  createStateIndexRuntime,
  stateIndexQueryMaximumLimit,
  type StateIndexDiagnostic,
  type StateIndexEntry,
  type StateIndexFilter,
  type StateIndexReader
} from "../../index-runtime/src/index.ts";
import { createDiagnostic } from "./diagnostics.ts";
import {
  testEvidenceCatalogPath,
  testEvidenceIndexPath,
  testEvidenceReportSchemaVersion,
  type TestEvidenceIndexMetadata
} from "./schemas.ts";
import {
  createTestEvidenceStateIndexDefinition,
  indexCanBeRebuilt,
  mapStateIndexDiagnostics
} from "./state-index.ts";
import { testEvidenceTopicIdFromSourcePath } from "./topic.ts";
import { cloneTopicDefinitions } from "./topics.ts";
import type {
  TestEvidenceCaseIndexState,
  TestEvidenceCaseState,
  TestEvidenceDiagnostic,
  TestEvidenceQueryResult,
  TestEvidenceTopicDefinition
} from "./types.ts";

type TestEvidenceReader = Pick<
  StateIndexReader<TestEvidenceCaseIndexState, TestEvidenceIndexMetadata>,
  "get" | "metadata" | "query"
>;

export type QueryTestEvidenceOptions = {
  limit?: number;
  offset?: number;
  query?: string;
  topic?: string;
  workspaceRoot: string;
};

export type TestEvidenceCaseLookupResult = {
  case: TestEvidenceCaseState | null;
  catalogPath: string;
  diagnostics: TestEvidenceDiagnostic[];
  indexPath: string;
  topic: TestEvidenceTopicDefinition | null;
};

export const testEvidenceQueryDefaultLimit = 20;

export async function queryTestEvidence(
  options: QueryTestEvidenceOptions
): Promise<TestEvidenceQueryResult> {
  if (options.query !== undefined && options.query.trim().length === 0) {
    return invalidQueryTextResult(options);
  }
  const opened = await openTestEvidenceIndex(options);
  if (opened.status === "error") {
    return createQueryFailureResult(opened.diagnostics, {
      limit: options.limit,
      offset: options.offset
    });
  }
  if (
    options.topic !== undefined &&
    !opened.reader.metadata.topics.some((topic) => topic.id === options.topic)
  ) {
    return unknownTopicResult(options, opened);
  }

  const queried = opened.reader.query({
    filters: queryFilters(options),
    limit: options.limit ?? testEvidenceQueryDefaultLimit,
    offset: options.offset,
    sort: [{ direction: "asc", key: "id" }]
  });
  if (queried.status === "error") {
    return createQueryFailureResult(
      [
        ...opened.diagnostics,
        ...mapStateIndexDiagnostics(queried.diagnostics, testEvidenceIndexPath)
      ],
      {
        limit: options.limit,
        offset: options.offset,
        topics: opened.reader.metadata.topics
      }
    );
  }

  return {
    cases: queried.value.entries.map(publicCaseState),
    catalogPath: testEvidenceCatalogPath,
    diagnostics: opened.diagnostics,
    indexPath: testEvidenceIndexPath,
    limit: queried.value.limit,
    offset: queried.value.offset,
    schemaVersion: testEvidenceReportSchemaVersion,
    topics: cloneTopicDefinitions(opened.reader.metadata.topics),
    total: queried.value.total
  };
}

function invalidQueryTextResult(
  options: QueryTestEvidenceOptions
): TestEvidenceQueryResult {
  return createQueryFailureResult(
    [
      createDiagnostic({
        category: "index",
        code: "query.text-invalid",
        message:
          "query text must contain at least one non-whitespace character",
        severity: "error"
      })
    ],
    { limit: options.limit, offset: options.offset }
  );
}

function unknownTopicResult(
  options: QueryTestEvidenceOptions,
  opened: Extract<
    Awaited<ReturnType<typeof openTestEvidenceIndex>>,
    { status: "ok" }
  >
): TestEvidenceQueryResult {
  return createQueryFailureResult(
    [
      ...opened.diagnostics,
      createDiagnostic({
        category: "catalog",
        code: "query.topic-unknown",
        message: `Unknown test evidence topic: ${options.topic}`,
        severity: "error"
      })
    ],
    {
      limit: options.limit,
      offset: options.offset,
      topics: opened.reader.metadata.topics
    }
  );
}

export async function getTestEvidenceCaseState(options: {
  caseId: string;
  workspaceRoot: string;
}): Promise<TestEvidenceCaseLookupResult> {
  const opened = await openTestEvidenceIndex(options);
  if (opened.status === "error") {
    return {
      case: null,
      catalogPath: opened.catalogPath,
      diagnostics: opened.diagnostics,
      indexPath: opened.indexPath,
      topic: null
    };
  }
  const found = opened.reader.get(options.caseId);
  if (found.status === "error") {
    return {
      case: null,
      catalogPath: testEvidenceCatalogPath,
      diagnostics: [
        ...opened.diagnostics,
        ...mapStateIndexDiagnostics(found.diagnostics, testEvidenceIndexPath)
      ],
      indexPath: testEvidenceIndexPath,
      topic: null
    };
  }
  if (found.value === null) {
    return {
      case: null,
      catalogPath: testEvidenceCatalogPath,
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
      indexPath: testEvidenceIndexPath,
      topic: null
    };
  }
  return {
    case: publicCaseState(found.value),
    catalogPath: testEvidenceCatalogPath,
    diagnostics: opened.diagnostics,
    indexPath: testEvidenceIndexPath,
    topic: topicDefinition(
      found.value.state.sourcePath,
      opened.reader.metadata.topics
    )
  };
}

type OpenTestEvidenceIndexResult =
  | {
      catalogPath: string;
      diagnostics: TestEvidenceDiagnostic[];
      indexPath: string;
      status: "error";
    }
  | {
      diagnostics: TestEvidenceDiagnostic[];
      reader: TestEvidenceReader;
      status: "ok";
    };

async function openTestEvidenceIndex(options: {
  workspaceRoot: string;
}): Promise<OpenTestEvidenceIndexResult> {
  const workspaceRoot = path.resolve(options.workspaceRoot);
  const definition = createTestEvidenceStateIndexDefinition();
  const runtime = createStateIndexRuntime({
    definition,
    indexPath: testEvidenceIndexPath,
    root: workspaceRoot
  });
  const opened = await runtime.open();
  if (opened.status === "error") {
    return await rebuildTestEvidenceIndex(
      workspaceRoot,
      definition,
      opened.diagnostics
    );
  }
  return {
    diagnostics: [],
    reader: opened.value,
    status: "ok"
  };
}

async function rebuildTestEvidenceIndex(
  workspaceRoot: string,
  definition: ReturnType<typeof createTestEvidenceStateIndexDefinition>,
  persistentDiagnostics: readonly StateIndexDiagnostic[]
): Promise<OpenTestEvidenceIndexResult> {
  if (
    persistentDiagnostics.length === 0 ||
    !persistentDiagnostics.every((entry) => indexCanBeRebuilt(entry.code))
  ) {
    return failedOpenResult(
      mapStateIndexDiagnostics(persistentDiagnostics, testEvidenceIndexPath)
    );
  }
  const built = await buildStateIndex(definition, { root: workspaceRoot });
  if (built.status === "ok") {
    return {
      diagnostics: mapIndexFallbackDiagnostics(
        persistentDiagnostics,
        testEvidenceCatalogPath,
        testEvidenceIndexPath
      ),
      reader: createStateIndexReader({
        definition,
        index: built.value,
        indexPath: testEvidenceIndexPath
      }),
      status: "ok"
    };
  }
  return failedOpenResult([
    ...mapStateIndexDiagnostics(persistentDiagnostics, testEvidenceIndexPath),
    ...mapStateIndexDiagnostics(built.diagnostics, testEvidenceIndexPath, false)
  ]);
}

function failedOpenResult(
  diagnostics: TestEvidenceDiagnostic[]
): OpenTestEvidenceIndexResult {
  return {
    catalogPath: testEvidenceCatalogPath,
    diagnostics,
    indexPath: testEvidenceIndexPath,
    status: "error"
  };
}

function mapIndexFallbackDiagnostics(
  diagnostics: readonly StateIndexDiagnostic[],
  catalogPath: string,
  indexPath: string
): TestEvidenceDiagnostic[] {
  return diagnostics.map((entry) =>
    createDiagnostic({
      caseId: entry.stateId ?? undefined,
      category: "index",
      code: entry.code,
      message:
        `${entry.message}. Used current ${catalogPath} in memory for this ` +
        `read-only query; run sync-index --write to refresh ${indexPath}`,
      path: entry.path ?? indexPath,
      severity: "warning"
    })
  );
}

function publicCaseState({
  id,
  state
}: StateIndexEntry<TestEvidenceCaseIndexState>): TestEvidenceCaseState {
  return {
    endLine: state.endLine,
    entries: [...state.entries],
    id,
    line: state.line,
    sourcePath: state.sourcePath,
    summary: state.summary,
    title: state.title
  };
}

export function createQueryFailureResult(
  diagnostics: readonly TestEvidenceDiagnostic[],
  paths: {
    limit?: number;
    offset?: number;
    topics?: readonly TestEvidenceTopicDefinition[];
  } = {}
): TestEvidenceQueryResult {
  return {
    cases: [],
    catalogPath: testEvidenceCatalogPath,
    diagnostics: [...diagnostics],
    indexPath: testEvidenceIndexPath,
    limit: validFailureLimit(paths.limit),
    offset: validFailureOffset(paths.offset),
    schemaVersion: testEvidenceReportSchemaVersion,
    topics: cloneTopicDefinitions(paths.topics ?? []),
    total: 0
  };
}

function validFailureLimit(value: number | undefined): number {
  return value !== undefined &&
    Number.isSafeInteger(value) &&
    value >= 1 &&
    value <= stateIndexQueryMaximumLimit
    ? value
    : testEvidenceQueryDefaultLimit;
}

function validFailureOffset(value: number | undefined): number {
  return value !== undefined && Number.isSafeInteger(value) && value >= 0
    ? value
    : 0;
}

function queryFilters(options: QueryTestEvidenceOptions): StateIndexFilter[] {
  const filters: StateIndexFilter[] = [];
  if (options.query !== undefined) {
    filters.push({
      key: "search",
      kind: "text",
      operator: "all",
      text: options.query.trim()
    });
  }
  if (options.topic !== undefined) {
    filters.push({
      key: "topic",
      kind: "exact",
      operator: "all",
      values: [options.topic]
    });
  }
  return filters;
}

function topicDefinition(
  sourcePath: string,
  topics: readonly TestEvidenceTopicDefinition[]
): TestEvidenceTopicDefinition {
  const topicId = testEvidenceTopicIdFromSourcePath(sourcePath);
  const topic =
    topicId === null
      ? undefined
      : topics.find((candidate) => candidate.id === topicId);
  if (topic === undefined) {
    throw new TypeError(
      `Indexed sourcePath has no topic definition: ${sourcePath}`
    );
  }
  return { id: topic.id, description: topic.description };
}
