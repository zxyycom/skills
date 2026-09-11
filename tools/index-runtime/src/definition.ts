import { compareIndexText } from "./ordering.ts";
import {
  validateDescriptorKeys,
  validateQuerySource
} from "./query-source-validation.ts";
import { isStateIndexKeyName, isStateIndexNamespace } from "./schemas.ts";
import type {
  JsonObject,
  StateIndexDefinition,
  StateIndexExpectation,
  StateIndexQueryFieldDefinition,
  StateIndexQuerySource
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
      `Invalid state index definition ${definition.namespace || "<missing-namespace>"}: ` +
        errors.join("; ")
    );
  }
  const queryFields = definition.queryFields.map((field) =>
    Object.freeze({
      mode: field.mode,
      name: field.name,
      sources: Object.freeze(field.sources.map(freezeQuerySource))
    })
  );
  return Object.freeze({
    ...definition,
    queryFields: Object.freeze(queryFields)
  });
}

export function validateStateIndexDefinition<
  State extends object,
  Metadata extends JsonObject
>(definition: StateIndexDefinition<State, Metadata>): string[] {
  const errors: string[] = [];
  if (!isStateIndexNamespace(definition.namespace)) {
    errors.push("namespace must be a kebab-case identifier");
  }
  if (
    !Number.isSafeInteger(definition.definitionVersion) ||
    definition.definitionVersion < 1
  ) {
    errors.push("definitionVersion must be a positive safe integer");
  }
  if (
    definition.fieldOrder !== undefined &&
    definition.fieldOrder !== "definition" &&
    definition.fieldOrder !== "lexicographic"
  ) {
    errors.push("fieldOrder must be definition or lexicographic");
  }
  if (typeof definition.read !== "function")
    errors.push("read must be a function");
  if (typeof definition.readRevision !== "function")
    errors.push("readRevision must be a function");
  if (typeof definition.parseMetadata !== "function")
    errors.push("parseMetadata must be a function");
  if (typeof definition.parseState !== "function")
    errors.push("parseState must be a function");
  if (
    definition.validateIndex !== undefined &&
    typeof definition.validateIndex !== "function"
  ) {
    errors.push("validateIndex must be a function");
  }
  if (
    !Array.isArray(definition.queryFields) ||
    definition.queryFields.length === 0
  ) {
    errors.push("queryFields must contain at least one field");
    return errors;
  }

  const names = new Set<string>();
  for (const [fieldIndex, field] of definition.queryFields.entries()) {
    const prefix = `queryFields[${fieldIndex}]`;
    if (typeof field !== "object" || field === null) {
      errors.push(`${prefix} must be a query field descriptor`);
      continue;
    }
    if (
      !validateDescriptorKeys(
        field,
        ["mode", "name", "sources"],
        ["mode", "name", "sources"],
        prefix,
        errors
      )
    ) {
      continue;
    }
    if (!isStateIndexKeyName(field.name)) {
      errors.push(`${prefix}.name must be a lowercase key name`);
    }
    if (field.name === "id") {
      errors.push("queryFields must not redefine the reserved id key");
    }
    if (names.has(field.name)) {
      errors.push(`query field ${field.name} appears more than once`);
    }
    names.add(field.name);
    if (
      field.mode !== "exact" &&
      field.mode !== "range" &&
      field.mode !== "text"
    ) {
      errors.push(`${prefix}.mode must be exact, range, or text`);
    }
    if (!Array.isArray(field.sources) || field.sources.length === 0) {
      errors.push(`${prefix}.sources must contain at least one source`);
      continue;
    }
    for (const [sourceIndex, source] of field.sources.entries()) {
      validateQuerySource(
        source,
        field,
        `${prefix}.sources[${sourceIndex}]`,
        errors
      );
    }
  }
  return errors;
}

function freezeQuerySource(
  source: StateIndexQuerySource
): StateIndexQuerySource {
  if (source.kind === "entry-id") return Object.freeze({ kind: source.kind });
  if (source.kind === "source-path-first-segment") {
    return Object.freeze({ kind: source.kind });
  }
  const path = source.path.map((segment) =>
    typeof segment === "string"
      ? segment
      : Object.freeze({ kind: "each" as const })
  );
  return Object.freeze({
    kind: source.kind,
    ...(source.normalization === undefined
      ? {}
      : { normalization: source.normalization }),
    path: Object.freeze(path)
  });
}

export function expectationOf<
  State extends object,
  Metadata extends JsonObject
>(definition: StateIndexDefinition<State, Metadata>): StateIndexExpectation {
  return {
    definitionVersion: definition.definitionVersion,
    namespace: definition.namespace
  };
}

export function queryFieldDefinitionsOf<
  State extends object,
  Metadata extends JsonObject
>(
  definition: StateIndexDefinition<State, Metadata>
): StateIndexQueryFieldDefinition[] {
  const fields = definition.queryFields.map(({ name, mode }) => ({
    name,
    mode
  }));
  return definition.fieldOrder === "definition"
    ? fields
    : fields.sort((left, right) => compareIndexText(left.name, right.name));
}

export function sameQueryFieldDefinitions(
  left: readonly StateIndexQueryFieldDefinition[],
  right: readonly StateIndexQueryFieldDefinition[]
): boolean {
  return (
    left.length === right.length &&
    left.every(
      (entry, index) =>
        entry.name === right[index]?.name && entry.mode === right[index]?.mode
    )
  );
}
