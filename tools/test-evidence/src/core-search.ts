import path from "node:path";
import {
  FileTextSearchError,
  searchFileText,
  type FileTextSearchMode
} from "../../shared/src/file-text-search/index.ts";
import {
  stateIndexQueryMaximumLimit,
  type StateSourceRevision
} from "../../index-runtime/src/index.ts";
import {
  testEvidenceIndexPath,
  testEvidencePath,
  testEvidenceSchemaVersion
} from "./core-schemas.ts";
import { openIndex, paging, queryTestEvidence } from "./core-query.ts";
import { diagnostic } from "./core-support.ts";
import { readCases } from "./core-source.ts";

export async function searchTestEvidence(options: {
  workspaceRoot: string;
  text: string;
  match?: FileTextSearchMode;
  tags?: readonly string[];
  testId?: string;
  limit?: number;
  offset?: number;
}) {
  const page = paging(options);
  try {
    return await searchAvailableEvidence(options, page);
  } catch (error) {
    return searchFailure(error, page.limit, page.offset);
  }
}
async function searchAvailableEvidence(
  options: Parameters<typeof searchTestEvidence>[0],
  page: ReturnType<typeof paging>
) {
  const source = await readCases(options.workspaceRoot);
  const listed = await queryAllSearchCandidates({
    workspaceRoot: options.workspaceRoot,
    tags: options.tags,
    testId: options.testId
  });
  if (page.error !== null || source.revision === null || hasBlocking(listed))
    return emptySearch(
      [...source.diagnostics, ...listed.diagnostics, ...pageDiagnostic(page)],
      null,
      page.limit,
      page.offset
    );
  const opened = await openIndex(options.workspaceRoot);
  if (
    opened.reader === null ||
    !sameRevision(opened.index?.sourceRevision, source.revision)
  )
    return staleIndexSearch(page.limit, page.offset);
  return await runSearch(options, source, listed, page.limit, page.offset);
}
function hasBlocking(
  result: Awaited<ReturnType<typeof queryAllSearchCandidates>>
): boolean {
  return result.diagnostics.some((entry) => entry.blocking);
}
function pageDiagnostic(page: ReturnType<typeof paging>) {
  return page.error === null ? [] : [page.error];
}
function staleIndexSearch(limit: number, offset: number) {
  return emptySearch(
    [
      diagnostic(
        "index",
        "state-index.index-stale",
        `${testEvidenceIndexPath} must be synchronized before searching`,
        { path: testEvidenceIndexPath }
      )
    ],
    null,
    limit,
    offset
  );
}
function searchFailure(error: unknown, limit: number, offset: number) {
  return emptySearch(
    [
      diagnostic(
        "query",
        error instanceof FileTextSearchError
          ? `search.${error.code}`
          : "search.failed",
        error instanceof Error ? error.message : "search failed"
      )
    ],
    null,
    limit,
    offset
  );
}
async function runSearch(
  options: { workspaceRoot: string; text: string; match?: FileTextSearchMode },
  source: Awaited<ReturnType<typeof readCases>>,
  listed: Awaited<ReturnType<typeof queryAllSearchCandidates>>,
  limit: number,
  offset: number
) {
  const hits = await searchCaseSources(options, listed);
  const stable = await readCases(options.workspaceRoot);
  if (!isStableSearchSource(source, stable))
    return sourceChangedSearch(limit, offset);
  const all = matchedSearchCases(source, hits);
  return {
    schemaVersion: testEvidenceSchemaVersion,
    diagnostics: [],
    sourceRevision: source.revision,
    cases: all.slice(offset, offset + limit).map(toSearchCase),
    total: all.length,
    limit,
    offset
  };
}
async function searchCaseSources(
  options: { workspaceRoot: string; text: string; match?: FileTextSearchMode },
  listed: Awaited<ReturnType<typeof queryAllSearchCandidates>>
) {
  return await searchFileText({
    root: path.join(
      path.resolve(options.workspaceRoot),
      ...testEvidencePath.split("/")
    ),
    selection: {
      kind: "files",
      sourcePaths: listed.cases.map((entry) => entry.sourcePath)
    },
    query: { text: options.text, mode: options.match ?? "all" },
    preview: {
      contextLines: 1,
      maxFiles: listed.cases.length || 1,
      maxMatchesPerFile: 5,
      maxPreviewCharacters: 10000
    }
  });
}
function isStableSearchSource(
  source: Awaited<ReturnType<typeof readCases>>,
  stable: Awaited<ReturnType<typeof readCases>>
): boolean {
  return (
    stable.revision !== null && sameRevision(stable.revision, source.revision!)
  );
}
function sourceChangedSearch(limit: number, offset: number) {
  return emptySearch(
    [
      diagnostic(
        "index",
        "state-index.source-changed",
        "Case sources changed while searching; retry after they are stable",
        { path: testEvidenceIndexPath }
      )
    ],
    null,
    limit,
    offset
  );
}
function matchedSearchCases(
  source: Awaited<ReturnType<typeof readCases>>,
  hits: Awaited<ReturnType<typeof searchFileText>>
) {
  const caseByPath = new Map(
    source.cases.map((entry) => [entry.case.sourcePath, entry])
  );
  return hits.hits
    .flatMap((hit) => searchCaseForHit(caseByPath, hit))
    .sort((left, right) =>
      left.found.case.id.localeCompare(right.found.case.id)
    );
}
function searchCaseForHit(
  caseByPath: Map<
    string,
    Awaited<ReturnType<typeof readCases>>["cases"][number]
  >,
  hit: Awaited<ReturnType<typeof searchFileText>>["hits"][number]
) {
  const found = caseByPath.get(hit.sourcePath);
  return found === undefined ? [] : [{ found, previews: hit.previews }];
}
function toSearchCase(entry: {
  found: Awaited<ReturnType<typeof readCases>>["cases"][number];
  previews: Awaited<
    ReturnType<typeof searchFileText>
  >["hits"][number]["previews"];
}) {
  const evidence = entry.found.case;
  return {
    id: evidence.id,
    title: evidence.title,
    sourcePath: evidence.sourcePath,
    tags: evidence.tags,
    testIds: evidence.testIds,
    previews: entry.previews
  };
}

function emptySearch(
  diagnostics: readonly ReturnType<typeof diagnostic>[],
  sourceRevision: StateSourceRevision | null,
  limit: number,
  offset: number
) {
  return {
    schemaVersion: testEvidenceSchemaVersion,
    diagnostics,
    sourceRevision,
    cases: [],
    total: 0,
    limit,
    offset
  };
}
async function queryAllSearchCandidates(options: {
  workspaceRoot: string;
  tags?: readonly string[];
  testId?: string;
}): Promise<Awaited<ReturnType<typeof queryTestEvidence>>> {
  const first = await queryTestEvidence({
    ...options,
    limit: stateIndexQueryMaximumLimit,
    offset: 0
  });
  if (
    first.diagnostics.some((entry) => entry.blocking) ||
    first.cases.length >= first.total
  )
    return first;
  const cases = [...first.cases];
  for (let offset = cases.length; offset < first.total;) {
    const page = await queryTestEvidence({
      ...options,
      limit: stateIndexQueryMaximumLimit,
      offset
    });
    if (page.diagnostics.some((entry) => entry.blocking))
      return { ...page, cases: [], total: 0 };
    if (page.cases.length === 0)
      return {
        ...page,
        diagnostics: [
          ...page.diagnostics,
          diagnostic(
            "index",
            "query.index-incomplete",
            "Case index stopped before all search candidates were read",
            { path: testEvidenceIndexPath }
          )
        ],
        cases: [],
        total: 0
      };
    cases.push(...page.cases);
    offset += page.cases.length;
  }
  return { ...first, cases, total: first.total };
}
function sameRevision(
  left: StateSourceRevision | undefined,
  right: StateSourceRevision
): boolean {
  return (
    left !== undefined &&
    left.metadata === right.metadata &&
    Object.keys(left.entries).length === Object.keys(right.entries).length &&
    Object.keys(right.entries).every(
      (id) => left.entries[id] === right.entries[id]
    )
  );
}
