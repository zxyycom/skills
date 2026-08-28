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
  buildRelationGraph,
  traceRelationGraph
} from "../../shared/src/graph/relations.ts";
import {
  createInvestigationStateIndexDefinition,
  investigationIndexDiagnosticMessages,
  investigationIndexFileName,
  loadCurrentInvestigationIndex
} from "./investigation-state-index.ts";
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
      ).mapErr((errors) =>
        queryFailure(
          "operation",
          errors,
          path.join(
            canonical.investigationsDirectory,
            investigationIndexFileName
          ),
          prepared.value.validated.limit,
          prepared.value.validated.offset
        )
      )
    );
}

export async function showInvestigationReport(
  options: InvestigationReportShowOptions
): Promise<InvestigationReportShowResult> {
  const parsed = parseInvestigationReportShowOptions(options);
  const id =
    typeof (options as { id?: unknown }).id === "string"
      ? (options as { id: string }).id
      : "";
  if (parsed.isErr() || !isInvestigationId(id)) {
    return showFailure(id, defaultInvestigationIndexPath(), [
      ...(parsed.isErr() ? parsed.error : []),
      `${id || "<empty>"} must use an Investigation ID`
    ]);
  }
  const resolved = resolveInvestigationsDirectory(
    parsed.value.workspaceRoot,
    parsed.value.investigationsDir
  );
  if (resolved.isErr()) {
    return showFailure(
      id,
      investigationIndexPathForOptions(parsed.value),
      resolved.error
    );
  }
  const canonical = await canonicalizeInvestigationsDirectory(resolved.value);
  if (canonical.isErr()) {
    return showFailure(
      id,
      investigationIndexPathForOptions(parsed.value),
      canonical.error
    );
  }
  const indexPath = path.join(
    canonical.value.investigationsDirectory,
    investigationIndexFileName
  );
  const loaded = await loadCurrentInvestigationIndex({
    investigationsDirectory: canonical.value.investigationsDirectory
  });
  if (loaded.status === "error") {
    return showFailure(
      id,
      indexPath,
      investigationIndexDiagnosticMessages(loaded.diagnostics, indexPath)
    );
  }
  const entry = loaded.value.entries[id];
  if (entry === undefined) {
    return showFailure(id, indexPath, [
      `${id} investigation report does not exist`
    ]);
  }
  try {
    return {
      errors: [],
      id,
      indexPath,
      markdown: await fs.readFile(
        reportPathForInvestigationId(
          canonical.value.investigationsDirectory,
          id
        ),
        "utf8"
      ),
      state: entry.state,
      status: "ok"
    };
  } catch (error) {
    return showFailure(id, indexPath, [
      `${id} could not be read: ${errorText(error)}`
    ]);
  }
}

export async function traceInvestigationReports(
  options: InvestigationReportTraceOptions
): Promise<InvestigationReportTraceResult> {
  const parsed = parseInvestigationReportTraceOptions(options);
  const id =
    typeof (options as { id?: unknown }).id === "string"
      ? (options as { id: string }).id
      : "";
  if (parsed.isErr() || !isInvestigationId(id)) {
    return traceFailure(id, defaultInvestigationIndexPath(), [
      ...(parsed.isErr() ? parsed.error : []),
      `${id || "<empty>"} must use an Investigation ID`
    ]);
  }
  const direction = parsed.value.direction ?? "both";
  const maxDepth = parsed.value.maxDepth ?? null;
  if (
    !Number.isSafeInteger(maxDepth ?? 0) ||
    (maxDepth !== null && maxDepth < 0)
  ) {
    return traceFailure(id, investigationIndexPathForOptions(parsed.value), [
      "maxDepth must be a non-negative integer"
    ]);
  }
  const resolved = resolveInvestigationsDirectory(
    parsed.value.workspaceRoot,
    parsed.value.investigationsDir
  );
  if (resolved.isErr()) {
    return traceFailure(
      id,
      investigationIndexPathForOptions(parsed.value),
      resolved.error
    );
  }
  const canonical = await canonicalizeInvestigationsDirectory(resolved.value);
  if (canonical.isErr()) {
    return traceFailure(
      id,
      investigationIndexPathForOptions(parsed.value),
      canonical.error
    );
  }
  const indexPath = path.join(
    canonical.value.investigationsDirectory,
    investigationIndexFileName
  );
  const loaded = await loadCurrentInvestigationIndex({
    investigationsDirectory: canonical.value.investigationsDirectory
  });
  if (loaded.status === "error") {
    return traceFailure(
      id,
      indexPath,
      investigationIndexDiagnosticMessages(loaded.diagnostics, indexPath)
    );
  }
  if (loaded.value.entries[id] === undefined) {
    return traceFailure(id, indexPath, [
      `${id} investigation report does not exist`
    ]);
  }
  const graph = buildRelationGraph(
    Object.keys(loaded.value.entries),
    Object.entries(loaded.value.entries).flatMap(([source, entry]) =>
      entry.state.relations.map((relation) => ({
        source,
        target: relation.target,
        type: relation.type
      }))
    )
  );
  const trace = traceRelationGraph(graph, id, { direction, maxDepth });
  return {
    edges: trace.edges.map((edge) => ({
      source: edge.source,
      target: edge.target,
      type: edge.type
    })),
    errors: [],
    id,
    indexPath,
    reportIds: [...trace.ids].sort(compareText),
    status: "ok"
  };
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
): ResultAsync<InvestigationIndexQueryResult, string[]> {
  const indexPath = path.join(
    investigationsDirectory,
    investigationIndexFileName
  );
  return ResultAsync.fromPromise(
    loadCurrentInvestigationIndex({ investigationsDirectory }),
    (error) => [
      `investigation index query could not be completed: ${errorText(error)}`
    ]
  ).andThen((loaded) => {
    if (loaded.status === "error") {
      return err(
        investigationIndexDiagnosticMessages(loaded.diagnostics, indexPath)
      );
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
      (error) => [
        `investigation index query could not be completed: ${errorText(error)}`
      ]
    )().andThen((queried) =>
      queried.status === "error"
        ? err(
            investigationIndexDiagnosticMessages(queried.diagnostics, indexPath)
          )
        : ok({
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
  });
}

function validateQueryOptions(
  options: InvestigationIndexQueryOptions
): Result<ValidatedQueryOptions, QueryOptionValidationFailure> {
  const errors: string[] = [];
  const filters: StateIndexFilter[] = [];
  const limit = options.limit ?? stateIndexQueryDefaultLimit;
  const offset = options.offset ?? 0;
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
  const tags = uniqueSorted((options.tags ?? []).map((tag) => tag.trim()));
  const invalidTags = tags.filter((tag) => !isInvestigationTag(tag));
  for (const tag of invalidTags) {
    errors.push(`tag filter must use kebab-case: ${tag || "<empty>"}`);
  }
  if (tags.length > 0 && invalidTags.length === 0) {
    filters.push({ key: "tag", kind: "exact", operator: "all", values: tags });
  }
  if (
    options.relationType !== undefined &&
    !isInvestigationRelationType(options.relationType)
  ) {
    errors.push(
      `unknown investigation relation type: ${String(options.relationType)}`
    );
  } else if (options.relationType !== undefined) {
    filters.push({
      key: "relation-type",
      kind: "exact",
      operator: "any",
      values: [options.relationType]
    });
  }
  const text = options.text?.trim();
  if (options.text !== undefined && text?.length === 0) {
    errors.push("text filter must not be empty");
  } else if (text !== undefined) {
    filters.push({ key: "text", kind: "text", operator: "all", text });
  }
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
  const uniqueErrors = uniqueSorted(errors);
  return uniqueErrors.length > 0
    ? err({ errors: uniqueErrors, limit, offset })
    : ok({ filters, limit, offset });
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
  offset: number
): InvestigationIndexQueryFailure {
  return {
    kind,
    result: {
      entries: [],
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
  errors: readonly string[]
): InvestigationReportShowResult {
  return {
    errors: uniqueSorted(errors),
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
  errors: readonly string[]
): InvestigationReportTraceResult {
  return {
    edges: [],
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
function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
