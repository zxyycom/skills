import { isStateIndexText } from "./schemas.ts";
import type {
  StateIndexQueryField,
  StateIndexQuerySource,
  StateIndexStatePathSegment
} from "./types.ts";

export function validateQuerySource(
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
    if (field.mode !== "exact") errors.push(`${prefix} requires exact mode`);
    return;
  }
  validateStatePathSource(source, field, prefix, errors);
}

function validateStatePathSource(
  source: StateIndexQuerySource,
  field: StateIndexQueryField,
  prefix: string,
  errors: string[]
): void {
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
  source.path.forEach((segment, index) =>
    validateStatePathSegment(segment, source.path, index, prefix, errors)
  );
  validateStatePathNormalization(source, field, prefix, errors);
}

function validateStatePathSegment(
  segment: StateIndexStatePathSegment,
  path: readonly unknown[],
  index: number,
  prefix: string,
  errors: string[]
): void {
  if (typeof segment === "string") {
    if (!isStateIndexText(segment)) {
      errors.push(
        `${prefix}.path[${index}] must be a safe non-empty property segment`
      );
    }
    return;
  }
  if (!isEachSegment(segment)) {
    errors.push(
      `${prefix}.path[${index}] must be a property segment or { kind: "each" }`
    );
  }
  if (index === 0 || index === path.length - 1) {
    errors.push(`${prefix}.path must not start or end with each`);
  }
  if ((path[index - 1] as { kind?: unknown } | undefined)?.kind === "each") {
    errors.push(`${prefix}.path must not contain adjacent each segments`);
  }
}

function validateStatePathNormalization(
  source: Extract<StateIndexQuerySource, { kind: "state-path" }>,
  field: StateIndexQueryField,
  prefix: string,
  errors: string[]
): void {
  const normalization = Object.hasOwn(source, "normalization")
    ? source.normalization
    : undefined;
  if (normalization !== undefined && normalization !== "instant") {
    errors.push(`${prefix}.normalization must be instant when present`);
  }
  if (normalization !== "instant") return;
  if (field.mode !== "range") {
    errors.push(`${prefix} instant normalization requires range mode`);
  }
  if (source.path.some((segment) => typeof segment !== "string")) {
    errors.push(
      `${prefix} instant normalization requires a single-value path without each`
    );
  }
}

export function validateDescriptorKeys(
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

function isEachSegment(segment: unknown): boolean {
  return (
    typeof segment === "object" &&
    segment !== null &&
    Object.hasOwn(segment, "kind") &&
    (segment as { kind?: unknown }).kind === "each" &&
    Reflect.ownKeys(segment).length === 1
  );
}
