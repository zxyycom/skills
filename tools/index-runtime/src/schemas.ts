import * as v from "valibot";
import { isJsonObject, type JsonObject } from "./json.ts";

export const stateIndexSchemaVersion = 1 as const;
export const stateIndexQueryDefaultLimit = 50;
export const stateIndexQueryMaximumLimit = 1_000;

const namespacePattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const keyNamePattern = /^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*$/u;
const controlCharacterPattern = /[\u0000-\u001f\u007f]/u;

const trimmedNonEmptyStringSchema = v.pipe(
  v.string("must be a string"),
  v.check(
    (value) => value.length > 0 && value.trim() === value,
    "must be non-empty text without surrounding whitespace"
  ),
  v.check(
    (value) => !controlCharacterPattern.test(value),
    "must not contain control characters"
  )
);
const nonNegativeIntegerSchema = v.pipe(
  v.number("must be a number"),
  v.integer("must be an integer"),
  v.safeInteger("must be a safe integer"),
  v.minValue(0, "must not be negative")
);
const positiveIntegerSchema = v.pipe(
  nonNegativeIntegerSchema,
  v.minValue(1, "must be greater than zero")
);

export const stateIndexNamespaceSchema = v.pipe(
  trimmedNonEmptyStringSchema,
  v.regex(namespacePattern, "must be a kebab-case namespace")
);
export const stateIndexKeyNameSchema = v.pipe(
  trimmedNonEmptyStringSchema,
  v.regex(keyNamePattern, "must be a lowercase key name")
);
export const stateIndexIdSchema = trimmedNonEmptyStringSchema;
export const stateIndexRevisionSchema = trimmedNonEmptyStringSchema;
export const stateIndexKeyScalarSchema = v.union([
  v.boolean("must be a boolean, finite number, or string"),
  v.pipe(v.number("must be a boolean, finite number, or string"), v.finite("must be finite")),
  trimmedNonEmptyStringSchema
]);
export const stateIndexRangeScalarSchema = v.union([
  v.pipe(v.number("must be a finite number or string"), v.finite("must be finite")),
  trimmedNonEmptyStringSchema
]);
const jsonObjectSchema = v.custom<JsonObject>(
  isJsonObject,
  "must be a JSON object containing only finite JSON values"
);
const keyMapSchema = v.record(
  stateIndexKeyNameSchema,
  v.pipe(
    v.array(stateIndexKeyScalarSchema, "must be an array of index scalars"),
    v.minLength(1, "must contain at least one value")
  ),
  "must be an object"
);

export const stateIndexKeyDefinitionSchema = v.strictObject({
  mode: v.picklist(["exact", "range", "text"]),
  name: stateIndexKeyNameSchema
});
export const stateIndexEntrySchema = v.strictObject({
  id: stateIndexIdSchema,
  keys: keyMapSchema,
  state: jsonObjectSchema
});
export const stateIndexSchema = v.strictObject({
  definitionVersion: positiveIntegerSchema,
  entries: v.array(stateIndexEntrySchema, "must be an array"),
  keyDefinitions: v.pipe(
    v.array(stateIndexKeyDefinitionSchema, "must be an array"),
    v.minLength(1, "must contain at least one key definition")
  ),
  namespace: stateIndexNamespaceSchema,
  schemaVersion: v.literal(stateIndexSchemaVersion, "must be 1"),
  sourceRevision: stateIndexRevisionSchema
});

const exactFilterSchema = v.strictObject({
  key: stateIndexKeyNameSchema,
  kind: v.literal("exact"),
  operator: v.picklist(["all", "any", "none"]),
  values: v.pipe(
    v.array(stateIndexKeyScalarSchema),
    v.minLength(1, "must contain at least one value")
  )
});
const rangeFilterSchema = v.strictObject({
  key: stateIndexKeyNameSchema,
  kind: v.literal("range"),
  operator: v.picklist(["eq", "gt", "gte", "lt", "lte"]),
  value: stateIndexRangeScalarSchema
});
const textFilterSchema = v.strictObject({
  key: stateIndexKeyNameSchema,
  kind: v.literal("text"),
  operator: v.picklist(["all", "any"]),
  text: trimmedNonEmptyStringSchema
});
const existsFilterSchema = v.strictObject({
  key: stateIndexKeyNameSchema,
  kind: v.literal("exists"),
  value: v.boolean()
});
export const stateIndexFilterSchema = v.variant("kind", [
  exactFilterSchema,
  rangeFilterSchema,
  textFilterSchema,
  existsFilterSchema
]);
export const stateIndexSortSchema = v.strictObject({
  direction: v.picklist(["asc", "desc"]),
  key: stateIndexKeyNameSchema
});
export const stateIndexQuerySchema = v.strictObject({
  filters: v.optional(v.array(stateIndexFilterSchema), []),
  limit: v.optional(v.pipe(
    positiveIntegerSchema,
    v.maxValue(
      stateIndexQueryMaximumLimit,
      `must not exceed ${stateIndexQueryMaximumLimit}`
    )
  ), stateIndexQueryDefaultLimit),
  offset: v.optional(nonNegativeIntegerSchema, 0),
  sort: v.optional(v.pipe(
    v.array(stateIndexSortSchema),
    v.minLength(1, "must contain at least one sort rule")
  ))
});

export type StateIndex = v.InferOutput<typeof stateIndexSchema>;
export type StateIndexEntry = v.InferOutput<typeof stateIndexEntrySchema>;
export type StateIndexFilter = v.InferOutput<typeof stateIndexFilterSchema>;
export type StateIndexKeyDefinition = v.InferOutput<typeof stateIndexKeyDefinitionSchema>;
export type StateIndexKeyMode = StateIndexKeyDefinition["mode"];
export type StateIndexKeyScalar = v.InferOutput<typeof stateIndexKeyScalarSchema>;
export type StateIndexQuery = v.InferInput<typeof stateIndexQuerySchema>;
export type StateIndexQueryValue = v.InferOutput<typeof stateIndexQuerySchema>;
export type StateIndexRangeScalar = v.InferOutput<typeof stateIndexRangeScalarSchema>;
export type StateIndexSort = v.InferOutput<typeof stateIndexSortSchema>;

export function isStateIndexNamespace(value: string): boolean {
  return namespacePattern.test(value);
}

export function isStateIndexKeyName(value: string): boolean {
  return keyNamePattern.test(value);
}

export function isStateIndexText(value: string): boolean {
  return value.length > 0
    && value.trim() === value
    && !controlCharacterPattern.test(value);
}
