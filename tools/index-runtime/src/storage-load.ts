import type { MaterializedStateIndexEntry } from "./query-fields.ts";
import fs from "node:fs/promises";
import { isFileSystemError } from "../../shared/src/node/filesystem.ts";
import { sameStateSourceRevision } from "./canonicalization.ts";
import { expectationOf, validateStateIndexDefinition } from "./definition.ts";
import { filesystemFailure, failure } from "./diagnostics.ts";
import {
  decodeUtf8Text,
  resolveIndexPath,
  type ResolvedIndexPath
} from "./index-path.ts";
import {
  normalizeStateIndex,
  validateCompleteStateIndex
} from "./projection.ts";
import { parseStateIndex, parseStateIndexEnvelope } from "./snapshot-parser.ts";
import { readSourceRevision } from "./storage-shared.ts";
import type {
  JsonObject,
  StateIndex,
  StateIndexContext,
  StateIndexDefinition,
  StateIndexExpectation,
  StateIndexResult
} from "./types.ts";

export async function loadStateIndex<
  State extends object,
  Metadata extends JsonObject
>(options: {
  context: StateIndexContext;
  definition: StateIndexDefinition<State, Metadata>;
  materializedEntries?: MaterializedStateIndexEntry<State>[];
  expectation?: StateIndexExpectation;
  indexPath: string;
}): Promise<StateIndexResult<StateIndex<State, Metadata>>> {
  const resolved = await resolveIndexPath(
    options.indexPath,
    options.context.root
  );
  if (resolved.status === "error") return resolved;
  return await loadStateIndexAtResolvedPath({
    definition: options.definition,
    materializedEntries: options.materializedEntries,
    expectation: options.expectation ?? expectationOf(options.definition),
    indexPath: options.indexPath,
    resolved: resolved.value
  });
}

export async function loadStateIndexAtResolvedPath<
  State extends object,
  Metadata extends JsonObject
>(options: {
  definition: StateIndexDefinition<State, Metadata>;
  materializedEntries?: MaterializedStateIndexEntry<State>[];
  expectation: StateIndexExpectation;
  indexPath: string;
  resolved: ResolvedIndexPath;
}): Promise<StateIndexResult<StateIndex<State, Metadata>>> {
  const text = await readIndexTextAtResolvedPath(options);
  if (text.status === "error") return text;
  return parseStateIndex({
    definition: options.definition,
    materializedEntries: options.materializedEntries,
    expectation: options.expectation,
    sourcePath: options.indexPath,
    text: text.value
  });
}

export async function loadStateIndexEnvelope(options: {
  context: StateIndexContext;
  expectation: StateIndexExpectation;
  indexPath: string;
}): Promise<StateIndexResult<StateIndex>> {
  const resolved = await resolveIndexPath(
    options.indexPath,
    options.context.root
  );
  if (resolved.status === "error") return resolved;
  const text = await readIndexTextAtResolvedPath({
    indexPath: options.indexPath,
    resolved: resolved.value
  });
  if (text.status === "error") return text;
  return parseStateIndexEnvelope({
    expectation: options.expectation,
    sourcePath: options.indexPath,
    text: text.value
  });
}

/** Internal raw source evidence for operations that independently reacquire identical input. */
export async function readIndexSourceAtResolvedPath(options: {
  indexPath: string;
  resolved: ResolvedIndexPath;
}): Promise<StateIndexResult<Readonly<{ bytes: Uint8Array; text: string }>>> {
  let data: Buffer;
  try {
    data = await fs.readFile(options.resolved.targetPath);
  } catch (error) {
    return filesystemFailure(
      isFileSystemError(error, "ENOENT")
        ? "state-index.index-missing"
        : "state-index.index-read-failed",
      isFileSystemError(error, "ENOENT")
        ? "the state-index file does not exist"
        : "failed to read the state-index file; inspect index availability and access, then retry",
      {
        error,
        operation: "read a state-index file",
        path: options.indexPath,
        target: options.indexPath
      }
    );
  }
  try {
    return {
      diagnostics: [],
      status: "ok",
      value: { bytes: data, text: decodeUtf8Text(data) }
    };
  } catch {
    return failure(
      "state-index.index-encoding-invalid",
      `${options.indexPath} must contain valid UTF-8 text`,
      { path: options.indexPath }
    );
  }
}

export async function readIndexTextAtResolvedPath(options: {
  indexPath: string;
  resolved: ResolvedIndexPath;
}): Promise<StateIndexResult<string>> {
  const source = await readIndexSourceAtResolvedPath(options);
  return source.status === "error"
    ? source
    : { ...source, value: source.value.text };
}

export async function loadCurrentStateIndex<
  State extends object,
  Metadata extends JsonObject
>(options: {
  context: StateIndexContext;
  definition: StateIndexDefinition<State, Metadata>;
  materializedEntries?: MaterializedStateIndexEntry<State>[];
  indexPath: string;
}): Promise<StateIndexResult<StateIndex<State, Metadata>>> {
  const definitionErrors = validateStateIndexDefinition(options.definition);
  if (definitionErrors.length > 0) {
    return failure(
      "state-index.definition-invalid",
      definitionErrors.join("; "),
      {
        path: options.indexPath
      }
    );
  }
  const loaded = await loadStateIndexEnvelope({
    context: options.context,
    expectation: expectationOf(options.definition),
    indexPath: options.indexPath
  });
  if (loaded.status === "error") return loaded;
  const currentRevision = await readSourceRevision(
    options.definition,
    options.context,
    options.indexPath
  );
  if (currentRevision.status === "error") return currentRevision;
  if (
    !sameStateSourceRevision(loaded.value.sourceRevision, currentRevision.value)
  ) {
    return failure(
      "state-index.index-stale",
      "index source revision does not match the current source revision",
      { path: options.indexPath }
    );
  }
  const normalized = normalizeStateIndex(
    loaded.value,
    options.definition,
    options.indexPath,
    options.materializedEntries
  );
  if (normalized.status === "error") return normalized;
  return validateCompleteStateIndex(
    options.definition,
    normalized.value,
    options.indexPath
  );
}
