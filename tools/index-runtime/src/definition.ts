import { compareIndexText } from "./ordering.ts";
import {
  isStateIndexKeyName,
  isStateIndexNamespace,
  isStateIndexText
} from "./schemas.ts";
import type {
  JsonObject,
  StateIndexDefinition,
  StateIndexExpectation,
  StateIndexQueryField,
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

function validateQuerySource(
  source: StateIndexQuerySource,
  field: StateIndexQueryField,
  prefix: string,
  errors: string[]
): void {
  if (typeof source !== "object" || source === null) {
    errors.push(`${prefix} must be a query source descriptor`);
    return;
  }
  if (!Object.hasOwn(source, "kind")) {
    errors.push(`${prefix} must define own properties: kind`);
    return;
  }
  if (source.kind === "entry-id") {
    validateDescriptorKeys(source, ["kind"], ["kind"], prefix, errors);
    return;
  }
  if (source.kind === "source-path-first-segment") {
    validateDescriptorKeys(source, ["kind"], ["kind"], prefix, errors);
    if (field.mode !== "exact") {
      errors.push(`${prefix} requires exact mode`);
    }
    return;
  }
  if (source.kind !== "state-path") {
    errors.push(`${prefix}.kind is unsupported`);
    return;
  }
  validateDescriptorKeys(
    source,
    ["kind", "normalization", "path"],
    ["kind", "path"],
    prefix,
    errors
  );
  if (!Object.hasOwn(source, "path")) return;
  if (!Array.isArray(source.path) || source.path.length === 0) {
    errors.push(`${prefix}.path must contain at least one segment`);
    return;
  }
  for (const [segmentIndex, segment] of source.path.entries()) {
    if (typeof segment === "string") {
      if (!isStateIndexText(segment)) {
        errors.push(
          `${prefix}.path[${segmentIndex}] must be a safe non-empty property segment`
        );
      }
      continue;
    }
    if (
      typeof segment !== "object" ||
      segment === null ||
      !Object.hasOwn(segment, "kind") ||
      segment.kind !== "each" ||
      Reflect.ownKeys(segment).length !== 1
    ) {
      errors.push(
        `${prefix}.path[${segmentIndex}] must be a property segment or { kind: "each" }`
      );
    }
    if (segmentIndex === 0 || segmentIndex === source.path.length - 1) {
      errors.push(`${prefix}.path must not start or end with each`);
    }
    if (source.path[segmentIndex - 1]?.kind === "each") {
      errors.push(`${prefix}.path must not contain adjacent each segments`);
    }
  }
  const normalization = Object.hasOwn(source, "normalization")
    ? source.normalization
    : undefined;
  if (normalization !== undefined && normalization !== "instant") {
    errors.push(`${prefix}.normalization must be instant when present`);
  }
  if (normalization === "instant") {
    if (field.mode !== "range")
      errors.push(`${prefix} instant normalization requires range mode`);
    if (source.path.some((segment) => typeof segment !== "string")) {
      errors.push(
        `${prefix} instant normalization requires a single-value path without each`
      );
    }
  }
}

function validateDescriptorKeys(
  value: object,
  allowed: readonly string[],
  required: readonly string[],
  prefix: string,
  errors: string[]
): boolean {
  const unexpected = Reflect.ownKeys(value).filter(
    (key) => typeof key !== "string" || !allowed.includes(key)
  );
  if (unexpected.length > 0) {
    errors.push(
      `${prefix} contains unsupported properties: ${unexpected.map(String).join(", ")}`
    );
  }
  const missing = required.filter((key) => !Object.hasOwn(value, key));
  if (missing.length > 0) {
    errors.push(`${prefix} must define own properties: ${missing.join(", ")}`);
  }
  return missing.length === 0;
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
