import * as v from "valibot";
import {
  isJsonObject,
  isJsonValue
} from "./json.ts";
import {
  isStateIndexKeyName,
  isStateIndexNamespace,
  isStateIndexText,
  stateIndexQueryDefaultLimit,
  stateIndexQueryMaximumLimit,
  stateIndexQuerySchema,
  stateIndexSchema,
  stateIndexSchemaVersion,
  type StateIndex,
  type StateIndexKeyDefinition,
  type StateIndexKeyScalar,
  type StateIndexQueryValue
} from "./schemas.ts";
import type {
  StateIndexDefinition,
  StateIndexDiagnostic,
  StateIndexExpectation
} from "./types.ts";

export {
  isJsonObject,
  isJsonValue,
  isStateIndexKeyName,
  isStateIndexNamespace,
  isStateIndexText,
  stateIndexQueryDefaultLimit,
  stateIndexQueryMaximumLimit,
  stateIndexSchemaVersion
};

export function validateStateIndexDefinition<State extends object>(
  definition: StateIndexDefinition<State>
): string[] {
  const errors: string[] = [];
  if (!isStateIndexNamespace(definition.namespace)) {
    errors.push("namespace must be a kebab-case identifier");
  }
  if (
    !Number.isSafeInteger(definition.definitionVersion)
    || definition.definitionVersion < 1
  ) {
    errors.push("definitionVersion must be a positive safe integer");
  }
  if (
    definition.fieldOrder !== undefined
    && definition.fieldOrder !== "definition"
    && definition.fieldOrder !== "lexicographic"
  ) {
    errors.push("fieldOrder must be definition or lexicographic");
  }
  if (typeof definition.read !== "function") {
    errors.push("read must be a function");
  }
  if (typeof definition.readRevision !== "function") {
    errors.push("readRevision must be a function");
  }
  if (typeof definition.identify !== "function") {
    errors.push("identify must be a function");
  }
  if (typeof definition.parseState !== "function") {
    errors.push("parseState must be a function");
  }
  if (!Array.isArray(definition.keyStrategies) || definition.keyStrategies.length === 0) {
    errors.push("keyStrategies must contain at least one strategy");
    return errors;
  }

  const names = new Set<string>();
  for (const [index, strategy] of definition.keyStrategies.entries()) {
    if (!isStateIndexKeyName(strategy.name)) {
      errors.push(`keyStrategies[${index}].name must be a lowercase key name`);
    }
    if (strategy.name === "id") {
      errors.push("keyStrategies must not redefine the reserved id key");
    }
    if (names.has(strategy.name)) {
      errors.push(`key strategy ${strategy.name} appears more than once`);
    }
    names.add(strategy.name);
    if (strategy.mode !== "exact" && strategy.mode !== "range" && strategy.mode !== "text") {
      errors.push(`keyStrategies[${index}].mode must be exact, range, or text`);
    }
    if (typeof strategy.derive !== "function") {
      errors.push(`keyStrategies[${index}].derive must be a function`);
    }
  }
  return errors;
}

export function validateStateIndexQueryValue(input: unknown): {
  diagnostics: StateIndexDiagnostic[];
  query: StateIndexQueryValue | null;
} {
  const parsed = v.safeParse(stateIndexQuerySchema, input);
  if (!parsed.success) {
    return {
      diagnostics: parsed.issues.map((issue) => diagnostic({
        code: "state-index.query-invalid",
        message: formatSchemaIssue(issue)
      })),
      query: null
    };
  }
  const sortKeys = parsed.output.sort?.map((entry) => entry.key) ?? [];
  if (new Set(sortKeys).size !== sortKeys.length) {
    return {
      diagnostics: [diagnostic({
        code: "state-index.query-invalid",
        message: "sort rules must not repeat a key"
      })],
      query: null
    };
  }
  return { diagnostics: [], query: parsed.output };
}

export function validateStateIndexValue(
  input: unknown,
  expectation: StateIndexExpectation | null,
  sourcePath: string
): { diagnostics: StateIndexDiagnostic[]; index: StateIndex | null } {
  const parsed = v.safeParse(stateIndexSchema, input);
  if (!parsed.success) {
    return {
      diagnostics: parsed.issues.map((issue) => diagnostic({
        code: "state-index.schema-invalid",
        message: formatSchemaIssue(issue),
        path: sourcePath
      })),
      index: null
    };
  }

  const index = parsed.output;
  const diagnostics: StateIndexDiagnostic[] = [];
  if (expectation !== null && index.namespace !== expectation.namespace) {
    diagnostics.push(diagnostic({
      code: "state-index.namespace-mismatch",
      message: `expected namespace ${expectation.namespace}, found ${index.namespace}`,
      path: sourcePath
    }));
  }
  if (
    expectation !== null
    && index.definitionVersion !== expectation.definitionVersion
  ) {
    diagnostics.push(diagnostic({
      code: "state-index.definition-version-mismatch",
      message: "expected definition version "
        + `${expectation.definitionVersion}, found ${index.definitionVersion}`,
      path: sourcePath
    }));
  }

  const definitions = validateKeyDefinitions(index.keyDefinitions, sourcePath, diagnostics);
  const ids = new Set<string>();
  for (const entry of index.entries) {
    if (ids.has(entry.id)) {
      diagnostics.push(diagnostic({
        code: "state-index.id-duplicate",
        message: `state id ${entry.id} appears more than once`,
        path: sourcePath,
        stateId: entry.id
      }));
    }
    ids.add(entry.id);
    for (const [key, values] of Object.entries(entry.keys)) {
      const definition = definitions.get(key);
      if (definition === undefined) {
        diagnostics.push(diagnostic({
          code: "state-index.key-unknown",
          message: `state ${entry.id} contains undeclared key ${key}`,
          path: sourcePath,
          stateId: entry.id
        }));
        continue;
      }
      if (new Set(values.map(scalarIdentity)).size !== values.length) {
        diagnostics.push(diagnostic({
          code: "state-index.key-value-duplicate",
          message: `state ${entry.id} repeats a value for key ${key}`,
          path: sourcePath,
          stateId: entry.id
        }));
      }
      for (const value of values) {
        if (!keyValueMatchesMode(value, definition.mode)) {
          diagnostics.push(diagnostic({
            code: "state-index.key-value-invalid",
            message: `key ${key} with mode ${definition.mode} cannot contain ${typeof value}`,
            path: sourcePath,
            stateId: entry.id
          }));
        }
      }
    }
  }

  return {
    diagnostics,
    index: diagnostics.length === 0 ? index : null
  };
}

function validateKeyDefinitions(
  definitions: readonly StateIndexKeyDefinition[],
  sourcePath: string,
  diagnostics: StateIndexDiagnostic[]
): Map<string, StateIndexKeyDefinition> {
  const byName = new Map<string, StateIndexKeyDefinition>();
  for (const definition of definitions) {
    if (definition.name === "id") {
      diagnostics.push(diagnostic({
        code: "state-index.key-reserved",
        message: "key definitions must not redefine the reserved id key",
        path: sourcePath
      }));
    }
    if (byName.has(definition.name)) {
      diagnostics.push(diagnostic({
        code: "state-index.key-definition-duplicate",
        message: `key definition ${definition.name} appears more than once`,
        path: sourcePath
      }));
    }
    byName.set(definition.name, definition);
  }
  return byName;
}

export function keyValueMatchesMode(
  value: StateIndexKeyScalar,
  mode: StateIndexKeyDefinition["mode"]
): boolean {
  switch (mode) {
    case "exact":
      return true;
    case "range":
      return typeof value === "number" || typeof value === "string";
    case "text":
      return typeof value === "string";
  }
}

export function scalarIdentity(value: StateIndexKeyScalar): string {
  return `${typeof value}:${String(value)}`;
}

function formatSchemaIssue(issue: v.BaseIssue<unknown>): string {
  const issuePath = v.getDotPath(issue);
  return issuePath ? `${issuePath} ${issue.message}` : issue.message;
}

export function diagnostic(options: {
  code: string;
  message: string;
  path?: string | null;
  stateId?: string | null;
}): StateIndexDiagnostic {
  return {
    code: options.code,
    message: options.message,
    path: options.path ?? null,
    stateId: options.stateId ?? null
  };
}
