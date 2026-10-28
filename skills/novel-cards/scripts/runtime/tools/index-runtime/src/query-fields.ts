/*
 * Synced TypeScript runtime; repository maintenance edits tools/index-runtime/src/query-fields.ts.
 * Installed skill copies may be edited directly; updates overwrite matching files.
 * Repository: https://github.com/zxyycom/skills
 * Source path: tools/index-runtime/src/query-fields.ts
 * Maintained source: https://github.com/zxyycom/skills/blob/main/tools/index-runtime/src/query-fields.ts
 * Skill source directory: https://github.com/zxyycom/skills/tree/main/skills/novel-cards
 * Rebuild: bun run sync:novel-cards-cli
 */
import { types as utilTypes } from "node:util";
import { failure } from "./diagnostics.ts";
import {
  cloneAndFreezeTypedJsonObject,
  cloneWithDataProof,
  freezeObject
} from "./frozen-json.ts";
import { isJsonObject } from "./json.ts";
import {
  freezeStateIndexKeyMap,
  normalizeStateIndexKeyValues
} from "./key-values.ts";
import { isStateIndexText } from "./schemas.ts";
import type {
  JsonObject,
  StateIndex,
  StateIndexDefinition,
  StateIndexEntry,
  StateIndexKeyScalar,
  StateIndexQueryField,
  StateIndexQuerySource,
  StateIndexResult
} from "./types.ts";

export type MaterializedStateIndexEntry<State extends object> =
  StateIndexEntry<State> & {
    readonly queryValues: Readonly<
      Record<string, readonly StateIndexKeyScalar[]>
    >;
  };

export function materializeStateIndexEntry<
  State extends object,
  Metadata extends JsonObject
>(
  definition: StateIndexDefinition<State, Metadata>,
  id: string,
  state: State
): StateIndexResult<MaterializedStateIndexEntry<State>> {
  return materializeEntry(definition, id, state);
}

/** The clone and its proof are created and consumed within this one projection. */
export function materializeClonedStateIndexEntry<
  State extends object,
  Metadata extends JsonObject
>(
  definition: StateIndexDefinition<State, Metadata>,
  id: string,
  state: State
): StateIndexResult<MaterializedStateIndexEntry<State>> {
  if (!hasRepeatedStaticRootSources(definition))
    return materializeEntry(
      definition,
      id,
      cloneAndFreezeTypedJsonObject(state, false)
    );
  const clone = cloneWithDataProof(state);
  return materializeEntry(
    definition,
    id,
    clone.value,
    clone.dataOnly ? { root: clone.value, valid: false } : undefined
  );
}

function hasRepeatedStaticRootSources(definition: object): boolean {
  try {
    const fields = staticQueryFields(definition);
    return fields !== null && hasRepeatedRootSources(fields);
  } catch {
    // Unknown descriptor representations retain the original path.
    return false;
  }
}

function staticQueryFields(definition: object): readonly unknown[] | null {
  if (utilTypes.isProxy(definition)) {
    return null;
  }
  if (!Object.isFrozen(definition)) {
    return null;
  }
  const descriptor = Object.getOwnPropertyDescriptor(definition, "queryFields");
  if (descriptor === undefined) {
    return null;
  }
  if (!("value" in descriptor)) {
    return null;
  }
  if (!Array.isArray(descriptor.value)) {
    return null;
  }
  if (utilTypes.isProxy(descriptor.value)) {
    return null;
  }
  if (descriptor.value.length < 2) {
    return null;
  }
  if (!isStaticData(descriptor.value)) {
    return null;
  }
  return descriptor.value;
}

function hasRepeatedRootSources(fields: readonly unknown[]): boolean {
  let sources = 0;
  for (const field of fields) {
    if (!hasSourceList(field)) return false;
    for (const source of field.sources) {
      if (!hasSourceKind(source)) return false;
      if (readsRootState(source) && ++sources >= 2) return true;
    }
  }
  return false;
}

function hasSourceList(
  field: unknown
): field is { sources: readonly unknown[] } {
  return (
    field !== null &&
    typeof field === "object" &&
    Object.hasOwn(field, "sources") &&
    Array.isArray(Reflect.get(field, "sources"))
  );
}

function hasSourceKind(
  source: unknown
): source is { kind: unknown; path?: unknown } {
  return (
    source !== null &&
    typeof source === "object" &&
    Object.hasOwn(source, "kind")
  );
}

function readsRootState(source: { kind: unknown; path?: unknown }): boolean {
  return (
    source.kind === "state-path" &&
    Object.hasOwn(source, "path") &&
    Array.isArray(source.path) &&
    typeof source.path[0] === "string"
  );
}

function isStaticData(value: unknown, ancestors = new Set<object>()): boolean {
  if (value === null || typeof value !== "object")
    return typeof value !== "function";
  if (
    utilTypes.isProxy(value) ||
    !Object.isFrozen(value) ||
    ancestors.has(value)
  )
    return false;
  const array = Array.isArray(value);
  const prototype = Object.getPrototypeOf(value);
  if (
    array
      ? prototype !== Array.prototype
      : prototype !== Object.prototype && prototype !== null
  )
    return false;
  const keys = Reflect.ownKeys(value);
  if (array && keys.length !== value.length + 1) return false;
  if (array)
    for (let index = 0; index < value.length; index += 1)
      if (!Object.hasOwn(value, String(index))) return false;
  ancestors.add(value);
  for (const key of keys) {
    if (typeof key === "symbol") return false;
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (
      descriptor === undefined ||
      !("value" in descriptor) ||
      !isStaticData(descriptor.value, ancestors)
    )
      return false;
  }
  ancestors.delete(value);
  return true;
}

function materializeEntry<State extends object, Metadata extends JsonObject>(
  definition: StateIndexDefinition<State, Metadata>,
  id: string,
  state: State,
  proof?: { root: object; valid: boolean }
): StateIndexResult<MaterializedStateIndexEntry<State>> {
  const values: Record<string, StateIndexKeyScalar[]> = {};
  for (const field of definition.queryFields) {
    const fieldValues: StateIndexKeyScalar[] = [];
    for (const source of field.sources) {
      const extracted = extractSource(id, state, field, source, proof);
      if (extracted.status === "error") return extracted;
      fieldValues.push(...extracted.value);
    }
    const normalized = normalizeStateIndexKeyValues(fieldValues, field.mode);
    if (normalized.status === "error") {
      return sourceFailure(
        id,
        field,
        field.sources.map(describeSource).join(" + "),
        normalized.message
      );
    }
    if (normalized.values.length > 0) values[field.name] = normalized.values;
  }
  return {
    diagnostics: [],
    status: "ok",
    value: freezeObject({
      id,
      queryValues: freezeStateIndexKeyMap(values),
      state
    })
  };
}

function extractSource<State extends object>(
  id: string,
  state: State,
  field: StateIndexQueryField,
  source: StateIndexQuerySource,
  proof: { root: object; valid: boolean } | undefined
): StateIndexResult<StateIndexKeyScalar[]> {
  if (source.kind === "entry-id") {
    return { diagnostics: [], status: "ok", value: [id] };
  }
  if (source.kind === "source-path-first-segment") {
    if (!Object.hasOwn(state, "sourcePath")) {
      return { diagnostics: [], status: "ok", value: [] };
    }
    const sourcePath = Reflect.get(state, "sourcePath");
    if (typeof sourcePath !== "string" || !isRelativePosixPath(sourcePath)) {
      return sourceFailure(
        id,
        field,
        describeSource(source),
        "state.sourcePath must be a normalized relative POSIX path"
      );
    }
    return {
      diagnostics: [],
      status: "ok",
      value: [sourcePath.split("/")[0]!]
    };
  }

  let values: unknown[] = [state];
  for (const segment of source.path) {
    const next: unknown[] = [];
    if (typeof segment === "string") {
      for (const value of values) {
        if (!isProvenOrJsonObject(value, proof)) {
          return sourceFailure(
            id,
            field,
            describeSource(source),
            `cannot read property ${JSON.stringify(segment)} from a non-object container`
          );
        }
        if (proof !== undefined && value === proof.root) proof.valid = true;
        if (Object.hasOwn(value, segment)) next.push(value[segment]);
      }
    } else {
      for (const value of values) {
        if (!Array.isArray(value)) {
          return sourceFailure(
            id,
            field,
            describeSource(source),
            "each requires an array container"
          );
        }
        next.push(...value);
      }
    }
    values = next;
  }

  if (source.normalization === "instant") {
    if (values.length === 0)
      return { diagnostics: [], status: "ok", value: [] };
    if (values.length !== 1 || typeof values[0] !== "string") {
      return sourceFailure(
        id,
        field,
        describeSource(source),
        "instant normalization requires exactly one time string"
      );
    }
    const timestamp = Date.parse(values[0]);
    if (!Number.isFinite(timestamp)) {
      return sourceFailure(
        id,
        field,
        describeSource(source),
        `instant normalization cannot parse ${JSON.stringify(values[0])}`
      );
    }
    return { diagnostics: [], status: "ok", value: [timestamp] };
  }

  const flattened = values.flatMap((value) =>
    Array.isArray(value) ? value : [value]
  );
  const normalized = normalizeStateIndexKeyValues(flattened, field.mode);
  return normalized.status === "ok"
    ? { diagnostics: [], status: "ok", value: normalized.values }
    : sourceFailure(id, field, describeSource(source), normalized.message);
}

function isProvenOrJsonObject(
  value: unknown,
  proof: { root: object; valid: boolean } | undefined
): value is JsonObject {
  return (
    (proof?.valid === true &&
      value !== null &&
      typeof value === "object" &&
      !Array.isArray(value)) ||
    isJsonObject(value)
  );
}

function sourceFailure(
  id: string,
  field: StateIndexQueryField,
  source: string,
  detail: string
): StateIndexResult<never> {
  return failure(
    "state-index.query-field-source-invalid",
    `query field ${field.name} source ${source}: ${detail}`,
    { stateId: id }
  );
}

function describeSource(source: StateIndexQuerySource): string {
  if (source.kind === "entry-id") return "entry-id";
  if (source.kind === "source-path-first-segment") {
    return "source-path-first-segment(state.sourcePath)";
  }
  const path = source.path
    .map((segment) => (typeof segment === "string" ? segment : "[each]"))
    .join(".");
  return `state-path(${path}${source.normalization === "instant" ? ", instant" : ""})`;
}

function isRelativePosixPath(value: string): boolean {
  if (
    !isStateIndexText(value) ||
    value.startsWith("/") ||
    value.includes("\\")
  ) {
    return false;
  }
  const segments = value.split("/");
  return segments.every(
    (segment) => segment.length > 0 && segment !== "." && segment !== ".."
  );
}

/** Rebind already verified field values to the equivalent canonical state objects. */
export function bindMaterializedEntries<
  State extends object,
  Metadata extends JsonObject
>(
  index: StateIndex<State, Metadata>,
  entries: readonly MaterializedStateIndexEntry<State>[]
): readonly MaterializedStateIndexEntry<State>[] {
  const byId = new Map(entries.map((entry) => [entry.id, entry.queryValues]));
  return Object.freeze(
    Object.entries(index.entries).map(([id, state]) => {
      const queryValues = byId.get(id);
      if (queryValues === undefined)
        throw new TypeError("missing materialized entry proof");
      return Object.freeze({ id, queryValues, state });
    })
  );
}
