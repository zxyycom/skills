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
import { isDecisionRelativePath } from "./decision-path.ts";
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
  type DecisionIndexState,
  type DecisionMetadata
} from "./types.ts";

export const decisionIndexFileName = "decision-index.json";
export const decisionIndexNamespace = "decisions";
export const decisionIndexDefinitionVersion = 2;

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

type DecisionIndexDefinitionOptions = {
  relativePaths?: readonly string[];
};

export function createDecisionStateIndexDefinition(
  options: DecisionIndexDefinitionOptions = {}
): StateIndexDefinition<DecisionIndexState> {
  const relativePaths = options.relativePaths;
  return defineStateIndexDefinition({
    definitionVersion: decisionIndexDefinitionVersion,
    fieldOrder: "definition",
    identify: (state) => state.path,
    keyStrategies: [
      {
        derive: (state) => state.path.split("/", 1)[0],
        mode: "exact",
        name: "topic"
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
  const paths = loaded.value.entries.map((entry) => entry.id);
  const definition = createDecisionStateIndexDefinition({ relativePaths: paths });
  const current = await loadCurrentStateIndex({
    context,
    definition,
    indexPath
  });
  if (current.status === "error") {
    return current;
  }
  return validateDecisionIndex(current.value, indexPath);
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

export function serializeDecisionIndex(index: StateIndex): string {
  return serializeStateIndex(index, createDecisionStateIndexDefinition());
}

export function decisionSourceRevision(
  sources: readonly { path: string; text: string }[]
): string {
  const hash = createHash("sha256");
  hash.update("decision-index-source-v1\0");
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
  return decisionSourceRevision(await readDecisionSources(
    decisionsDirectory,
    relativePaths,
    signal
  ));
}

export async function readDecisionStateSnapshot(
  decisionsDirectory: string,
  relativePaths: readonly string[],
  signal?: AbortSignal
): Promise<StateSnapshot<DecisionIndexState>> {
  const sources = await readDecisionSources(
    decisionsDirectory,
    relativePaths,
    signal
  );
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
      await parseDecisionSource(decisionsDirectory, source)
    ))));
  }
  return {
    revision: decisionSourceRevision(sources),
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
  index: StateIndex,
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
  StateIndexDefinition<DecisionIndexState>["parseState"]
>[0]): DecisionIndexState {
  const parsed = v.safeParse(decisionIndexStateSchema, input);
  if (!parsed.success) {
    throw new TypeError(parsed.issues.map(formatDecisionStateIssue).join("; "));
  }

  const state = parsed.output;
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

async function unavailableRead(): Promise<StateSnapshot<DecisionIndexState>> {
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
  source: { path: string; text: string }
): Promise<DecisionIndexState> {
  const errors: string[] = [];
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
  source: Pick<
    DecisionDocument,
    "background" | "decision" | "purpose" | "relations" | "title"
  >
): Pick<
  DecisionDocument,
  "background" | "decision" | "purpose" | "relations" | "title"
> {
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
