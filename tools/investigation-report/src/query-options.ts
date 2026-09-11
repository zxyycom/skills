import path from "node:path";
import { investigationListDefaultLimit } from "./query.ts";
import { err, ok, type Result } from "neverthrow";
import {
  stateIndexQueryDefaultLimit,
  stateIndexQueryMaximumLimit,
  type StateIndexFilter
} from "../../index-runtime/src/index.ts";
import { investigationIndexFileName } from "./investigation-state-index.ts";
import { parseInvestigationSearchOptions } from "./options.ts";
import {
  isInvestigationTag,
  resolveInvestigationsDirectory
} from "./report-path.ts";
import { isInvestigationRelationType } from "./report-validation.ts";
import { investigationTimestampMilliseconds } from "./timestamp.ts";
import { uniqueSorted } from "./query-results.ts";
import type { InvestigationIndexQueryOptions } from "./types.ts";
import type {
  PreparedSearch,
  QueryOptionValidationFailure,
  ValidatedQueryOptions
} from "./query.ts";

export function prepareSearch(
  input: unknown
): Result<PreparedSearch, string[]> {
  const parsed = parseInvestigationSearchOptions(input);
  if (parsed.isErr()) return err(parsed.error);
  const resolved = resolveInvestigationsDirectory(
    parsed.value.workspaceRoot,
    parsed.value.investigationsDir
  );
  if (resolved.isErr()) return err(resolved.error);
  const criteria = validateSearchCriteria(parsed.value);
  if (criteria.errors.length > 0) return err(criteria.errors);
  return ok(preparedSearch(parsed.value, resolved.value, criteria));
}

function preparedSearch(
  options: import("./types.ts").InvestigationSearchOptions,
  resolved: ReturnType<typeof resolveInvestigationsDirectory> extends Result<
    infer T,
    unknown
  >
    ? T
    : never,
  criteria: SearchCriteria
): PreparedSearch {
  return {
    indexPath: path.join(
      resolved.investigationsDirectory,
      investigationIndexFileName
    ),
    in: options.in ?? "content",
    query: criteria.query,
    resolved,
    validated: {
      limit: criteria.limit,
      match: options.match ?? "all",
      direction: options.direction,
      relatedTo: options.relatedTo,
      relationType: options.relationType,
      states: (state) => matchesSearchCriteria(state, criteria)
    }
  };
}

type SearchCriteria = Readonly<{
  errors: string[];
  from: number | null;
  limit: number;
  query: string;
  relationType: InvestigationIndexQueryOptions["relationType"];
  relatedTo: string | undefined;
  tags: string[];
  to: number | null;
}>;

function validateSearchCriteria(
  options: import("./types.ts").InvestigationSearchOptions
): SearchCriteria {
  const errors: string[] = [];
  const query = options.query.trim();
  if (query.length === 0) errors.push("search query must not be empty");
  const limit = options.limit ?? stateIndexQueryDefaultLimit;
  validateQueryPagination(limit, 0, errors);
  const tags = validateSearchTags(options.tags, errors);
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
  validateSearchRelations(options.direction, options.relatedTo, errors);
  if (from !== null && to !== null && from > to)
    errors.push("formedAt lower bound must not be after the upper bound");
  return {
    errors: uniqueSorted(errors),
    from,
    limit,
    query,
    relationType: options.relationType,
    relatedTo: options.relatedTo,
    tags,
    to
  };
}

function validateSearchTags(
  input: readonly string[] | undefined,
  errors: string[]
): string[] {
  const tags = uniqueSorted((input ?? []).map((tag) => tag.trim()));
  for (const tag of tags)
    if (!isInvestigationTag(tag))
      errors.push(`tag filter must use kebab-case: ${tag || "<empty>"}`);
  return tags;
}

function validateSearchRelations(
  direction: unknown,
  relatedTo: string | undefined,
  errors: string[]
): void {
  if (direction !== undefined && relatedTo === undefined)
    errors.push("direction requires relatedTo");
}

function matchesSearchCriteria(
  state: import("./types.ts").InvestigationIndexState,
  criteria: SearchCriteria
): boolean {
  if (!criteria.tags.every((tag) => state.tags.includes(tag))) return false;
  if (
    criteria.relatedTo === undefined &&
    criteria.relationType !== undefined &&
    !state.relations.some((relation) => relation.type === criteria.relationType)
  )
    return false;
  const formedAt = investigationTimestampMilliseconds(state.formedAt);
  if (formedAt === null) return false;
  if (criteria.from !== null && formedAt < criteria.from) return false;
  return criteria.to === null || formedAt <= criteria.to;
}
export function validateQueryOptions(
  options: InvestigationIndexQueryOptions
): Result<ValidatedQueryOptions, QueryOptionValidationFailure> {
  const errors: string[] = [];
  const filters: StateIndexFilter[] = [];
  const limit = options.limit ?? investigationListDefaultLimit;
  const offset = options.offset ?? 0;
  validateQueryPagination(limit, offset, errors);
  const tags = validateTagFilters(options.tags, filters, errors);
  validateQueryRelations(options, filters, errors);
  validateTimestampFilters(options, filters, errors);
  const uniqueErrors = uniqueSorted(errors);
  return uniqueErrors.length > 0
    ? err({ errors: uniqueErrors, limit, offset })
    : ok(validatedQueryOptions(options, filters, tags, limit, offset));
}

function validateQueryRelations(
  options: InvestigationIndexQueryOptions,
  filters: StateIndexFilter[],
  errors: string[]
): void {
  if (options.direction !== undefined && options.relatedTo === undefined)
    errors.push("direction requires relatedTo");
  validateRelationTypeFilter(
    options.relationType,
    filters,
    errors,
    options.relatedTo !== undefined
  );
}

function validatedQueryOptions(
  options: InvestigationIndexQueryOptions,
  filters: StateIndexFilter[],
  tags: string[],
  limit: number,
  offset: number
): ValidatedQueryOptions {
  return {
    appliedFilters: appliedQueryFilters(options, tags),
    filters,
    limit,
    offset,
    ...optionalQueryRelationOptions(options)
  };
}

function appliedQueryFilters(
  options: InvestigationIndexQueryOptions,
  tags: string[]
): ValidatedQueryOptions["appliedFilters"] {
  return {
    tags,
    ...(options.relatedTo === undefined
      ? {}
      : {
          direction: options.direction ?? "both",
          relatedTo: options.relatedTo
        }),
    ...(options.formedAtFrom === undefined
      ? {}
      : { formedAtFrom: options.formedAtFrom.trim() }),
    ...(options.formedAtTo === undefined
      ? {}
      : { formedAtTo: options.formedAtTo.trim() }),
    ...(options.relationType === undefined
      ? {}
      : { relationType: options.relationType })
  };
}

function optionalQueryRelationOptions(
  options: InvestigationIndexQueryOptions
): Pick<ValidatedQueryOptions, "direction" | "relatedTo" | "relationType"> {
  return {
    ...(options.direction === undefined
      ? {}
      : { direction: options.direction }),
    ...(options.relatedTo === undefined
      ? {}
      : { relatedTo: options.relatedTo }),
    ...(options.relationType === undefined
      ? {}
      : { relationType: options.relationType })
  };
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
): string[] {
  const tags = uniqueSorted((input ?? []).map((tag) => tag.trim()));
  const invalidTags = tags.filter((tag) => !isInvestigationTag(tag));
  for (const tag of invalidTags) {
    errors.push(`tag filter must use kebab-case: ${tag || "<empty>"}`);
  }
  if (tags.length > 0 && invalidTags.length === 0) {
    filters.push({ key: "tag", kind: "exact", operator: "all", values: tags });
  }
  return tags;
}

function validateRelationTypeFilter(
  relationType: InvestigationIndexQueryOptions["relationType"],
  filters: StateIndexFilter[],
  errors: string[],
  relatedTo: boolean
): void {
  if (
    relationType !== undefined &&
    !isInvestigationRelationType(relationType)
  ) {
    errors.push(`unknown investigation relation type: ${String(relationType)}`);
  } else if (relationType !== undefined && !relatedTo) {
    filters.push({
      key: "relation-type",
      kind: "exact",
      operator: "any",
      values: [relationType]
    });
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
