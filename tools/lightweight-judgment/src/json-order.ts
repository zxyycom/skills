import type { JsonValue, JsonObject } from "./json.ts";

const keyOrders = new WeakMap<object, readonly string[]>();

export function orderedKeys(value: object): readonly string[] {
  return keyOrders.get(value) ?? Object.keys(value);
}

export function preserveKeyOrder(value: object, keys: readonly string[]): void {
  keyOrders.set(value, [...keys]);
}

export function stringifyJson(value: JsonValue): string {
  if (jsonArray(value)) {
    return `[${value.map(stringifyJson).join(",")}]`;
  }
  if (value !== null && typeof value === "object") {
    const object: JsonObject = value;
    return (
      "{" +
      orderedKeys(object)
        .filter((key) => object[key] !== undefined)
        .map((key) => JSON.stringify(key) + ":" + stringifyJson(object[key]))
        .join(",") +
      "}"
    );
  }
  return JSON.stringify(value);
}

// Array.isArray does not narrow readonly arrays out of the object branch.
function jsonArray(value: JsonValue): value is readonly JsonValue[] {
  return Array.isArray(value);
}
