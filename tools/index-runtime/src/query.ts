import { compareIndexText } from "./ordering.ts";
import {
  expectationOf,
  keyDefinitionsOf,
  projectStateIndexEntry
} from "./snapshot.ts";
import type {
  JsonObject,
  StateIndex,
  StateIndexDefinition,
  StateIndexEntry,
  StateIndexFilter,
  StateIndexKeyDefinition,
  StateIndexKeyScalar,
  StateIndexQuery,
  StateIndexQueryOutput,
  StateIndexQueryValue,
  StateIndexResult,
  StateIndexSort
} from "./types.ts";
import {
  diagnostic,
  scalarIdentity,
  validateStateIndexDefinition,
  validateStateIndexQueryValue,
  validateStateIndexValue
} from "./validation.ts";

export function queryStateIndex<State extends JsonObject>(options: {
  definition: StateIndexDefinition<State>;
  index: StateIndex;
  query?: StateIndexQuery;
  runtimeStates?: readonly State[];
}): StateIndexResult<StateIndexQueryOutput<State>>;
export function queryStateIndex(options: {
  definition?: undefined;
  index: StateIndex;
  query?: StateIndexQuery;
  runtimeStates?: undefined;
}): StateIndexResult<StateIndexQueryOutput>;
export function queryStateIndex<State extends JsonObject>(options: {
  definition?: StateIndexDefinition<State>;
  index: StateIndex;
  query?: StateIndexQuery;
  runtimeStates?: readonly State[];
}): StateIndexResult<StateIndexQueryOutput> {
  const validatedIndex = validateStateIndexValue(options.index, null, "<memory>");
  if (validatedIndex.index === null) {
    return {
      diagnostics: validatedIndex.diagnostics,
      status: "error",
      value: null
    };
  }
  const parsedQuery = validateStateIndexQueryValue(options.query ?? {});
  if (parsedQuery.query === null) {
    return {
      diagnostics: parsedQuery.diagnostics,
      status: "error",
      value: null
    };
  }

  const index = validatedIndex.index;
  const query = normalizeQuery(parsedQuery.query);
  const entriesResult = options.definition === undefined
    ? rawEntries(index, options.runtimeStates)
    : effectiveEntries({
      definition: options.definition,
      index,
      runtimeStates: options.runtimeStates
    });
  if (entriesResult.status === "error") {
    return entriesResult;
  }
  const semanticDiagnostics = validateQuerySemantics(query, index.keyDefinitions);
  if (semanticDiagnostics.length > 0) {
    return { diagnostics: semanticDiagnostics, status: "error", value: null };
  }

  const entries = entriesResult.value
    .filter((entry) => query.filters.every((filter) => matchesFilter(entry, filter)));
  const sortDiagnostics = validateSortCardinality(entries, effectiveSort(query));
  if (sortDiagnostics.length > 0) {
    return { diagnostics: sortDiagnostics, status: "error", value: null };
  }
  entries.sort((left, right) => compareEntries(left, right, effectiveSort(query)));
  const total = entries.length;
  return {
    diagnostics: [],
    status: "ok",
    value: {
      entries: entries.slice(query.offset, query.offset + query.limit),
      limit: query.limit,
      offset: query.offset,
      total
    }
  };
}

export function findStateIndexEntry(
  index: StateIndex,
  stateId: string
): StateIndexResult<StateIndexEntry | null> {
  const queried = queryStateIndex({
    index,
    query: {
      filters: [{
        key: "id",
        kind: "exact",
        operator: "all",
        values: [stateId]
      }],
      limit: 1
    }
  });
  if (queried.status === "error") {
    return queried;
  }
  return {
    diagnostics: [],
    status: "ok",
    value: queried.value.entries[0] ?? null
  };
}

function rawEntries(
  index: StateIndex,
  runtimeStates: readonly JsonObject[] | undefined
): StateIndexResult<StateIndexEntry[]> {
  if (runtimeStates !== undefined && runtimeStates.length > 0) {
    return failure(
      "state-index.runtime-definition-required",
      "definition is required when runtimeStates are provided"
    );
  }
  return { diagnostics: [], status: "ok", value: [...index.entries] };
}

function effectiveEntries<State extends JsonObject>(options: {
  definition: StateIndexDefinition<State>;
  index: StateIndex;
  runtimeStates: readonly State[] | undefined;
}): StateIndexResult<StateIndexEntry<State>[]> {
  const definitionErrors = validateStateIndexDefinition(options.definition);
  if (definitionErrors.length > 0) {
    return failure(
      "state-index.definition-invalid",
      definitionErrors.join("; ")
    );
  }
  if (
    options.index.namespace !== options.definition.namespace
    || options.index.definitionVersion !== options.definition.definitionVersion
  ) {
    const expectation = expectationOf(options.definition);
    return failure(
      "state-index.definition-mismatch",
      `index ${options.index.namespace}@${options.index.definitionVersion} does not match `
      + `${expectation.namespace}@${expectation.definitionVersion}`
    );
  }
  if (!sameKeyDefinitions(options.index.keyDefinitions, keyDefinitionsOf(options.definition))) {
    return failure(
      "state-index.definition-mismatch",
      "index key definitions do not match the runtime definition"
    );
  }

  const byId = new Map<string, StateIndexEntry<State>>();
  for (const entry of options.index.entries) {
    const projected = projectStateIndexEntry(options.definition, entry.state);
    if (projected.status === "error") {
      return {
        diagnostics: projected.diagnostics.map((entryDiagnostic) => ({
          ...entryDiagnostic,
          stateId: entryDiagnostic.stateId ?? entry.id
        })),
        status: "error",
        value: null
      };
    }
    if (
      projected.value.id !== entry.id
      || !sameKeyMaps(projected.value.keys, entry.keys)
    ) {
      return failure(
        "state-index.definition-mismatch",
        `stored state ${entry.id} does not match its id and keys under the runtime definition`,
        entry.id
      );
    }
    byId.set(entry.id, projected.value);
  }

  const runtimeIds = new Set<string>();
  for (const state of options.runtimeStates ?? []) {
    const projected = projectStateIndexEntry(options.definition, state);
    if (projected.status === "error") {
      return projected;
    }
    if (runtimeIds.has(projected.value.id)) {
      return failure(
        "state-index.runtime-id-duplicate",
        `runtime state id ${projected.value.id} appears more than once`,
        projected.value.id
      );
    }
    runtimeIds.add(projected.value.id);
    byId.set(projected.value.id, projected.value);
  }
  return { diagnostics: [], status: "ok", value: [...byId.values()] };
}

function validateQuerySemantics(
  query: StateIndexQueryValue,
  definitions: readonly StateIndexKeyDefinition[]
): ReturnType<typeof diagnostic>[] {
  const byName = new Map(definitions.map((definition) => [definition.name, definition]));
  const diagnostics = [];
  for (const filter of query.filters) {
    if (filter.key === "id") {
      if (filter.kind !== "exact" && filter.kind !== "exists") {
        diagnostics.push(diagnostic({
          code: "state-index.query-key-mode-mismatch",
          message: `reserved id key does not support ${filter.kind} filters`
        }));
      } else if (
        filter.kind === "exact"
        && filter.values.some((value) => typeof value !== "string")
      ) {
        diagnostics.push(diagnostic({
          code: "state-index.query-key-value-invalid",
          message: "reserved id key only accepts string values"
        }));
      }
      continue;
    }
    const definition = byName.get(filter.key);
    if (definition === undefined) {
      diagnostics.push(diagnostic({
        code: "state-index.query-key-unknown",
        message: `query references undeclared key ${filter.key}`
      }));
      continue;
    }
    if (filter.kind !== "exists" && filter.kind !== definition.mode) {
      diagnostics.push(diagnostic({
        code: "state-index.query-key-mode-mismatch",
        message: `key ${filter.key} uses ${definition.mode} mode, not ${filter.kind}`
      }));
    }
  }
  for (const sort of query.sort ?? []) {
    if (sort.key !== "id" && !byName.has(sort.key)) {
      diagnostics.push(diagnostic({
        code: "state-index.query-key-unknown",
        message: `sort references undeclared key ${sort.key}`
      }));
    }
  }
  return diagnostics;
}

function normalizeQuery(query: StateIndexQueryValue): StateIndexQueryValue {
  return {
    ...query,
    filters: query.filters.map((filter) => filter.kind === "exact"
      ? {
        ...filter,
        values: [...new Map(filter.values.map((value) => (
          [scalarIdentity(value), value]
        ))).values()]
      }
      : filter),
    sort: query.sort
  };
}

function matchesFilter(entry: StateIndexEntry, filter: StateIndexFilter): boolean {
  const actual = filter.key === "id" ? [entry.id] : (entry.keys[filter.key] ?? []);
  if (filter.kind === "exists") {
    return (actual.length > 0) === filter.value;
  }
  if (filter.kind === "exact") {
    const identities = new Set(actual.map(scalarIdentity));
    switch (filter.operator) {
      case "all":
        return filter.values.every((value) => identities.has(scalarIdentity(value)));
      case "any":
        return filter.values.some((value) => identities.has(scalarIdentity(value)));
      case "none":
        return filter.values.every((value) => !identities.has(scalarIdentity(value)));
    }
  }
  if (filter.kind === "range") {
    return actual.some((value) => matchesRange(value, filter.operator, filter.value));
  }
  const terms = unique(normalizeText(filter.text).split(/\s+/u).filter(Boolean));
  const candidates = actual
    .filter((value): value is string => typeof value === "string")
    .map(normalizeText);
  return filter.operator === "all"
    ? terms.every((term) => candidates.some((candidate) => candidate.includes(term)))
    : terms.some((term) => candidates.some((candidate) => candidate.includes(term)));
}

function matchesRange(
  actual: StateIndexKeyScalar,
  operator: "eq" | "gt" | "gte" | "lt" | "lte",
  expected: number | string
): boolean {
  if (typeof actual !== typeof expected || typeof actual === "boolean") {
    return false;
  }
  const comparison = typeof actual === "number" && typeof expected === "number"
    ? actual - expected
    : compareIndexText(String(actual), String(expected));
  switch (operator) {
    case "eq": return comparison === 0;
    case "gt": return comparison > 0;
    case "gte": return comparison >= 0;
    case "lt": return comparison < 0;
    case "lte": return comparison <= 0;
  }
}

function effectiveSort(query: StateIndexQueryValue): StateIndexSort[] {
  return query.sort === undefined
    ? [{ direction: "asc", key: "id" }]
    : [...query.sort];
}

function validateSortCardinality(
  entries: readonly StateIndexEntry[],
  sorts: readonly StateIndexSort[]
): ReturnType<typeof diagnostic>[] {
  for (const sort of sorts) {
    if (sort.key === "id") {
      continue;
    }
    const multivalued = entries.find((entry) => (entry.keys[sort.key]?.length ?? 0) > 1);
    if (multivalued !== undefined) {
      return [diagnostic({
        code: "state-index.sort-key-multivalued",
        message: `key ${sort.key} has multiple values for state ${multivalued.id}`,
        stateId: multivalued.id
      })];
    }
  }
  return [];
}

function compareEntries(
  left: StateIndexEntry,
  right: StateIndexEntry,
  sorts: readonly StateIndexSort[]
): number {
  for (const sort of sorts) {
    const leftValue = sort.key === "id" ? left.id : left.keys[sort.key]?.[0];
    const rightValue = sort.key === "id" ? right.id : right.keys[sort.key]?.[0];
    const comparison = compareOptionalScalars(leftValue, rightValue, sort.direction);
    if (comparison !== 0) {
      return comparison;
    }
  }
  return compareIndexText(left.id, right.id);
}

function compareOptionalScalars(
  left: StateIndexKeyScalar | undefined,
  right: StateIndexKeyScalar | undefined,
  direction: "asc" | "desc"
): number {
  if (left === undefined) {
    return right === undefined ? 0 : 1;
  }
  if (right === undefined) {
    return -1;
  }
  const comparison = compareScalars(left, right);
  return direction === "desc" ? -comparison : comparison;
}

function compareScalars(left: StateIndexKeyScalar, right: StateIndexKeyScalar): number {
  if (typeof left === typeof right) {
    if (typeof left === "number" && typeof right === "number") {
      return left - right;
    }
    if (typeof left === "boolean" && typeof right === "boolean") {
      return Number(left) - Number(right);
    }
    return compareIndexText(String(left), String(right));
  }
  return scalarTypeOrder(left) - scalarTypeOrder(right);
}

function scalarTypeOrder(value: StateIndexKeyScalar): number {
  switch (typeof value) {
    case "boolean": return 0;
    case "number": return 1;
    case "string": return 2;
  }
}

function sameKeyDefinitions(
  left: readonly StateIndexKeyDefinition[],
  right: readonly StateIndexKeyDefinition[]
): boolean {
  return left.length === right.length && left.every((entry, index) => (
    entry.name === right[index]?.name && entry.mode === right[index]?.mode
  ));
}

function sameKeyMaps(
  left: StateIndexEntry["keys"],
  right: StateIndexEntry["keys"]
): boolean {
  const leftNames = Object.keys(left).sort(compareIndexText);
  const rightNames = Object.keys(right).sort(compareIndexText);
  return leftNames.length === rightNames.length
    && leftNames.every((name, index) => {
      if (name !== rightNames[index]) {
        return false;
      }
      const leftValues = left[name] ?? [];
      const rightValues = right[name] ?? [];
      return leftValues.length === rightValues.length
        && leftValues.every((value, valueIndex) => (
          scalarIdentity(value) === scalarIdentity(rightValues[valueIndex]!)
        ));
    });
}

function normalizeText(value: string): string {
  return value.normalize("NFKC").toLowerCase();
}

function unique<Value>(values: readonly Value[]): Value[] {
  return [...new Set(values)];
}

function failure<Value = never>(
  code: string,
  message: string,
  stateId: string | null = null
): StateIndexResult<Value> {
  return {
    diagnostics: [diagnostic({ code, message, stateId })],
    status: "error",
    value: null
  };
}
