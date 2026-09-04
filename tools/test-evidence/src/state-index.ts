import path from "node:path";
import * as v from "valibot";
import {
  createStateIndexRuntime,
  defineStateIndexDefinition,
  type StateIndexDefinition,
  type StateIndexDiagnostic,
  type StateIndexSyncScope,
  type StateIndexSyncMode,
  type StateSnapshot
} from "../../index-runtime/src/index.ts";
import { createDiagnostic } from "./diagnostics.ts";
import {
  testEvidenceCatalogPath,
  testEvidenceIndexPath,
  testEvidenceCaseIndexStateSchema,
  testEvidenceCaseIdPatternSource,
  testEvidenceCaseIdSchema,
  testEvidenceIndexDefinitionVersion,
  testEvidenceIndexMetadataSchema,
  testEvidenceIndexNamespace,
  testEvidenceReportSchemaVersion,
  type TestEvidenceIndexMetadata
} from "./schemas.ts";
import {
  readCurrentTestEvidenceSourceRevision,
  readTestEvidenceIndexSource
} from "./state-index-source.ts";
import { testEvidenceTopicIdFromSourcePath } from "./topic.ts";
import { cloneTopicDefinitions } from "./topics.ts";
import type {
  TestEvidenceCaseIndexState,
  TestEvidenceDiagnostic,
  TestEvidenceIndexSyncResult
} from "./types.ts";

export type SyncTestEvidenceIndexOptions = {
  mode: StateIndexSyncMode;
  selectedCaseIds?: readonly string[];
  workspaceRoot: string;
};

export function createTestEvidenceStateIndexDefinition(
  options: {
    snapshot?: StateSnapshot<
      TestEvidenceCaseIndexState,
      TestEvidenceIndexMetadata
    >;
  } = {}
): StateIndexDefinition<TestEvidenceCaseIndexState, TestEvidenceIndexMetadata> {
  return defineStateIndexDefinition({
    definitionVersion: testEvidenceIndexDefinitionVersion,
    keyStrategies: [
      {
        derive: (state, context) => caseSearchText(state, context.id),
        mode: "text",
        name: "search"
      },
      {
        derive: (state, context) =>
          topicFromIndexState(state, context.metadata),
        mode: "exact",
        name: "topic"
      }
    ],
    namespace: testEvidenceIndexNamespace,
    parseMetadata: (input) => v.parse(testEvidenceIndexMetadataSchema, input),
    parseState: (input, context) => {
      const state = v.parse(testEvidenceCaseIndexStateSchema, input);
      if (state.id !== context.id) {
        throw new TypeError(`state id must match its index key: ${context.id}`);
      }
      topicFromIndexState(state, context.metadata);
      return state;
    },
    read: async (context) => {
      if (options.snapshot !== undefined) {
        return options.snapshot;
      }
      const source = await readTestEvidenceIndexSource(context);
      if (source.snapshot === null) {
        throw new Error(
          source.diagnostics.map((entry) => entry.message).join("; ")
        );
      }
      return source.snapshot;
    },
    readRevision: readCurrentTestEvidenceSourceRevision
  });
}

function caseSearchText(state: TestEvidenceCaseIndexState, id: string): string {
  return `${id} ${state.searchText}`;
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
      `sourcePath must use <topic-id>/<semantic-slug>.md: ${state.sourcePath}`
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
  const selectors =
    options.selectedCaseIds === undefined ? [] : [...options.selectedCaseIds];
  const selection = selectedCaseIds(options.selectedCaseIds);
  if (selection.status === "error") {
    return failedSyncResult({
      changedIds: [],
      diagnostics: selection.diagnostics,
      mode: options.mode,
      scope: "selected",
      selectedIds: [],
      selectors,
      state: "selection-invalid"
    });
  }
  const source = await readTestEvidenceIndexSource({ root: workspaceRoot });
  if (source.snapshot === null) {
    return failedSyncResult({
      changedIds: [],
      diagnostics: source.diagnostics,
      mode: options.mode,
      scope: selection.scope.kind,
      selectedIds:
        selection.scope.kind === "selected" ? selection.scope.selectedIds : [],
      selectors,
      state: "source-invalid",
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
  const synchronized = await runtime.sync(options.mode, selection.scope);
  return {
    catalogPath: testEvidenceCatalogPath,
    changed: synchronized.changed,
    changedIds: synchronized.changedIds,
    diagnostics: mapStateIndexDiagnostics(
      synchronized.diagnostics,
      testEvidenceIndexPath,
      options.mode === "check"
    ),
    indexPath: testEvidenceIndexPath,
    mode: options.mode,
    schemaVersion: testEvidenceReportSchemaVersion,
    scope: synchronized.scope,
    selectedIds: synchronized.selectedIds,
    selectors,
    state:
      synchronized.state === "mode-invalid"
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
  return diagnostics.map((entry) =>
    createDiagnostic({
      caseId: entry.stateId ?? undefined,
      category: "index",
      code: entry.code,
      message:
        includeSyncHint && indexCanBeRebuilt(entry.code)
          ? `${entry.message}. Run sync-index --write to rebuild ${indexPath}`
          : entry.message,
      path: entry.path ?? indexPath,
      severity: "error"
    })
  );
}

function failedSyncResult(options: {
  changedIds: readonly string[];
  diagnostics: readonly TestEvidenceDiagnostic[];
  mode: StateIndexSyncMode;
  scope: "all" | "selected";
  selectedIds: readonly string[];
  selectors: readonly string[];
  state: TestEvidenceIndexSyncResult["state"];
  topics?: TestEvidenceIndexMetadata["topics"];
}): TestEvidenceIndexSyncResult {
  return {
    catalogPath: testEvidenceCatalogPath,
    changed: false,
    changedIds: [...options.changedIds],
    diagnostics: [...options.diagnostics],
    indexPath: testEvidenceIndexPath,
    mode: options.mode,
    schemaVersion: testEvidenceReportSchemaVersion,
    scope: options.scope,
    selectedIds: [...options.selectedIds],
    selectors: [...options.selectors],
    state: options.state,
    status: "error",
    topics: cloneTopicDefinitions(options.topics ?? [])
  };
}

function selectedCaseIds(
  caseIds: readonly string[] | undefined
):
  | Readonly<{ scope: StateIndexSyncScope; status: "ok" }>
  | Readonly<{ diagnostics: TestEvidenceDiagnostic[]; status: "error" }> {
  if (caseIds === undefined) return { scope: { kind: "all" }, status: "ok" };
  const diagnostics: TestEvidenceDiagnostic[] = [];
  const seen = new Set<string>();
  for (const caseId of caseIds) {
    if (!v.safeParse(testEvidenceCaseIdSchema, caseId).success) {
      diagnostics.push(
        createDiagnostic({
          caseId,
          category: "index",
          code: "test-evidence.sync-case-id-invalid",
          message: `case ID ${JSON.stringify(caseId)} must match ${testEvidenceCaseIdPatternSource}`,
          path: testEvidenceIndexPath,
          severity: "error"
        })
      );
      continue;
    }
    if (seen.has(caseId)) {
      diagnostics.push(
        createDiagnostic({
          caseId,
          category: "index",
          code: "test-evidence.sync-case-id-duplicate",
          message: `case ID ${JSON.stringify(caseId)} appears more than once`,
          path: testEvidenceIndexPath,
          severity: "error"
        })
      );
      continue;
    }
    seen.add(caseId);
  }
  return diagnostics.length > 0
    ? { diagnostics, status: "error" }
    : {
        scope: { kind: "selected", selectedIds: [...seen].sort(compareText) },
        status: "ok"
      };
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

const rebuildableIndexCodes: ReadonlySet<string> = new Set([
  "state-index.definition-mismatch",
  "state-index.definition-version-mismatch",
  "state-index.id-invalid",
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
  "state-index.schema-version-unsupported",
  "state-index.source-revision-invalid",
  "state-index.source-revision-members-mismatch",
  "state-index.state-invalid",
  "state-index.state-parse-failed",
  "state-index.state-parse-invalid"
]);

export function indexCanBeRebuilt(code: string): boolean {
  return rebuildableIndexCodes.has(code);
}
