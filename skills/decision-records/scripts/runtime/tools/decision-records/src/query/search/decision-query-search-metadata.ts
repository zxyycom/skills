/*
 * Synced TypeScript runtime; repository maintenance edits tools/decision-records/src/query/search/decision-query-search-metadata.ts.
 * Installed skill copies may be edited directly; updates overwrite matching files.
 * Repository: https://github.com/zxyycom/skills
 * Source path: tools/decision-records/src/query/search/decision-query-search-metadata.ts
 * Maintained source: https://github.com/zxyycom/skills/blob/main/tools/decision-records/src/query/search/decision-query-search-metadata.ts
 * Skill source directory: https://github.com/zxyycom/skills/tree/main/skills/decision-records
 * Rebuild: bun run sync:decision-records-cli
 */
import { collectRecordMetadataWindow } from "../../../../record-operations/src/query.ts";
import { canonicalRecordCollection } from "../../../../record-operations/src/source.ts";
import { err, ok } from "neverthrow";
import {
  loadDecisionIndexSnapshot,
  type DecisionIndexSnapshot
} from "../../index/decision-index-snapshot.ts";
import {
  decisionMetadataSearchDefaultLimit,
  decisionPublishedSnapshotSource
} from "../decision-query-contract.ts";
import {
  metadataSearchFacts,
  searchLimitWarnings
} from "../../../../shared/src/file-text-search/record-search-info.ts";
import { stateIndexQueryMaximumLimit } from "../../../../index-runtime/src/index.ts";
import path from "node:path";
import {
  createTextSearchMatcher,
  matchTextSegmentIdentifiers,
  TextSearchMatcherError
} from "../../../../shared/src/file-text-search/index.ts";
import {
  decisionDiagnostic,
  decisionFailure,
  type DecisionApplicationFailure
} from "../../application-result.ts";
import {
  decisionIndexDiagnostics,
  decisionIndexFileName,
  decisionIndexRecovery
} from "../../index/decision-state-index.ts";
import {
  decisionNameFromId,
  displayDecisionPath
} from "../../collection/decision-path.ts";
import type {
  DecisionMetadataMatchedRelation,
  DecisionMetadataSearchField,
  DecisionMetadataSearchRecord,
  DecisionQueryRequest,
  DecisionQueryResult,
  DecisionSearchFilters,
  IndexedDecisionRecord,
  IndexedDecisionState
} from "../decision-query-contract.ts";
import { decisionMetadataSearchFields } from "../decision-query-contract.ts";
import { decisionIndexRecordSnapshot } from "../decision-query-records.ts";
import { filterSearchRecords } from "./decision-query-search-filter.ts";
import type { StateIndexDiagnostic } from "../../../../index-runtime/src/index.ts";

type DecisionMetadataSegment =
  | Readonly<{ field: DecisionMetadataSearchField; kind: "field" }>
  | Readonly<{ kind: "relation"; relation: DecisionMetadataMatchedRelation }>;

type DecisionMetadataSearchLimitResult =
  | Readonly<{ status: "ok"; value: number }>
  | Readonly<{ failure: DecisionApplicationFailure; status: "error" }>;

export async function searchDecisionMetadata(
  request: Extract<DecisionQueryRequest, { command: "search" }>
): Promise<DecisionQueryResult> {
  const limit = metadataSearchLimit(request.limit);
  if (limit.status === "error") return limit.failure;
  let decisionsDirectory: string;
  let workspaceRoot: string;
  try {
    const canonical = await canonicalRecordCollection(
      request.location.workspaceRoot,
      request.location.decisionsDir
    );
    decisionsDirectory = canonical.collectionRoot;
    workspaceRoot = canonical.workspaceRoot;
  } catch (error) {
    return decisionFailure([
      error instanceof Error
        ? error.message
        : "Decision collection could not be safely resolved"
    ]);
  }
  const indexRelativePath = displayDecisionPath(
    workspaceRoot,
    path.join(decisionsDirectory, decisionIndexFileName)
  );
  const persisted = await loadDecisionIndexSnapshot({
    decisionsDirectory,
    queryOnly:
      request.relatedTo === undefined && request.relationType === undefined
  });
  if (persisted.status === "error")
    return metadataIndexFailure(persisted, indexRelativePath);
  return projectMetadataWindow(persisted.value, request, limit.value);
}

/** 从已验证的发布快照计算元数据命中与搜索事实，不读取来源。 */
export function projectDecisionMetadata(
  source: readonly IndexedDecisionState[] | DecisionIndexSnapshot,
  request: Extract<DecisionQueryRequest, { command: "search" }>
): DecisionQueryResult {
  const limit = metadataSearchLimit(request.limit);
  if (limit.status === "error") return limit.failure;
  return projectMetadataWindow(source, request, limit.value);
}

function projectMetadataWindow(
  source: readonly IndexedDecisionState[] | DecisionIndexSnapshot,
  request: Extract<DecisionQueryRequest, { command: "search" }>,
  limit: number
): DecisionQueryResult {
  const matcher = metadataMatcher(request);
  if (matcher.status === "error") return matcher.failure;
  const snapshot = decisionIndexRecordSnapshot(source);
  const filtered = filterSearchRecords(snapshot, request);
  if (filtered.status === "error") return filtered.failure;
  const window = collectRecordMetadataWindow({
    entries: [...filtered.records].sort((left, right) =>
      left.sourcePath.localeCompare(right.sourcePath)
    ),
    limit,
    match: (record) => {
      const matched = metadataRecordMatches(matcher.value, record);
      return matched.status === "error"
        ? err(matched.failure)
        : ok(matched.value.length === 0 ? null : matched.value);
    },
    project: metadataSearchRecord
  });
  if (window.isErr()) return window.error;
  return metadataSearchSuccess(
    request,
    filtered.filters,
    window.value.entries,
    window.value.matched,
    limit
  );
}

function metadataSearchSuccess(
  request: Extract<DecisionQueryRequest, { command: "search" }>,
  filters: DecisionSearchFilters,
  records: DecisionMetadataSearchRecord[],
  matched: number,
  limit: number
): Extract<DecisionQueryResult, { command: "search"; in: "metadata" }> {
  const facts = metadataSearchFacts(matched, records.length, limit);
  return {
    searchInfo: {
      query: {
        text: request.text,
        in: "metadata",
        match: request.match,
        filters,
        limits: facts.limits
      },
      source: decisionPublishedSnapshotSource,
      counts: facts.counts,
      coverage: facts.coverage
    },
    command: "search",
    in: "metadata",
    records,
    status: "ok",
    warnings: searchLimitWarnings(facts.coverage)
  };
}

function metadataSearchLimit(
  requested: number | undefined
): DecisionMetadataSearchLimitResult {
  const limit =
    requested === undefined ? decisionMetadataSearchDefaultLimit : requested;
  if (
    Number.isSafeInteger(limit) &&
    limit >= 1 &&
    limit <= stateIndexQueryMaximumLimit
  ) {
    return { status: "ok", value: limit };
  }
  return {
    status: "error",
    failure: decisionFailure([
      decisionDiagnostic({
        code: "decision-records.invalid-search-options",
        reason: `limit must be an integer from 1 to ${stateIndexQueryMaximumLimit}.`,
        recovery: "Provide a valid metadata result limit, then retry.",
        target: "Decision metadata search limit"
      })
    ])
  };
}

function metadataMatcher(
  request: Extract<DecisionQueryRequest, { command: "search" }>
):
  | { status: "ok"; value: ReturnType<typeof createTextSearchMatcher> }
  | { failure: DecisionApplicationFailure; status: "error" } {
  try {
    return {
      status: "ok",
      value: createTextSearchMatcher({
        mode: request.match,
        text: request.text
      })
    };
  } catch (error) {
    return { failure: metadataMatcherFailure(error), status: "error" };
  }
}

function metadataRecordMatches(
  matcher: ReturnType<typeof createTextSearchMatcher>,
  record: IndexedDecisionRecord
):
  | {
      status: "ok";
      value: readonly DecisionMetadataSegment[];
    }
  | { failure: DecisionApplicationFailure; status: "error" } {
  try {
    return {
      status: "ok",
      value: matchTextSegmentIdentifiers(matcher, metadataSegments(record))
    };
  } catch (error) {
    return { failure: metadataMatcherFailure(error), status: "error" };
  }
}

function metadataSearchRecord(
  record: IndexedDecisionRecord,
  matches: readonly DecisionMetadataSegment[]
): DecisionMetadataSearchRecord {
  const matchedFields = new Set<DecisionMetadataSearchField>();
  const matchedRelations: DecisionMetadataMatchedRelation[] = [];
  for (const identifier of matches) {
    if (identifier.kind === "field") matchedFields.add(identifier.field);
    else matchedRelations.push(identifier.relation);
  }
  return {
    ...record,
    matchedFields: decisionMetadataSearchFields.filter((field) =>
      matchedFields.has(field)
    ),
    matchedRelations
  };
}

function metadataSegments(
  record: IndexedDecisionRecord
): ReadonlyArray<
  Readonly<{ identifier: DecisionMetadataSegment; text: string }>
> {
  const fields: ReadonlyArray<readonly [DecisionMetadataSearchField, string]> =
    [
      ["id", record.decisionId],
      ["name", decisionNameFromId(record.decisionId)],
      ["title", record.projection.title],
      ["purpose", record.projection.purpose],
      ["background", record.projection.background],
      ["decision", record.projection.decision],
      ...record.tags.map((tag) => ["tags", tag] as const)
    ];
  return [
    ...fields.map(([field, text]) => ({
      identifier: { field, kind: "field" } as const,
      text
    })),
    ...record.projection.relations.flatMap((relation) => {
      const summary = relation.summary;
      return summary === undefined || summary.trim().length === 0
        ? []
        : [
            {
              identifier: {
                kind: "relation" as const,
                relation: {
                  summary,
                  target: relation.target,
                  type: relation.type
                }
              },
              text: summary
            }
          ];
    })
  ];
}

function metadataIndexFailure(
  result: { diagnostics: readonly StateIndexDiagnostic[] },
  indexRelativePath: string
): DecisionApplicationFailure {
  const recovery = decisionIndexRecovery(
    result.diagnostics,
    "Run check to diagnose the Decision collection, then run sync-index after correcting the problem."
  );
  return decisionFailure(
    decisionIndexDiagnostics(result.diagnostics, {
      code: "decision-records.metadata-index-unavailable",
      recovery,
      target: indexRelativePath
    }).map((diagnostic) => ({ ...diagnostic, recovery }))
  );
}

function metadataMatcherFailure(error: unknown): DecisionApplicationFailure {
  const reason =
    error instanceof TextSearchMatcherError
      ? error.message
      : "The Decision metadata search operation failed.";
  return decisionFailure([
    decisionDiagnostic({
      code: "decision-records.metadata-search-failed",
      reason,
      recovery: "Correct the metadata search query, then retry.",
      target: "Decision metadata search"
    })
  ]);
}
