import path from "node:path";
import * as v from "valibot";
import {
  buildStateIndex,
  createStateIndexReader,
  expectationOf,
  loadStateIndex,
  stateIndexQueryMaximumLimit,
  type StateIndexDiagnostic,
  type StateIndexFilter,
  type StateIndexReader,
  type StateSourceRevision
} from "../../../index-runtime/src/index.ts";
import { createTestEvidenceDiagnostic } from "./diagnostics.ts";
import {
  readTestEvidenceLedgerRevision,
  readTestEvidenceLedgerSource,
  sameTestEvidenceLedgerRevision,
  type TestEvidenceLedgerRevisionSource
} from "./ledger-source.ts";
import {
  createTestEvidenceLedgerStateIndexDefinition,
  indexCanBeRebuilt,
  mapStateIndexDiagnostics
} from "./state-index.ts";
import {
  queryTestEntitiesOptionsSchema,
  queryTestEvidenceCasesOptionsSchema,
  testEvidenceCaseQueryResultSchema,
  testEvidenceLedgerIndexPath,
  testEvidenceLedgerPath,
  testEvidenceLedgerSchemaVersion,
  testEvidenceTestQueryResultSchema,
  type QueryTestEntitiesOptions,
  type QueryTestEvidenceCasesOptions,
  type TestEntity,
  type TestEvidenceCaseQueryResult,
  type TestEvidenceDiagnostic,
  type TestEvidenceLedgerCaseIndexState,
  type TestEvidenceLedgerCaseSummary,
  type TestEvidenceLedgerIndexMetadata,
  type TestEvidenceTestQueryItem,
  type TestEvidenceTestQueryResult
} from "./schemas.ts";

export const testEvidenceLedgerQueryDefaultLimit = 20;

type TestEvidenceLedgerReader = StateIndexReader<
  TestEvidenceLedgerCaseIndexState,
  TestEvidenceLedgerIndexMetadata
>;

export type OpenedTestEvidenceLedgerIndex = {
  diagnostics: TestEvidenceDiagnostic[];
  reader: TestEvidenceLedgerReader;
  revisionSource: TestEvidenceLedgerRevisionSource;
};

export type OpenTestEvidenceLedgerIndexResult =
  | {
    diagnostics: TestEvidenceDiagnostic[];
    opened: OpenedTestEvidenceLedgerIndex;
  }
  | {
    diagnostics: TestEvidenceDiagnostic[];
    opened: null;
  };

export async function queryTestEvidenceCases(
  options: QueryTestEvidenceCasesOptions
): Promise<TestEvidenceCaseQueryResult> {
  const parsedOptions = v.safeParse(
    queryTestEvidenceCasesOptionsSchema,
    options
  );
  if (!parsedOptions.success) {
    return caseQueryFailure(
      [optionsDiagnostic(parsedOptions.issues)],
      options
    );
  }
  const normalizedOptions = {
    ...parsedOptions.output,
    ...(parsedOptions.output.query === undefined
      ? {}
      : { query: parsedOptions.output.query.trim() })
  };
  const opened = await openTestEvidenceLedgerIndex(
    normalizedOptions.workspaceRoot
  );
  if (opened.opened === null) {
    return caseQueryFailure(opened.diagnostics, normalizedOptions);
  }

  if (
    normalizedOptions.testId !== undefined
    && !opened.opened.revisionSource.entityIndex.value.entities.some(
      (entity) => entity.id === normalizedOptions.testId
    )
  ) {
    return caseQueryFailure([
      ...opened.diagnostics,
      createTestEvidenceDiagnostic({
        category: "query",
        code: "query.test-unknown",
        message: `Unknown Test entity: ${normalizedOptions.testId}`,
        severity: "error",
        testId: normalizedOptions.testId
      })
    ], normalizedOptions);
  }

  const queried = opened.opened.reader.query({
    filters: caseQueryFilters(normalizedOptions),
    limit: normalizedOptions.limit ?? testEvidenceLedgerQueryDefaultLimit,
    offset: normalizedOptions.offset,
    sort: [{ direction: "asc", key: "id" }]
  });
  if (queried.status === "error") {
    return caseQueryFailure([
      ...opened.diagnostics,
      ...mapStateIndexDiagnostics(queried.diagnostics)
    ], normalizedOptions);
  }

  return v.parse(testEvidenceCaseQueryResultSchema, {
    cases: queried.value.entries.map(({ id, state }) => ({
      id,
      title: state.title,
      summary: state.summary,
      sourcePath: state.sourcePath,
      testIds: [...state.testIds],
      tags: [...state.tags]
    })),
    diagnostics: opened.opened.diagnostics,
    indexPath: testEvidenceLedgerIndexPath,
    ledgerPath: testEvidenceLedgerPath,
    limit: queried.value.limit,
    offset: queried.value.offset,
    schemaVersion: testEvidenceLedgerSchemaVersion,
    total: queried.value.total
  });
}

export async function queryTestEntities(
  options: QueryTestEntitiesOptions
): Promise<TestEvidenceTestQueryResult> {
  const parsedOptions = v.safeParse(queryTestEntitiesOptionsSchema, options);
  if (!parsedOptions.success) {
    return testQueryFailure(
      [optionsDiagnostic(parsedOptions.issues)],
      options
    );
  }
  const normalizedOptions = {
    ...parsedOptions.output,
    ...(parsedOptions.output.query === undefined
      ? {}
      : { query: parsedOptions.output.query.trim() })
  };
  const opened = await openTestEvidenceLedgerIndex(
    normalizedOptions.workspaceRoot
  );
  if (opened.opened === null) {
    return testQueryFailure(opened.diagnostics, normalizedOptions);
  }

  const allCases = opened.opened.reader.all({
    sort: [{ direction: "asc", key: "id" }]
  });
  if (allCases.status === "error") {
    return testQueryFailure([
      ...opened.diagnostics,
      ...mapStateIndexDiagnostics(allCases.diagnostics)
    ], normalizedOptions);
  }
  const caseIdsByTest = new Map<string, string[]>();
  for (const entry of allCases.value) {
    for (const testId of entry.keys.test ?? []) {
      if (typeof testId !== "string") {
        continue;
      }
      const caseIds = caseIdsByTest.get(testId) ?? [];
      caseIds.push(entry.id);
      caseIdsByTest.set(testId, caseIds);
    }
  }

  const filtered = opened.opened.revisionSource.entityIndex.value.entities
    .filter((entity) => entityMatchesQuery(entity, normalizedOptions.query))
    .map((entity): TestEvidenceTestQueryItem => ({
      id: entity.id,
      name: entity.name,
      locators: [...entity.locators],
      caseIds: [...(caseIdsByTest.get(entity.id) ?? [])].sort(compareText)
    }));
  const limit = normalizedOptions.limit ?? testEvidenceLedgerQueryDefaultLimit;
  const offset = normalizedOptions.offset ?? 0;
  return v.parse(testEvidenceTestQueryResultSchema, {
    diagnostics: opened.opened.diagnostics,
    indexPath: testEvidenceLedgerIndexPath,
    ledgerPath: testEvidenceLedgerPath,
    limit,
    offset,
    schemaVersion: testEvidenceLedgerSchemaVersion,
    tests: filtered.slice(offset, offset + limit),
    total: filtered.length
  });
}

export async function openTestEvidenceLedgerIndex(
  workspaceRoot: string
): Promise<OpenTestEvidenceLedgerIndexResult> {
  const root = path.resolve(workspaceRoot);
  const definition = createTestEvidenceLedgerStateIndexDefinition();
  const loaded = await loadStateIndex({
    context: { root },
    definition,
    expectation: expectationOf(definition),
    indexPath: testEvidenceLedgerIndexPath
  });

  let persistentDiagnostics: StateIndexDiagnostic[] = [];
  if (loaded.status === "ok") {
    const revision = await readTestEvidenceLedgerRevision(root);
    if (revision.source === null) {
      return { diagnostics: revision.diagnostics, opened: null };
    }
    if (sameTestEvidenceLedgerRevision(
      loaded.value.sourceRevision,
      revision.source.sourceRevision
    )) {
      return {
        diagnostics: [],
        opened: {
          diagnostics: [],
          reader: createStateIndexReader({
            definition,
            index: loaded.value,
            indexPath: testEvidenceLedgerIndexPath
          }),
          revisionSource: revision.source
        }
      };
    }
    persistentDiagnostics = [{
      code: "state-index.index-stale",
      message: "index source revision does not match the current ledger source revision",
      path: testEvidenceLedgerIndexPath,
      stateId: null
    }];
  } else {
    persistentDiagnostics = loaded.diagnostics;
  }

  if (
    persistentDiagnostics.length === 0
    || !persistentDiagnostics.every((entry) => indexCanBeRebuilt(entry.code))
  ) {
    return {
      diagnostics: mapStateIndexDiagnostics(persistentDiagnostics),
      opened: null
    };
  }

  const source = await readTestEvidenceLedgerSource(root);
  if (source.source === null) {
    return { diagnostics: source.diagnostics, opened: null };
  }
  const fallbackDefinition = createTestEvidenceLedgerStateIndexDefinition({
    snapshot: source.source.snapshot
  });
  const built = await buildStateIndex(fallbackDefinition, { root });
  if (built.status === "error") {
    return {
      diagnostics: [
        ...mapStateIndexDiagnostics(persistentDiagnostics),
        ...mapStateIndexDiagnostics(built.diagnostics)
      ],
      opened: null
    };
  }
  const currentRevision = await readTestEvidenceLedgerRevision(root);
  if (currentRevision.source === null) {
    return { diagnostics: currentRevision.diagnostics, opened: null };
  }
  if (!sameTestEvidenceLedgerRevision(
    built.value.sourceRevision,
    currentRevision.source.sourceRevision
  )) {
    return {
      diagnostics: [createTestEvidenceDiagnostic({
        category: "index",
        code: "state-index.source-changed",
        message: "ledger source revision changed while building the in-memory projection; retry after the source is stable",
        path: testEvidenceLedgerIndexPath,
        severity: "error"
      })],
      opened: null
    };
  }

  const warnings = fallbackWarnings(persistentDiagnostics);
  return {
    diagnostics: warnings,
    opened: {
      diagnostics: warnings,
      reader: createStateIndexReader({
        definition: fallbackDefinition,
        index: built.value,
        indexPath: testEvidenceLedgerIndexPath
      }),
      revisionSource: currentRevision.source
    }
  };
}

function caseQueryFilters(
  options: QueryTestEvidenceCasesOptions
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
  if (options.testId !== undefined) {
    filters.push({
      key: "test",
      kind: "exact",
      operator: "all",
      values: [options.testId]
    });
  }
  if (options.tag !== undefined) {
    filters.push({
      key: "tag",
      kind: "exact",
      operator: "all",
      values: [options.tag]
    });
  }
  return filters;
}

function fallbackWarnings(
  diagnostics: readonly StateIndexDiagnostic[]
): TestEvidenceDiagnostic[] {
  return mapStateIndexDiagnostics(diagnostics, "warning").map((entry) => ({
    ...entry,
    message: `${entry.message}. Used the current ledger sources in memory for this read-only query; run sync-index --write to refresh ${testEvidenceLedgerIndexPath}`
  }));
}

function entityMatchesQuery(entity: TestEntity, query?: string): boolean {
  if (query === undefined) {
    return true;
  }
  const text = normalizeSearchText([
    entity.id,
    entity.name,
    ...entity.locators
  ].join(" "));
  return normalizeSearchText(query)
    .split(/\s+/u)
    .every((term) => text.includes(term));
}

function normalizeSearchText(value: string): string {
  return value.normalize("NFKC").toLowerCase().trim();
}

function caseQueryFailure(
  diagnostics: readonly TestEvidenceDiagnostic[],
  options: Partial<QueryTestEvidenceCasesOptions> | unknown
): TestEvidenceCaseQueryResult {
  const value = isObject(options) ? options : {};
  return v.parse(testEvidenceCaseQueryResultSchema, {
    cases: [] satisfies TestEvidenceLedgerCaseSummary[],
    diagnostics: [...diagnostics],
    indexPath: testEvidenceLedgerIndexPath,
    ledgerPath: testEvidenceLedgerPath,
    limit: validFailureLimit(value.limit),
    offset: validFailureOffset(value.offset),
    schemaVersion: testEvidenceLedgerSchemaVersion,
    total: 0
  });
}

function testQueryFailure(
  diagnostics: readonly TestEvidenceDiagnostic[],
  options: Partial<QueryTestEntitiesOptions> | unknown
): TestEvidenceTestQueryResult {
  const value = isObject(options) ? options : {};
  return v.parse(testEvidenceTestQueryResultSchema, {
    diagnostics: [...diagnostics],
    indexPath: testEvidenceLedgerIndexPath,
    ledgerPath: testEvidenceLedgerPath,
    limit: validFailureLimit(value.limit),
    offset: validFailureOffset(value.offset),
    schemaVersion: testEvidenceLedgerSchemaVersion,
    tests: [],
    total: 0
  });
}

function optionsDiagnostic(
  issues: readonly { message: string }[]
): TestEvidenceDiagnostic {
  return createTestEvidenceDiagnostic({
    category: "query",
    code: "query.options-invalid",
    message: `Invalid ledger API options: ${issues.map((issue) => issue.message).join("; ")}`,
    severity: "error"
  });
}

function validFailureLimit(value: unknown): number {
  return typeof value === "number"
    && Number.isSafeInteger(value)
    && value >= 1
    && value <= stateIndexQueryMaximumLimit
    ? value
    : testEvidenceLedgerQueryDefaultLimit;
}

function validFailureOffset(value: unknown): number {
  return typeof value === "number"
    && Number.isSafeInteger(value)
    && value >= 0
    ? value
    : 0;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

export function sameTargetRevision(options: {
  caseId: string;
  current: StateSourceRevision;
  observedFingerprint: string;
  opened: StateSourceRevision;
}): boolean {
  return options.current.metadata === options.opened.metadata
    && options.observedFingerprint === options.opened.entries[options.caseId]
    && options.current.entries[options.caseId]
      === options.observedFingerprint;
}
