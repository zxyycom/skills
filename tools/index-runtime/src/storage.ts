import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import {
  isFileSystemError,
  isPathWithinDirectory
} from "../../shared/src/node/filesystem.ts";
import { sameStateSourceRevision } from "./canonicalization.ts";
import {
  expectationOf,
  keyDefinitionsOf,
  sameKeyDefinitions,
  validateStateIndexDefinition
} from "./definition.ts";
import {
  diagnostic,
  errorText,
  failure
} from "./diagnostics.ts";
import { buildStateIndex } from "./snapshot-builder.ts";
import {
  parseStateIndex,
  serializeStateIndex
} from "./snapshot-parser.ts";
import { isStateIndexText } from "./schemas.ts";
import type {
  JsonObject,
  StateIndex,
  StateIndexContext,
  StateIndexDefinition,
  StateIndexExpectation,
  StateIndexResult,
  StateSourceRevision,
  StateIndexSyncMode,
  StateIndexSyncResult
} from "./types.ts";
import { validateStateSourceRevisionValue } from "./validation.ts";

export async function loadStateIndex<
  State extends object,
  Metadata extends JsonObject
>(options: {
  context: StateIndexContext;
  definition: StateIndexDefinition<State, Metadata>;
  expectation: StateIndexExpectation;
  indexPath: string;
}): Promise<StateIndexResult<StateIndex<State, Metadata>>>;
export async function loadStateIndex(options: {
  context: StateIndexContext;
  definition?: undefined;
  expectation: StateIndexExpectation;
  indexPath: string;
}): Promise<StateIndexResult<StateIndex>>;
export async function loadStateIndex<
  State extends object,
  Metadata extends JsonObject
>(options: {
  context: StateIndexContext;
  definition?: StateIndexDefinition<State, Metadata>;
  expectation: StateIndexExpectation;
  indexPath: string;
}): Promise<
  StateIndexResult<StateIndex | StateIndex<State, Metadata>>
> {
  const resolved = resolveIndexPath(options.indexPath, options.context.root);
  if (resolved.status === "error") {
    return resolved;
  }
  let text: string;
  try {
    text = await fs.readFile(resolved.value, "utf8");
  } catch (error) {
    return failure(
      isFileSystemError(error, "ENOENT")
        ? "state-index.index-missing"
        : "state-index.index-read-failed",
      isFileSystemError(error, "ENOENT")
        ? `${options.indexPath} does not exist`
        : `failed to read ${options.indexPath}: ${errorText(error)}`,
      { path: options.indexPath }
    );
  }
  return options.definition === undefined
    ? parseStateIndex({
      expectation: options.expectation,
      sourcePath: options.indexPath,
      text
    })
    : parseStateIndex({
      definition: options.definition,
      expectation: options.expectation,
      sourcePath: options.indexPath,
      text
    });
}

export async function loadCurrentStateIndex<
  State extends object,
  Metadata extends JsonObject
>(options: {
  context: StateIndexContext;
  definition: StateIndexDefinition<State, Metadata>;
  indexPath: string;
}): Promise<StateIndexResult<StateIndex<State, Metadata>>> {
  const definitionErrors = validateStateIndexDefinition(options.definition);
  if (definitionErrors.length > 0) {
    return failure(
      "state-index.definition-invalid",
      definitionErrors.join("; "),
      { path: options.indexPath }
    );
  }
  const loaded = await loadStateIndex({
    context: options.context,
    expectation: expectationOf(options.definition),
    indexPath: options.indexPath
  });
  if (loaded.status === "error") {
    return loaded;
  }
  if (!sameKeyDefinitions(
    loaded.value.keyDefinitions,
    keyDefinitionsOf(options.definition)
  )) {
    return failure(
      "state-index.definition-mismatch",
      "index key definitions do not match the runtime definition",
      { path: options.indexPath }
    );
  }

  const currentRevision = await readSourceRevision(
    options.definition,
    options.context,
    options.indexPath
  );
  if (currentRevision.status === "error") {
    return currentRevision;
  }
  if (!sameStateSourceRevision(loaded.value.sourceRevision, currentRevision.value)) {
    return failure(
      "state-index.index-stale",
      "index source revision does not match the current source revision",
      { path: options.indexPath }
    );
  }
  return {
    diagnostics: [],
    status: "ok",
    value: bindCurrentIndexToDefinition(loaded.value, options.definition)
  };
}

export async function syncStateIndex<
  State extends object,
  Metadata extends JsonObject
>(options: {
  context: StateIndexContext;
  definition: StateIndexDefinition<State, Metadata>;
  indexPath: string;
  mode: StateIndexSyncMode;
}): Promise<StateIndexSyncResult> {
  const { context, definition, indexPath, mode } = options;
  if (!isStateIndexSyncMode(mode)) {
    return {
      changed: false,
      diagnostics: [diagnostic({
        code: "state-index.mode-invalid",
        message: "sync mode must be check or write",
        path: indexPath
      })],
      indexPath,
      mode: null,
      namespace: definition.namespace,
      state: "mode-invalid",
      status: "error"
    };
  }
  const resolved = resolveIndexPath(indexPath, context.root);
  if (resolved.status === "error") {
    return failedSync(options, "index-path-invalid", resolved.diagnostics);
  }

  const built = await buildStateIndex(definition, context);
  if (built.status === "error") {
    return failedSync(options, "source-invalid", built.diagnostics);
  }
  const currentRevision = await readSourceRevision(definition, context, indexPath);
  if (currentRevision.status === "error") {
    return failedSync(options, "source-invalid", currentRevision.diagnostics);
  }
  if (!sameStateSourceRevision(currentRevision.value, built.value.sourceRevision)) {
    return failedSync(options, "source-invalid", [diagnostic({
      code: "state-index.source-changed",
      message: "source revision changed while building the state projection; retry after "
        + "the source is stable",
      path: indexPath
    })]);
  }
  const expectedText = serializeStateIndex(built.value, definition);
  let currentText: string | null = null;
  try {
    currentText = await fs.readFile(resolved.value, "utf8");
  } catch (error) {
    if (!isFileSystemError(error, "ENOENT")) {
      return failedSync(options, "index-read-failed", [diagnostic({
        code: "state-index.index-read-failed",
        message: `failed to read ${indexPath}: ${errorText(error)}`,
        path: indexPath
      })]);
    }
  }

  if (
    currentText !== null
    && normalizeIndexLineEndings(currentText) === expectedText
  ) {
    return {
      changed: false,
      diagnostics: [],
      indexPath,
      mode,
      namespace: definition.namespace,
      state: mode === "check" ? "current" : "unchanged",
      status: "ok"
    };
  }
  if (mode === "check") {
    if (currentText === null) {
      return failedSync(options, "index-missing", [diagnostic({
        code: "state-index.index-missing",
        message: `${indexPath} does not exist`,
        path: indexPath
      })]);
    }
    const parsed = parseStateIndex({
      definition,
      expectation: expectationOf(definition),
      sourcePath: indexPath,
      text: currentText
    });
    return parsed.status === "error"
      ? failedSync(options, "index-invalid", parsed.diagnostics)
      : failedSync(options, "index-stale", [diagnostic({
        code: "state-index.index-stale",
        message: `${indexPath} does not match the current state projection`,
        path: indexPath
      })]);
  }

  try {
    await writeTextAtomically(resolved.value, expectedText);
    await verifyWrittenText(resolved.value, expectedText);
    return {
      changed: true,
      diagnostics: [],
      indexPath,
      mode,
      namespace: definition.namespace,
      state: "written",
      status: "ok"
    };
  } catch (error) {
    return failedSync(options, "index-write-failed", [diagnostic({
      code: "state-index.index-write-failed",
      message: `failed to write ${indexPath}: ${errorText(error)}`,
      path: indexPath
    })]);
  }
}

function normalizeIndexLineEndings(value: string): string {
  return value.replace(/\r\n/g, "\n");
}

function resolveIndexPath(
  indexPath: string,
  root: string
): StateIndexResult<string> {
  if (!isNormalizedRelativePosixPath(indexPath)) {
    return failure(
      "state-index.index-path-invalid",
      `${indexPath} must be a normalized relative POSIX path`,
      { path: indexPath }
    );
  }
  const resolvedRoot = path.resolve(root);
  const resolvedPath = path.resolve(resolvedRoot, ...indexPath.split("/"));
  if (!isPathWithinDirectory(resolvedPath, resolvedRoot)) {
    return failure(
      "state-index.index-path-invalid",
      `${indexPath} resolves outside the index root`,
      { path: indexPath }
    );
  }
  return { diagnostics: [], status: "ok", value: resolvedPath };
}

function isNormalizedRelativePosixPath(value: string): boolean {
  if (!isStateIndexText(value) || value.includes("\\") || path.posix.isAbsolute(value)) {
    return false;
  }
  return value.split("/").every((segment) => (
    segment.length > 0 && segment !== "." && segment !== ".."
  ));
}

async function writeTextAtomically(targetPath: string, text: string): Promise<void> {
  await fs.mkdir(path.dirname(targetPath), { recursive: true });
  const temporaryPath = path.join(
    path.dirname(targetPath),
    `.${path.basename(targetPath)}.${process.pid}.${randomUUID()}.tmp`
  );
  try {
    await fs.writeFile(temporaryPath, text, { encoding: "utf8", flag: "wx" });
    await fs.rename(temporaryPath, targetPath);
  } catch (error) {
    await fs.rm(temporaryPath, { force: true });
    throw error;
  }
}

async function verifyWrittenText(targetPath: string, expected: string): Promise<void> {
  const written = await fs.readFile(targetPath, "utf8");
  if (written !== expected) {
    throw new Error("written index does not match the generated state projection");
  }
}

async function readSourceRevision<
  State extends object,
  Metadata extends JsonObject
>(
  definition: StateIndexDefinition<State, Metadata>,
  context: StateIndexContext,
  indexPath: string
): Promise<StateIndexResult<StateSourceRevision>> {
  if (context.signal?.aborted === true) {
    return failure(
      "state-index.operation-aborted",
      "revision read was aborted",
      { path: indexPath }
    );
  }
  let revision: unknown;
  try {
    revision = await definition.readRevision(context);
  } catch (error) {
    return failure(
      "state-index.revision-read-failed",
      errorText(error),
      { path: indexPath }
    );
  }
  const validated = validateStateSourceRevisionValue(revision, indexPath);
  if (validated.status === "error") {
    return {
      diagnostics: validated.diagnostics.map((entry) => ({
        ...entry,
        code: "state-index.revision-invalid",
        message: `readRevision returned an invalid source revision: ${entry.message}`
      })),
      status: "error",
      value: null
    };
  }
  return validated;
}

function isStateIndexSyncMode(value: unknown): value is StateIndexSyncMode {
  return value === "check" || value === "write";
}

function bindCurrentIndexToDefinition<
  State extends object,
  Metadata extends JsonObject
>(
  index: StateIndex,
  _definition: StateIndexDefinition<State, Metadata>
): StateIndex<State, Metadata> {
  // This is the one deliberate fast-open type binding. The caller has already
  // checked the definition identity, key definitions, common JSON schema and
  // current source revision. Re-running parseMetadata/parseState here would
  // violate the fast-open contract; persisted domain-shape validation remains
  // the consumer schema/check responsibility documented by Index Runtime.
  return index as StateIndex<State, Metadata>;
}

function failedSync<
  State extends object,
  Metadata extends JsonObject
>(
  options: {
    definition: StateIndexDefinition<State, Metadata>;
    indexPath: string;
    mode: StateIndexSyncMode;
  },
  state:
    | "index-invalid"
    | "index-missing"
    | "index-path-invalid"
    | "index-read-failed"
    | "index-stale"
    | "index-write-failed"
    | "source-invalid",
  diagnostics: StateIndexSyncResult["diagnostics"]
): StateIndexSyncResult {
  return {
    changed: false,
    diagnostics,
    indexPath: options.indexPath,
    mode: options.mode,
    namespace: options.definition.namespace,
    state,
    status: "error"
  };
}
