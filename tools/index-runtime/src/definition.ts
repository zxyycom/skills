import { compareIndexText } from "./ordering.ts";
import {
  isStateIndexKeyName,
  isStateIndexNamespace
} from "./schemas.ts";
import type {
  JsonObject,
  StateIndexDefinition,
  StateIndexExpectation,
  StateIndexKeyDefinition
} from "./types.ts";

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

export function validateStateIndexDefinition<
  State extends object,
  Metadata extends JsonObject
>(
  definition: StateIndexDefinition<State, Metadata>
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
  if (typeof definition.parseMetadata !== "function") {
    errors.push("parseMetadata must be a function");
  }
  if (typeof definition.parseState !== "function") {
    errors.push("parseState must be a function");
  }
  if (
    definition.validateIndex !== undefined
    && typeof definition.validateIndex !== "function"
  ) {
    errors.push("validateIndex must be a function");
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

export function sameKeyDefinitions(
  left: readonly StateIndexKeyDefinition[],
  right: readonly StateIndexKeyDefinition[]
): boolean {
  return left.length === right.length
    && left.every((entry, index) => (
      entry.name === right[index]?.name
      && entry.mode === right[index]?.mode
    ));
}
