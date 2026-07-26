import { createHash, type Hash } from "node:crypto";
import fs from "node:fs/promises";
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
  collectTestEvidenceCases,
  type ParsedTestEvidenceCase
} from "./catalog.ts";
import {
  validateTestEvidenceCases,
  type TestEvidenceCase
} from "./catalog-validation.ts";
import { loadTestEvidenceConfig } from "./config.ts";
import { createDiagnostic } from "./diagnostics.ts";
import {
  defaultTestEvidenceCatalogPath,
  defaultTestEvidenceIndexPath,
  testEvidenceCaseIndexStateSchema,
  testEvidenceIndexDefinitionVersion,
  testEvidenceIndexMetadataSchema,
  testEvidenceIndexNamespace,
  testEvidenceReportSchemaVersion,
  type TestEvidenceIndexMetadata
} from "./schemas.ts";
import type {
  TestEvidenceCaseIndexState,
  TestEvidenceConfig,
  TestEvidenceDiagnostic,
  TestEvidenceIndexSyncResult
} from "./types.ts";

export type SyncTestEvidenceIndexOptions = {
  config?: unknown;
  configPath?: string;
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
  }
  | {
    diagnostics: TestEvidenceDiagnostic[];
    snapshot: null;
  };

export function createTestEvidenceStateIndexDefinition(options: {
  config: TestEvidenceConfig;
  snapshot?: StateSnapshot<
    TestEvidenceCaseIndexState,
    TestEvidenceIndexMetadata
  >;
}): StateIndexDefinition<
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
      }
    ],
    namespace: testEvidenceIndexNamespace,
    parseMetadata: (input) => v.parse(
      testEvidenceIndexMetadataSchema,
      input
    ),
    parseState: (input) => v.parse(testEvidenceCaseIndexStateSchema, input),
    read: async (context) => {
      if (options.snapshot !== undefined) {
        return options.snapshot;
      }
      const source = await readTestEvidenceIndexSource(
        context,
        options.config
      );
      if (source.snapshot === null) {
        throw new Error(
          source.diagnostics.map((entry) => entry.message).join("; ")
        );
      }
      return source.snapshot;
    },
    readRevision: async (context) => await readCurrentSourceRevision(
      context,
      options.config
    )
  });
}

function caseSearchText(state: TestEvidenceCaseIndexState): string {
  return state.searchText;
}

export async function syncTestEvidenceIndex(
  options: SyncTestEvidenceIndexOptions
): Promise<TestEvidenceIndexSyncResult> {
  const workspaceRoot = path.resolve(options.workspaceRoot);
  const loadedConfig = await loadTestEvidenceConfig(
    workspaceRoot,
    options.configPath,
    options.config
  );
  if (loadedConfig.config === null) {
    return failedSyncResult({
      catalogPath: defaultTestEvidenceCatalogPath,
      diagnostics: loadedConfig.diagnostics,
      indexPath: defaultTestEvidenceIndexPath,
      mode: options.mode
    });
  }

  const source = await readTestEvidenceIndexSource(
    { root: workspaceRoot },
    loadedConfig.config
  );
  if (source.snapshot === null) {
    return failedSyncResult({
      catalogPath: loadedConfig.config.catalogPath,
      diagnostics: source.diagnostics,
      indexPath: loadedConfig.config.indexPath,
      mode: options.mode
    });
  }

  const runtime = createStateIndexRuntime({
    definition: createTestEvidenceStateIndexDefinition({
      config: loadedConfig.config,
      snapshot: source.snapshot
    }),
    indexPath: loadedConfig.config.indexPath,
    root: workspaceRoot
  });
  const synchronized = await runtime.sync(options.mode);
  return {
    catalogPath: loadedConfig.config.catalogPath,
    changed: synchronized.changed,
    diagnostics: mapStateIndexDiagnostics(
      synchronized.diagnostics,
      loadedConfig.config.indexPath,
      options.mode === "check"
    ),
    indexPath: loadedConfig.config.indexPath,
    mode: options.mode,
    schemaVersion: testEvidenceReportSchemaVersion,
    state: synchronized.state === "mode-invalid"
      ? "source-invalid"
      : synchronized.state,
    status: synchronized.status
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
  caseIdPattern: string;
  catalogPath: string;
  text: string;
}): string {
  const hash = createHash("sha256");
  hash.update("test-evidence-index-source-v1\0");
  hashField(hash, options.catalogPath);
  hashField(hash, options.caseIdPattern);
  hashField(hash, normalizeSourceText(options.text));
  return `sha256:${hash.digest("hex")}`;
}

async function readTestEvidenceIndexSource(
  context: StateIndexContext,
  config: TestEvidenceConfig
): Promise<TestEvidenceIndexSourceResult> {
  let text: string;
  try {
    text = await fs.readFile(
      path.join(context.root, ...config.catalogPath.split("/")),
      "utf8"
    );
  } catch (error) {
    return {
      diagnostics: [createDiagnostic({
        category: "catalog",
        code: "catalog.read-failed",
        message: `${config.catalogPath} could not be read: ${errorText(error)}`,
        path: config.catalogPath,
        severity: "error"
      })],
      snapshot: null
    };
  }

  const parsedCases = collectTestEvidenceCases(
    text,
    new RegExp(config.caseIdPattern, "u")
  );
  const validated = validateTestEvidenceCases(parsedCases, config.catalogPath);
  if (
    validated.errors.length > 0
    || validated.cases.length !== parsedCases.length
  ) {
    return {
      diagnostics: validated.errors.map((message) => createDiagnostic({
        category: "catalog",
        code: "catalog.invalid",
        message,
        path: config.catalogPath,
        severity: "error"
      })),
      snapshot: null
    };
  }

  const casesByLocation = new Map(
    validated.cases.map((entry) => [caseLocation(entry.id, entry.line), entry])
  );
  const states = parsedCases.map((entry) => {
    const validatedCase = casesByLocation.get(caseLocation(entry.id, entry.line));
    if (validatedCase === undefined) {
      throw new Error(
        `${config.catalogPath}:${entry.line} ${entry.id} has no validated state`
      );
    }
    return catalogCaseState(entry, validatedCase);
  });
  return {
    diagnostics: [],
    snapshot: {
      metadata: {},
      revision: testEvidenceSourceRevision({
        caseIdPattern: config.caseIdPattern,
        catalogPath: config.catalogPath,
        text
      }),
      states
    }
  };
}

async function readCurrentSourceRevision(
  context: StateIndexContext,
  config: TestEvidenceConfig
): Promise<string> {
  const text = await fs.readFile(
    path.join(context.root, ...config.catalogPath.split("/")),
    "utf8"
  );
  return testEvidenceSourceRevision({
    caseIdPattern: config.caseIdPattern,
    catalogPath: config.catalogPath,
    text
  });
}

function catalogCaseState(
  entry: ParsedTestEvidenceCase,
  validated: TestEvidenceCase
): TestEvidenceCaseIndexState {
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
    summary,
    title: entry.title
  });
}

function failedSyncResult(options: {
  catalogPath: string;
  diagnostics: readonly TestEvidenceDiagnostic[];
  indexPath: string;
  mode: StateIndexSyncMode;
}): TestEvidenceIndexSyncResult {
  return {
    catalogPath: options.catalogPath,
    changed: false,
    diagnostics: [...options.diagnostics],
    indexPath: options.indexPath,
    mode: options.mode,
    schemaVersion: testEvidenceReportSchemaVersion,
    state: "source-invalid",
    status: "error"
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

function caseLocation(id: string, line: number): string {
  return `${id}\0${line}`;
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

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
