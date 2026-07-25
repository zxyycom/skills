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
  collectVerificationCases,
  type ParsedVerificationCase
} from "./catalog.ts";
import {
  validateVerificationCases,
  type VerificationCase
} from "./catalog-validation.ts";
import { loadVerificationEvidenceConfig } from "./config.ts";
import { createDiagnostic } from "./diagnostics.ts";
import {
  defaultVerificationEvidenceCatalogPath,
  defaultVerificationEvidenceIndexPath,
  verificationCaseStateSchema,
  verificationEvidenceIndexDefinitionVersion,
  verificationEvidenceIndexMetadataSchema,
  verificationEvidenceIndexNamespace,
  verificationEvidenceReportSchemaVersion,
  type VerificationEvidenceIndexMetadata
} from "./schemas.ts";
import type {
  VerificationCaseState,
  VerificationEvidenceConfig,
  VerificationEvidenceDiagnostic,
  VerificationEvidenceIndexSyncResult
} from "./types.ts";

export type SyncVerificationEvidenceIndexOptions = {
  config?: unknown;
  configPath?: string;
  mode: StateIndexSyncMode;
  workspaceRoot: string;
};

type VerificationEvidenceIndexSourceResult =
  | {
    diagnostics: [];
    snapshot: StateSnapshot<
      VerificationCaseState,
      VerificationEvidenceIndexMetadata
    >;
  }
  | {
    diagnostics: VerificationEvidenceDiagnostic[];
    snapshot: null;
  };

export function createVerificationEvidenceStateIndexDefinition(options: {
  config: VerificationEvidenceConfig;
  snapshot?: StateSnapshot<
    VerificationCaseState,
    VerificationEvidenceIndexMetadata
  >;
}): StateIndexDefinition<
  VerificationCaseState,
  VerificationEvidenceIndexMetadata
> {
  return defineStateIndexDefinition({
    definitionVersion: verificationEvidenceIndexDefinitionVersion,
    identify: (state) => state.id,
    keyStrategies: [
      {
        derive: caseSearchText,
        mode: "text",
        name: "search"
      },
      {
        derive: (state) => state.verification,
        mode: "exact",
        name: "verification"
      }
    ],
    namespace: verificationEvidenceIndexNamespace,
    parseMetadata: (input) => v.parse(
      verificationEvidenceIndexMetadataSchema,
      input
    ),
    parseState: (input) => v.parse(verificationCaseStateSchema, input),
    read: async (context) => {
      if (options.snapshot !== undefined) {
        return options.snapshot;
      }
      const source = await readVerificationEvidenceIndexSource(
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

function caseSearchText(state: VerificationCaseState): string {
  return [
    state.id,
    state.title,
    state.summary,
    ...state.entries
  ].join(" ");
}

export async function syncVerificationEvidenceIndex(
  options: SyncVerificationEvidenceIndexOptions
): Promise<VerificationEvidenceIndexSyncResult> {
  const workspaceRoot = path.resolve(options.workspaceRoot);
  const loadedConfig = await loadVerificationEvidenceConfig(
    workspaceRoot,
    options.configPath,
    options.config
  );
  if (loadedConfig.config === null) {
    return failedSyncResult({
      catalogPath: defaultVerificationEvidenceCatalogPath,
      diagnostics: loadedConfig.diagnostics,
      indexPath: defaultVerificationEvidenceIndexPath,
      mode: options.mode
    });
  }

  const source = await readVerificationEvidenceIndexSource(
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
    definition: createVerificationEvidenceStateIndexDefinition({
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
    schemaVersion: verificationEvidenceReportSchemaVersion,
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
): VerificationEvidenceDiagnostic[] {
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

export function verificationEvidenceSourceRevision(options: {
  caseIdPattern: string;
  catalogPath: string;
  text: string;
}): string {
  const hash = createHash("sha256");
  hash.update("verification-evidence-index-source-v1\0");
  hashField(hash, options.catalogPath);
  hashField(hash, options.caseIdPattern);
  hashField(hash, normalizeSourceText(options.text));
  return `sha256:${hash.digest("hex")}`;
}

async function readVerificationEvidenceIndexSource(
  context: StateIndexContext,
  config: VerificationEvidenceConfig
): Promise<VerificationEvidenceIndexSourceResult> {
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

  const parsedCases = collectVerificationCases(
    text,
    new RegExp(config.caseIdPattern, "u")
  );
  const validated = validateVerificationCases(parsedCases, config.catalogPath);
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
      revision: verificationEvidenceSourceRevision({
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
  config: VerificationEvidenceConfig
): Promise<string> {
  const text = await fs.readFile(
    path.join(context.root, ...config.catalogPath.split("/")),
    "utf8"
  );
  return verificationEvidenceSourceRevision({
    caseIdPattern: config.caseIdPattern,
    catalogPath: config.catalogPath,
    text
  });
}

function catalogCaseState(
  entry: ParsedVerificationCase,
  validated: VerificationCase
): VerificationCaseState {
  const summary = entry.sections.contract.items[0];
  if (summary === undefined) {
    throw new TypeError(`validated case ${entry.id} has no index summary`);
  }
  return v.parse(verificationCaseStateSchema, {
    endLine: entry.endLine,
    entries: validated.entries,
    id: entry.id,
    line: entry.line,
    summary,
    title: entry.title,
    verification: validated.verification
  });
}

function failedSyncResult(options: {
  catalogPath: string;
  diagnostics: readonly VerificationEvidenceDiagnostic[];
  indexPath: string;
  mode: StateIndexSyncMode;
}): VerificationEvidenceIndexSyncResult {
  return {
    catalogPath: options.catalogPath,
    changed: false,
    diagnostics: [...options.diagnostics],
    indexPath: options.indexPath,
    mode: options.mode,
    schemaVersion: verificationEvidenceReportSchemaVersion,
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
