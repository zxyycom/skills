import { compareIndexText } from "./ordering.ts";
import type {
  DeepReadonly,
  JsonObject,
  JsonValue,
  ReadonlyStateIndex,
  StateIndex,
  StateIndexContext,
  StateIndexDefinition,
  StateIndexEntry,
  StateIndexExpectation,
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
  stateIndexSchemaVersion,
  validateStateIndexDefinition,
  validateStateIndexValue
} from "./validation.ts";

export function defineStateIndexDefinition<
  State extends object,
  Metadata extends JsonObject = JsonObject
>(
  definition: StateIndexDefinition<State, Metadata>
): StateIndexDefinition<State, Metadata> {
  const errors = validateStateIndexDefinition(definition);
  if (errors.length > 0) {
    throw new TypeError(
      `Invalid state index definition ${definition.namespace || "<missing-namespace>"}: `
      + errors.join("; ")
    );
  }
  const keyStrategies = definition.keyStrategies.map((strategy) => (
    Object.freeze({ ...strategy })
  ));
  return Object.freeze({ ...definition, keyStrategies });
}

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
  const validated = validateStateIndexValue(rawIndex, expectationOf(definition), "<generated>");
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

export function parseStateIndex<
  State extends object,
  Metadata extends JsonObject
>(options: {
  definition: StateIndexDefinition<State, Metadata>;
  expectation: StateIndexExpectation;
  sourcePath: string;
  text: string;
}): StateIndexResult<StateIndex<State, Metadata>>;
export function parseStateIndex(options: {
  definition?: undefined;
  expectation: StateIndexExpectation;
  sourcePath: string;
  text: string;
}): StateIndexResult<StateIndex>;
export function parseStateIndex<
  State extends object,
  Metadata extends JsonObject
>(options: {
  definition?: StateIndexDefinition<State, Metadata>;
  expectation: StateIndexExpectation;
  sourcePath: string;
  text: string;
}): StateIndexResult<StateIndex | StateIndex<State, Metadata>> {
  if (options.definition !== undefined) {
    const definitionErrors = validateStateIndexDefinition(options.definition);
    if (definitionErrors.length > 0) {
      return {
        diagnostics: [diagnostic({
          code: "state-index.definition-invalid",
          message: definitionErrors.join("; "),
          path: options.sourcePath
        })],
        status: "error",
        value: null
      };
    }
    const definitionExpectation = expectationOf(options.definition);
    if (
      definitionExpectation.namespace !== options.expectation.namespace
      || definitionExpectation.definitionVersion !== options.expectation.definitionVersion
    ) {
      return {
        diagnostics: [diagnostic({
          code: "state-index.definition-mismatch",
          message: "parse expectation does not match the runtime definition",
          path: options.sourcePath
        })],
        status: "error",
        value: null
      };
    }
  }

  let value: unknown;
  try {
    value = JSON.parse(options.text);
  } catch (error) {
    return {
      diagnostics: [diagnostic({
        code: "state-index.json-invalid",
        message: errorText(error),
        path: options.sourcePath
      })],
      status: "error",
      value: null
    };
  }

  const validated = validateStateIndexValue(
    value,
    options.expectation,
    options.sourcePath
  );
  if (validated.index === null) {
    return { diagnostics: validated.diagnostics, status: "error", value: null };
  }

  if (
    options.definition !== undefined
    && !sameKeyDefinitions(
      validated.index.keyDefinitions,
      keyDefinitionsOf(options.definition)
    )
  ) {
    return {
      diagnostics: [diagnostic({
        code: "state-index.definition-mismatch",
        message: "index key definitions do not match the runtime definition",
        path: options.sourcePath
      })],
      status: "error",
      value: null
    };
  }

  if (options.definition === undefined) {
    return {
      diagnostics: [],
      status: "ok",
      value: canonicalizeStateIndex(validated.index)
    };
  }
  const normalized = normalizeStateIndex(
    validated.index,
    options.definition,
    options.sourcePath
  );
  if (normalized.status === "error") {
    return normalized;
  }
  return validateCompleteStateIndex(
    options.definition,
    normalized.value,
    options.sourcePath
  );
}

export function serializeStateIndex<
  State extends object,
  Metadata extends JsonObject
>(
  index: StateIndex<State, Metadata>,
  definition: StateIndexDefinition<State, Metadata>
): string {
  return `${JSON.stringify(canonicalizeStateIndex(index, definition), null, 2)}\n`;
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
      .sort((left, right) => compareDefinitionKeys(left.name, right.name, keyOrder))
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

export function expectationOf<
  State extends object,
  Metadata extends JsonObject
>(
  definition: StateIndexDefinition<State, Metadata>
): StateIndexExpectation {
  return {
    definitionVersion: definition.definitionVersion,
    namespace: definition.namespace
  };
}

export function keyDefinitionsOf<
  State extends object,
  Metadata extends JsonObject
>(
  definition: StateIndexDefinition<State, Metadata>
): StateIndexKeyDefinition[] {
  if (definition.fieldOrder === "definition") {
    return definition.keyStrategies.map(({ name, mode }) => ({ name, mode }));
  }
  return definition.keyStrategies
    .map(({ mode, name }) => ({ mode, name }))
    .sort((left, right) => compareIndexText(left.name, right.name));
}

export function readonlyStateIndexMetadata<
  State extends object,
  Metadata extends JsonObject
>(
  index: StateIndex<State, Metadata>
): DeepReadonly<Metadata> {
  return deeplyReadonlyFrozenValue(index.metadata);
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

function sameKeyDefinitions(
  left: readonly StateIndexKeyDefinition[],
  right: readonly StateIndexKeyDefinition[]
): boolean {
  return left.length === right.length
    && left.every((entry, index) => (
      entry.name === right[index]?.name
      && entry.mode === right[index]?.mode
    ));
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

function parseStateIndexMetadata<
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

function createProjectionContext<Metadata extends JsonObject>(
  metadata: Metadata
): StateIndexProjectionContext<Metadata> {
  return Object.freeze({
    metadata: deeplyReadonlyFrozenValue(metadata)
  });
}

function validateCompleteStateIndex<
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
      .sort(compareKeyScalars)
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
          .sort(([left], [right]) => compareDefinitionKeys(left, right, keyOrder))
          .map(([name, values]) => [name, [...values].sort(compareKeyScalars)])
      )),
      state: cloneAndFreezeTypedJsonObject(state, false)
    });
  }
  return freezeObject({
    id: entry.id,
    keys: freezeKeyMap(Object.fromEntries(
      Object.entries(entry.keys)
        .sort(([left], [right]) => compareIndexText(left, right))
        .map(([name, values]) => [name, [...values].sort(compareKeyScalars)])
    )),
    state: canonicalizeTypedJsonObject(entry.state)
  });
}

function canonicalizeTypedJsonObject<Value extends object>(value: Value): Value {
  return cloneAndFreezeTypedJsonObject(value, true);
}

function cloneAndFreezeTypedJsonObject<Value extends object>(
  value: Value,
  sortKeys: boolean
): Value {
  if (!isJsonObject(value)) {
    throw new TypeError(
      "value must be a JSON object containing only finite JSON values"
    );
  }
  // The validated JSON shape is preserved in a fresh recursively frozen copy.
  return cloneAndFreezeJsonObject(value, sortKeys) as Value;
}

function cloneAndFreezeJsonObject(
  value: JsonObject,
  sortKeys: boolean
): JsonObject {
  const entries = Object.entries(value);
  if (sortKeys) {
    entries.sort(([left], [right]) => compareIndexText(left, right));
  }
  return freezeObject(Object.fromEntries(
    entries.map(([key, child]) => [
      key,
      cloneAndFreezeJsonValue(child, sortKeys)
    ])
  ));
}

function cloneAndFreezeJsonValue(
  value: JsonValue,
  sortKeys: boolean
): JsonValue {
  if (Array.isArray(value)) {
    return freezeObject(value.map((entry) => (
      cloneAndFreezeJsonValue(entry, sortKeys)
    )));
  }
  if (value !== null && typeof value === "object") {
    return cloneAndFreezeJsonObject(value, sortKeys);
  }
  return value;
}

function freezeKeyMap(
  keys: Record<string, StateIndexKeyScalar[]>
): Record<string, StateIndexKeyScalar[]> {
  for (const values of Object.values(keys)) {
    freezeObject(values);
  }
  return freezeObject(keys);
}

function freezeObject<Value extends object>(value: Value): Value {
  Object.freeze(value);
  return value;
}

function deeplyReadonlyFrozenValue<Value>(
  value: Value
): DeepReadonly<Value> {
  if (!isDeeplyFrozen(value)) {
    throw new TypeError("internal normalized value must be recursively frozen");
  }
  return value as DeepReadonly<Value>;
}

function readonlyFrozenStateIndex<
  State extends object,
  Metadata extends JsonObject
>(
  index: StateIndex<State, Metadata>
): ReadonlyStateIndex<State, Metadata> {
  if (!isDeeplyFrozen(index)) {
    throw new TypeError("complete state index must be recursively frozen");
  }
  return index as unknown as ReadonlyStateIndex<State, Metadata>;
}

function isDeeplyFrozen(
  value: unknown,
  seen: Set<object> = new Set()
): boolean {
  if (value === null || typeof value !== "object") {
    return true;
  }
  if (seen.has(value)) {
    return true;
  }
  if (!Object.isFrozen(value)) {
    return false;
  }
  seen.add(value);
  return Reflect.ownKeys(value).every((key) => (
    isDeeplyFrozen(Reflect.get(value, key), seen)
  ));
}

function compareDefinitionKeys(
  left: string,
  right: string,
  order: ReadonlyMap<string, number>
): number {
  const leftOrder = order.get(left) ?? Number.POSITIVE_INFINITY;
  const rightOrder = order.get(right) ?? Number.POSITIVE_INFINITY;
  return leftOrder === rightOrder
    ? compareIndexText(left, right)
    : leftOrder - rightOrder;
}

function compareKeyScalars(
  left: StateIndexKeyScalar,
  right: StateIndexKeyScalar
): number {
  const leftOrder = scalarTypeOrder(left);
  const rightOrder = scalarTypeOrder(right);
  if (leftOrder !== rightOrder) {
    return leftOrder - rightOrder;
  }
  if (typeof left === "number" && typeof right === "number") {
    return left - right;
  }
  if (typeof left === "boolean" && typeof right === "boolean") {
    return Number(left) - Number(right);
  }
  return compareIndexText(String(left), String(right));
}

function scalarTypeOrder(value: StateIndexKeyScalar): number {
  switch (typeof value) {
    case "boolean": return 0;
    case "number": return 1;
    case "string": return 2;
  }
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
