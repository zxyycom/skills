import { expectationOf, validateStateIndexDefinition } from "./definition.ts";
import { canonicalizeTypedJsonObject } from "./frozen-json.ts";
import {
  canonicalizeStateIndex,
  createProjectionContext,
  parseStateIndexMetadata,
  projectStateIndexEntry,
  validateCompleteStateIndex
} from "./normalization.ts";
import type {
  JsonObject,
  StateIndex,
  StateIndexContext,
  StateIndexDefinition,
  StateIndexEntry,
  StateIndexResult
} from "./types.ts";
import {
  diagnostic,
  isJsonObject,
  isStateIndexText,
  stateIndexSchemaVersion,
  validateStateIndexValue
} from "./validation.ts";

export async function buildStateIndex<
  State extends object,
  Metadata extends JsonObject
>(
  definition: StateIndexDefinition<State, Metadata>,
  context: StateIndexContext
): Promise<StateIndexResult<StateIndex<State, Metadata>>> {
  const definitionErrors = validateStateIndexDefinition(definition);
  if (definitionErrors.length > 0) {
    return failure("state-index.definition-invalid", definitionErrors.join("; "));
  }
  if (context.signal?.aborted === true) {
    return failure("state-index.operation-aborted", "state index build was aborted");
  }

  let snapshot: unknown;
  try {
    snapshot = await definition.read(context);
  } catch (error) {
    return failure("state-index.source-read-failed", errorText(error));
  }
  if (!isStateSnapshot(snapshot)) {
    return failure(
      "state-index.source-invalid",
      "read must return { revision, metadata, states } with a valid revision, "
      + "JSON object metadata, and state array"
    );
  }

  const parsedMetadata = parseStateIndexMetadata(definition, snapshot.metadata);
  if (parsedMetadata.status === "error") {
    return parsedMetadata;
  }
  const metadata = canonicalizeTypedJsonObject(parsedMetadata.value);
  const projectionContext = createProjectionContext(metadata);
  const entries: StateIndexEntry<State>[] = [];
  const diagnostics = [];
  for (const state of snapshot.states) {
    const projected = projectStateIndexEntry(
      definition,
      state,
      projectionContext
    );
    diagnostics.push(...projected.diagnostics);
    if (projected.status === "ok") {
      entries.push(projected.value);
    }
  }
  if (diagnostics.length > 0) {
    return { diagnostics, status: "error", value: null };
  }

  const rawIndex: StateIndex<State, Metadata> = {
    definitionVersion: definition.definitionVersion,
    entries,
    keyDefinitions: definition.keyStrategies.map(({ mode, name }) => ({ mode, name })),
    metadata,
    namespace: definition.namespace,
    schemaVersion: stateIndexSchemaVersion,
    sourceRevision: snapshot.revision
  };
  const validated = validateStateIndexValue(
    rawIndex,
    expectationOf(definition),
    "<generated>"
  );
  if (validated.index === null) {
    return { diagnostics: validated.diagnostics, status: "error", value: null };
  }
  const canonical = canonicalizeStateIndex(rawIndex, definition);
  return validateCompleteStateIndex(
    definition,
    canonical,
    "<generated>"
  );
}

function isStateSnapshot(
  value: unknown
): value is { metadata: JsonObject; revision: string; states: unknown[] } {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const candidate = value as {
    metadata?: unknown;
    revision?: unknown;
    states?: unknown;
  };
  return typeof candidate.revision === "string"
    && isStateIndexText(candidate.revision)
    && isJsonObject(candidate.metadata)
    && Array.isArray(candidate.states);
}

function failure<Value = never>(
  code: string,
  message: string
): StateIndexResult<Value> {
  return {
    diagnostics: [diagnostic({ code, message })],
    status: "error",
    value: null
  };
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
