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
