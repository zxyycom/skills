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
  collectCatalogCases,
  type ParsedCatalogCase
} from "./catalog.ts";
import {
  validateCatalogCases,
  type LedgerCase
} from "./catalog-validation.ts";
import {
  loadTestEvidenceLedgerConfig
} from "./config.ts";
import { createDiagnostic } from "./diagnostics.ts";
import {
  defaultTestEvidenceCatalogPath,
  defaultTestEvidenceIndexPath,
  testEvidenceCaseStateSchema,
  testEvidenceIndexDefinitionVersion,
  testEvidenceIndexNamespace,
  testEvidenceReportSchemaVersion
} from "./schemas.ts";
import type {
  TestEvidenceCaseState,
  TestEvidenceDiagnostic,
  TestEvidenceIndexSyncResult,
  TestEvidenceLedgerConfig
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
    snapshot: StateSnapshot<TestEvidenceCaseState>;
  }
  | {
    diagnostics: TestEvidenceDiagnostic[];
    snapshot: null;
  };

export function createTestEvidenceStateIndexDefinition(options: {
  config: TestEvidenceLedgerConfig;
  runtime?: boolean;
  snapshot?: StateSnapshot<TestEvidenceCaseState>;
}): StateIndexDefinition<TestEvidenceCaseState> {
  return defineStateIndexDefinition({
    definitionVersion: testEvidenceIndexDefinitionVersion,
    identify: (state) => state.id,
    keyStrategies: [
      {
        derive: (state) => state.trigger === null ? undefined : true,
        mode: "exact",
        name: "review-triggered"
      },
      {
        derive: caseSearchText,
        mode: "text",
        name: "search"
      },
      {
        derive: (state) => state.status,
        mode: "exact",
        name: "status"
      },
      {
        derive: (state) => state.verification,
        mode: "exact",
        name: "verification"
      }
    ],
    namespace: testEvidenceIndexNamespace,
    parseState: (input) => parseTestEvidenceCaseState(
      input,
      options.runtime === true
    ),
    read: async (context) => {
      if (options.snapshot !== undefined) {
        return options.snapshot;
      }
      const source = await readTestEvidenceIndexSource(context, options.config);
      if (source.snapshot === null) {
        throw new Error(source.diagnostics.map((entry) => entry.message).join("; "));
      }
      return source.snapshot;
    },
    readRevision: async (context) => await readCurrentSourceRevision(
      context,
      options.config
    )
  });
}

function caseSearchText(state: TestEvidenceCaseState): string {
  return [
    state.id,
    state.title,
    state.summary,
    state.codePath ?? "",
    ...state.scope
  ].filter((value) => value.length > 0).join(" ");
}

export async function syncTestEvidenceIndex(
  options: SyncTestEvidenceIndexOptions
): Promise<TestEvidenceIndexSyncResult> {
  const workspaceRoot = path.resolve(options.workspaceRoot);
  const loadedConfig = await loadTestEvidenceLedgerConfig(
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
  const state = synchronized.state === "mode-invalid"
    ? "source-invalid"
    : synchronized.state;
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
    state,
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

export function testEvidenceLedgerCaseFromState(
  state: TestEvidenceCaseState
): LedgerCase {
  if (state.endLine < state.line) {
    throw new TypeError(`case source range is invalid: ${state.id}`);
  }
  if (
    state.trigger !== null
    && (
      state.verification !== "review"
      || state.trigger.caseId !== state.id
    )
  ) {
    throw new TypeError(`case trigger state is invalid: ${state.id}`);
  }

  if (state.status === "planned") {
    if (
      state.verification !== "automated"
      || state.codePath !== null
      || state.scope.length > 0
      || state.lastReview !== null
      || state.trigger !== null
    ) {
      throw new TypeError(`planned automated case state is invalid: ${state.id}`);
    }
    return { id: state.id, kind: "planned-automated", line: state.line };
  }

  if (state.verification === "automated") {
    if (
      state.codePath === null
      || state.scope.length > 0
      || state.lastReview !== null
      || state.trigger !== null
    ) {
      throw new TypeError(`active automated case state is invalid: ${state.id}`);
    }
    return {
      codePath: state.codePath,
      id: state.id,
      kind: "active-automated",
      line: state.line
    };
  }

  if (state.verification === "review") {
    if (
      state.codePath !== null
      || state.scope.length === 0
    ) {
      throw new TypeError(`active review case state is invalid: ${state.id}`);
    }
    return {
      id: state.id,
      kind: "active-review",
      lastReview: state.lastReview,
      line: state.line,
      scopePatterns: [...state.scope]
    };
  }

  if (
    state.codePath !== null
    || state.scope.length === 0
    || state.lastReview !== null
    || state.trigger !== null
  ) {
    throw new TypeError(`active exempt case state is invalid: ${state.id}`);
  }
  return {
    id: state.id,
    kind: "active-exempt",
    line: state.line,
    scopePatterns: [...state.scope]
  };
}

async function readTestEvidenceIndexSource(
  context: StateIndexContext,
  config: TestEvidenceLedgerConfig
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

  const parsedCases = collectCatalogCases(
    text,
    new RegExp(config.caseIdPattern, "u")
  );
  const validated = validateCatalogCases(parsedCases, config.catalogPath);
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
        `${config.catalogPath}:${entry.line} ${entry.id} has no validated case state`
      );
    }
    return catalogCaseState(entry, validatedCase);
  });
  return {
    diagnostics: [],
    snapshot: {
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
  config: TestEvidenceLedgerConfig
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
  entry: ParsedCatalogCase,
  validated: LedgerCase
): TestEvidenceCaseState {
  if (entry.status === null || entry.verification === null) {
    throw new TypeError(`validated case ${entry.id} is missing status or verification`);
  }
  return v.parse(testEvidenceCaseStateSchema, {
    codePath: validated.kind === "active-automated"
      ? validated.codePath
      : null,
    endLine: entry.endLine,
    id: entry.id,
    lastReview: validated.kind === "active-review"
      ? validated.lastReview
      : null,
    line: entry.line,
    scope: validated.kind === "active-review"
      || validated.kind === "active-exempt"
      ? [...validated.scopePatterns]
      : [],
    status: entry.status,
    summary: caseSummary(entry),
    title: entry.title,
    trigger: null,
    verification: entry.verification
  });
}

function parseTestEvidenceCaseState(
  input: unknown,
  allowRuntimeTrigger: boolean
): TestEvidenceCaseState {
  const state = v.parse(testEvidenceCaseStateSchema, input);
  if (!allowRuntimeTrigger && state.trigger !== null) {
    throw new TypeError(`persisted case trigger state is invalid: ${state.id}`);
  }
  testEvidenceLedgerCaseFromState(state);
  return state;
}

function caseSummary(entry: ParsedCatalogCase): string {
  const summary = entry.verification === "exempt"
    ? entry.sections.reason.items[0]
    : entry.sections.contract.items[0];
  if (summary === undefined) {
    throw new TypeError(`validated case ${entry.id} has no index summary`);
  }
  return summary;
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

function indexCanBeRebuilt(code: string): boolean {
  return code === "state-index.index-missing"
    || code === "state-index.index-stale"
    || code === "state-index.definition-mismatch"
    || code === "state-index.schema-invalid"
    || code === "state-index.state-parse-failed";
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
