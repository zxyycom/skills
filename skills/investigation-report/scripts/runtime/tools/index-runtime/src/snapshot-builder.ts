/*
 * Synced TypeScript runtime; repository maintenance edits tools/index-runtime/src/snapshot-builder.ts.
 * Installed skill copies may be edited directly; updates overwrite matching files.
 * Repository: https://github.com/zxyycom/skills
 * Source path: tools/index-runtime/src/snapshot-builder.ts
 * Maintained source: https://github.com/zxyycom/skills/blob/main/tools/index-runtime/src/snapshot-builder.ts
 * Skill source directory: https://github.com/zxyycom/skills/tree/main/skills/investigation-report
 * Rebuild: bun run sync:investigation-report-check
 */
import type { MaterializedStateIndexEntry } from "./query-fields.ts";
import { expectationOf, validateStateIndexDefinition } from "./definition.ts";
import { canonicalizeStateIndex } from "./canonicalization.ts";
import { filesystemFailure, failure } from "./diagnostics.ts";
import { canonicalizeTypedJsonObject } from "./frozen-json.ts";
import { isJsonObject } from "./json.ts";
import {
  createProjectionContext,
  parseStateIndexMetadata,
  projectStateIndexState,
  validateCompleteStateIndex
} from "./projection.ts";
import type {
  JsonObject,
  StateIndex,
  StateIndexContext,
  StateIndexDefinition,
  StateIndexDiagnostic,
  StateIndexResult
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
  context: StateIndexContext,
  materializedEntries?: MaterializedStateIndexEntry<State>[]
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
  return buildStateIndexFromSnapshot(
    definition,
    snapshot,
    null,
    materializedEntries
  );
}

export function buildStateIndexFromSnapshot<
  State extends object,
  Metadata extends JsonObject
>(
  definition: StateIndexDefinition<State, Metadata>,
  snapshot: unknown,
  sourcePath: string | null = null,
  materializedEntries?: MaterializedStateIndexEntry<State>[]
): StateIndexResult<StateIndex<State, Metadata>> {
  if (!isStateSnapshot(snapshot)) {
    return failure(
      "state-index.source-invalid",
      "read must return { sourceRevision, metadata, states } with JSON object metadata and an id-keyed state record",
      { path: sourcePath }
    );
  }
  const sourceRevision = validateStateSourceRevisionValue(
    snapshot.sourceRevision,
    sourcePath
  );
  if (sourceRevision.status === "error") return sourceRevision;
  const invalidId = Object.keys(snapshot.states).find(
    (id) => !isStateIndexText(id)
  );
  if (invalidId !== undefined) {
    return failure(
      "state-index.id-invalid",
      `state id ${JSON.stringify(invalidId)} must be non-empty text without surrounding whitespace or control characters`,
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
  if (parsedMetadata.status === "error") return parsedMetadata;
  const metadata = canonicalizeTypedJsonObject(parsedMetadata.value);
  const states: Array<[string, State]> = [];
  const diagnostics: StateIndexDiagnostic[] = [];
  for (const [id, state] of Object.entries(snapshot.states)) {
    const projected = projectStateIndexState(
      definition,
      state,
      createProjectionContext(id, metadata),
      materializedEntries
    );
    diagnostics.push(
      ...projected.diagnostics.map((entry) => ({
        ...entry,
        path: entry.path ?? sourcePath
      }))
    );
    if (projected.status === "ok") states.push([id, projected.value]);
  }
  if (diagnostics.length > 0) {
    return { diagnostics, status: "error", value: null };
  }
  const rawIndex: StateIndex<State, Metadata> = {
    definitionVersion: definition.definitionVersion,
    entries: Object.fromEntries(states),
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
  return (
    isPlainRecord(value) &&
    isJsonObject(value.metadata) &&
    isPlainRecord(value.states) &&
    value.sourceRevision !== undefined
  );
}
