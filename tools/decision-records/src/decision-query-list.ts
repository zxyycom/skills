import { stateIndexQueryMaximumLimit } from "../../index-runtime/src/index.ts";
import {
  decisionDiagnostic,
  decisionFailure,
  type DecisionApplicationFailure
} from "./application-result.ts";
import { buildDecisionListFacets } from "./list-facets.ts";
import { loadDecisionQueryContext } from "./decision-query-context.ts";
import { decisionTimestampMilliseconds } from "./decision-timestamp.ts";
import type {
  DecisionListAppliedFilters,
  DecisionQueryRequest,
  DecisionQueryResult,
  IndexedDecisionRecord
} from "./decision-query-contract.ts";
import { indexedRecords, indexFailure } from "./decision-query-records.ts";
import { filterDecisionRelationRecords } from "./decision-query-relation-filter.ts";

type PreparedDecisionListRequest =
  | { createdAtFrom: number | null; createdAtTo: number | null; status: "ok" }
  | { failure: DecisionApplicationFailure; status: "error" };
type TimedDecisionListRecord = Readonly<{
  createdAtMilliseconds: number;
  record: IndexedDecisionRecord;
}>;

export async function listDecisionRecords(
  request: Extract<DecisionQueryRequest, { command: "list" }>
): Promise<DecisionQueryResult> {
  const prepared = prepareDecisionListRequest(request);
  if (prepared.status === "error") return prepared.failure;
  const context = await loadDecisionQueryContext(request.location);
  if (context.status === "error") return context;
  const all = context.reader.all({ sort: [{ direction: "asc", key: "id" }] });
  if (all.status === "error")
    return indexFailure(all, context.indexRelativePath);
  const allRecords = indexedRecords(all.value);
  const relationFilter = filterDecisionRelationRecords(allRecords, request);
  if (relationFilter.status === "error") return relationFilter.failure;
  const matching = relationFilter.records
    .map(timedDecisionListRecord)
    .filter(({ createdAtMilliseconds, record }) =>
      matchesListFilters(record, createdAtMilliseconds, request, prepared)
    )
    .sort(compareRecentDecisionRecords)
    .map(({ record }) => record);
  return {
    appliedFilters: decisionListAppliedFilters(request),
    command: "list",
    facets: buildDecisionListFacets(all.value),
    limit: request.limit,
    offset: request.offset,
    records: matching.slice(request.offset, request.offset + request.limit),
    status: "ok",
    total: matching.length,
    warnings: []
  };
}

function matchesListFilters(
  record: IndexedDecisionRecord,
  createdAtMilliseconds: number,
  request: Extract<DecisionQueryRequest, { command: "list" }>,
  prepared: Extract<PreparedDecisionListRequest, { status: "ok" }>
): boolean {
  return (
    listStatusMatches(record, request) &&
    listAlignmentMatches(record, request) &&
    listTagsMatch(record, request) &&
    listTimestampMatches(createdAtMilliseconds, prepared)
  );
}
function listStatusMatches(
  record: IndexedDecisionRecord,
  request: Extract<DecisionQueryRequest, { command: "list" }>
): boolean {
  return request.status === "all" || record.status === request.status;
}
function listAlignmentMatches(
  record: IndexedDecisionRecord,
  request: Extract<DecisionQueryRequest, { command: "list" }>
): boolean {
  return request.alignment === "all" || record.alignment === request.alignment;
}
function listTagsMatch(
  record: IndexedDecisionRecord,
  request: Extract<DecisionQueryRequest, { command: "list" }>
): boolean {
  return request.tags.every((tag) => record.tags.includes(tag));
}
function listTimestampMatches(
  createdAtMilliseconds: number,
  prepared: Extract<PreparedDecisionListRequest, { status: "ok" }>
): boolean {
  return (
    afterLowerBound(createdAtMilliseconds, prepared.createdAtFrom) &&
    beforeUpperBound(createdAtMilliseconds, prepared.createdAtTo)
  );
}
function afterLowerBound(value: number, bound: number | null): boolean {
  return bound === null || value >= bound;
}
function beforeUpperBound(value: number, bound: number | null): boolean {
  return bound === null || value <= bound;
}

function prepareDecisionListRequest(
  request: Extract<DecisionQueryRequest, { command: "list" }>
): PreparedDecisionListRequest {
  const issues: string[] = [];
  if (
    !Number.isSafeInteger(request.limit) ||
    request.limit < 1 ||
    request.limit > stateIndexQueryMaximumLimit
  ) {
    issues.push(
      `limit must be an integer from 1 to ${stateIndexQueryMaximumLimit}`
    );
  }
  if (!Number.isSafeInteger(request.offset) || request.offset < 0)
    issues.push("offset must be a non-negative integer");
  const createdAtFrom = decisionListTimestamp(
    request.createdAtFrom,
    "createdAt lower bound",
    issues
  );
  const createdAtTo = decisionListTimestamp(
    request.createdAtTo,
    "createdAt upper bound",
    issues
  );
  if (
    createdAtFrom !== null &&
    createdAtTo !== null &&
    createdAtFrom > createdAtTo
  ) {
    issues.push("createdAt lower bound must not be after the upper bound");
  }
  if (issues.length === 0) return { createdAtFrom, createdAtTo, status: "ok" };
  return invalidListOptionsFailure(issues);
}

function invalidListOptionsFailure(
  issues: readonly string[]
): PreparedDecisionListRequest {
  return {
    failure: decisionFailure(
      [...new Set(issues)].sort(compareText).map(listOptionDiagnostic),
      { exitCode: 2 }
    ),
    status: "error"
  };
}
function listOptionDiagnostic(reason: string) {
  return decisionDiagnostic({
    code: "decision-records.list-options-invalid",
    reason,
    recovery: "Correct the Decision list options, then retry.",
    target: "Decision list options"
  });
}

function decisionListTimestamp(
  value: string | undefined,
  label: string,
  issues: string[]
): number | null {
  if (value === undefined) return null;
  const milliseconds = decisionTimestampMilliseconds(value);
  if (milliseconds === null) {
    issues.push(
      `${label} must be an RFC 3339 timestamp with timezone and second precision`
    );
    return null;
  }
  return milliseconds;
}

function decisionListAppliedFilters(
  request: Extract<DecisionQueryRequest, { command: "list" }>
): DecisionListAppliedFilters {
  return {
    alignment: request.alignment,
    ...(request.createdAtFrom === undefined
      ? {}
      : { createdAtFrom: request.createdAtFrom }),
    ...(request.createdAtTo === undefined
      ? {}
      : { createdAtTo: request.createdAtTo }),
    ...(request.relatedTo === undefined
      ? {}
      : {
          direction: request.direction ?? "both",
          relatedTo: request.relatedTo
        }),
    ...(request.relationType === undefined
      ? {}
      : { relationType: request.relationType }),
    status: request.status,
    tags: [...request.tags]
  };
}

function timedDecisionListRecord(
  record: IndexedDecisionRecord
): TimedDecisionListRecord {
  const createdAtMilliseconds = decisionTimestampMilliseconds(record.createdAt);
  if (createdAtMilliseconds === null)
    throw new TypeError("Decision list requires a valid createdAt timestamp");
  return { createdAtMilliseconds, record };
}

function compareRecentDecisionRecords(
  left: TimedDecisionListRecord,
  right: TimedDecisionListRecord
): number {
  const timeOrder = right.createdAtMilliseconds - left.createdAtMilliseconds;
  return timeOrder === 0
    ? compareText(left.record.decisionId, right.record.decisionId)
    : timeOrder;
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
