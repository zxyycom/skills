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
  FileTextSearchError,
  searchFileText,
  createTextSearchMatcher,
  matchTextSegments,
  TextSearchMatcherError
} from "../../shared/src/file-text-search/index.ts";
import {
  createInvestigationStateIndexDefinition,
  investigationIndexDiagnosticMessages,
  investigationIndexFileName,
  loadInvestigationIndex,
  loadCurrentInvestigationIndex
} from "./investigation-state-index.ts";
import {
  diagnosticFromError,
  diagnosticFromStateIndexDiagnostic,
  type InvestigationDiagnostic
} from "./diagnostics.ts";
import { investigationIdFromMarkdown } from "./markdown.ts";
import {
  parseInvestigationIndexQueryOptions,
  parseInvestigationSearchOptions,
  parseInvestigationReportShowOptions,
  parseInvestigationReportTraceOptions
} from "./options.ts";
import {
  canonicalizeInvestigationsDirectory,
  defaultInvestigationsDirectory,
  isInvestigationTag,
  resolveInvestigationsDirectory,
  type ResolvedInvestigationsDirectory
} from "./report-path.ts";
import { resolveInvestigationSelector } from "./investigation-selector.ts";
import { isInvestigationRelationType } from "./report-validation.ts";
import { traceInvestigationRelations } from "./relation-validation.ts";
import { investigationTimestampMilliseconds } from "./timestamp.ts";
import { collectValidatedInvestigationCollection } from "./validation.ts";
import { investigationMetadataSearchFields } from "./types.ts";
import type {
  InvestigationIndexQueryOptions,
  InvestigationIndexQueryResult,
  InvestigationIndexState,
  InvestigationReportShowOptions,
  InvestigationReportShowResult,
  InvestigationReportTraceOptions,
  InvestigationReportTraceResult,
  InvestigationMetadataMatchedRelation,
  InvestigationMetadataSearchEntry,
  InvestigationMetadataSearchField,
  InvestigationSearchEntry,
  InvestigationSearchResult
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
type PreparedSearch = Readonly<{
  indexPath: string;
  in: "content" | "metadata";
  query: string;
  resolved: ResolvedInvestigationsDirectory;
  validated: Readonly<{
    limit: number;
    match: "all" | "any" | "phrase";
    states: (state: InvestigationIndexState) => boolean;
  }>;
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

export async function searchInvestigationReports(
  input: unknown
): Promise<InvestigationSearchResult> {
  const prepared = prepareSearch(input);
  if (prepared.isErr())
    return searchFailure(prepared.error, defaultInvestigationIndexPath());
  const canonical = await canonicalizeInvestigationsDirectory(
    prepared.value.resolved
  );
  if (canonical.isErr()) {
    return searchFailure(canonical.error, prepared.value.indexPath);
  }
  const investigationsDirectory = canonical.value.investigationsDirectory;
  const indexPath = path.join(
    investigationsDirectory,
    investigationIndexFileName
  );
  if (prepared.value.in === "metadata") {
    return await searchInvestigationMetadata(
      investigationsDirectory,
      indexPath,
      prepared.value
    );
  }
  const loaded = await loadCurrentInvestigationIndex({
    investigationsDirectory
  });
  if (loaded.status === "ok") {
    return await searchSnapshot({
      entries: Object.entries(loaded.value.entries).map(([id, state]) => ({
        id,
        state
      })),
      indexPath,
      investigationsDirectory,
      prepared: prepared.value,
      warnings: []
    });
  }

  const collection = await collectValidatedInvestigationCollection(
    investigationsDirectory,
    { allowEmptyCollection: true }
  );
  if (collection.errors.length > 0 || collection.snapshot === null) {
    return searchFailure(
      collection.errors.length > 0
        ? collection.errors
        : ["the formal investigation collection could not be validated"],
      indexPath,
      loaded.diagnostics.map((diagnostic) =>
        diagnosticFromStateIndexDiagnostic(diagnostic, {
          recovery:
            "restore the derived index or correct the formal collection before retrying search",
          target: indexPath
        })
      )
    );
  }
  return await searchSnapshot({
    entries: Object.entries(collection.snapshot.states).map(([id, state]) => ({
      id,
      state
    })),
    indexPath,
    investigationsDirectory,
    prepared: prepared.value,
    warnings: [
      "The derived investigation index is unavailable; search used a validated in-memory source projection. Run sync-index before relying on index-backed operations."
    ]
  });
}

type InvestigationMetadataSegment =
  | Readonly<{ field: InvestigationMetadataSearchField; kind: "field" }>
  | Readonly<{
      kind: "relation";
      relation: InvestigationMetadataMatchedRelation;
    }>;

async function searchInvestigationMetadata(
  investigationsDirectory: string,
  indexPath: string,
  prepared: PreparedSearch
): Promise<InvestigationSearchResult> {
  const loaded = await loadInvestigationIndex({
    investigationsDirectory
  });
  if (loaded.status === "error") {
    const recovery =
      "Run investigation-report check to diagnose the collection, then run sync-index after correcting the problem.";
    return searchFailure(
      [
        "the published investigation index could not be loaded for metadata search"
      ],
      indexPath,
      loaded.diagnostics.map((diagnostic) =>
        diagnosticFromStateIndexDiagnostic(diagnostic, {
          recovery,
          target: indexPath
        })
      )
    );
  }

  let matcher: ReturnType<typeof createTextSearchMatcher>;
  try {
    matcher = createTextSearchMatcher({
      mode: prepared.validated.match,
      text: prepared.query
    });
  } catch (error) {
    return metadataMatcherFailure(error, indexPath);
  }

  const entries: InvestigationMetadataSearchEntry[] = [];
  const selected = Object.entries(loaded.value.entries)
    .map(([id, state]) => ({ id, state }))
    .filter(({ state }) => prepared.validated.states(state))
    .sort((left, right) =>
      compareText(left.state.sourcePath, right.state.sourcePath)
    );
  for (const entry of selected) {
    let matches: ReturnType<
      typeof matchTextSegments<InvestigationMetadataSegment>
    >;
    try {
      matches = matchTextSegments(matcher, metadataSegments(entry));
    } catch (error) {
      return metadataMatcherFailure(error, indexPath);
    }
    if (matches.length === 0) continue;
    const matchedFields = new Set<InvestigationMetadataSearchField>();
    const matchedRelations: InvestigationMetadataMatchedRelation[] = [];
    for (const { identifier } of matches) {
      if (identifier.kind === "field") matchedFields.add(identifier.field);
      else matchedRelations.push(identifier.relation);
    }
    entries.push({
      formedAt: entry.state.formedAt,
      id: entry.id,
      matchedFields: investigationMetadataSearchFields.filter((field) =>
        matchedFields.has(field)
      ),
      matchedRelations,
      question: entry.state.question,
      sourcePath: entry.state.sourcePath,
      tags: entry.state.tags,
      title: entry.state.title
    });
  }
  return {
    diagnostics: [],
    entries: entries.slice(0, prepared.validated.limit),
    errors: [],
    indexPath,
    status: "ok",
    truncation: { files: false, matches: false, previewCharacters: false },
    warnings: []
  };
}

function metadataSegments(
  entry: Readonly<{ id: string; state: InvestigationIndexState }>
): readonly Readonly<{
  identifier: InvestigationMetadataSegment;
  text: string;
}>[] {
  const fields: readonly (readonly [
    InvestigationMetadataSearchField,
    string
  ])[] = [
    ["id", entry.id],
    ["name", entry.state.name],
    ["title", entry.state.title],
    ["question", entry.state.question],
    ...entry.state.tags.map((tag) => ["tags", tag] as const)
  ];
  return [
    ...fields.map(([field, text]) => ({
      identifier: { field, kind: "field" } as const,
      text
    })),
    ...entry.state.relations.flatMap((relation) => {
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

function metadataMatcherFailure(
  error: unknown,
  indexPath: string
): InvestigationSearchResult {
  return searchFailure(
    ["investigation metadata search could not be completed"],
    indexPath,
    [
      diagnosticFromError({
        code: "investigation-report.metadata-search-failed",
        error,
        reason:
          error instanceof TextSearchMatcherError
            ? error.message
            : "the investigation metadata search operation failed",
        recovery: "correct the metadata search query, then retry",
        target: indexPath
      })
    ]
  );
}

type SearchSnapshot = Readonly<{
  entries: readonly Readonly<{ id: string; state: InvestigationIndexState }>[];
  indexPath: string;
  investigationsDirectory: string;
  prepared: PreparedSearch;
  warnings: readonly string[];
}>;

async function searchSnapshot(
  snapshot: SearchSnapshot
): Promise<InvestigationSearchResult> {
  const selected = snapshot.entries.filter(({ state }) =>
    snapshot.prepared.validated.states(state)
  );
  const entryBySourcePath = new Map<string, (typeof selected)[number]>();
  for (const entry of selected) {
    if (entryBySourcePath.has(entry.state.sourcePath)) {
      return searchFailure(
        ["investigation sourcePath mapping is not unique"],
        snapshot.indexPath
      );
    }
    entryBySourcePath.set(entry.state.sourcePath, entry);
  }
  try {
    const searched = await searchFileText({
      limits: {
        maxCandidateFiles: 2_000,
        maxFileBytes: 2 * 1024 * 1024,
        maxTotalBytes: 20 * 1024 * 1024
      },
      preview: {
        contextLines: 1,
        maxFiles: snapshot.prepared.validated.limit,
        maxMatchesPerFile: 3,
        maxPreviewCharacters: 24_000
      },
      query: {
        mode: snapshot.prepared.validated.match,
        text: snapshot.prepared.query
      },
      root: snapshot.investigationsDirectory,
      selection: {
        kind: "files",
        sourcePaths: selected.map((entry) => entry.state.sourcePath)
      }
    });
    const entries: InvestigationSearchEntry[] = [];
    for (const hit of searched.hits) {
      const entry = entryBySourcePath.get(hit.sourcePath);
      if (entry === undefined) {
        return searchFailure(
          [
            "investigation search returned a source path outside its index snapshot"
          ],
          snapshot.indexPath
        );
      }
      entries.push({
        formedAt: entry.state.formedAt,
        id: entry.id,
        previews: hit.previews,
        question: entry.state.question,
        sourcePath: hit.sourcePath,
        tags: entry.state.tags,
        title: entry.state.title
      });
    }
    return {
      diagnostics: [],
      entries,
      errors: [],
      indexPath: snapshot.indexPath,
      status: "ok",
      truncation: searched.truncation,
      warnings: [...snapshot.warnings]
    };
  } catch (error) {
    return searchFailure(
      ["investigation file search could not be completed"],
      snapshot.indexPath,
      [
        diagnosticFromError({
          code:
            error instanceof FileTextSearchError
              ? `investigation-report.file-search-${error.code}`
              : "investigation-report.file-search-unavailable",
          error,
          reason: "the selected investigation Markdown could not be searched",
          recovery: "restore the selected formal report and retry the search",
          target:
            error instanceof FileTextSearchError && error.sourcePath !== null
              ? error.sourcePath
              : snapshot.indexPath
        })
      ],
      snapshot.warnings
    );
  }
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
  const { id: selector } = parsed.value;
  const loaded = await loadIndexedInvestigationContext(
    parsed.value,
    "correct the reported derived-index problem, then retry showing the report"
  );
  if (loaded.isErr()) {
    return showFailure(
      selector,
      loaded.error.indexPath,
      loaded.error.errors,
      loaded.error.diagnostics
    );
  }
  const { index, indexPath, investigationsDirectory } = loaded.value;
  const resolved = resolveInvestigationSelector(
    Object.entries(index.entries).map(([id, state]) => ({
      id,
      name: state.name
    })),
    selector
  );
  if (resolved.status === "error")
    return showFailure(selector, indexPath, resolved.errors);
  const { id } = resolved;
  const entry = index.entries[id]!;
  return await readShownInvestigation(
    investigationsDirectory,
    indexPath,
    id,
    entry
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
  const target = path.join(investigationsDirectory, state.sourcePath);
  try {
    const markdown = await fs.readFile(target, "utf8");
    if (investigationIdFromMarkdown(markdown) !== id) {
      throw new Error(
        "frontmatter Investigation ID does not match the requested ID"
      );
    }
    return {
      errors: [],
      diagnostics: [],
      id,
      indexPath,
      markdown,
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
  const selector = options.id;
  const traceOptions = validatedTraceOptions(options);
  if (traceOptions === null) {
    return traceFailure(
      selector,
      investigationIndexPathForOptions(parsed.value),
      ["maxDepth must be a non-negative integer"]
    );
  }
  const loaded = await loadIndexedInvestigationContext(
    options,
    "correct the reported derived-index problem, then retry tracing reports"
  );
  if (loaded.isErr()) {
    return traceFailure(
      selector,
      loaded.error.indexPath,
      loaded.error.errors,
      loaded.error.diagnostics
    );
  }
  const { index, indexPath } = loaded.value;
  const resolved = resolveInvestigationSelector(
    Object.entries(index.entries).map(([id, state]) => ({
      id,
      name: state.name
    })),
    selector
  );
  if (resolved.status === "error")
    return traceFailure(selector, indexPath, resolved.errors);
  const { id } = resolved;
  const trace = traceInvestigationRelations(
    new Map(
      Object.entries(index.entries).map(([reportId, state]) => [
        reportId,
        state
      ])
    ),
    id,
    traceOptions
  );
  return {
    edges: trace.edges.map((edge) => ({
      source: edge.source,
      target: edge.target,
      type: edge.type,
      ...(edge.summary === undefined ? {} : { summary: edge.summary })
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

function prepareSearch(input: unknown): Result<PreparedSearch, string[]> {
  const parsed = parseInvestigationSearchOptions(input);
  if (parsed.isErr()) return err(parsed.error);
  const resolved = resolveInvestigationsDirectory(
    parsed.value.workspaceRoot,
    parsed.value.investigationsDir
  );
  if (resolved.isErr()) return err(resolved.error);
  const errors: string[] = [];
  const query = parsed.value.query.trim();
  if (query.length === 0) errors.push("search query must not be empty");
  const limit = parsed.value.limit ?? stateIndexQueryDefaultLimit;
  validateQueryPagination(limit, 0, errors);
  const tags = uniqueSorted((parsed.value.tags ?? []).map((tag) => tag.trim()));
  for (const tag of tags)
    if (!isInvestigationTag(tag))
      errors.push(`tag filter must use kebab-case: ${tag || "<empty>"}`);
  const relationType = parsed.value.relationType;
  const from = timestampFilter(
    parsed.value.formedAtFrom,
    "formedAt lower bound",
    errors
  );
  const to = timestampFilter(
    parsed.value.formedAtTo,
    "formedAt upper bound",
    errors
  );
  if (from !== null && to !== null && from > to)
    errors.push("formedAt lower bound must not be after the upper bound");
  return errors.length > 0
    ? err(uniqueSorted(errors))
    : ok({
        indexPath: path.join(
          resolved.value.investigationsDirectory,
          investigationIndexFileName
        ),
        in: parsed.value.in ?? "content",
        query,
        resolved: resolved.value,
        validated: {
          limit,
          match: parsed.value.match ?? "all",
          states: (state) => {
            const formedAt = investigationTimestampMilliseconds(state.formedAt);
            return (
              tags.every((tag) => state.tags.includes(tag)) &&
              (relationType === undefined ||
                state.relations.some(
                  (relation) => relation.type === relationType
                )) &&
              formedAt !== null &&
              (from === null || formedAt >= from) &&
              (to === null || formedAt <= to)
            );
          }
        }
      });
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
function searchFailure(
  errors: readonly string[],
  indexPath: string,
  diagnostics: readonly InvestigationDiagnostic[] = [],
  warnings: readonly string[] = []
): InvestigationSearchResult {
  return {
    diagnostics: [...diagnostics],
    entries: [],
    errors: uniqueSorted(errors),
    indexPath,
    status: "error",
    truncation: { files: false, matches: false, previewCharacters: false },
    warnings: [...warnings]
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
