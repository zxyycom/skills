import path from "node:path";
import * as v from "valibot";
import {
  createStateIndexRuntime,
  defineStateIndexDefinition,
  type ReadonlyStateIndex,
  type StateIndexDefinition,
  type StateIndexDiagnostic,
  type StateIndexSyncMode,
  type StateSnapshot
} from "../../../index-runtime/src/index.ts";
import { createTestEvidenceDiagnostic } from "./diagnostics.ts";
import {
  readCurrentTestEvidenceLedgerRevision,
  readTestEvidenceLedgerSource,
  type LoadedTestEvidenceLedgerSource
} from "./ledger-source.ts";
import {
  testEvidenceCaseIdSchema,
  testEvidenceLedgerCaseIndexStateSchema,
  testEvidenceLedgerDefinitionVersion,
  testEvidenceLedgerIndexMetadataSchema,
  testEvidenceLedgerIndexPath,
  testEvidenceLedgerIndexSyncResultSchema,
  testEvidenceLedgerNamespace,
  testEvidenceLedgerPath,
  testEvidenceLedgerSchemaVersion,
  testEvidenceLedgerStateIndexSchema,
  syncTestEvidenceLedgerIndexOptionsSchema,
  type SyncTestEvidenceLedgerIndexOptions,
  type TestEvidenceDiagnostic,
  type TestEvidenceLedgerCaseIndexState,
  type TestEvidenceLedgerIndexMetadata,
  type TestEvidenceLedgerIndexSyncResult
} from "./schemas.ts";

export type CreateTestEvidenceLedgerDefinitionOptions = {
  readRevision?: StateIndexDefinition<
    TestEvidenceLedgerCaseIndexState,
    TestEvidenceLedgerIndexMetadata
  >["readRevision"];
  snapshot?: StateSnapshot<
    TestEvidenceLedgerCaseIndexState,
    TestEvidenceLedgerIndexMetadata
  >;
};

export function createTestEvidenceLedgerStateIndexDefinition(
  options: CreateTestEvidenceLedgerDefinitionOptions = {}
): StateIndexDefinition<
  TestEvidenceLedgerCaseIndexState,
  TestEvidenceLedgerIndexMetadata
> {
  return defineStateIndexDefinition({
    definitionVersion: testEvidenceLedgerDefinitionVersion,
    fieldOrder: "definition",
    keyStrategies: [
      {
        derive: (state, context) => `${context.id} ${state.searchText}`,
        mode: "text",
        name: "search"
      },
      {
        derive: (state) => state.tags,
        mode: "exact",
        name: "tag"
      },
      {
        derive: (state) => state.testIds,
        mode: "exact",
        name: "test"
      }
    ],
    namespace: testEvidenceLedgerNamespace,
    parseMetadata: (input) => v.parse(
      testEvidenceLedgerIndexMetadataSchema,
      input
    ),
    parseState: (input) => v.parse(
      testEvidenceLedgerCaseIndexStateSchema,
      input
    ),
    read: async (context) => {
      if (options.snapshot !== undefined) {
        return options.snapshot;
      }
      const source = await readTestEvidenceLedgerSource(context.root);
      if (source.source === null) {
        throw new Error(
          source.diagnostics.map((entry) => entry.message).join("; ")
        );
      }
      return source.source.snapshot;
    },
    readRevision: options.readRevision
      ?? readCurrentTestEvidenceLedgerRevision,
    validateIndex: validateLedgerStateIndex
  });
}

export async function syncTestEvidenceLedgerIndex(
  options: SyncTestEvidenceLedgerIndexOptions
): Promise<TestEvidenceLedgerIndexSyncResult> {
  const parsedOptions = v.safeParse(
    syncTestEvidenceLedgerIndexOptionsSchema,
    options
  );
  if (!parsedOptions.success) {
    const rawMode = typeof options === "object" && options !== null
      && "mode" in options && options.mode === "write"
      ? "write"
      : "check";
    return failedLedgerSyncResult({
      diagnostics: [createTestEvidenceDiagnostic({
        category: "query",
        code: "query.options-invalid",
        message: `Invalid ledger API options: ${parsedOptions.issues.map((issue) => issue.message).join("; ")}`,
        severity: "error"
      })],
      entityIndex: null,
      mode: rawMode
    });
  }
  const workspaceRoot = path.resolve(parsedOptions.output.workspaceRoot);
  const source = await readTestEvidenceLedgerSource(workspaceRoot);
  if (source.source === null) {
    return failedLedgerSyncResult({
      diagnostics: source.diagnostics,
      entityIndex: source.entityIndex?.identity ?? null,
      mode: parsedOptions.output.mode
    });
  }
  return syncLoadedTestEvidenceLedgerIndex({
    mode: parsedOptions.output.mode,
    source: source.source,
    workspaceRoot
  });
}

export async function syncLoadedTestEvidenceLedgerIndex(options: {
  mode: StateIndexSyncMode;
  readRevision?: CreateTestEvidenceLedgerDefinitionOptions["readRevision"];
  source: LoadedTestEvidenceLedgerSource;
  workspaceRoot: string;
}): Promise<TestEvidenceLedgerIndexSyncResult> {
  const runtime = createStateIndexRuntime({
    definition: createTestEvidenceLedgerStateIndexDefinition({
      readRevision: options.readRevision,
      snapshot: options.source.snapshot
    }),
    indexPath: testEvidenceLedgerIndexPath,
    root: path.resolve(options.workspaceRoot)
  });
  const synchronized = await runtime.sync(options.mode);
  const result: TestEvidenceLedgerIndexSyncResult = {
    changed: synchronized.changed,
    diagnostics: mapStateIndexDiagnostics(
      synchronized.diagnostics,
      "error",
      options.mode === "check"
    ),
    entityIndex: { ...options.source.entityIndex.identity },
    indexPath: testEvidenceLedgerIndexPath,
    ledgerPath: testEvidenceLedgerPath,
    mode: options.mode,
    schemaVersion: testEvidenceLedgerSchemaVersion,
    sourceRevision: cloneSourceRevision(
      options.source.snapshot.sourceRevision
    ),
    state: synchronized.state === "mode-invalid"
      ? "source-invalid"
      : synchronized.state,
    status: synchronized.status
  };
  return v.parse(testEvidenceLedgerIndexSyncResultSchema, result);
}

export function mapStateIndexDiagnostics(
  diagnostics: readonly StateIndexDiagnostic[],
  severity: "error" | "warning" = "error",
  includeSyncHint = false
): TestEvidenceDiagnostic[] {
  return diagnostics.map((entry) => createTestEvidenceDiagnostic({
    caseId: entry.stateId !== null
      && v.safeParse(testEvidenceCaseIdSchema, entry.stateId).success
      ? entry.stateId
      : undefined,
    blocking: severity === "error",
    category: "index",
    code: entry.code,
    message: includeSyncHint && indexCanBeRebuilt(entry.code)
      ? `${entry.message}. Run sync-index --write to rebuild ${testEvidenceLedgerIndexPath}`
      : entry.message,
    path: entry.path ?? testEvidenceLedgerIndexPath,
    severity
  }));
}

const rebuildableIndexCodes: ReadonlySet<string> = new Set([
  "state-index.definition-mismatch",
  "state-index.definition-version-mismatch",
  "state-index.id-invalid",
  "state-index.index-encoding-invalid",
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

function validateLedgerStateIndex(
  index: ReadonlyStateIndex<
    TestEvidenceLedgerCaseIndexState,
    TestEvidenceLedgerIndexMetadata
  >
): void {
  v.parse(testEvidenceLedgerStateIndexSchema, index);
  if (
    index.metadata.entityIndex.fingerprint
    !== index.sourceRevision.metadata
  ) {
    throw new TypeError(
      "metadata.entityIndex.fingerprint must equal sourceRevision.metadata"
    );
  }
}

function failedLedgerSyncResult(options: {
  diagnostics: readonly TestEvidenceDiagnostic[];
  entityIndex: TestEvidenceLedgerIndexSyncResult["entityIndex"];
  mode: StateIndexSyncMode;
}): TestEvidenceLedgerIndexSyncResult {
  return v.parse(testEvidenceLedgerIndexSyncResultSchema, {
    changed: false,
    diagnostics: [...options.diagnostics],
    entityIndex: options.entityIndex,
    indexPath: testEvidenceLedgerIndexPath,
    ledgerPath: testEvidenceLedgerPath,
    mode: options.mode,
    schemaVersion: testEvidenceLedgerSchemaVersion,
    sourceRevision: null,
    state: "source-invalid",
    status: "error"
  });
}

function cloneSourceRevision(
  revision: StateSnapshot<
    TestEvidenceLedgerCaseIndexState,
    TestEvidenceLedgerIndexMetadata
  >["sourceRevision"]
): {
  entries: Record<string, string>;
  metadata: string;
} {
  return {
    entries: { ...revision.entries },
    metadata: revision.metadata
  };
}
