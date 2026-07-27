import { createHash, type Hash } from "node:crypto";
import path from "node:path";
import * as v from "valibot";
import {
  createStateIndexRuntime,
  defineStateIndexDefinition,
  type StateIndexContext,
  type StateIndexDefinition,
  type StateIndexDiagnostic,
  type StateIndexSyncMode,
  type StateSnapshot
} from "../../index-runtime/src/index.ts";
import {
  loadTestEvidenceCatalog,
  type LoadedTestEvidenceCatalogCase,
  type TestEvidenceCatalogSource
} from "./catalog-source.ts";
import { createDiagnostic } from "./diagnostics.ts";
import {
  testEvidenceCaseIdPatternSource,
  testEvidenceCatalogPath,
  testEvidenceIndexPath,
  testEvidenceCaseIndexStateSchema,
  testEvidenceIndexDefinitionVersion,
  testEvidenceIndexMetadataSchema,
  testEvidenceIndexNamespace,
  testEvidenceReportSchemaVersion,
  type TestEvidenceIndexMetadata
} from "./schemas.ts";
import {
  normalizeTestEvidenceTopicCatalog
} from "./topic-catalog.ts";
import { testEvidenceTopicIdFromSourcePath } from "./topic.ts";
import { cloneTopicDefinitions } from "./topics.ts";
import type {
  TestEvidenceCaseIndexState,
  TestEvidenceDiagnostic,
  TestEvidenceIndexSyncResult
} from "./types.ts";

export type SyncTestEvidenceIndexOptions = {
  mode: StateIndexSyncMode;
  workspaceRoot: string;
};

type TestEvidenceIndexSourceResult =
  | {
    diagnostics: [];
    snapshot: StateSnapshot<
      TestEvidenceCaseIndexState,
      TestEvidenceIndexMetadata
    >;
    topics: TestEvidenceIndexMetadata["topics"];
  }
  | {
    diagnostics: TestEvidenceDiagnostic[];
    snapshot: null;
    topics: TestEvidenceIndexMetadata["topics"];
  };

export function createTestEvidenceStateIndexDefinition(options: {
  snapshot?: StateSnapshot<
    TestEvidenceCaseIndexState,
    TestEvidenceIndexMetadata
  >;
} = {}): StateIndexDefinition<
  TestEvidenceCaseIndexState,
  TestEvidenceIndexMetadata
> {
  return defineStateIndexDefinition({
    definitionVersion: testEvidenceIndexDefinitionVersion,
    identify: (state) => state.id,
    keyStrategies: [
      {
        derive: caseSearchText,
        mode: "text",
        name: "search"
      },
      {
        derive: (state, context) => topicFromIndexState(
          state,
          context.metadata
        ),
        mode: "exact",
        name: "topic"
      }
    ],
    namespace: testEvidenceIndexNamespace,
    parseMetadata: (input) => v.parse(
      testEvidenceIndexMetadataSchema,
      input
    ),
    parseState: (input, context) => {
      const state = v.parse(testEvidenceCaseIndexStateSchema, input);
      topicFromIndexState(state, context.metadata);
      return state;
    },
    read: async (context) => {
      if (options.snapshot !== undefined) {
        return options.snapshot;
      }
      const source = await readTestEvidenceIndexSource(
        context
      );
      if (source.snapshot === null) {
        throw new Error(
          source.diagnostics.map((entry) => entry.message).join("; ")
        );
      }
      return source.snapshot;
    },
    readRevision: async (context) => await readCurrentSourceRevision(context)
  });
}

function caseSearchText(state: TestEvidenceCaseIndexState): string {
  return state.searchText;
}

function topicFromIndexState(
  state: TestEvidenceCaseIndexState,
  metadata: {
    readonly topics: readonly {
      readonly id: string;
    }[];
  }
): string {
  const topicId = testEvidenceTopicIdFromSourcePath(state.sourcePath);
  if (topicId === null) {
    throw new TypeError(
      `sourcePath must use <topic-id>/<semantic-slug>.md: ${
        state.sourcePath
      }`
    );
  }
  if (!metadata.topics.some((topic) => topic.id === topicId)) {
    throw new TypeError(
      `sourcePath topic is not defined in metadata.topics: ${topicId}`
    );
  }
  return topicId;
}

export async function syncTestEvidenceIndex(
  options: SyncTestEvidenceIndexOptions
): Promise<TestEvidenceIndexSyncResult> {
  const workspaceRoot = path.resolve(options.workspaceRoot);
  const source = await readTestEvidenceIndexSource(
    { root: workspaceRoot }
  );
  if (source.snapshot === null) {
    return failedSyncResult({
      diagnostics: source.diagnostics,
      mode: options.mode,
      topics: source.topics
    });
  }

  const runtime = createStateIndexRuntime({
    definition: createTestEvidenceStateIndexDefinition({
      snapshot: source.snapshot
    }),
    indexPath: testEvidenceIndexPath,
    root: workspaceRoot
  });
  const synchronized = await runtime.sync(options.mode);
  return {
    catalogPath: testEvidenceCatalogPath,
    changed: synchronized.changed,
    diagnostics: mapStateIndexDiagnostics(
      synchronized.diagnostics,
      testEvidenceIndexPath,
      options.mode === "check"
    ),
    indexPath: testEvidenceIndexPath,
    mode: options.mode,
    schemaVersion: testEvidenceReportSchemaVersion,
    state: synchronized.state === "mode-invalid"
      ? "source-invalid"
      : synchronized.state,
    status: synchronized.status,
    topics: cloneTopicDefinitions(source.topics)
  };
}

export function mapStateIndexDiagnostics(
  diagnostics: readonly StateIndexDiagnostic[],
  indexPath: string,
  includeSyncHint = true
): TestEvidenceDiagnostic[] {
  return diagnostics.map((entry) => createDiagnostic({
    caseId: entry.stateId ?? undefined,
    category: "index",
    code: entry.code,
    message: includeSyncHint && indexCanBeRebuilt(entry.code)
      ? `${entry.message}. Run sync-index --write to rebuild ${indexPath}`
      : entry.message,
    path: entry.path ?? indexPath,
    severity: "error"
  }));
}

export function testEvidenceSourceRevision(options: {
  sources: readonly TestEvidenceCatalogSource[];
  topicCatalog: Parameters<typeof normalizeTestEvidenceTopicCatalog>[0];
}): string {
  const hash = createHash("sha256");
  hash.update("test-evidence-index-source-v3\0");
  hashField(hash, normalizeTestEvidenceTopicCatalog(options.topicCatalog));
  hashField(hash, testEvidenceCaseIdPatternSource);
  for (const source of [...options.sources].sort((left, right) => (
    compareText(left.path, right.path)
  ))) {
    hashField(hash, source.path);
    hashField(hash, normalizeSourceText(source.text));
  }
  return `sha256:${hash.digest("hex")}`;
}

async function readTestEvidenceIndexSource(
  context: StateIndexContext
): Promise<TestEvidenceIndexSourceResult> {
  const catalog = await loadTestEvidenceCatalog(context.root);
  const topics = cloneTopicDefinitions(catalog.topicCatalog?.topics ?? []);
  if (catalog.diagnostics.length > 0) {
    return {
      diagnostics: catalog.diagnostics,
      snapshot: null,
      topics
    };
  }
  if (catalog.topicCatalog === null) {
    throw new TypeError("validated catalog must include a topic catalog");
  }

  const states = catalog.cases.map(catalogCaseState);
  return {
    diagnostics: [],
    snapshot: {
      metadata: { topics },
      revision: testEvidenceSourceRevision({
        sources: catalog.sources,
        topicCatalog: catalog.topicCatalog
      }),
      states
    },
    topics
  };
}

async function readCurrentSourceRevision(
  context: StateIndexContext
): Promise<string> {
  const catalog = await loadTestEvidenceCatalog(context.root);
  if (catalog.diagnostics.length > 0 || catalog.topicCatalog === null) {
    throw new Error(
      catalog.diagnostics.map((entry) => entry.message).join("; ")
    );
  }
  return testEvidenceSourceRevision({
    sources: catalog.sources,
    topicCatalog: catalog.topicCatalog
  });
}

function catalogCaseState(
  catalogCase: LoadedTestEvidenceCatalogCase
): TestEvidenceCaseIndexState {
  const { parsed: entry, sourcePath, validated } = catalogCase;
  const summary = entry.sections.contract.items[0];
  if (summary === undefined) {
    throw new TypeError(`validated case ${entry.id} has no index summary`);
  }
  return v.parse(testEvidenceCaseIndexStateSchema, {
    endLine: entry.endLine,
    entries: validated.entries,
    id: entry.id,
    line: entry.line,
    searchText: [
      entry.id,
      entry.title,
      ...entry.sections.contract.items,
      ...entry.sections.proves.items,
      ...validated.entries
    ].join(" "),
    sourcePath,
    summary,
    title: entry.title
  });
}

function failedSyncResult(options: {
  diagnostics: readonly TestEvidenceDiagnostic[];
  mode: StateIndexSyncMode;
  topics?: TestEvidenceIndexMetadata["topics"];
}): TestEvidenceIndexSyncResult {
  return {
    catalogPath: testEvidenceCatalogPath,
    changed: false,
    diagnostics: [...options.diagnostics],
    indexPath: testEvidenceIndexPath,
    mode: options.mode,
    schemaVersion: testEvidenceReportSchemaVersion,
    state: "source-invalid",
    status: "error",
    topics: cloneTopicDefinitions(options.topics ?? [])
  };
}

const rebuildableIndexCodes: ReadonlySet<string> = new Set([
  "state-index.definition-mismatch",
  "state-index.definition-version-mismatch",
  "state-index.id-duplicate",
  "state-index.id-invalid",
  "state-index.identify-failed",
  "state-index.index-missing",
  "state-index.index-stale",
  "state-index.index-validation-failed",
  "state-index.json-invalid",
  "state-index.key-definition-duplicate",
  "state-index.key-derive-failed",
  "state-index.key-reserved",
  "state-index.key-unknown",
  "state-index.key-value-duplicate",
  "state-index.key-value-invalid",
  "state-index.metadata-invalid",
  "state-index.metadata-parse-failed",
  "state-index.metadata-parse-invalid",
  "state-index.namespace-mismatch",
  "state-index.schema-invalid",
  "state-index.state-invalid",
  "state-index.state-parse-failed",
  "state-index.state-parse-invalid"
]);

export function indexCanBeRebuilt(code: string): boolean {
  return rebuildableIndexCodes.has(code);
}

function normalizeSourceText(value: string): string {
  return value.replace(/\r\n?/gu, "\n");
}

function hashField(hash: Hash, value: string): void {
  const byteLength = Buffer.byteLength(value, "utf8");
  hash.update(`${byteLength}:`, "utf8");
  hash.update(value, "utf8");
  hash.update("\0", "utf8");
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
