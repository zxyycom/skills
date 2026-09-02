import { expectationOf, validateStateIndexDefinition } from "./definition.ts";
import { canonicalizeStateIndex } from "./canonicalization.ts";
import { filesystemFailure, failure } from "./diagnostics.ts";
import { canonicalizeTypedJsonObject } from "./frozen-json.ts";
import { isJsonObject } from "./json.ts";
import {
  createProjectionContext,
  parseStateIndexMetadata,
  projectStateIndexEntry,
  validateCompleteStateIndex
} from "./projection.ts";
import type {
  JsonObject,
  StateIndex,
  StateIndexContext,
  StateIndexDefinition,
  StateIndexDiagnostic,
  StateIndexResult,
  StateIndexStoredEntry
} from "./types.ts";
import { isPlainRecord, sameRecordMembers } from "./record.ts";
import { isStateIndexText, stateIndexSchemaVersion } from "./schemas.ts";
import {
  validateStateSourceRevisionValue,
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
    return failure(
      "state-index.definition-invalid",
      definitionErrors.join("; ")
    );
  }
  if (context.signal?.aborted === true) {
    return failure(
      "state-index.operation-aborted",
      "state index build was aborted"
    );
  }

  let snapshot: unknown;
  try {
    snapshot = await definition.read(context);
  } catch (error) {
    return filesystemFailure(
      "state-index.source-read-failed",
      "failed to read the state-index source; inspect source availability and access, then retry",
      {
        error,
        operation: "read a state-index source",
        target: "state-index source"
      }
    );
  }
  return buildStateIndexFromSnapshot(definition, snapshot);
}

export function buildStateIndexFromSnapshot<
  State extends object,
  Metadata extends JsonObject
>(
  definition: StateIndexDefinition<State, Metadata>,
  snapshot: unknown,
  sourcePath: string | null = null
): StateIndexResult<StateIndex<State, Metadata>> {
  if (!isStateSnapshot(snapshot)) {
    return failure(
      "state-index.source-invalid",
      "read must return { sourceRevision, metadata, states } with JSON object " +
        "metadata and an id-keyed state record",
      { path: sourcePath }
    );
  }

  const sourceRevision = validateStateSourceRevisionValue(
    snapshot.sourceRevision,
    sourcePath
  );
  if (sourceRevision.status === "error") {
    return sourceRevision;
  }
  const invalidId = Object.keys(snapshot.states).find(
    (id) => !isStateIndexText(id)
  );
  if (invalidId !== undefined) {
    return failure(
      "state-index.id-invalid",
      `state id ${JSON.stringify(invalidId)} must be non-empty text without surrounding ` +
        "whitespace or control characters",
      { path: sourcePath, stateId: invalidId }
    );
  }
  if (!sameRecordMembers(snapshot.states, sourceRevision.value.entries)) {
    return failure(
      "state-index.source-revision-members-mismatch",
      "sourceRevision.entries must contain exactly the same state ids as states",
      { path: sourcePath }
    );
  }

  const parsedMetadata = parseStateIndexMetadata(
    definition,
    snapshot.metadata,
    sourcePath
  );
  if (parsedMetadata.status === "error") {
    return parsedMetadata;
  }
  const metadata = canonicalizeTypedJsonObject(parsedMetadata.value);
  const entries: Array<[string, StateIndexStoredEntry<State>]> = [];
  const diagnostics: StateIndexDiagnostic[] = [];
  for (const [id, state] of Object.entries(snapshot.states)) {
    const projected = projectStateIndexEntry(
      definition,
      state,
      createProjectionContext(id, metadata)
    );
    diagnostics.push(
      ...projected.diagnostics.map((entry) => ({
        ...entry,
        path: entry.path ?? sourcePath
      }))
    );
    if (projected.status === "ok") {
      entries.push([id, projected.value]);
    }
  }
  if (diagnostics.length > 0) {
    return { diagnostics, status: "error", value: null };
  }

  const rawIndex: StateIndex<State, Metadata> = {
    definitionVersion: definition.definitionVersion,
    entries: Object.fromEntries(entries),
    keyDefinitions: definition.keyStrategies.map(({ mode, name }) => ({
      mode,
      name
    })),
    metadata,
    namespace: definition.namespace,
    schemaVersion: stateIndexSchemaVersion,
    sourceRevision: sourceRevision.value
  };
  const validated = validateStateIndexValue(
    rawIndex,
    expectationOf(definition),
    sourcePath ?? "<generated>"
  );
  if (validated.index === null) {
    return { diagnostics: validated.diagnostics, status: "error", value: null };
  }
  const canonical = canonicalizeStateIndex(rawIndex, definition);
  return validateCompleteStateIndex(
    definition,
    canonical,
    sourcePath ?? "<generated>"
  );
}

function isStateSnapshot(value: unknown): value is {
  metadata: JsonObject;
  sourceRevision: unknown;
  states: Record<string, unknown>;
} {
  if (!isPlainRecord(value)) {
    return false;
  }
  return (
    isJsonObject(value.metadata) &&
    isPlainRecord(value.states) &&
    value.sourceRevision !== undefined
  );
}
