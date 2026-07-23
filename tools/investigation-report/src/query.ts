import path from "node:path";
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
  isInvestigationCategory,
  isInvestigationTopicPath,
  normalizeInvestigationTopicPath,
  resolveInvestigationsDirectory
} from "./report-path.ts";
import { investigationTimestampMilliseconds } from "./timestamp.ts";
import {
  investigationReportStatuses,
  type InvestigationIndexQueryOptions,
  type InvestigationIndexQueryResult,
  type InvestigationReportStatus
} from "./types.ts";

export async function queryInvestigationIndex(
  options: InvestigationIndexQueryOptions
): Promise<InvestigationIndexQueryResult> {
  const resolved = resolveInvestigationsDirectory(
    options.workspaceRoot,
    options.investigationsDir
  );
  const indexPath = path.join(
    resolved.investigationsDirectory,
    investigationIndexFileName
  );
  const validated = validateQueryOptions(options);
  const errors = [...resolved.errors, ...validated.errors];
  if (errors.length > 0) {
    return emptyQueryResult(
      errors,
      indexPath,
      validated.limit,
      validated.offset
    );
  }

  const loaded = await loadCurrentInvestigationIndex({
    investigationsDirectory: resolved.investigationsDirectory
  });
  if (loaded.status === "error") {
    return emptyQueryResult(
      investigationIndexDiagnosticMessages(
        loaded.diagnostics,
        indexPath
      ),
      indexPath,
      validated.limit,
      validated.offset
    );
  }

  const queried = queryStateIndex({
    definition: createInvestigationStateIndexDefinition(),
    index: loaded.value,
    query: {
      filters: validated.filters,
      limit: validated.limit,
      offset: validated.offset,
      sort: [{ direction: "desc", key: "latest-report-at" }]
    }
  });
  if (queried.status === "error") {
    return emptyQueryResult(
      investigationIndexDiagnosticMessages(
        queried.diagnostics,
        indexPath
      ),
      indexPath,
      validated.limit,
      validated.offset
    );
  }
  return {
    entries: queried.value.entries.map((entry) => entry.state),
    errors: [],
    indexPath,
    limit: queried.value.limit,
    offset: queried.value.offset,
    total: queried.value.total
  };
}

export function investigationIndexQueryOptionErrors(
  options: InvestigationIndexQueryOptions
): string[] {
  return validateQueryOptions(options).errors;
}

type ValidatedQueryOptions = {
  errors: string[];
  filters: StateIndexFilter[];
  limit: number;
  offset: number;
};

function validateQueryOptions(
  options: InvestigationIndexQueryOptions
): ValidatedQueryOptions {
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
  const invalidStatuses = statuses.filter((status) => (
    !isInvestigationReportStatus(status)
  ));
  for (const status of invalidStatuses) {
    errors.push(`unknown investigation status: ${status}`);
  }
  if (statuses.length > 0 && invalidStatuses.length === 0) {
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

  return {
    errors: uniqueSorted(errors),
    filters,
    limit,
    offset
  };
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

function isInvestigationReportStatus(
  value: string
): value is InvestigationReportStatus {
  return investigationReportStatuses.some((status) => status === value);
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

function uniqueSorted<Value extends string>(
  values: readonly Value[]
): Value[] {
  return [...new Set(values)].sort(compareText);
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
