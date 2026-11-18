import { createHash } from "node:crypto";
import { fail } from "./errors.ts";

export function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value !== null && typeof value === "object") {
    const entries: [string, unknown][] = Object.entries(value);
    return `{${entries
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, entry]) => `${JSON.stringify(key)}:${canonical(entry)}`)
      .join(",")}}`;
  }
  // JSON.parse can overflow a JSON number to Infinity. It is invalid for every
  // field but must not fingerprint as null and replay a different request.
  if (typeof value === "number" && !Number.isFinite(value))
    return String(value);
  return JSON.stringify(value) ?? fail("cannot fingerprint non-JSON data");
}

export function hash(value: unknown): string {
  return createHash("sha256").update(canonical(value)).digest("hex");
}
