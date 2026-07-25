import {
  canonicalizeTypedJsonObject,
  cloneAndFreezeTypedJsonObject,
  deeplyReadonlyFrozenValue,
  freezeObject,
  readonlyFrozenStateIndex
} from "./frozen-json.ts";
import {
  compareDefinitionKeyNames,
  compareIndexText,
  compareStateIndexKeyScalars
} from "./ordering.ts";
import type {
  DeepReadonly,
  JsonObject,
  StateIndex,
  StateIndexDefinition,
  StateIndexEntry,
  StateIndexKeyDefinition,
  StateIndexKeyScalar,
  StateIndexProjectionContext,
  StateIndexResult
} from "./types.ts";
import {
  diagnostic,
  isJsonObject,
  isStateIndexText,
  keyValueMatchesMode,
  scalarIdentity,
  stateIndexSchemaVersion
} from "./validation.ts";

export function projectStateIndexEntry<
  State extends object,
  Metadata extends JsonObject
>(
  definition: StateIndexDefinition<State, Metadata>,
  input: unknown,
  context: StateIndexProjectionContext<Metadata>
): StateIndexResult<StateIndexEntry<State>> {
  if (!isJsonObject(input)) {
    return failure(
      "state-index.state-invalid",
      "state must be a JSON object containing only finite JSON values"
    );
  }

  let state: State;
  try {
    state = definition.parseState(input, context);
  } catch (error) {
    return failure("state-index.state-parse-failed", errorText(error));
  }
  if (!isJsonObject(state)) {
    return failure(
      "state-index.state-parse-invalid",
      "parseState must return a JSON object containing only finite JSON values"
    );
  }

  let stateId: unknown;
  try {
    stateId = definition.identify(state, context);
  } catch (error) {
    return failure("state-index.identify-failed", errorText(error));
  }
  if (typeof stateId !== "string" || !isStateIndexText(stateId)) {
    return failure(
      "state-index.id-invalid",
      "identify must return non-empty text without surrounding whitespace"
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
        stateId
      );
    }
    const normalized = normalizeKeyValues(rawValues, strategy.mode);
    if (normalized.error !== null) {
      return failure(
        "state-index.key-value-invalid",
        `key ${strategy.name}: ${normalized.error}`,
        stateId
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
      id: stateId,
      keys: freezeKeyMap(keys),
      state: cloneAndFreezeTypedJsonObject(state, false)
    })
  };
}

export function canonicalizeStateIndex<
  State extends object = JsonObject,
  Metadata extends JsonObject = JsonObject
>(
  index: StateIndex<State, Metadata>,
  definition?: StateIndexDefinition<State, Metadata>
): StateIndex<State, Metadata> {
  const metadata = canonicalizeTypedJsonObject(index.metadata);
  const context = createProjectionContext(metadata);
  if (definition?.fieldOrder === "definition") {
    const keyOrder = new Map(
      definition.keyStrategies.map((strategy, index) => [strategy.name, index])
    );
    const keyDefinitions = [...index.keyDefinitions]
      .sort((left, right) => (
        compareDefinitionKeyNames(left.name, right.name, keyOrder)
      ))
      .map(({ name, mode }) => freezeObject({ name, mode }));
    const entries = index.entries
      .map((entry) => canonicalizeEntry(
        entry,
        definition,
        context,
        keyOrder
      ))
      .sort((left, right) => compareIndexText(left.id, right.id));
    return freezeObject({
      schemaVersion: stateIndexSchemaVersion,
      namespace: index.namespace,
      definitionVersion: index.definitionVersion,
      metadata,
      sourceRevision: index.sourceRevision,
      keyDefinitions: freezeObject(keyDefinitions),
      entries: freezeObject(entries)
    });
  }
  const entries = index.entries
    .map((entry) => canonicalizeEntry(entry))
    .sort((left, right) => compareIndexText(left.id, right.id));
  const keyDefinitions = [...index.keyDefinitions]
    .map(({ mode, name }) => freezeObject({ mode, name }))
    .sort((left, right) => compareIndexText(left.name, right.name));
  return freezeObject({
    definitionVersion: index.definitionVersion,
    entries: freezeObject(entries),
    keyDefinitions: freezeObject(keyDefinitions),
    metadata,
    namespace: index.namespace,
    schemaVersion: stateIndexSchemaVersion,
    sourceRevision: index.sourceRevision
  });
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
  const context = createProjectionContext(metadata);
  const entries: StateIndexEntry<State>[] = [];
  for (const entry of index.entries) {
    const projected = projectStateIndexEntry(definition, entry.state, context);
    if (projected.status === "error") {
      return {
        diagnostics: projected.diagnostics.map((entryDiagnostic) => ({
          ...entryDiagnostic,
          path: entryDiagnostic.path ?? sourcePath,
          stateId: entryDiagnostic.stateId ?? entry.id
        })),
        status: "error",
        value: null
      };
    }
    if (
      projected.value.id !== entry.id
      || !sameKeyMaps(projected.value.keys, entry.keys)
    ) {
      return {
        diagnostics: [diagnostic({
          code: "state-index.definition-mismatch",
          message: `stored state ${entry.id} does not match its id and keys `
            + "under the runtime definition",
          path: sourcePath,
          stateId: entry.id
        })],
        status: "error",
        value: null
      };
    }
    entries.push(projected.value);
  }
  return {
    diagnostics: [],
    status: "ok",
    value: canonicalizeStateIndex({
      definitionVersion: index.definitionVersion,
      entries,
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
      "metadata must be a JSON object containing only finite JSON values"
    );
  }
  let metadata: Metadata;
  try {
    metadata = definition.parseMetadata(input);
  } catch (error) {
    return {
      diagnostics: [diagnostic({
        code: "state-index.metadata-parse-failed",
        message: errorText(error),
        path: sourcePath
      })],
      status: "error",
      value: null
    };
  }
  if (!isJsonObject(metadata)) {
    return {
      diagnostics: [diagnostic({
        code: "state-index.metadata-parse-invalid",
        message: "parseMetadata must return a JSON object containing only finite JSON values",
        path: sourcePath
      })],
      status: "error",
      value: null
    };
  }
  return { diagnostics: [], status: "ok", value: metadata };
}

export function createProjectionContext<Metadata extends JsonObject>(
  metadata: Metadata
): StateIndexProjectionContext<Metadata> {
  return Object.freeze({
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

function normalizeKeyValues(
  input: unknown,
  mode: StateIndexKeyDefinition["mode"]
): { error: string | null; values: StateIndexKeyScalar[] } {
  if (input === undefined) {
    return { error: null, values: [] };
  }
  const inputs = Array.isArray(input) ? input : [input];
  const values: StateIndexKeyScalar[] = [];
  for (const value of inputs) {
    if (!isKeyScalar(value)) {
      return {
        error: "derive must return a boolean, finite number, non-empty string, or an array of them",
        values: []
      };
    }
    if (!keyValueMatchesMode(value, mode)) {
      return {
        error: `${mode} keys cannot contain ${typeof value} values`,
        values: []
      };
    }
    values.push(value);
  }
  return {
    error: null,
    values: [...new Map(values.map((value) => [scalarIdentity(value), value])).values()]
      .sort(compareStateIndexKeyScalars)
  };
}

function isKeyScalar(value: unknown): value is StateIndexKeyScalar {
  return typeof value === "boolean"
    || (typeof value === "number" && Number.isFinite(value))
    || (typeof value === "string" && isStateIndexText(value));
}

function canonicalizeEntry<
  State extends object,
  Metadata extends JsonObject
>(
  entry: StateIndexEntry<State>,
  definition: StateIndexDefinition<State, Metadata>,
  context: StateIndexProjectionContext<Metadata>,
  keyOrder: ReadonlyMap<string, number>
): StateIndexEntry<State>;
function canonicalizeEntry<State extends object>(
  entry: StateIndexEntry<State>
): StateIndexEntry<State>;
function canonicalizeEntry<
  State extends object,
  Metadata extends JsonObject
>(
  entry: StateIndexEntry<State>,
  definition?: StateIndexDefinition<State, Metadata>,
  context?: StateIndexProjectionContext<Metadata>,
  keyOrder?: ReadonlyMap<string, number>
): StateIndexEntry<State> {
  if (definition?.fieldOrder === "definition" && keyOrder !== undefined) {
    if (!isJsonObject(entry.state) || context === undefined) {
      throw new TypeError(
        "state must be a JSON object containing only finite JSON values"
      );
    }
    const state = definition.parseState(entry.state, context);
    if (!isJsonObject(state)) {
      throw new TypeError(
        "parseState must return a JSON object containing only finite JSON values"
      );
    }
    return freezeObject({
      id: entry.id,
      keys: freezeKeyMap(Object.fromEntries(
        Object.entries(entry.keys)
          .sort(([left], [right]) => (
            compareDefinitionKeyNames(left, right, keyOrder)
          ))
          .map(([name, values]) => [
            name,
            [...values].sort(compareStateIndexKeyScalars)
          ])
      )),
      state: cloneAndFreezeTypedJsonObject(state, false)
    });
  }
  return freezeObject({
    id: entry.id,
    keys: freezeKeyMap(Object.fromEntries(
      Object.entries(entry.keys)
        .sort(([left], [right]) => compareIndexText(left, right))
        .map(([name, values]) => [
          name,
          [...values].sort(compareStateIndexKeyScalars)
        ])
    )),
    state: canonicalizeTypedJsonObject(entry.state)
  });
}

function sameKeyMaps(
  left: StateIndexEntry["keys"],
  right: StateIndexEntry["keys"]
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
        && leftValues.every((value, valueIndex) => (
          scalarIdentity(value) === scalarIdentity(rightValues[valueIndex]!)
        ));
    });
}

function freezeKeyMap(
  keys: Record<string, StateIndexKeyScalar[]>
): Record<string, StateIndexKeyScalar[]> {
  for (const values of Object.values(keys)) {
    freezeObject(values);
  }
  return freezeObject(keys);
}

function failure<Value = never>(
  code: string,
  message: string,
  stateId: string | null = null
): StateIndexResult<Value> {
  return {
    diagnostics: [diagnostic({ code, message, stateId })],
    status: "error",
    value: null
  };
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
