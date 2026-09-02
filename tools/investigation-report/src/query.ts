import fs from "node:fs/promises";
import path from "node:path";
import {
  err,
  errAsync,
  fromThrowable,
  ok,
  ResultAsync,
  type Result
} from "neverthrow";
import {
  queryStateIndex,
  stateIndexQueryDefaultLimit,
  stateIndexQueryMaximumLimit,
  type StateIndexFilter
} from "../../index-runtime/src/index.ts";
import {
  createInvestigationStateIndexDefinition,
  investigationIndexDiagnosticMessages,
  investigationIndexFileName,
  loadCurrentInvestigationIndex
} from "./investigation-state-index.ts";
import {
  diagnosticFromError,
  diagnosticFromStateIndexDiagnostic,
  type InvestigationDiagnostic
} from "./diagnostics.ts";
import {
  parseInvestigationIndexQueryOptions,
  parseInvestigationReportShowOptions,
  parseInvestigationReportTraceOptions
} from "./options.ts";
import {
  canonicalizeInvestigationsDirectory,
  defaultInvestigationsDirectory,
  isInvestigationId,
  isInvestigationTag,
  reportPathForInvestigationId,
  resolveInvestigationsDirectory,
  type ResolvedInvestigationsDirectory
} from "./report-path.ts";
import { isInvestigationRelationType } from "./report-validation.ts";
import { traceInvestigationRelations } from "./relation-validation.ts";
import { investigationTimestampMilliseconds } from "./timestamp.ts";
import type {
  InvestigationIndexQueryOptions,
  InvestigationIndexQueryResult,
  InvestigationReportShowOptions,
  InvestigationReportShowResult,
  InvestigationReportTraceOptions,
  InvestigationReportTraceResult
} from "./types.ts";

type InvestigationIndexQueryFailure = Readonly<{
  kind: "invalid-options" | "operation";
  result: InvestigationIndexQueryResult;
}>;
type PreparedQuery = Readonly<{
  indexPath: string;
  resolved: ResolvedInvestigationsDirectory;
  validated: ValidatedQueryOptions;
}>;
type ValidatedQueryOptions = Readonly<{
  filters: StateIndexFilter[];
  limit: number;
  offset: number;
}>;
type QueryOptionValidationFailure = Readonly<{
  errors: string[];
  limit: number;
  offset: number;
}>;
type QueryOperationFailure = Readonly<{
  diagnostics: InvestigationDiagnostic[];
  errors: string[];
}>;

export async function queryInvestigationIndex(
  options: InvestigationIndexQueryOptions
): Promise<InvestigationIndexQueryResult> {
  const executed = await executeInvestigationIndexQuery(options);
  return executed.match(
    (result) => result,
    (failure) => failure.result
  );
}

export function executeInvestigationIndexQuery(
  input: unknown
): ResultAsync<InvestigationIndexQueryResult, InvestigationIndexQueryFailure> {
  const prepared = prepareQuery(input);
  if (prepared.isErr()) {
    return errAsync(prepared.error);
  }
  return canonicalizeInvestigationsDirectory(prepared.value.resolved)
    .mapErr((errors) =>
      queryFailure(
        "operation",
        errors,
        prepared.value.indexPath,
        prepared.value.validated.limit,
        prepared.value.validated.offset
      )
    )
    .andThen((canonical) =>
      queryValidatedInvestigationIndex(
        canonical.investigationsDirectory,
        prepared.value.validated
      ).mapErr((failure) =>
        queryFailure(
          "operation",
          failure.errors,
          path.join(
            canonical.investigationsDirectory,
            investigationIndexFileName
          ),
          prepared.value.validated.limit,
          prepared.value.validated.offset,
          failure.diagnostics
        )
      )
    );
}

export async function showInvestigationReport(
  input: unknown
): Promise<InvestigationReportShowResult> {
  const parsed = parseInvestigationReportShowOptions(input);
  const rawId = rawStringField(input, "id") ?? "";
  if (parsed.isErr())
    return showFailure(rawId, defaultInvestigationIndexPath(), parsed.error);
  const { id } = parsed.value;
  if (!isInvestigationId(id))
    return showFailure(id, investigationIndexPathForOptions(parsed.value), [
      `${id || "<empty>"} must use an Investigation ID`
    ]);
  const loaded = await loadIndexedInvestigationContext(
    parsed.value,
    "correct the reported derived-index problem, then retry showing the report"
  );
  if (loaded.isErr()) {
    return showFailure(
      id,
      loaded.error.indexPath,
      loaded.error.errors,
      loaded.error.diagnostics
    );
  }
  const { index, indexPath, investigationsDirectory } = loaded.value;
  const entry = index.entries[id];
  if (entry === undefined) {
    return showFailure(id, indexPath, [
      `${id} investigation report does not exist`
    ]);
  }
  return await readShownInvestigation(
    investigationsDirectory,
    indexPath,
    id,
    entry.state
  );
}

type CurrentInvestigationIndex = Extract<
  LoadedInvestigationIndex,
  { status: "ok" }
>["value"];
type IndexedInvestigationContext = Readonly<{
  index: CurrentInvestigationIndex;
  indexPath: string;
  investigationsDirectory: string;
}>;
type IndexedInvestigationFailure = QueryOperationFailure & {
  indexPath: string;
};
type InvestigationQueryLocationOptions = Pick<
  InvestigationReportShowOptions,
  "investigationsDir" | "workspaceRoot"
>;

async function loadIndexedInvestigationContext(
  options: InvestigationQueryLocationOptions,
  recovery: string
): Promise<Result<IndexedInvestigationContext, IndexedInvestigationFailure>> {
  const fallbackIndexPath = investigationIndexPathForOptions(options);
  const resolved = resolveInvestigationsDirectory(
    options.workspaceRoot,
    options.investigationsDir
  );
  if (resolved.isErr()) {
    return err({
      diagnostics: [],
      errors: resolved.error,
      indexPath: fallbackIndexPath
    });
  }
  const canonical = await canonicalizeInvestigationsDirectory(resolved.value);
  if (canonical.isErr()) {
    return err({
      diagnostics: [],
      errors: canonical.error,
      indexPath: fallbackIndexPath
    });
  }
  const investigationsDirectory = canonical.value.investigationsDirectory;
  const indexPath = path.join(
    investigationsDirectory,
    investigationIndexFileName
  );
  const loaded = await loadCurrentInvestigationIndex({
    investigationsDirectory
  });
  if (loaded.status === "error") {
    return err({
      diagnostics: loaded.diagnostics.map((diagnostic) =>
        diagnosticFromStateIndexDiagnostic(diagnostic, {
          recovery,
          target: indexPath
        })
      ),
      errors: investigationIndexDiagnosticMessages(
        loaded.diagnostics,
        indexPath
      ),
      indexPath
    });
  }
  return ok({ index: loaded.value, indexPath, investigationsDirectory });
}

async function readShownInvestigation(
  investigationsDirectory: string,
  indexPath: string,
  id: string,
  state: NonNullable<InvestigationReportShowResult["state"]>
): Promise<InvestigationReportShowResult> {
  const target = reportPathForInvestigationId(investigationsDirectory, id);
  try {
    return {
      errors: [],
      diagnostics: [],
      id,
      indexPath,
      markdown: await fs.readFile(target, "utf8"),
      state,
      status: "ok"
    };
  } catch (error) {
    return showFailure(
      id,
      indexPath,
      [`${id} could not be read`],
      [
        diagnosticFromError({
          code: "investigation-report.report-read-failed",
          error,
          reason: "the selected investigation report could not be read",
          recovery: "restore read access to the report, then retry show",
          target
        })
      ]
    );
  }
}

export async function traceInvestigationReports(
  input: unknown
): Promise<InvestigationReportTraceResult> {
  const parsed = parseInvestigationReportTraceOptions(input);
  const rawId = rawStringField(input, "id") ?? "";
  if (parsed.isErr()) {
    return traceFailure(rawId, defaultInvestigationIndexPath(), [
      ...parsed.error
    ]);
  }
  const options = parsed.value;
  if (!isInvestigationId(options.id))
    return traceFailure(options.id, investigationIndexPathForOptions(options), [
      `${options.id || "<empty>"} must use an Investigation ID`
    ]);
  const { id } = options;
  const traceOptions = validatedTraceOptions(options);
  if (traceOptions === null) {
    return traceFailure(id, investigationIndexPathForOptions(parsed.value), [
      "maxDepth must be a non-negative integer"
    ]);
  }
  const loaded = await loadIndexedInvestigationContext(
    options,
    "correct the reported derived-index problem, then retry tracing reports"
  );
  if (loaded.isErr()) {
    return traceFailure(
      id,
      loaded.error.indexPath,
      loaded.error.errors,
      loaded.error.diagnostics
    );
  }
  const { index, indexPath } = loaded.value;
  if (index.entries[id] === undefined) {
    return traceFailure(id, indexPath, [
      `${id} investigation report does not exist`
    ]);
  }
  const trace = traceInvestigationRelations(
    new Map(
      Object.entries(index.entries).map(([reportId, entry]) => [
        reportId,
        entry.state
      ])
    ),
    id,
    traceOptions
  );
  return {
    edges: trace.edges.map((edge) => ({
      source: edge.source,
      target: edge.target,
      type: edge.type
    })),
    diagnostics: [],
    errors: [],
    id,
    indexPath,
    reportIds: [...trace.ids].sort(compareText),
    status: "ok"
  };
}

function validatedTraceOptions(options: InvestigationReportTraceOptions): {
  direction: NonNullable<InvestigationReportTraceOptions["direction"]>;
  maxDepth: number | null;
} | null {
  const direction = options.direction ?? "both";
  const maxDepth = options.maxDepth ?? null;
  return Number.isSafeInteger(maxDepth ?? 0) &&
    (maxDepth === null || maxDepth >= 0)
    ? { direction, maxDepth }
    : null;
}

function rawStringField(input: unknown, field: string): string | undefined {
  if (typeof input !== "object" || input === null || Array.isArray(input))
    return undefined;
  const value = Reflect.get(input, field);
  return typeof value === "string" ? value : undefined;
}

function prepareQuery(
  input: unknown
): Result<PreparedQuery, InvestigationIndexQueryFailure> {
  const parsed = parseInvestigationIndexQueryOptions(input);
  if (parsed.isErr()) {
    return err(
      queryFailure(
        "invalid-options",
        parsed.error,
        defaultInvestigationIndexPath(),
        stateIndexQueryDefaultLimit,
        0
      )
    );
  }
  const resolved = resolveInvestigationsDirectory(
    parsed.value.workspaceRoot,
    parsed.value.investigationsDir
  );
  const validated = validateQueryOptions(parsed.value);
  if (resolved.isErr() || validated.isErr()) {
    return err(
      queryFailure(
        "invalid-options",
        [
          ...(resolved.isErr() ? resolved.error : []),
          ...(validated.isErr() ? validated.error.errors : [])
        ],
        investigationIndexPathForOptions(parsed.value),
        validated.isErr() ? validated.error.limit : validated.value.limit,
        validated.isErr() ? validated.error.offset : validated.value.offset
      )
    );
  }
  return ok({
    indexPath: path.join(
      resolved.value.investigationsDirectory,
      investigationIndexFileName
    ),
    resolved: resolved.value,
    validated: validated.value
  });
}

function queryValidatedInvestigationIndex(
  investigationsDirectory: string,
  validated: ValidatedQueryOptions
): ResultAsync<InvestigationIndexQueryResult, QueryOperationFailure> {
  const indexPath = path.join(
    investigationsDirectory,
    investigationIndexFileName
  );
  return ResultAsync.fromPromise(
    loadCurrentInvestigationIndex({ investigationsDirectory }),
    (error) =>
      queryOperationFailure(
        error,
        "the derived index could not be loaded for the query",
        indexPath
      )
  ).andThen((loaded) =>
    queryLoadedInvestigationIndex(loaded, validated, indexPath)
  );
}

type LoadedInvestigationIndex = Awaited<
  ReturnType<typeof loadCurrentInvestigationIndex>
>;

function queryLoadedInvestigationIndex(
  loaded: LoadedInvestigationIndex,
  validated: ValidatedQueryOptions,
  indexPath: string
) {
  if (loaded.status === "error") {
    return err(indexQueryDiagnostics(loaded.diagnostics, indexPath));
  }
  return fromThrowable(
    () =>
      queryStateIndex({
        definition: createInvestigationStateIndexDefinition(),
        index: loaded.value,
        query: {
          filters: validated.filters,
          limit: validated.limit,
          offset: validated.offset,
          sort: [{ direction: "asc", key: "id" }]
        }
      }),
    (error) =>
      queryOperationFailure(
        error,
        "the derived index query could not be completed",
        indexPath
      )
  )().andThen((queried) =>
    queried.status === "error"
      ? err(indexQueryDiagnostics(queried.diagnostics, indexPath))
      : ok({
          diagnostics: [],
          entries: queried.value.entries.map((entry) => ({
            id: entry.id,
            state: entry.state
          })),
          errors: [],
          indexPath,
          limit: queried.value.limit,
          offset: queried.value.offset,
          total: queried.value.total
        })
  );
}

function indexQueryDiagnostics(
  diagnostics: Parameters<typeof investigationIndexDiagnosticMessages>[0],
  indexPath: string
): QueryOperationFailure {
  return {
    diagnostics: diagnostics.map((diagnostic) =>
      diagnosticFromStateIndexDiagnostic(diagnostic, {
        recovery:
          "correct the reported derived-index problem, then retry the query",
        target: indexPath
      })
    ),
    errors: investigationIndexDiagnosticMessages(diagnostics, indexPath)
  };
}

function validateQueryOptions(
  options: InvestigationIndexQueryOptions
): Result<ValidatedQueryOptions, QueryOptionValidationFailure> {
  const errors: string[] = [];
  const filters: StateIndexFilter[] = [];
  const limit = options.limit ?? stateIndexQueryDefaultLimit;
  const offset = options.offset ?? 0;
  validateQueryPagination(limit, offset, errors);
  validateTagFilters(options.tags, filters, errors);
  validateRelationTypeFilter(options.relationType, filters, errors);
  validateTextFilter(options.text, filters, errors);
  validateTimestampFilters(options, filters, errors);
  const uniqueErrors = uniqueSorted(errors);
  return uniqueErrors.length > 0
    ? err({ errors: uniqueErrors, limit, offset })
    : ok({ filters, limit, offset });
}

function validateQueryPagination(
  limit: number,
  offset: number,
  errors: string[]
): void {
  if (
    !Number.isSafeInteger(limit) ||
    limit < 1 ||
    limit > stateIndexQueryMaximumLimit
  ) {
    errors.push(
      `limit must be an integer from 1 to ${stateIndexQueryMaximumLimit}`
    );
  }
  if (!Number.isSafeInteger(offset) || offset < 0) {
    errors.push("offset must be a non-negative integer");
  }
}

function validateTagFilters(
  input: readonly string[] | undefined,
  filters: StateIndexFilter[],
  errors: string[]
): void {
  const tags = uniqueSorted((input ?? []).map((tag) => tag.trim()));
  const invalidTags = tags.filter((tag) => !isInvestigationTag(tag));
  for (const tag of invalidTags) {
    errors.push(`tag filter must use kebab-case: ${tag || "<empty>"}`);
  }
  if (tags.length > 0 && invalidTags.length === 0) {
    filters.push({ key: "tag", kind: "exact", operator: "all", values: tags });
  }
}

function validateRelationTypeFilter(
  relationType: InvestigationIndexQueryOptions["relationType"],
  filters: StateIndexFilter[],
  errors: string[]
): void {
  if (
    relationType !== undefined &&
    !isInvestigationRelationType(relationType)
  ) {
    errors.push(`unknown investigation relation type: ${String(relationType)}`);
  } else if (relationType !== undefined) {
    filters.push({
      key: "relation-type",
      kind: "exact",
      operator: "any",
      values: [relationType]
    });
  }
}

function validateTextFilter(
  input: string | undefined,
  filters: StateIndexFilter[],
  errors: string[]
): void {
  const text = input?.trim();
  if (input !== undefined && text?.length === 0) {
    errors.push("text filter must not be empty");
  } else if (text !== undefined) {
    filters.push({ key: "text", kind: "text", operator: "all", text });
  }
}

function validateTimestampFilters(
  options: InvestigationIndexQueryOptions,
  filters: StateIndexFilter[],
  errors: string[]
): void {
  const from = timestampFilter(
    options.formedAtFrom,
    "formedAt lower bound",
    errors
  );
  const to = timestampFilter(
    options.formedAtTo,
    "formedAt upper bound",
    errors
  );
  if (from !== null && to !== null && from > to) {
    errors.push("formedAt lower bound must not be after the upper bound");
  }
  if (from !== null) {
    filters.push({
      key: "formed-at",
      kind: "range",
      operator: "gte",
      value: from
    });
  }
  if (to !== null) {
    filters.push({
      key: "formed-at",
      kind: "range",
      operator: "lte",
      value: to
    });
  }
}

function timestampFilter(
  value: string | undefined,
  label: string,
  errors: string[]
): number | null {
  if (value === undefined) return null;
  const milliseconds = investigationTimestampMilliseconds(value.trim());
  if (milliseconds === null) {
    errors.push(
      `${label} must be an RFC 3339 timestamp with timezone and second precision`
    );
  }
  return milliseconds;
}
function queryFailure(
  kind: InvestigationIndexQueryFailure["kind"],
  errors: readonly string[],
  indexPath: string,
  limit: number,
  offset: number,
  diagnostics: readonly InvestigationDiagnostic[] = []
): InvestigationIndexQueryFailure {
  return {
    kind,
    result: {
      entries: [],
      diagnostics: [...diagnostics],
      errors: uniqueSorted(errors),
      indexPath,
      limit,
      offset,
      total: 0
    }
  };
}
function showFailure(
  id: string,
  indexPath: string,
  errors: readonly string[],
  diagnostics: readonly InvestigationDiagnostic[] = []
): InvestigationReportShowResult {
  return {
    errors: uniqueSorted(errors),
    diagnostics: [...diagnostics],
    id,
    indexPath,
    markdown: null,
    state: null,
    status: "error"
  };
}
function traceFailure(
  id: string,
  indexPath: string,
  errors: readonly string[],
  diagnostics: readonly InvestigationDiagnostic[] = []
): InvestigationReportTraceResult {
  return {
    edges: [],
    diagnostics: [...diagnostics],
    errors: uniqueSorted(errors),
    id,
    indexPath,
    reportIds: [],
    status: "error"
  };
}
function defaultInvestigationIndexPath(): string {
  return path.join(
    path.resolve("."),
    defaultInvestigationsDirectory,
    investigationIndexFileName
  );
}
function investigationIndexPathForOptions(options: {
  investigationsDir?: string;
  workspaceRoot: string;
}): string {
  return path.join(
    path.resolve(
      options.workspaceRoot,
      options.investigationsDir ?? defaultInvestigationsDirectory
    ),
    investigationIndexFileName
  );
}
function uniqueSorted(values: readonly string[]): string[] {
  return [...new Set(values)].sort(compareText);
}
function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
function queryOperationFailure(
  error: unknown,
  reason: string,
  indexPath: string
): QueryOperationFailure {
  return {
    diagnostics: [
      diagnosticFromError({
        code: "investigation-report.index-query-unavailable",
        error,
        reason,
        recovery: "correct the reported index problem, then retry the query",
        target: indexPath
      })
    ],
    errors: ["investigation index query could not be completed"]
  };
}
