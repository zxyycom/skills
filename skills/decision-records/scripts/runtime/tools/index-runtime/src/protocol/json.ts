/*
 * Synced TypeScript runtime; repository maintenance edits tools/index-runtime/src/protocol/json.ts.
 * Installed skill copies may be edited directly; updates overwrite matching files.
 * Repository: https://github.com/zxyycom/skills
 * Source path: tools/index-runtime/src/protocol/json.ts
 * Maintained source: https://github.com/zxyycom/skills/blob/main/tools/index-runtime/src/protocol/json.ts
 * Skill source directory: https://github.com/zxyycom/skills/tree/main/skills/decision-records
 * Rebuild: bun run sync:decision-records-cli
 */
export type JsonPrimitive = boolean | null | number | string;

export type JsonValue =
  | JsonPrimitive
  | JsonValue[]
  | { [key: string]: JsonValue };

export type JsonObject = { [key: string]: JsonValue };

export type ReadonlyJsonValue =
  | JsonPrimitive
  | readonly ReadonlyJsonValue[]
  | ReadonlyJsonObject;

export type ReadonlyJsonObject = {
  readonly [key: string]: ReadonlyJsonValue;
};

export type DeepReadonly<Value> = Value extends JsonPrimitive
  ? Value
  : Value extends readonly unknown[]
    ? { readonly [Key in keyof Value]: DeepReadonly<Value[Key]> }
    : Value extends object
      ? { readonly [Key in keyof Value]: DeepReadonly<Value[Key]> }
      : Value;

export function isJsonValue(value: unknown): value is JsonValue {
  return isJsonValueInternal(value, new Set<object>());
}

export function isJsonObject(value: unknown): value is JsonObject {
  return isJsonObjectInternal(value, new Set<object>());
}

function isJsonValueInternal(
  value: unknown,
  ancestors: Set<object>
): value is JsonValue {
  if (
    value === null ||
    typeof value === "boolean" ||
    typeof value === "string"
  ) {
    return true;
  }
  if (typeof value === "number") {
    return Number.isFinite(value);
  }
  if (Array.isArray(value)) {
    if (ancestors.has(value)) {
      return false;
    }
    ancestors.add(value);
    const valid = value.every((entry) => isJsonValueInternal(entry, ancestors));
    ancestors.delete(value);
    return valid;
  }
  return isJsonObjectInternal(value, ancestors);
}

function isJsonObjectInternal(
  value: unknown,
  ancestors: Set<object>
): value is JsonObject {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    return false;
  }
  if (Object.getOwnPropertySymbols(value).length > 0 || ancestors.has(value)) {
    return false;
  }
  ancestors.add(value);
  const valid = Object.values(value).every((entry) =>
    isJsonValueInternal(entry, ancestors)
  );
  ancestors.delete(value);
  return valid;
}
