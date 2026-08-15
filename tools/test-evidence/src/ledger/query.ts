import * as v from "valibot";
import { type StateIndexFilter } from "../../../index-runtime/src/index.ts";
import { compareLexicalText } from "./canonicalization.ts";
import {
  createInvalidTestEvidenceOptionsDiagnostic,
  createTestEvidenceDiagnostic
} from "./diagnostics.ts";
import { openTestEvidenceLedgerIndex } from "./index-reader.ts";
import { mapStateIndexDiagnostics } from "./state-index.ts";
import {
  queryTestEntitiesOptionsSchema,
  queryTestEvidenceCasesOptionsSchema,
  testEvidenceCaseQueryResultSchema,
  testEvidenceLedgerIndexPath,
  testEvidenceLedgerPath,
  testEvidenceQueryLimitSchema,
  testEvidenceQueryOffsetSchema,
  testEvidenceLedgerSchemaVersion,
  testEvidenceTestQueryResultSchema,
  type QueryTestEntitiesOptions,
  type QueryTestEvidenceCasesOptions,
  type TestEntity,
  type TestEvidenceCaseQueryResult,
  type TestEvidenceDiagnostic,
  type TestEvidenceLedgerCaseSummary,
  type TestEvidenceTestQueryItem,
  type TestEvidenceTestQueryResult
} from "./schemas.ts";

export const testEvidenceLedgerQueryDefaultLimit = 20;

export async function queryTestEvidenceCases(
  options: QueryTestEvidenceCasesOptions
): Promise<TestEvidenceCaseQueryResult> {
  const parsedOptions = v.safeParse(
    queryTestEvidenceCasesOptionsSchema,
    options
  );
  if (!parsedOptions.success) {
    return caseQueryFailure(
      [createInvalidTestEvidenceOptionsDiagnostic(parsedOptions.issues)],
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
    normalizedOptions.testId !== undefined &&
    !opened.opened.revisionSource.entityIndex.value.entities.some(
      (entity) => entity.id === normalizedOptions.testId
    )
  ) {
    return caseQueryFailure(
      [
        ...opened.diagnostics,
        createTestEvidenceDiagnostic({
          category: "query",
          code: "query.test-unknown",
          message: `Unknown Test entity: ${normalizedOptions.testId}`,
          severity: "error",
          testId: normalizedOptions.testId
        })
      ],
      normalizedOptions
    );
  }

  const queried = opened.opened.reader.query({
    filters: caseQueryFilters(normalizedOptions),
    limit: normalizedOptions.limit ?? testEvidenceLedgerQueryDefaultLimit,
    offset: normalizedOptions.offset,
    sort: [{ direction: "asc", key: "id" }]
  });
  if (queried.status === "error") {
    return caseQueryFailure(
      [...opened.diagnostics, ...mapStateIndexDiagnostics(queried.diagnostics)],
      normalizedOptions
    );
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
    diagnostics: opened.diagnostics,
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
      [createInvalidTestEvidenceOptionsDiagnostic(parsedOptions.issues)],
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
    return testQueryFailure(
      [
        ...opened.diagnostics,
        ...mapStateIndexDiagnostics(allCases.diagnostics)
      ],
      normalizedOptions
    );
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
      caseIds: [...(caseIdsByTest.get(entity.id) ?? [])].sort(
        compareLexicalText
      )
    }));
  const limit = normalizedOptions.limit ?? testEvidenceLedgerQueryDefaultLimit;
  const offset = normalizedOptions.offset ?? 0;
  return v.parse(testEvidenceTestQueryResultSchema, {
    diagnostics: opened.diagnostics,
    indexPath: testEvidenceLedgerIndexPath,
    ledgerPath: testEvidenceLedgerPath,
    limit,
    offset,
    schemaVersion: testEvidenceLedgerSchemaVersion,
    tests: filtered.slice(offset, offset + limit),
    total: filtered.length
  });
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

function entityMatchesQuery(entity: TestEntity, query?: string): boolean {
  if (query === undefined) {
    return true;
  }
  const text = normalizeSearchText(
    [entity.id, entity.name, ...entity.locators].join(" ")
  );
  return normalizeSearchText(query)
    .split(/\s+/u)
    .every((term) => text.includes(term));
}

function normalizeSearchText(value: string): string {
  return value.normalize("NFKC").toLowerCase().trim();
}

function caseQueryFailure(
  diagnostics: readonly TestEvidenceDiagnostic[],
  options: unknown
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
  options: unknown
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

function validFailureLimit(value: unknown): number {
  const parsed = v.safeParse(testEvidenceQueryLimitSchema, value);
  return parsed.success ? parsed.output : testEvidenceLedgerQueryDefaultLimit;
}

function validFailureOffset(value: unknown): number {
  const parsed = v.safeParse(testEvidenceQueryOffsetSchema, value);
  return parsed.success ? parsed.output : 0;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
