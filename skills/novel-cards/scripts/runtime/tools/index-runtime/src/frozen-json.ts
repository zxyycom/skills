/*
 * Synced TypeScript runtime; repository maintenance edits tools/index-runtime/src/frozen-json.ts.
 * Installed skill copies may be edited directly; updates overwrite matching files.
 * Repository: https://github.com/zxyycom/skills
 * Source path: tools/index-runtime/src/frozen-json.ts
 * Maintained source: https://github.com/zxyycom/skills/blob/main/tools/index-runtime/src/frozen-json.ts
 * Skill source directory: https://github.com/zxyycom/skills/tree/main/skills/novel-cards
 * Rebuild: bun run sync:novel-cards-cli
 */
import { types as utilTypes } from "node:util";
import {
  isJsonObject,
  type DeepReadonly,
  type JsonObject,
  type JsonValue
} from "./json.ts";
import { compareIndexText } from "./ordering.ts";
import type { ReadonlyStateIndex, StateIndex } from "./types.ts";

export function canonicalizeTypedJsonObject<Value extends object>(
  value: Value
): Value {
  return cloneAndFreezeTypedJsonObject(value, true);
}

export function cloneAndFreezeTypedJsonObject<Value extends object>(
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

/**
 * Clone with an operation-local data proof. This must preserve the value and
 * input access order of cloneAndFreezeTypedJsonObject(value, false).
 */
export function cloneWithDataProof<Value extends object>(
  value: Value
): { value: Value; dataOnly: boolean } {
  if (!isJsonObject(value)) {
    throw new TypeError(
      "value must be a JSON object containing only finite JSON values"
    );
  }
  const proven = new WeakSet<object>();
  const isProven = (child: unknown): boolean =>
    child === null ||
    typeof child === "string" ||
    typeof child === "boolean" ||
    (typeof child === "number" && Number.isFinite(child)) ||
    (typeof child === "object" && proven.has(child));

  const cloneValue = (child: JsonValue): JsonValue => {
    if (Array.isArray(child)) {
      // Preserve the original map call, including caller-provided overrides.
      const array = freezeObject(child.map((entry) => cloneValue(entry)));
      if (isProvenDataArray(array, isProven)) proven.add(array);
      return array;
    }
    if (child !== null && typeof child === "object") return cloneObject(child);
    return child;
  };
  const cloneObject = (input: JsonObject): JsonObject => {
    let dataOnly = true;
    const entries = Object.entries(input).map(([key, child]) => {
      const cloned = cloneValue(child);
      if (!isProven(cloned)) dataOnly = false;
      return [key, cloned] as const;
    });
    const result = freezeObject(Object.fromEntries(entries));
    if (dataOnly) proven.add(result);
    return result;
  };
  const cloned = cloneObject(value as JsonObject) as Value;
  return { value: cloned, dataOnly: proven.has(cloned) };
}

function isProvenDataArray(
  value: unknown,
  isProven: (child: unknown) => boolean
): value is JsonValue[] {
  if (
    !Array.isArray(value) ||
    utilTypes.isProxy(value) ||
    Object.getPrototypeOf(value) !== Array.prototype ||
    Reflect.ownKeys(value).length !== value.length + 1
  )
    return false;
  for (let index = 0; index < value.length; index += 1) {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
    if (
      descriptor === undefined ||
      !("value" in descriptor) ||
      !isProven(descriptor.value)
    )
      return false;
  }
  return true;
}

export function freezeObject<Value extends object>(value: Value): Value {
  Object.freeze(value);
  return value;
}

export function deeplyReadonlyFrozenValue<Value>(
  value: Value
): DeepReadonly<Value> {
  if (!isDeeplyFrozen(value)) {
    throw new TypeError("internal normalized value must be recursively frozen");
  }
  return value as DeepReadonly<Value>;
}

export function readonlyFrozenStateIndex<
  State extends object,
  Metadata extends JsonObject
>(index: StateIndex<State, Metadata>): ReadonlyStateIndex<State, Metadata> {
  if (!isDeeplyFrozen(index)) {
    throw new TypeError("complete state index must be recursively frozen");
  }
  // Recursive freezing proves the mutable generic shape is safe to expose
  // through its recursively readonly view; TypeScript cannot derive that
  // relationship for an unconstrained generic object.
  return index as unknown as ReadonlyStateIndex<State, Metadata>;
}

function cloneAndFreezeJsonObject(
  value: JsonObject,
  sortKeys: boolean
): JsonObject {
  const entries = Object.entries(value);
  if (sortKeys) {
    entries.sort(([left], [right]) => compareIndexText(left, right));
  }
  return freezeObject(
    Object.fromEntries(
      entries.map(([key, child]) => [
        key,
        cloneAndFreezeJsonValue(child, sortKeys)
      ])
    )
  );
}

function cloneAndFreezeJsonValue(
  value: JsonValue,
  sortKeys: boolean
): JsonValue {
  if (Array.isArray(value)) {
    return freezeObject(
      value.map((entry) => cloneAndFreezeJsonValue(entry, sortKeys))
    );
  }
  if (value !== null && typeof value === "object") {
    return cloneAndFreezeJsonObject(value, sortKeys);
  }
  return value;
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
  return Reflect.ownKeys(value).every((key) =>
    isDeeplyFrozen(Reflect.get(value, key), seen)
  );
}
