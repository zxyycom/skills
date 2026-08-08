import { canonicalizeStateIndex } from "./canonicalization.ts";
import {
  errorText,
  failure,
  diagnostic
} from "./diagnostics.ts";
import {
  canonicalizeTypedJsonObject,
  cloneAndFreezeTypedJsonObject,
  deeplyReadonlyFrozenValue,
  freezeObject,
  readonlyFrozenStateIndex
} from "./frozen-json.ts";
import {
  freezeStateIndexKeyMap,
  normalizeStateIndexKeyValues,
  scalarIdentity
} from "./key-values.ts";
import { compareIndexText } from "./ordering.ts";
import {
  isStateIndexText,
  stateIndexSchemaVersion
} from "./schemas.ts";
import type {
  DeepReadonly,
  JsonObject,
  StateIndex,
  StateIndexDefinition,
  StateIndexKeyScalar,
  StateIndexProjectionContext,
  StateIndexResult,
  StateIndexStoredEntry
} from "./types.ts";
import { isJsonObject } from "./json.ts";

export function projectStateIndexEntry<
  State extends object,
  Metadata extends JsonObject
>(
  definition: StateIndexDefinition<State, Metadata>,
  input: unknown,
  context: StateIndexProjectionContext<Metadata>
): StateIndexResult<StateIndexStoredEntry<State>> {
  if (!isStateIndexText(context.id)) {
    return failure(
      "state-index.id-invalid",
      "state id must be non-empty text without surrounding whitespace or control characters",
      { stateId: typeof context.id === "string" ? context.id : null }
    );
  }
  if (!isJsonObject(input)) {
    return failure(
      "state-index.state-invalid",
      "state must be a JSON object containing only finite JSON values",
      { stateId: context.id }
    );
  }

  let state: State;
  try {
    state = definition.parseState(input, context);
  } catch (error) {
    return failure(
      "state-index.state-parse-failed",
      errorText(error),
      { stateId: context.id }
    );
  }
  if (!isJsonObject(state)) {
    return failure(
      "state-index.state-parse-invalid",
      "parseState must return a JSON object containing only finite JSON values",
      { stateId: context.id }
    );
  }

  const keys: Record<string, StateIndexKeyScalar[]> = {};
  for (const strategy of definition.keyStrategies) {
    let rawValues: unknown;
    try {
      rawValues = strategy.derive(state, context);
    } catch (error) {
      return failure(
        "state-index.key-derive-failed",
        `key ${strategy.name}: ${errorText(error)}`,
        { stateId: context.id }
      );
    }
    const normalized = normalizeStateIndexKeyValues(rawValues, strategy.mode);
    if (normalized.status === "error") {
      return failure(
        "state-index.key-value-invalid",
        `key ${strategy.name}: ${normalized.message}`,
        { stateId: context.id }
      );
    }
    if (normalized.values.length > 0) {
      keys[strategy.name] = normalized.values;
    }
  }

  return {
    diagnostics: [],
    status: "ok",
    value: freezeObject({
      keys: freezeStateIndexKeyMap(keys),
      state: cloneAndFreezeTypedJsonObject(state, false)
    })
  };
}

export function normalizeStateIndex<
  State extends object,
  Metadata extends JsonObject
>(
  index: StateIndex,
  definition: StateIndexDefinition<State, Metadata>,
  sourcePath: string
): StateIndexResult<StateIndex<State, Metadata>> {
  const parsedMetadata = parseStateIndexMetadata(
    definition,
    index.metadata,
    sourcePath
  );
  if (parsedMetadata.status === "error") {
    return parsedMetadata;
  }
  const metadata = canonicalizeTypedJsonObject(parsedMetadata.value);
  const entries: Array<[string, StateIndexStoredEntry<State>]> = [];
  for (const [id, entry] of Object.entries(index.entries)) {
    const projected = projectStateIndexEntry(
      definition,
      entry.state,
      createProjectionContext(id, metadata)
    );
    if (projected.status === "error") {
      return {
        diagnostics: projected.diagnostics.map((entryDiagnostic) => ({
          ...entryDiagnostic,
          path: entryDiagnostic.path ?? sourcePath,
          stateId: entryDiagnostic.stateId ?? id
        })),
        status: "error",
        value: null
      };
    }
    if (!sameKeyMaps(projected.value.keys, entry.keys)) {
      return failure(
        "state-index.definition-mismatch",
        `stored state ${id} does not match its keys under the runtime definition`,
        { path: sourcePath, stateId: id }
      );
    }
    entries.push([id, projected.value]);
  }
  return {
    diagnostics: [],
    status: "ok",
    value: canonicalizeStateIndex({
      definitionVersion: index.definitionVersion,
      entries: Object.fromEntries(entries),
      keyDefinitions: [...index.keyDefinitions],
      metadata,
      namespace: index.namespace,
      schemaVersion: stateIndexSchemaVersion,
      sourceRevision: index.sourceRevision
    }, definition)
  };
}

export function parseStateIndexMetadata<
  State extends object,
  Metadata extends JsonObject
>(
  definition: StateIndexDefinition<State, Metadata>,
  input: unknown,
  sourcePath: string | null = null
): StateIndexResult<Metadata> {
  if (!isJsonObject(input)) {
    return failure(
      "state-index.metadata-invalid",
      "metadata must be a JSON object containing only finite JSON values",
      { path: sourcePath }
    );
  }
  let metadata: Metadata;
  try {
    metadata = definition.parseMetadata(input);
  } catch (error) {
    return failure(
      "state-index.metadata-parse-failed",
      errorText(error),
      { path: sourcePath }
    );
  }
  if (!isJsonObject(metadata)) {
    return failure(
      "state-index.metadata-parse-invalid",
      "parseMetadata must return a JSON object containing only finite JSON values",
      { path: sourcePath }
    );
  }
  return { diagnostics: [], status: "ok", value: metadata };
}

export function createProjectionContext<Metadata extends JsonObject>(
  id: string,
  metadata: Metadata
): StateIndexProjectionContext<Metadata> {
  return Object.freeze({
    id,
    metadata: deeplyReadonlyFrozenValue(metadata)
  });
}

export function readonlyStateIndexMetadata<
  State extends object,
  Metadata extends JsonObject
>(
  index: StateIndex<State, Metadata>
): DeepReadonly<Metadata> {
  return deeplyReadonlyFrozenValue(index.metadata);
}

export function validateCompleteStateIndex<
  State extends object,
  Metadata extends JsonObject
>(
  definition: StateIndexDefinition<State, Metadata>,
  index: StateIndex<State, Metadata>,
  sourcePath: string
): StateIndexResult<StateIndex<State, Metadata>> {
  if (definition.validateIndex === undefined) {
    return { diagnostics: [], status: "ok", value: index };
  }
  try {
    definition.validateIndex(readonlyFrozenStateIndex(index));
  } catch (error) {
    return {
      diagnostics: [diagnostic({
        code: "state-index.index-validation-failed",
        message: errorText(error),
        path: sourcePath
      })],
      status: "error",
      value: null
    };
  }
  return { diagnostics: [], status: "ok", value: index };
}

function sameKeyMaps(
  left: StateIndexStoredEntry["keys"],
  right: StateIndexStoredEntry["keys"]
): boolean {
  const leftNames = Object.keys(left).sort(compareIndexText);
  const rightNames = Object.keys(right).sort(compareIndexText);
  return leftNames.length === rightNames.length
    && leftNames.every((name, index) => {
      if (name !== rightNames[index]) {
        return false;
      }
      const leftValues = left[name] ?? [];
      const rightValues = right[name] ?? [];
      return leftValues.length === rightValues.length
        && leftValues.every((value, valueIndex) => {
          const rightValue = rightValues[valueIndex];
          return rightValue !== undefined
            && scalarIdentity(value) === scalarIdentity(rightValue);
        });
    });
}
