import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import * as v from "valibot";
import {
  defineStateIndexDefinition,
  loadCurrentStateIndex,
  loadStateIndex,
  parseStateIndex,
  queryStateIndex,
  serializeStateIndex,
  syncStateIndex,
  type StateIndex,
  type StateIndexContext,
  type StateIndexDefinition,
  type StateIndexDiagnostic,
  type StateIndexResult,
  type StateIndexSyncMode,
  type StateIndexSyncResult,
  type StateSnapshot
} from "../../index-runtime/src/index.ts";
import {
  decisionDomainFromRelativePath,
  isDecisionRelativePath
} from "./decision-path.ts";
import {
  decisionDomainCatalogFileName,
  decisionDomainDefinitionsSchema,
  loadDecisionDomainCatalog,
  type DecisionDomainCatalog
} from "./decision-domain-catalog.ts";
import { isDecisionTimestamp } from "./decision-timestamp.ts";
import { decisionMetadataFromCandidate } from "./decision-metadata.ts";
import { projectionTextIssue } from "./projection.ts";
import { validateDecisionBody } from "./record.ts";
import {
  decisionAlignments,
  decisionRelationTypes,
  decisionStatuses,
  type DecisionDocument,
  type DecisionIndex,
  type DecisionIndexMetadata,
  type DecisionIndexState,
  type DecisionMetadata,
  type DecisionProjection
} from "./types.ts";

export const decisionIndexFileName = "decision-index.json";
export const decisionIndexNamespace = "decisions";
export const decisionIndexDefinitionVersion = 3;

const decisionSourceReadConcurrency = 32;
const sourceRevisionPattern = /^sha256:[0-9a-f]{64}$/u;
const nonEmptyStringSchema = v.pipe(
  v.string("must be a string"),
  v.check((value) => value.trim().length > 0, "must be non-empty")
);
const decisionPathSchema = v.pipe(
  nonEmptyStringSchema,
  v.check(isDecisionRelativePath, "must be a decision Markdown path")
);
const decisionRelationSchema = v.strictObject({
  type: v.picklist(decisionRelationTypes),
  target: decisionPathSchema
});
const decisionIndexStateSchema = v.strictObject({
  path: decisionPathSchema,
  title: nonEmptyStringSchema,
  status: v.picklist(decisionStatuses),
  alignment: v.union([v.picklist(decisionAlignments), v.null()]),
  createdAt: nonEmptyStringSchema,
  purpose: nonEmptyStringSchema,
  background: nonEmptyStringSchema,
  decision: nonEmptyStringSchema,
  relations: v.array(decisionRelationSchema),
});
const decisionIndexMetadataSchema = v.strictObject({
  domains: decisionDomainDefinitionsSchema
});

type DecisionIndexDefinitionOptions = {
  relativePaths?: readonly string[];
};

export function createDecisionStateIndexDefinition(
  options: DecisionIndexDefinitionOptions = {}
): StateIndexDefinition<DecisionIndexState, DecisionIndexMetadata> {
  const relativePaths = options.relativePaths;
  return defineStateIndexDefinition({
    definitionVersion: decisionIndexDefinitionVersion,
    fieldOrder: "definition",
    identify: (state) => state.path,
    keyStrategies: [
      {
        derive: (state, context) => decisionDomainFromIndexPath(
          state.path,
          context.metadata
        ),
        mode: "exact",
        name: "domain"
      },
      {
        derive: (state) => state.status,
        mode: "exact",
        name: "status"
      },
      {
        derive: (state) => state.alignment ?? undefined,
        mode: "exact",
        name: "alignment"
      }
    ],
    namespace: decisionIndexNamespace,
    parseMetadata: parseDecisionIndexMetadata,
    parseState: parseDecisionIndexState,
    read: relativePaths === undefined
      ? unavailableRead
      : async (context) => await readDecisionStateSnapshot(
        context.root,
        relativePaths,
        context.signal
      ),
    readRevision: relativePaths === undefined
      ? unavailableRevisionRead
      : async (context) => await readDecisionSourceRevision(
        context.root,
        relativePaths,
        context.signal
      )
  });
}

export function decisionIndexState(
  relativePath: string,
  document: DecisionDocument
): DecisionIndexState {
  const projection = canonicalDecisionProjection(document);
  return document.status === "active"
    ? {
        path: relativePath,
        title: projection.title,
        status: "active",
        alignment: document.alignment,
        createdAt: document.createdAt,
        purpose: projection.purpose,
        background: projection.background,
        decision: projection.decision,
        relations: projection.relations
      }
    : {
        path: relativePath,
        title: projection.title,
        status: "archived",
        alignment: null,
        createdAt: document.createdAt,
        purpose: projection.purpose,
        background: projection.background,
        decision: projection.decision,
        relations: projection.relations
      };
}

export function parseDecisionIndex(
  text: string,
  sourcePath: string
): StateIndexResult<DecisionIndex> {
  const parsed = parseStateIndex({
    definition: createDecisionStateIndexDefinition(),
    expectation: {
      definitionVersion: decisionIndexDefinitionVersion,
      namespace: decisionIndexNamespace
    },
    sourcePath,
    text
  });
  if (parsed.status === "error") {
    return parsed;
  }
  return validateDecisionIndex(parsed.value, sourcePath);
}

export async function loadCurrentDecisionIndex(options: {
  decisionsDirectory: string;
  indexPath?: string;
  relativePaths: readonly string[];
  signal?: AbortSignal;
}): Promise<StateIndexResult<DecisionIndex>> {
  const indexPath = options.indexPath ?? decisionIndexFileName;
  const context: StateIndexContext = {
    root: options.decisionsDirectory,
    ...(options.signal === undefined ? {} : { signal: options.signal })
  };
  const loaded = await loadStateIndex({
    context,
    definition: createDecisionStateIndexDefinition(),
    expectation: {
      definitionVersion: decisionIndexDefinitionVersion,
      namespace: decisionIndexNamespace
    },
    indexPath
  });
  if (loaded.status === "error") {
    return loaded;
  }
  const definition = createDecisionStateIndexDefinition({
    relativePaths: options.relativePaths
  });
  const current = await loadCurrentStateIndex({
    context,
    definition,
    indexPath
  });
  if (current.status === "error") {
    return current;
  }
  const validated = validateDecisionIndex(current.value, indexPath);
  if (validated.status === "error") {
    return validated;
  }
  return validateDecisionIndexMembership(
    validated.value,
    options.relativePaths,
    indexPath
  );
}

export async function syncDecisionIndex(options: {
  decisionsDirectory: string;
  indexPath?: string;
  mode: StateIndexSyncMode;
  relativePaths: readonly string[];
  signal?: AbortSignal;
}): Promise<StateIndexSyncResult> {
  const definition = createDecisionStateIndexDefinition({
    relativePaths: options.relativePaths
  });
  return await syncStateIndex({
    context: {
      root: options.decisionsDirectory,
      ...(options.signal === undefined ? {} : { signal: options.signal })
    },
    definition,
    indexPath: options.indexPath ?? decisionIndexFileName,
    mode: options.mode
  });
}

export function serializeDecisionIndex(index: DecisionIndex): string {
  return serializeStateIndex(index, createDecisionStateIndexDefinition());
}

function validateDecisionIndexMembership(
  index: DecisionIndex,
  relativePaths: readonly string[],
  sourcePath: string
): StateIndexResult<DecisionIndex> {
  const expectedPaths = [...new Set(relativePaths)].sort(compareText);
  const indexedPaths = index.entries.map((entry) => entry.id).sort(compareText);
  if (
    expectedPaths.length === indexedPaths.length
    && expectedPaths.every((entry, entryIndex) => (
      entry === indexedPaths[entryIndex]
    ))
  ) {
    return { diagnostics: [], status: "ok", value: index };
  }

  const expectedPathSet = new Set(expectedPaths);
  const indexedPathSet = new Set(indexedPaths);
  const missingPaths = expectedPaths.filter((entry) => !indexedPathSet.has(entry));
  const unexpectedPaths = indexedPaths.filter((entry) => !expectedPathSet.has(entry));
  const details = [
    ...(missingPaths.length === 0
      ? []
      : ["missing: " + missingPaths.join(", ")]),
    ...(unexpectedPaths.length === 0
      ? []
      : ["unexpected: " + unexpectedPaths.join(", ")])
  ];
  return failure(
    "decision-index.membership-mismatch",
    "index entries do not match the complete established Markdown set"
      + (details.length === 0 ? "" : "; " + details.join("; ")),
    sourcePath
  );
}

export function decisionSourceRevision(
  catalog: DecisionDomainCatalog,
  sources: readonly { path: string; text: string }[]
): string {
  const hash = createHash("sha256");
  hash.update("decision-index-source-v2\0");
  hashField(hash, normalizeDecisionDomainCatalog(catalog));
  for (const source of [...sources].sort((left, right) => compareText(
    left.path,
    right.path
  ))) {
    hashField(hash, source.path);
    hashField(hash, normalizeDecisionSourceText(source.text));
  }
  return `sha256:${hash.digest("hex")}`;
}

export async function readDecisionSourceRevision(
  decisionsDirectory: string,
  relativePaths: readonly string[],
  signal?: AbortSignal
): Promise<string> {
  const [catalog, sources] = await Promise.all([
    readDecisionDomainCatalog(decisionsDirectory),
    readDecisionSources(decisionsDirectory, relativePaths, signal)
  ]);
  return decisionSourceRevision(catalog, sources);
}

export async function readDecisionStateSnapshot(
  decisionsDirectory: string,
  relativePaths: readonly string[],
  signal?: AbortSignal
): Promise<StateSnapshot<DecisionIndexState, DecisionIndexMetadata>> {
  const [catalog, sources] = await Promise.all([
    readDecisionDomainCatalog(decisionsDirectory),
    readDecisionSources(decisionsDirectory, relativePaths, signal)
  ]);
  const domainIds = new Set(catalog.domains.map((domain) => domain.id));
  const states: DecisionIndexState[] = [];
  for (
    let offset = 0;
    offset < sources.length;
    offset += decisionSourceReadConcurrency
  ) {
    if (signal?.aborted === true) {
      throw new Error("decision state read was aborted");
    }
    const batch = sources.slice(offset, offset + decisionSourceReadConcurrency);
    states.push(...await Promise.all(batch.map(async (source) => (
      await parseDecisionSource(decisionsDirectory, source, domainIds)
    ))));
  }
  return {
    metadata: {
      domains: catalog.domains.map(({ id, description }) => ({ id, description }))
    },
    revision: decisionSourceRevision(catalog, sources),
    states
  };
}

async function readDecisionSources(
  decisionsDirectory: string,
  relativePaths: readonly string[],
  signal?: AbortSignal
): Promise<Array<{ path: string; text: string }>> {
  const sources: Array<{ path: string; text: string }> = [];
  const paths = [...new Set(relativePaths)].sort(compareText);
  for (
    let offset = 0;
    offset < paths.length;
    offset += decisionSourceReadConcurrency
  ) {
    if (signal?.aborted === true) {
      throw new Error("decision source revision read was aborted");
    }
    const batch = paths.slice(offset, offset + decisionSourceReadConcurrency);
    sources.push(...await Promise.all(batch.map(async (relativePath) => (
      await readDecisionSource(decisionsDirectory, relativePath, signal)
    ))));
  }
  return sources;
}

export function decisionIndexDiagnosticMessages(
  diagnostics: readonly StateIndexDiagnostic[],
  displayPath?: string
): string[] {
  return diagnostics.map((diagnostic) => {
    const source = diagnostic.path === null
      ? displayPath
      : displayPath === undefined || diagnostic.path !== decisionIndexFileName
        ? diagnostic.path
        : displayPath;
    return [
      ...(source === undefined ? [] : [source]),
      diagnostic.stateId === null ? "" : `[${diagnostic.stateId}]`,
      diagnostic.message
    ].filter((part) => part.length > 0).join(" ");
  });
}

function validateDecisionIndex(
  index: StateIndex<DecisionIndexState, DecisionIndexMetadata>,
  sourcePath: string
): StateIndexResult<DecisionIndex> {
  if (!sourceRevisionPattern.test(index.sourceRevision)) {
    return failure(
      "decision-index.source-revision-invalid",
      "sourceRevision must be a sha256 decision source revision",
      sourcePath
    );
  }
  const validated = queryStateIndex({
    definition: createDecisionStateIndexDefinition(),
    index,
    query: { limit: 1 }
  });
  if (validated.status === "error") {
    return {
      diagnostics: validated.diagnostics.map((diagnostic) => ({
        ...diagnostic,
        path: diagnostic.path ?? sourcePath
      })),
      status: "error",
      value: null
    };
  }
  return {
    diagnostics: [],
    status: "ok",
    value: index as DecisionIndex
  };
}

function parseDecisionIndexState(input: Parameters<
  StateIndexDefinition<
    DecisionIndexState,
    DecisionIndexMetadata
  >["parseState"]
>[0], context: Parameters<
  StateIndexDefinition<
    DecisionIndexState,
    DecisionIndexMetadata
  >["parseState"]
>[1]): DecisionIndexState {
  const parsed = v.safeParse(decisionIndexStateSchema, input);
  if (!parsed.success) {
    throw new TypeError(parsed.issues.map(formatDecisionStateIssue).join("; "));
  }

  const state = parsed.output;
  decisionDomainFromIndexPath(state.path, context.metadata);
  if (!isDecisionTimestamp(state.createdAt)) {
    throw new TypeError(
      "createdAt must be an RFC 3339 timestamp precise to seconds "
      + "with an explicit timezone"
    );
  }
  const metadata: DecisionMetadata = state.status === "active"
    ? {
        status: "active",
        alignment: activeAlignment(state.alignment),
        createdAt: state.createdAt
      }
    : {
        status: "archived",
        alignment: archivedAlignment(state.alignment),
        createdAt: state.createdAt
      };

  for (const field of ["title", "purpose", "background", "decision"] as const) {
    const issue = projectionTextIssue(state[field]);
    if (issue !== null) {
      throw new TypeError(`${field} ${issue}`);
    }
  }

  const relationKeys = new Set<string>();
  for (const relation of state.relations) {
    const key = `${relation.type}\u0000${relation.target}`;
    if (relationKeys.has(key)) {
      throw new TypeError(
        `repeats relationship ${relation.type} target ${relation.target}`
      );
    }
    relationKeys.add(key);
  }

  const projection = canonicalDecisionProjection(state);
  return metadata.status === "active"
    ? {
        path: state.path,
        title: projection.title,
        status: "active",
        alignment: metadata.alignment,
        createdAt: metadata.createdAt,
        purpose: projection.purpose,
        background: projection.background,
        decision: projection.decision,
        relations: projection.relations
      }
    : {
        path: state.path,
        title: projection.title,
        status: "archived",
        alignment: null,
        createdAt: metadata.createdAt,
        purpose: projection.purpose,
        background: projection.background,
        decision: projection.decision,
        relations: projection.relations
      };
}

function formatDecisionStateIssue(issue: v.BaseIssue<unknown>): string {
  const issuePath = v.getDotPath(issue);
  return issuePath === null ? issue.message : `${issuePath} ${issue.message}`;
}

function activeAlignment(
  alignment: DecisionIndexState["alignment"]
): "aligned" | "unaligned" {
  if (alignment === null) {
    throw new TypeError(
      "alignment must be aligned or unaligned when status is active"
    );
  }
  return alignment;
}

function archivedAlignment(
  alignment: DecisionIndexState["alignment"]
): null {
  if (alignment !== null) {
    throw new TypeError("alignment must be null when status is archived");
  }
  return alignment;
}

function parseDecisionIndexMetadata(
  input: Parameters<StateIndexDefinition<
    DecisionIndexState,
    DecisionIndexMetadata
  >["parseMetadata"]>[0]
): DecisionIndexMetadata {
  return v.parse(decisionIndexMetadataSchema, input);
}

async function unavailableRead(): Promise<StateSnapshot<
  DecisionIndexState,
  DecisionIndexMetadata
>> {
  throw new Error("decision state reader is unavailable in this operation");
}

async function unavailableRevisionRead(): Promise<string> {
  throw new Error("decision revision reader is unavailable in this operation");
}

function hashField(hash: ReturnType<typeof createHash>, value: string): void {
  hash.update(String(Buffer.byteLength(value, "utf8")));
  hash.update(":");
  hash.update(value, "utf8");
  hash.update("\0");
}

function normalizeDecisionSourceText(value: string): string {
  return value.replace(/\r\n/g, "\n");
}

function normalizeDecisionDomainCatalog(catalog: DecisionDomainCatalog): string {
  return JSON.stringify({
    schemaVersion: catalog.schemaVersion,
    domains: catalog.domains.map(({ id, description }) => ({ id, description }))
  });
}

async function readDecisionDomainCatalog(
  decisionsDirectory: string
): Promise<DecisionDomainCatalog> {
  const catalogPath = path.join(decisionsDirectory, decisionDomainCatalogFileName);
  const loaded = await loadDecisionDomainCatalog(
    catalogPath,
    decisionDomainCatalogFileName
  );
  if (loaded.status === "error") {
    throw new Error(loaded.errors.join("; "));
  }
  return loaded.value;
}

function decisionDomainFromIndexPath(
  relativePath: string,
  metadata: {
    readonly domains: readonly {
      readonly id: string;
    }[];
  }
): string {
  const domain = decisionDomainFromRelativePath(relativePath);
  if (domain === null) {
    throw new TypeError(`path must identify a decision domain: ${relativePath}`);
  }
  if (!metadata.domains.some((definition) => definition.id === domain)) {
    throw new TypeError(
      `path domain is not defined in metadata.domains: ${domain}`
    );
  }
  return domain;
}

async function readDecisionSource(
  decisionsDirectory: string,
  relativePath: string,
  signal?: AbortSignal
): Promise<{ path: string; text: string }> {
  if (signal?.aborted === true) {
    throw new Error("decision source revision read was aborted");
  }
  if (!isDecisionRelativePath(relativePath)) {
    throw new Error(`invalid indexed decision path ${relativePath}`);
  }
  const sourcePath = path.join(decisionsDirectory, ...relativePath.split("/"));
  try {
    return {
      path: relativePath,
      text: await fs.readFile(sourcePath, "utf8")
    };
  } catch (error) {
    throw new Error(
      `failed to read indexed decision ${relativePath}: ${errorText(error)}`,
      { cause: error }
    );
  }
}

async function parseDecisionSource(
  decisionsDirectory: string,
  source: { path: string; text: string },
  domainIds: ReadonlySet<string>
): Promise<DecisionIndexState> {
  const errors: string[] = [];
  const domain = decisionDomainFromRelativePath(source.path);
  if (domain === null || !domainIds.has(domain)) {
    errors.push(
      `${source.path} path domain is not defined in `
      + `${decisionDomainCatalogFileName}: ${domain ?? "<invalid>"}`
    );
  }
  const candidate = await validateDecisionBody({
    body: source.text,
    decisionsDirectory,
    errors,
    fileName: path.posix.basename(source.path),
    relativePath: source.path
  });
  const metadata = candidate === null
    ? null
    : decisionMetadataFromCandidate(candidate);
  if (candidate === null || metadata === null || errors.length > 0) {
    throw new Error(
      errors.length > 0
        ? errors.join("; ")
        : `${source.path} does not contain established decision metadata`
    );
  }
  const projection = canonicalDecisionProjection(candidate);
  const document: DecisionDocument = metadata.status === "active"
    ? {
        title: projection.title,
        status: "active",
        alignment: metadata.alignment,
        createdAt: metadata.createdAt,
        purpose: projection.purpose,
        background: projection.background,
        decision: projection.decision,
        relations: projection.relations
      }
    : {
        title: projection.title,
        status: "archived",
        alignment: null,
        createdAt: metadata.createdAt,
        purpose: projection.purpose,
        background: projection.background,
        decision: projection.decision,
        relations: projection.relations
      };
  return decisionIndexState(source.path, document);
}

function canonicalDecisionProjection(
  source: DecisionProjection
): DecisionProjection {
  return {
    title: source.title,
    purpose: source.purpose,
    background: source.background,
    decision: source.decision,
    relations: source.relations.map(({ type, target }) => ({ type, target }))
  };
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function failure<Value>(
  code: string,
  message: string,
  sourcePath: string
): StateIndexResult<Value> {
  return {
    diagnostics: [{
      code,
      message,
      path: sourcePath,
      stateId: null
    }],
    status: "error",
    value: null
  };
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
