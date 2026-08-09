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
import { parseInvestigationIndexQueryOptions } from "./options.ts";
import {
  canonicalizeInvestigationsDirectory,
  defaultInvestigationsDirectory,
  isInvestigationCategory,
  isInvestigationTopicPath,
  normalizeInvestigationTopicPath,
  resolveInvestigationsDirectory,
  type ResolvedInvestigationsDirectory
} from "./report-path.ts";
import { investigationTimestampMilliseconds } from "./timestamp.ts";
import {
  type InvestigationIndexQueryOptions,
  type InvestigationIndexQueryResult
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
    .mapErr((errors) => queryFailure(
      "operation",
      errors,
      prepared.value.indexPath,
      prepared.value.validated.limit,
      prepared.value.validated.offset
    ))
    .andThen((canonical) => queryValidatedInvestigationIndex(
      canonical.investigationsDirectory,
      prepared.value.validated
    ).mapErr((errors) => queryFailure(
      "operation",
      errors,
      path.join(canonical.investigationsDirectory, investigationIndexFileName),
      prepared.value.validated.limit,
      prepared.value.validated.offset
    )));
}

function prepareQuery(
  input: unknown
): Result<PreparedQuery, InvestigationIndexQueryFailure> {
  const parsed = parseInvestigationIndexQueryOptions(input);
  if (parsed.isErr()) {
    return err(queryFailure(
      "invalid-options",
      parsed.error,
      defaultInvestigationIndexPath(),
      stateIndexQueryDefaultLimit,
      0
    ));
  }

  const resolved = resolveInvestigationsDirectory(
    parsed.value.workspaceRoot,
    parsed.value.investigationsDir
  );
  const validated = validateQueryOptions(parsed.value);
  if (resolved.isErr() || validated.isErr()) {
    return err(queryFailure(
      "invalid-options",
      [
        ...(resolved.isErr() ? resolved.error : []),
        ...(validated.isErr() ? validated.error.errors : [])
      ],
      investigationIndexPathForOptions(parsed.value),
      validated.isErr() ? validated.error.limit : validated.value.limit,
      validated.isErr() ? validated.error.offset : validated.value.offset
    ));
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
      return err(investigationIndexDiagnosticMessages(
        loaded.diagnostics,
        indexPath
      ));
    }

    return fromThrowable(
      () => queryStateIndex({
        definition: createInvestigationStateIndexDefinition(),
        index: loaded.value,
        query: {
          filters: validated.filters,
          limit: validated.limit,
          offset: validated.offset,
          sort: [{ direction: "desc", key: "latest-report-at" }]
        }
      }),
      (error) => [
        `investigation index query could not be completed: ${errorText(error)}`
      ]
    )().andThen((queried) => queried.status === "error"
      ? err(investigationIndexDiagnosticMessages(
        queried.diagnostics,
        indexPath
      ))
      : ok({
        entries: queried.value.entries.map((entry) => entry.state),
        errors: [],
        indexPath,
        limit: queried.value.limit,
        offset: queried.value.offset,
        total: queried.value.total
      }));
  });
}

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

function validateQueryOptions(
  options: InvestigationIndexQueryOptions
): Result<ValidatedQueryOptions, QueryOptionValidationFailure> {
  const errors: string[] = [];
  const filters: StateIndexFilter[] = [];
  const limit = options.limit ?? stateIndexQueryDefaultLimit;
  const offset = options.offset ?? 0;
  if (
    !Number.isSafeInteger(limit)
    || limit < 1
    || limit > stateIndexQueryMaximumLimit
  ) {
    errors.push(
      `limit must be an integer from 1 to ${stateIndexQueryMaximumLimit}`
    );
  }
  if (!Number.isSafeInteger(offset) || offset < 0) {
    errors.push("offset must be a non-negative integer");
  }

  const paths = uniqueSorted(
    (options.paths ?? []).map(normalizeInvestigationTopicPath)
  );
  const invalidPaths = paths.filter((topicPath) => (
    !isInvestigationTopicPath(topicPath)
  ));
  for (const topicPath of invalidPaths) {
    errors.push(
      `path filter must use <category-id>/<semantic-slug>.md: `
      + (topicPath || "<empty>")
    );
  }
  if (paths.length > 0 && invalidPaths.length === 0) {
    filters.push({
      key: "id",
      kind: "exact",
      operator: "any",
      values: paths
    });
  }

  const categories = uniqueSorted((options.categories ?? []).map((category) => (
    category.trim()
  )));
  const invalidCategories = categories.filter(
    (category) => !isInvestigationCategory(category)
  );
  for (const category of invalidCategories) {
    errors.push(
      `category filter must use kebab-case: ${category || "<empty>"}`
    );
  }
  if (categories.length > 0 && invalidCategories.length === 0) {
    filters.push({
      key: "category",
      kind: "exact",
      operator: "any",
      values: categories
    });
  }

  const statuses = uniqueSorted(options.statuses ?? []);
  if (statuses.length > 0) {
    filters.push({
      key: "status",
      kind: "exact",
      operator: "any",
      values: statuses
    });
  }

  const text = options.text?.trim();
  if (options.text !== undefined && text?.length === 0) {
    errors.push("text filter must not be empty");
  } else if (text !== undefined) {
    filters.push({
      key: "text",
      kind: "text",
      operator: "all",
      text
    });
  }

  const latestFrom = timestampFilter(
    options.latestReportAtFrom,
    "latest report lower bound",
    errors
  );
  const latestTo = timestampFilter(
    options.latestReportAtTo,
    "latest report upper bound",
    errors
  );
  if (
    latestFrom !== null
    && latestTo !== null
    && latestFrom > latestTo
  ) {
    errors.push(
      "latest report lower bound must not be after the upper bound"
    );
  }
  if (latestFrom !== null) {
    filters.push({
      key: "latest-report-at",
      kind: "range",
      operator: "gte",
      value: latestFrom
    });
  }
  if (latestTo !== null) {
    filters.push({
      key: "latest-report-at",
      kind: "range",
      operator: "lte",
      value: latestTo
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
  if (value === undefined) {
    return null;
  }
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
    result: emptyQueryResult(errors, indexPath, limit, offset)
  };
}

function emptyQueryResult(
  errors: readonly string[],
  indexPath: string,
  limit: number,
  offset: number
): InvestigationIndexQueryResult {
  return {
    entries: [],
    errors: uniqueSorted(errors),
    indexPath,
    limit,
    offset,
    total: 0
  };
}

function defaultInvestigationIndexPath(): string {
  return path.join(
    path.resolve("."),
    defaultInvestigationsDirectory,
    investigationIndexFileName
  );
}

function investigationIndexPathForOptions(
  options: InvestigationIndexQueryOptions
): string {
  return path.join(
    path.resolve(
      options.workspaceRoot,
      options.investigationsDir ?? defaultInvestigationsDirectory
    ),
    investigationIndexFileName
  );
}

function uniqueSorted<Value extends string>(
  values: readonly Value[]
): Value[] {
  return [...new Set(values)].sort(compareText);
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
