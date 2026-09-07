import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import * as v from "valibot";
import {
  searchFileText,
  FileTextSearchError,
  type FileTextSearchMode
} from "../../shared/src/file-text-search/index.ts";
import {
  createStateIndexReader,
  createStateIndexRuntime,
  defineStateIndexDefinition,
  expectationOf,
  loadStateIndex,
  type StateIndexDefinition,
  type StateSnapshot,
  type StateSourceRevision,
  type StateIndexSyncScope,
  stateIndexQueryMaximumLimit
} from "../../index-runtime/src/index.ts";
import { parseCaseSource, normalizeCaseMarkdown } from "./case-source.ts";
import {
  testEvidenceCaseSchema,
  testEvidenceCaseIdSchema,
  testEvidenceCaseIndexStateSchema,
  testEvidenceCasesPath,
  testEvidenceDefinitionVersion,
  testEvidenceIndexMetadataSchema,
  testEvidenceIndexPath,
  testEvidenceNamespace,
  testEvidencePath,
  testEvidenceSchemaVersion,
  testEvidenceStateIndexSchema,
  queryLimitSchema,
  queryOffsetSchema,
  snapshotSchema,
  expectedSourceSchema,
  type ExpectedSource,
  type TestEvidenceCase,
  type TestEvidenceCaseIndexState,
  type TestEvidenceDiagnostic,
  type TestEvidenceIndexMetadata
} from "./core-schemas.ts";

export const testEvidenceQueryDefaultLimit = 20;
type ParsedCase = Readonly<{
  case: TestEvidenceCase;
  fingerprint: string;
  markdown: string;
}>;
type Source = Readonly<{
  cases: readonly ParsedCase[];
  diagnostics: readonly TestEvidenceDiagnostic[];
  revision: StateSourceRevision | null;
}>;
const diagnostic = (
  category: TestEvidenceDiagnostic["category"],
  code: string,
  message: string,
  extra: Omit<
    TestEvidenceDiagnostic,
    "blocking" | "category" | "code" | "message"
  > = {}
): TestEvidenceDiagnostic => ({
  blocking: true,
  category,
  code,
  message,
  ...extra
});
const fp = (value: string) =>
  `sha256:${createHash("sha256").update(value, "utf8").digest("hex")}`;
const sourcePath = (member: string) => `cases/${member}`;

async function readCases(workspaceRoot: string): Promise<Source> {
  const root = path.resolve(workspaceRoot);
  const evidenceRoot = path.join(root, ...testEvidencePath.split("/"));
  const casesRoot = path.join(root, ...testEvidenceCasesPath.split("/"));
  const diagnostics: TestEvidenceDiagnostic[] = [];
  let rootEntries: string[];
  try {
    const stat = await fs.lstat(evidenceRoot);
    if (stat.isSymbolicLink() || !stat.isDirectory())
      throw new Error("invalid");
    rootEntries = await fs.readdir(evidenceRoot);
  } catch {
    return {
      cases: [],
      diagnostics: [
        diagnostic(
          "case",
          "case.root-uninitialized",
          `${testEvidencePath} must be an existing regular directory`,
          { path: testEvidencePath }
        )
      ],
      revision: null
    };
  }
  for (const member of rootEntries)
    if (
      member !== "cases" &&
      member !== path.posix.basename(testEvidenceIndexPath)
    )
      diagnostics.push(
        diagnostic(
          "case",
          "case.root-member-unsupported",
          `${testEvidencePath}/${member} is not part of the Case layout`,
          { path: `${testEvidencePath}/${member}` }
        )
      );
  let members: string[];
  try {
    const stat = await fs.lstat(casesRoot);
    if (stat.isSymbolicLink() || !stat.isDirectory())
      throw new Error("invalid");
    members = await fs.readdir(casesRoot);
  } catch {
    diagnostics.push(
      diagnostic(
        "case",
        "case.directory-uninitialized",
        `${testEvidenceCasesPath} must be an existing regular directory`,
        { path: testEvidenceCasesPath }
      )
    );
    return { cases: [], diagnostics, revision: null };
  }
  const cases: ParsedCase[] = [];
  const ids = new Map<string, string>();
  const identities = new Map<string, string>();
  for (const member of members.sort()) {
    const relative = sourcePath(member);
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*\.md$/u.test(member)) {
      diagnostics.push(
        diagnostic(
          "case",
          "case.member-unsupported",
          `${relative} must be a direct kebab-case Markdown Case file`,
          { path: relative }
        )
      );
      continue;
    }
    try {
      const absolute = path.join(casesRoot, member);
      const stat = await fs.lstat(absolute);
      if (stat.isSymbolicLink() || !stat.isFile()) throw new Error("invalid");
      const identity = `${stat.dev}:${stat.ino}`;
      const firstPath = identities.get(identity);
      if (firstPath !== undefined) {
        diagnostics.push(
          diagnostic(
            "case",
            "case.identity-conflict",
            `${firstPath} and ${relative} must have distinct file-system identities`,
            { path: relative }
          )
        );
        continue;
      }
      identities.set(identity, relative);
      const bytes = await fs.readFile(absolute);
      const markdown = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
      const parsed = parseCaseSource({ path: relative, text: markdown });
      if (parsed.value === null) {
        diagnostics.push(
          ...parsed.diagnostics.map((entry) =>
            diagnostic(entry.category, entry.code, entry.message, {
              caseId: entry.caseId,
              path: entry.path,
              testId: entry.testId
            })
          )
        );
        continue;
      }
      const checked = v.safeParse(testEvidenceCaseSchema, parsed.value.case);
      if (!checked.success) {
        diagnostics.push(
          diagnostic("case", "case.schema-invalid", `${relative} is invalid`, {
            path: relative
          })
        );
        continue;
      }
      if (ids.has(checked.output.id)) {
        diagnostics.push(
          diagnostic(
            "case",
            "case.id-duplicate",
            `${checked.output.id} appears in both ${ids.get(checked.output.id)} and ${relative}`,
            { caseId: checked.output.id, path: relative }
          )
        );
        continue;
      }
      ids.set(checked.output.id, relative);
      cases.push({
        case: checked.output,
        fingerprint: fp(
          JSON.stringify([relative, normalizeCaseMarkdown(markdown)])
        ),
        markdown: normalizeCaseMarkdown(markdown)
      });
    } catch {
      diagnostics.push(
        diagnostic(
          "case",
          "case.read-failed",
          `${relative} must be a regular UTF-8 file`,
          { path: relative }
        )
      );
    }
  }
  cases.sort((left, right) => left.case.id.localeCompare(right.case.id));
  const revision =
    diagnostics.length === 0
      ? {
          metadata: fp("{}"),
          entries: Object.fromEntries(
            cases.map((entry) => [entry.case.id, entry.fingerprint])
          )
        }
      : null;
  return { cases, diagnostics, revision };
}
async function readSingleCase(
  workspaceRoot: string,
  relative: string
): Promise<{
  diagnostics: readonly TestEvidenceDiagnostic[];
  value: ParsedCase | null;
}> {
  if (!/^cases\/[a-z0-9]+(?:-[a-z0-9]+)*\.md$/u.test(relative))
    return {
      diagnostics: [
        diagnostic(
          "case",
          "case.source-path-invalid",
          `${relative} is not a Case source path`,
          { path: relative }
        )
      ],
      value: null
    };
  try {
    const absolute = path.join(
      path.resolve(workspaceRoot),
      ...testEvidencePath.split("/"),
      ...relative.split("/")
    );
    const stat = await fs.lstat(absolute);
    if (stat.isSymbolicLink() || !stat.isFile()) throw new Error("invalid");
    const markdown = normalizeCaseMarkdown(
      new TextDecoder("utf-8", { fatal: true }).decode(
        await fs.readFile(absolute)
      )
    );
    const parsed = parseCaseSource({ path: relative, text: markdown });
    if (parsed.value === null)
      return {
        diagnostics: parsed.diagnostics.map((entry) =>
          diagnostic("case", entry.code, entry.message, {
            caseId: entry.caseId,
            path: entry.path,
            testId: entry.testId
          })
        ),
        value: null
      };
    const checked = v.safeParse(testEvidenceCaseSchema, parsed.value.case);
    if (!checked.success)
      return {
        diagnostics: [
          diagnostic("case", "case.schema-invalid", `${relative} is invalid`, {
            path: relative
          })
        ],
        value: null
      };
    return {
      diagnostics: [],
      value: {
        case: checked.output,
        fingerprint: fp(JSON.stringify([relative, markdown])),
        markdown
      }
    };
  } catch {
    return {
      diagnostics: [
        diagnostic(
          "case",
          "case.read-failed",
          `${relative} must be a regular UTF-8 file`,
          { path: relative }
        )
      ],
      value: null
    };
  }
}

function definition(
  snapshot?: StateSnapshot<
    TestEvidenceCaseIndexState,
    TestEvidenceIndexMetadata
  >
): StateIndexDefinition<TestEvidenceCaseIndexState, TestEvidenceIndexMetadata> {
  return defineStateIndexDefinition({
    definitionVersion: testEvidenceDefinitionVersion,
    namespace: testEvidenceNamespace,
    fieldOrder: "definition",
    queryFields: [
      {
        mode: "exact",
        name: "tag",
        sources: [{ kind: "state-path", path: ["tags"] }]
      },
      {
        mode: "exact",
        name: "test",
        sources: [{ kind: "state-path", path: ["testIds"] }]
      }
    ],
    parseMetadata: (input) => v.parse(testEvidenceIndexMetadataSchema, input),
    parseState: (input) => v.parse(testEvidenceCaseIndexStateSchema, input),
    read: async (context) =>
      snapshot ?? snapshotFromSource(await readCases(context.root)),
    readRevision: async (context) => {
      const source = await readCases(context.root);
      if (source.revision === null)
        throw new Error(source.diagnostics.map((d) => d.message).join("; "));
      return source.revision;
    },
    validateIndex: (index) => {
      v.parse(testEvidenceStateIndexSchema, index);
    }
  });
}
function snapshotFromSource(
  source: Source
): StateSnapshot<TestEvidenceCaseIndexState, TestEvidenceIndexMetadata> {
  if (source.revision === null)
    throw new Error(source.diagnostics.map((d) => d.message).join("; "));
  return {
    metadata: {},
    sourceRevision: source.revision,
    states: Object.fromEntries(
      source.cases.map(({ case: entry }) => [
        entry.id,
        {
          title: entry.title,
          sourcePath: entry.sourcePath,
          tags: [...entry.tags],
          testIds: [...entry.testIds]
        }
      ])
    )
  };
}
function mapIndex(
  errors: readonly {
    code: string;
    message: string;
    path: string | null;
    stateId: string | null;
  }[]
): TestEvidenceDiagnostic[] {
  return errors.map((entry) =>
    diagnostic(
      "index",
      entry.code,
      `${entry.message}. Run sync-index --write to rebuild ${testEvidenceIndexPath}`,
      {
        caseId: entry.stateId ?? undefined,
        path: entry.path ?? testEvidenceIndexPath
      }
    )
  );
}

export async function validateTestEvidence(options: { workspaceRoot: string }) {
  const source = await readCases(options.workspaceRoot);
  const diagnostics = [...source.diagnostics];
  if (source.revision !== null) {
    const sync = await syncTestEvidenceIndex({
      workspaceRoot: options.workspaceRoot,
      mode: "check"
    });
    diagnostics.push(...sync.diagnostics);
  }
  return {
    schemaVersion: testEvidenceSchemaVersion,
    diagnostics,
    casePath: testEvidenceCasesPath,
    indexPath: testEvidenceIndexPath,
    sourceRevision: source.revision,
    summary: {
      cases: source.cases.length,
      tags: new Set(source.cases.flatMap((entry) => entry.case.tags)).size,
      references: source.cases.reduce(
        (total, entry) => total + entry.case.testIds.length,
        0
      )
    }
  };
}

export async function syncTestEvidenceIndex(options: {
  workspaceRoot: string;
  mode: "check" | "write";
  selectedCaseIds?: readonly string[];
}) {
  const source = await readCases(options.workspaceRoot);
  if (source.revision === null)
    return {
      schemaVersion: testEvidenceSchemaVersion,
      status: "error" as const,
      state: "source-invalid" as const,
      changed: false,
      diagnostics: source.diagnostics,
      indexPath: testEvidenceIndexPath,
      sourceRevision: null
    };
  const selected = options.selectedCaseIds;
  if (
    selected !== undefined &&
    (selected.length === 0 ||
      new Set(selected).size !== selected.length ||
      selected.some((id) => !v.safeParse(testEvidenceCaseIdSchema, id).success))
  )
    return {
      schemaVersion: testEvidenceSchemaVersion,
      status: "error" as const,
      state: "source-invalid" as const,
      changed: false,
      diagnostics: [
        diagnostic(
          "index",
          "index.selection-invalid",
          "selected Case IDs must be non-empty, unique, and valid"
        )
      ],
      indexPath: testEvidenceIndexPath,
      sourceRevision: source.revision
    };
  const runtime = createStateIndexRuntime({
    definition: definition(snapshotFromSource(source)),
    indexPath: testEvidenceIndexPath,
    root: path.resolve(options.workspaceRoot)
  });
  const scope: StateIndexSyncScope =
    selected === undefined
      ? { kind: "all" }
      : { kind: "selected", selectedIds: [...selected].sort() };
  const result = await runtime.sync(options.mode, scope);
  return {
    schemaVersion: testEvidenceSchemaVersion,
    status: result.status,
    state: result.state === "mode-invalid" ? "source-invalid" : result.state,
    changed: result.changed,
    diagnostics: mapIndex(result.diagnostics),
    indexPath: testEvidenceIndexPath,
    sourceRevision: source.revision,
    selectedIds: result.selectedIds
  };
}

async function openIndex(root: string) {
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
function paging(input: { limit?: number; offset?: number }) {
  const limit = v.safeParse(
    queryLimitSchema,
    input.limit ?? testEvidenceQueryDefaultLimit
  );
  const offset = v.safeParse(queryOffsetSchema, input.offset ?? 0);
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
  if (options.caseId !== undefined) {
    const found = opened.reader.get(options.caseId);
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
        .map((entry) => ({ id: entry.id, ...entry.state })),
      total: entries.length
    };
  }
  const filters = [
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
  const result = opened.reader.query({
    filters,
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
    cases: result.value.entries.map((entry) => ({
      id: entry.id,
      ...entry.state
    })),
    total: result.value.total,
    limit: result.value.limit,
    offset: result.value.offset
  };
}
export async function listTestEvidenceTags(options: { workspaceRoot: string }) {
  const opened = await openIndex(options.workspaceRoot);
  if (opened.reader === null)
    return {
      schemaVersion: testEvidenceSchemaVersion,
      source: "index" as const,
      currentness: "unchecked" as const,
      diagnostics: opened.diagnostics,
      tags: []
    };
  const all = opened.reader.all({ sort: [{ key: "id", direction: "asc" }] });
  if (all.status === "error")
    return {
      schemaVersion: testEvidenceSchemaVersion,
      source: "index" as const,
      currentness: "unchecked" as const,
      diagnostics: [...opened.diagnostics, ...mapIndex(all.diagnostics)],
      tags: []
    };
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
  const expectedFingerprint =
    opened.index?.sourceRevision.entries[options.caseId];
  if (
    source.value.case.id !== options.caseId ||
    source.value.fingerprint !== expectedFingerprint
  )
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
function showFailure(diagnostics: readonly TestEvidenceDiagnostic[]) {
  return {
    schemaVersion: testEvidenceSchemaVersion,
    diagnostics: [...diagnostics],
    case: null,
    markdown: null,
    indexPath: testEvidenceIndexPath
  };
}
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
  const source = await readCases(options.workspaceRoot);
  const listed = await queryAllSearchCandidates({
    workspaceRoot: options.workspaceRoot,
    tags: options.tags,
    testId: options.testId
  });
  if (
    page.error !== null ||
    source.revision === null ||
    listed.diagnostics.some((d) => d.blocking)
  )
    return {
      schemaVersion: testEvidenceSchemaVersion,
      diagnostics: [
        ...source.diagnostics,
        ...listed.diagnostics,
        ...(page.error === null ? [] : [page.error])
      ],
      sourceRevision: null,
      cases: [],
      total: 0,
      limit: page.limit,
      offset: page.offset
    };
  const opened = await openIndex(options.workspaceRoot);
  if (
    opened.reader === null ||
    !sameRevision(opened.index?.sourceRevision, source.revision)
  )
    return {
      schemaVersion: testEvidenceSchemaVersion,
      diagnostics: [
        diagnostic(
          "index",
          "state-index.index-stale",
          `${testEvidenceIndexPath} must be synchronized before searching`,
          { path: testEvidenceIndexPath }
        )
      ],
      sourceRevision: null,
      cases: [],
      total: 0,
      limit: page.limit,
      offset: page.offset
    };
  try {
    const hits = await searchFileText({
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
    const stable = await readCases(options.workspaceRoot);
    if (
      stable.revision === null ||
      !sameRevision(stable.revision, source.revision)
    )
      return {
        schemaVersion: testEvidenceSchemaVersion,
        diagnostics: [
          diagnostic(
            "index",
            "state-index.source-changed",
            "Case sources changed while searching; retry after they are stable",
            { path: testEvidenceIndexPath }
          )
        ],
        sourceRevision: null,
        cases: [],
        total: 0,
        limit: page.limit,
        offset: page.offset
      };
    const caseByPath = new Map(
      source.cases.map((entry) => [entry.case.sourcePath, entry])
    );
    const all = hits.hits
      .map((hit) => ({
        case: caseByPath.get(hit.sourcePath)!,
        previews: hit.previews
      }))
      .filter((entry) => entry.case !== undefined)
      .sort((a, b) => a.case.case.id.localeCompare(b.case.case.id));
    return {
      schemaVersion: testEvidenceSchemaVersion,
      diagnostics: [],
      sourceRevision: source.revision,
      cases: all.slice(page.offset, page.offset + page.limit).map((entry) => ({
        id: entry.case.case.id,
        title: entry.case.case.title,
        sourcePath: entry.case.case.sourcePath,
        tags: entry.case.case.tags,
        testIds: entry.case.case.testIds,
        previews: entry.previews
      })),
      total: all.length,
      limit: page.limit,
      offset: page.offset
    };
  } catch (error) {
    return {
      schemaVersion: testEvidenceSchemaVersion,
      diagnostics: [
        diagnostic(
          "query",
          error instanceof FileTextSearchError
            ? `search.${error.code}`
            : "search.failed",
          error instanceof Error ? error.message : "search failed"
        )
      ],
      sourceRevision: null,
      cases: [],
      total: 0,
      limit: page.limit,
      offset: page.offset
    };
  }
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
    first.diagnostics.some((diagnostic) => diagnostic.blocking) ||
    first.cases.length >= first.total
  )
    return first;
  const cases = [...first.cases];
  let offset = cases.length;
  while (offset < first.total) {
    const page = await queryTestEvidence({
      ...options,
      limit: stateIndexQueryMaximumLimit,
      offset
    });
    if (page.diagnostics.some((diagnostic) => diagnostic.blocking))
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
export async function validateTestEvidenceReferences(options: {
  workspaceRoot: string;
  snapshot: unknown;
  expectedSource: ExpectedSource;
  caseIds?: readonly string[];
}) {
  const source = await readCases(options.workspaceRoot);
  const base = {
    schemaVersion: testEvidenceSchemaVersion,
    expectedSource: options.expectedSource ?? null,
    observedSource: null as ExpectedSource | null,
    snapshotFingerprint: null as string | null,
    checkedCaseIds: [] as string[],
    checkedReferenceCount: 0
  };
  if (source.revision === null)
    return {
      ...base,
      status: "error" as const,
      state: "case-invalid" as const,
      diagnostics: source.diagnostics
    };
  const selected =
    options.caseIds === undefined
      ? source.cases
      : source.cases.filter((entry) =>
          options.caseIds!.includes(entry.case.id)
        );
  if (
    options.caseIds !== undefined &&
    (options.caseIds.length === 0 ||
      new Set(options.caseIds).size !== options.caseIds.length ||
      selected.length !== options.caseIds.length)
  )
    return {
      ...base,
      status: "error" as const,
      state: "case-invalid" as const,
      diagnostics: [
        diagnostic(
          "case",
          "case.selection-invalid",
          "selected Case IDs must be non-empty, unique, and known"
        )
      ]
    };
  const snapshot = v.safeParse(snapshotSchema, options.snapshot);
  if (!snapshot.success)
    return {
      ...base,
      status: "error" as const,
      state: "snapshot-invalid" as const,
      diagnostics: [
        diagnostic(
          "snapshot",
          "snapshot.invalid",
          "snapshot does not match schemaVersion 2"
        )
      ]
    };
  const observed = snapshot.output.source;
  const fingerprint = fp(JSON.stringify(snapshot.output));
  const common = {
    ...base,
    observedSource: observed,
    snapshotFingerprint: fingerprint,
    checkedCaseIds: selected.map((entry) => entry.case.id)
  };
  const expected = v.safeParse(expectedSourceSchema, options.expectedSource);
  if (
    !expected.success ||
    Object.entries(expected.output).some(
      ([key, value]) => observed[key as keyof ExpectedSource] !== value
    )
  )
    return {
      ...common,
      status: "error" as const,
      state: "source-mismatch" as const,
      diagnostics: [
        diagnostic(
          "snapshot",
          "snapshot.source-mismatch",
          "snapshot source does not match expectedSource"
        )
      ]
    };
  if (snapshot.output.completeness !== "complete")
    return {
      ...common,
      status: "error" as const,
      state: "snapshot-incomplete" as const,
      diagnostics: [
        diagnostic(
          "snapshot",
          "snapshot.incomplete",
          "partial snapshots cannot validate references"
        )
      ]
    };
  const known = new Set(snapshot.output.entities.map((entity) => entity.id));
  const missing = selected.flatMap((entry) =>
    entry.case.testIds
      .filter((id) => !known.has(id))
      .map((testId) =>
        diagnostic(
          "reference",
          "reference.entity-missing",
          `${entry.case.id} references missing entity ${testId}`,
          { caseId: entry.case.id, testId, path: entry.case.sourcePath }
        )
      )
  );
  return missing.length === 0
    ? {
        ...common,
        status: "ok" as const,
        state: "valid" as const,
        checkedReferenceCount: selected.reduce(
          (n, entry) => n + entry.case.testIds.length,
          0
        ),
        diagnostics: []
      }
    : {
        ...common,
        status: "error" as const,
        state: "references-invalid" as const,
        diagnostics: missing
      };
}
export async function stageTestEvidenceIndex(options: {
  workspaceRoot: string;
  caseIds: readonly string[];
}) {
  if (
    options.caseIds.length === 0 ||
    new Set(options.caseIds).size !== options.caseIds.length ||
    options.caseIds.some(
      (id) => !v.safeParse(testEvidenceCaseIdSchema, id).success
    )
  )
    return {
      status: "error" as const,
      state: "selection-invalid" as const,
      diagnostics: [
        diagnostic(
          "index",
          "index.selection-invalid",
          "stage-index requires non-empty unique Case IDs"
        )
      ]
    };
  const runtime = createStateIndexRuntime({
    definition: definition(),
    indexPath: testEvidenceIndexPath,
    root: path.resolve(options.workspaceRoot)
  });
  return await runtime.stageSelectedEntries(options.caseIds);
}
