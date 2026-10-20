/*
 * Synced TypeScript runtime; repository maintenance edits tools/lightweight-judgment/src/json-order.ts.
 * Installed skill copies may be edited directly; updates overwrite matching files.
 * Repository: https://github.com/zxyycom/skills
 * Source path: tools/lightweight-judgment/src/json-order.ts
 * Maintained source: https://github.com/zxyycom/skills/blob/main/tools/lightweight-judgment/src/json-order.ts
 * Skill source directory: https://github.com/zxyycom/skills/tree/main/skills/lightweight-judgment
 * Rebuild: bun run sync:lightweight-judgment-cli
 */
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
