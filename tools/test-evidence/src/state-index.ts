import path from "node:path";
import * as v from "valibot";
import {
  createStateIndexRuntime,
  defineStateIndexDefinition,
  type StateIndexDefinition,
  type StateIndexDiagnostic,
  type StateIndexSyncMode,
  type StateSnapshot
} from "../../index-runtime/src/index.ts";
import { createDiagnostic } from "./diagnostics.ts";
import {
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
  workspaceRoot: string;
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
    keyStrategies: [
      {
        derive: (state, context) => caseSearchText(state, context.id),
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
      if (state.id !== context.id) {
        throw new TypeError(
          `state id must match its index key: ${context.id}`
        );
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

function caseSearchText(
  state: TestEvidenceCaseIndexState,
  id: string
): string {
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
  const source = await readTestEvidenceIndexSource({ root: workspaceRoot });
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
