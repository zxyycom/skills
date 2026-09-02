import type { JsonObject, JsonValue, TaskGraphErrorCode } from "./types.ts";

const retryableCodes = new Set<TaskGraphErrorCode>([
  "INDEX_READ_FAILED",
  "LOCK_TIMEOUT",
  "REVISION_CONFLICT",
  "LEASE_CONFLICT",
  "WRITE_FAILED"
]);

function jsonValue(value: unknown, seen: Set<object>): JsonValue {
  const scalar = scalarJsonValue(value);
  if (scalar.matched) return scalar.value;
  if (value instanceof Date) {
    return Number.isNaN(value.valueOf()) ? "Invalid Date" : value.toISOString();
  }
  if (value instanceof Error) {
    return { name: value.name, message: value.message };
  }
  if (value === null || typeof value !== "object") {
    return null;
  }
  if (seen.has(value)) {
    return "[Circular]";
  }
  seen.add(value);
  if (Array.isArray(value)) {
    const result = value.map((item) => jsonValue(item, seen));
    seen.delete(value);
    return result;
  }
  const result = Object.create(null) as JsonObject;
  for (const [key, item] of Object.entries(value)) {
    result[key] = jsonValue(item, seen);
  }
  seen.delete(value);
  return result;
}

type JsonScalarResult =
  | { matched: false }
  | { matched: true; value: JsonValue };

function scalarJsonValue(value: unknown): JsonScalarResult {
  if (value === null) return { matched: true, value: null };
  switch (typeof value) {
    case "string":
    case "boolean":
      return { matched: true, value };
    case "number":
      return {
        matched: true,
        value: Number.isFinite(value) ? value : String(value)
      };
    case "bigint":
    case "symbol":
    case "function":
      return { matched: true, value: String(value) };
    case "undefined":
      return { matched: true, value: null };
    case "object":
      return { matched: false };
    default:
      return { matched: false };
  }
}

function jsonObject(value: unknown): JsonObject {
  const normalized = jsonValue(value, new Set());
  return typeof normalized === "object" &&
    normalized !== null &&
    !Array.isArray(normalized)
    ? normalized
    : { value: normalized };
}

export class TaskGraphError extends Error {
  readonly code: TaskGraphErrorCode;
  readonly details: JsonObject;
  readonly retryable: boolean;

  constructor(
    code: TaskGraphErrorCode,
    message: string,
    details: unknown = {},
    options?: ErrorOptions
  ) {
    super(message, options);
    this.name = "TaskGraphError";
    this.code = code;
    this.details = jsonObject(details);
    this.retryable = retryableCodes.has(code);
  }
}

export function taskGraphError(
  error: unknown,
  fallbackCode?: TaskGraphErrorCode
): TaskGraphError {
  if (error instanceof TaskGraphError) {
    return error;
  }
  if (fallbackCode === undefined) {
    throw error instanceof Error ? error : new Error(String(error));
  }
  return new TaskGraphError(
    fallbackCode,
    error instanceof Error ? error.message : String(error),
    {},
    error instanceof Error ? { cause: error } : undefined
  );
}
