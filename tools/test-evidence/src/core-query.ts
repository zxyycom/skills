import path from "node:path";
import * as v from "valibot";
import {
  createStateIndexReader,
  expectationOf,
  loadStateIndex
} from "../../index-runtime/src/index.ts";
import {
  queryLimitSchema,
  queryOffsetSchema,
  testEvidenceIndexPath,
  testEvidenceSchemaVersion,
  type TestEvidenceCaseIndexState,
  type TestEvidenceDiagnostic
} from "./core-schemas.ts";
import { definition, mapIndex } from "./core-index.ts";
import { diagnostic } from "./core-support.ts";
import { readSingleCase } from "./core-source.ts";

export const testEvidenceQueryDefaultLimit = 20;
export async function openIndex(root: string) {
  const current = definition();
  const result = await loadStateIndex({
    context: { root: path.resolve(root) },
    definition: current,
    expectation: expectationOf(current),
    indexPath: testEvidenceIndexPath
  });
  if (result.status === "error")
    return { diagnostics: mapIndex(result.diagnostics), reader: null };
  return {
    diagnostics: [] as TestEvidenceDiagnostic[],
    reader: createStateIndexReader({
      definition: current,
      index: result.value,
      indexPath: testEvidenceIndexPath
    }),
    index: result.value
  };
}
export function paging(input: { limit?: number; offset?: number }) {
  const limit = parsePageLimit(input.limit);
  const offset = parsePageOffset(input.offset);
  return limit.success && offset.success
    ? { limit: limit.output, offset: offset.output, error: null }
    : {
        limit: testEvidenceQueryDefaultLimit,
        offset: 0,
        error: diagnostic(
          "query",
          "query.options-invalid",
          "limit or offset is invalid"
        )
      };
}
function parsePageLimit(limit: number | undefined) {
  return v.safeParse(queryLimitSchema, limit ?? testEvidenceQueryDefaultLimit);
}
function parsePageOffset(offset: number | undefined) {
  return v.safeParse(queryOffsetSchema, offset ?? 0);
}
export async function queryTestEvidence(options: {
  workspaceRoot: string;
  caseId?: string;
  tags?: readonly string[];
  testId?: string;
  limit?: number;
  offset?: number;
}) {
  const page = paging(options);
  const opened = await openIndex(options.workspaceRoot);
  const diagnostics = [
    ...opened.diagnostics,
    ...(page.error === null ? [] : [page.error])
  ];
  const base = {
    schemaVersion: testEvidenceSchemaVersion,
    source: "index" as const,
    currentness: "unchecked" as const,
    limit: page.limit,
    offset: page.offset
  };
  if (opened.reader === null || page.error !== null)
    return { ...base, diagnostics, cases: [], total: 0 };
  const matches = (state: TestEvidenceCaseIndexState) =>
    (options.tags ?? []).every((tag) => state.tags.includes(tag)) &&
    (options.testId === undefined || state.testIds.includes(options.testId));
  if (options.caseId !== undefined)
    return queryOne(
      opened.reader,
      options.caseId,
      matches,
      page,
      base,
      diagnostics
    );
  return queryMany(opened.reader, options, page, base, diagnostics);
}
function queryMany(
  reader: NonNullable<Awaited<ReturnType<typeof openIndex>>["reader"]>,
  options: { tags?: readonly string[]; testId?: string },
  page: { limit: number; offset: number },
  base: QueryBase,
  diagnostics: TestEvidenceDiagnostic[]
) {
  const result = reader.query({
    filters: queryFilters(options),
    limit: page.limit,
    offset: page.offset,
    sort: [{ key: "id", direction: "asc" }]
  });
  if (result.status === "error")
    return {
      ...base,
      diagnostics: [...diagnostics, ...mapIndex(result.diagnostics)],
      cases: [],
      total: 0
    };
  return {
    ...base,
    diagnostics,
    cases: result.value.entries.map(indexEntryCase),
    total: result.value.total,
    limit: result.value.limit,
    offset: result.value.offset
  };
}
type QueryBase = Readonly<{
  currentness: "unchecked";
  limit: number;
  offset: number;
  schemaVersion: typeof testEvidenceSchemaVersion;
  source: "index";
}>;
function indexEntryCase(entry: {
  id: string;
  state: TestEvidenceCaseIndexState;
}) {
  return { id: entry.id, ...entry.state };
}
function queryOne(
  reader: NonNullable<Awaited<ReturnType<typeof openIndex>>["reader"]>,
  caseId: string,
  matches: (state: TestEvidenceCaseIndexState) => boolean,
  page: { limit: number; offset: number },
  base: {
    schemaVersion: typeof testEvidenceSchemaVersion;
    source: "index";
    currentness: "unchecked";
    limit: number;
    offset: number;
  },
  diagnostics: TestEvidenceDiagnostic[]
) {
  const found = reader.get(caseId);
  if (found.status === "error")
    return {
      ...base,
      diagnostics: [...diagnostics, ...mapIndex(found.diagnostics)],
      cases: [],
      total: 0
    };
  const entries =
    found.value !== null && matches(found.value.state) ? [found.value] : [];
  return {
    ...base,
    diagnostics,
    cases: entries
      .slice(page.offset, page.offset + page.limit)
      .map(indexEntryCase),
    total: entries.length
  };
}
function queryFilters(options: { tags?: readonly string[]; testId?: string }) {
  return [
    ...(options.tags ?? []).map((tag) => ({
      kind: "exact" as const,
      key: "tag",
      operator: "all" as const,
      values: [tag]
    })),
    ...(options.testId === undefined
      ? []
      : [
          {
            kind: "exact" as const,
            key: "test",
            operator: "all" as const,
            values: [options.testId]
          }
        ])
  ];
}
export async function listTestEvidenceTags(options: { workspaceRoot: string }) {
  const opened = await openIndex(options.workspaceRoot);
  if (opened.reader === null) return tagFailure(opened.diagnostics);
  const all = opened.reader.all({ sort: [{ key: "id", direction: "asc" }] });
  if (all.status === "error")
    return tagFailure([...opened.diagnostics, ...mapIndex(all.diagnostics)]);
  const counts = new Map<string, number>();
  for (const entry of all.value)
    for (const tag of entry.state.tags)
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
  return {
    schemaVersion: testEvidenceSchemaVersion,
    source: "index" as const,
    currentness: "unchecked" as const,
    diagnostics: opened.diagnostics,
    tags: [...counts]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([tag, caseCount]) => ({ tag, caseCount }))
  };
}
function tagFailure(diagnostics: TestEvidenceDiagnostic[]) {
  return {
    schemaVersion: testEvidenceSchemaVersion,
    source: "index" as const,
    currentness: "unchecked" as const,
    diagnostics,
    tags: []
  };
}
export async function showTestEvidenceCase(options: {
  workspaceRoot: string;
  caseId: string;
}) {
  const opened = await openIndex(options.workspaceRoot);
  if (opened.reader === null) return showFailure(opened.diagnostics);
  const found = opened.reader.get(options.caseId);
  if (found.status === "error")
    return showFailure([...opened.diagnostics, ...mapIndex(found.diagnostics)]);
  if (found.value === null)
    return showFailure([
      ...opened.diagnostics,
      diagnostic(
        "query",
        "query.case-missing",
        `Test evidence Case does not exist: ${options.caseId}`,
        { caseId: options.caseId }
      )
    ]);
  const source = await readSingleCase(
    options.workspaceRoot,
    found.value.state.sourcePath
  );
  if (source.value === null)
    return showFailure([...opened.diagnostics, ...source.diagnostics]);
  if (!matchesIndexedCase(source.value, opened.index, options.caseId))
    return showFailure([
      ...opened.diagnostics,
      diagnostic(
        "index",
        "state-index.index-stale",
        `${testEvidenceIndexPath} does not match the authoritative Case`,
        { caseId: options.caseId, path: testEvidenceIndexPath }
      )
    ]);
  return {
    schemaVersion: testEvidenceSchemaVersion,
    diagnostics: opened.diagnostics,
    case: source.value.case,
    markdown: source.value.markdown,
    indexPath: testEvidenceIndexPath
  };
}
function matchesIndexedCase(
  source: NonNullable<Awaited<ReturnType<typeof readSingleCase>>["value"]>,
  index: Awaited<ReturnType<typeof openIndex>>["index"],
  caseId: string
): boolean {
  return (
    source.case.id === caseId &&
    source.fingerprint === index?.sourceRevision.entries[caseId]
  );
}
function showFailure(diagnostics: TestEvidenceDiagnostic[]) {
  return {
    schemaVersion: testEvidenceSchemaVersion,
    diagnostics: [...diagnostics],
    case: null,
    markdown: null,
    indexPath: testEvidenceIndexPath
  };
}
