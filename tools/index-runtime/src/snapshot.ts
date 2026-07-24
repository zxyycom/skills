import { compareIndexText } from "./ordering.ts";
import type {
  JsonObject,
  JsonValue,
  StateIndex,
  StateIndexContext,
  StateIndexDefinition,
  StateIndexEntry,
  StateIndexExpectation,
  StateIndexKeyDefinition,
  StateIndexKeyScalar,
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

export function defineStateIndexDefinition<State extends object>(
  definition: StateIndexDefinition<State>
): StateIndexDefinition<State> {
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

export async function buildStateIndex<State extends object>(
  definition: StateIndexDefinition<State>,
  context: StateIndexContext
): Promise<StateIndexResult<StateIndex>> {
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
      "read must return { revision, states } with a valid revision and state array"
    );
  }

  const entries: StateIndexEntry<State>[] = [];
  const diagnostics = [];
  for (const state of snapshot.states) {
    const projected = projectStateIndexEntry(definition, state);
    diagnostics.push(...projected.diagnostics);
    if (projected.status === "ok") {
      entries.push(projected.value);
    }
  }
  if (diagnostics.length > 0) {
    return { diagnostics, status: "error", value: null };
  }

  const rawIndex: unknown = {
    definitionVersion: definition.definitionVersion,
    entries,
    keyDefinitions: definition.keyStrategies.map(({ mode, name }) => ({ mode, name })),
    namespace: definition.namespace,
    schemaVersion: stateIndexSchemaVersion,
    sourceRevision: snapshot.revision
  };
  const validated = validateStateIndexValue(rawIndex, expectationOf(definition), "<generated>");
  if (validated.index === null) {
    return { diagnostics: validated.diagnostics, status: "error", value: null };
  }
  return {
    diagnostics: [],
    status: "ok",
    value: canonicalizeStateIndex(validated.index, definition)
  };
}

export function projectStateIndexEntry<State extends object>(
  definition: StateIndexDefinition<State>,
  input: unknown
): StateIndexResult<StateIndexEntry<State>> {
  if (!isJsonObject(input)) {
    return failure(
      "state-index.state-invalid",
      "state must be a JSON object containing only finite JSON values"
    );
  }

  let state: State;
  try {
    state = definition.parseState(input);
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
    stateId = definition.identify(state);
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
      rawValues = strategy.derive(state);
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
    value: {
      id: stateId,
      keys,
      state
    }
  };
}

export function parseStateIndex<State extends object = JsonObject>(options: {
  definition?: StateIndexDefinition<State>;
  expectation: StateIndexExpectation;
  sourcePath: string;
  text: string;
}): StateIndexResult<StateIndex> {
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

  let canonical: StateIndex;
  try {
    canonical = canonicalizeStateIndex(validated.index, options.definition);
  } catch (error) {
    return {
      diagnostics: [diagnostic({
        code: "state-index.state-parse-failed",
        message: errorText(error),
        path: options.sourcePath
      })],
      status: "error",
      value: null
    };
  }
  return {
    diagnostics: [],
    status: "ok",
    value: canonical
  };
}

export function serializeStateIndex<State extends object>(
  index: StateIndex,
  definition: StateIndexDefinition<State>
): string {
  return `${JSON.stringify(canonicalizeStateIndex(index, definition), null, 2)}\n`;
}

export function canonicalizeStateIndex<State extends object = JsonObject>(
  index: StateIndex,
  definition?: StateIndexDefinition<State>
): StateIndex {
  if (definition?.fieldOrder === "definition") {
    const keyOrder = new Map(
      definition.keyStrategies.map((strategy, index) => [strategy.name, index])
    );
    return {
      schemaVersion: stateIndexSchemaVersion,
      namespace: index.namespace,
      definitionVersion: index.definitionVersion,
      sourceRevision: index.sourceRevision,
      keyDefinitions: [...index.keyDefinitions]
        .sort((left, right) => compareDefinitionKeys(left.name, right.name, keyOrder))
        .map(({ name, mode }) => ({ name, mode })),
      entries: index.entries
        .map((entry) => canonicalizeEntry(entry, definition, keyOrder))
        .sort((left, right) => compareIndexText(left.id, right.id))
    };
  }
  return {
    definitionVersion: index.definitionVersion,
    entries: index.entries
      .map(canonicalizeEntry)
      .sort((left, right) => compareIndexText(left.id, right.id)),
    keyDefinitions: [...index.keyDefinitions]
      .map(({ mode, name }) => ({ mode, name }))
      .sort((left, right) => compareIndexText(left.name, right.name)),
    namespace: index.namespace,
    schemaVersion: stateIndexSchemaVersion,
    sourceRevision: index.sourceRevision
  };
}

export function expectationOf<State extends object>(
  definition: StateIndexDefinition<State>
): StateIndexExpectation {
  return {
    definitionVersion: definition.definitionVersion,
    namespace: definition.namespace
  };
}

export function keyDefinitionsOf<State extends object>(
  definition: StateIndexDefinition<State>
): StateIndexKeyDefinition[] {
  if (definition.fieldOrder === "definition") {
    return definition.keyStrategies.map(({ name, mode }) => ({ name, mode }));
  }
  return definition.keyStrategies
    .map(({ mode, name }) => ({ mode, name }))
    .sort((left, right) => compareIndexText(left.name, right.name));
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

function isStateSnapshot(
  value: unknown
): value is { revision: string; states: unknown[] } {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const candidate = value as { revision?: unknown; states?: unknown };
  return typeof candidate.revision === "string"
    && isStateIndexText(candidate.revision)
    && Array.isArray(candidate.states);
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

function canonicalizeEntry(entry: StateIndexEntry): StateIndexEntry;
function canonicalizeEntry<State extends object>(
  entry: StateIndexEntry,
  definition: StateIndexDefinition<State>,
  keyOrder: ReadonlyMap<string, number>
): StateIndexEntry;
function canonicalizeEntry(
  entry: StateIndexEntry,
  definition?: StateIndexDefinition<object>,
  keyOrder?: ReadonlyMap<string, number>
): StateIndexEntry {
  if (definition?.fieldOrder === "definition" && keyOrder !== undefined) {
    const state = definition.parseState(entry.state);
    if (!isJsonObject(state)) {
      throw new TypeError(
        "parseState must return a JSON object containing only finite JSON values"
      );
    }
    return {
      id: entry.id,
      keys: Object.fromEntries(
        Object.entries(entry.keys)
          .sort(([left], [right]) => compareDefinitionKeys(left, right, keyOrder))
          .map(([name, values]) => [name, [...values].sort(compareKeyScalars)])
      ),
      state: preserveJsonObjectFieldOrder(state)
    };
  }
  return {
    id: entry.id,
    keys: Object.fromEntries(
      Object.entries(entry.keys)
        .sort(([left], [right]) => compareIndexText(left, right))
        .map(([name, values]) => [name, [...values].sort(compareKeyScalars)])
    ),
    state: canonicalizeJsonObject(entry.state)
  };
}

function canonicalizeJsonObject(value: JsonObject): JsonObject {
  return Object.fromEntries(
    Object.entries(value)
      .sort(([left], [right]) => compareIndexText(left, right))
      .map(([key, child]) => [key, canonicalizeJsonValue(child)])
  );
}

function canonicalizeJsonValue(value: JsonValue): JsonValue {
  if (Array.isArray(value)) {
    return value.map(canonicalizeJsonValue);
  }
  if (value !== null && typeof value === "object") {
    return canonicalizeJsonObject(value);
  }
  return value;
}

function preserveJsonObjectFieldOrder(value: JsonObject): JsonObject {
  return Object.fromEntries(
    Object.entries(value).map(([key, child]) => [
      key,
      preserveJsonValueFieldOrder(child)
    ])
  );
}

function preserveJsonValueFieldOrder(value: JsonValue): JsonValue {
  if (Array.isArray(value)) {
    return value.map(preserveJsonValueFieldOrder);
  }
  if (value !== null && typeof value === "object") {
    return preserveJsonObjectFieldOrder(value);
  }
  return value;
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
