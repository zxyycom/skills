import * as v from "valibot";
import {
  expectationOf,
  keyDefinitionsOf,
  sameKeyDefinitions,
  validateStateIndexDefinition
} from "./definition.ts";
import { canonicalizeStateIndex } from "./canonicalization.ts";
import { diagnostic, failure, formatValibotIssue } from "./diagnostics.ts";
import {
  createProjectionContext,
  projectStateIndexEntry,
  readonlyStateIndexMetadata
} from "./projection.ts";
import { compareIndexText, compareStateIndexKeyScalars } from "./ordering.ts";
import { isPlainRecord } from "./record.ts";
import { isStateIndexText, stateIndexQuerySchema } from "./schemas.ts";
import { scalarIdentity } from "./key-values.ts";
import type {
  JsonObject,
  StateIndex,
  StateIndexDefinition,
  StateIndexDiagnostic,
  StateIndexEntry,
  StateIndexFilter,
  StateIndexKeyDefinition,
  StateIndexKeyScalar,
  StateIndexQuery,
  StateIndexQueryOutput,
  StateIndexQueryValue,
  StateIndexResult,
  StateIndexSort,
  StateRecord
} from "./types.ts";
import { validateStateIndexValue } from "./validation.ts";

export function queryStateIndex<
  State extends object,
  Metadata extends JsonObject
>(options: {
  definition: StateIndexDefinition<State, Metadata>;
  index: StateIndex<State, Metadata>;
  query?: StateIndexQuery;
  runtimeStates?: StateRecord<State>;
}): StateIndexResult<StateIndexQueryOutput<State, Metadata>>;
export function queryStateIndex(options: {
  definition?: undefined;
  index: StateIndex;
  query?: StateIndexQuery;
  runtimeStates?: undefined;
}): StateIndexResult<StateIndexQueryOutput>;
export function queryStateIndex<
  State extends object,
  Metadata extends JsonObject
>(options: {
  definition?: StateIndexDefinition<State, Metadata>;
  index: StateIndex<State, Metadata>;
  query?: StateIndexQuery;
  runtimeStates?: StateRecord<State>;
}): StateIndexResult<
  StateIndexQueryOutput | StateIndexQueryOutput<State, Metadata>
> {
  const validatedIndex = validateStateIndexValue(
    options.index,
    null,
    "<memory>"
  );
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

  const query = normalizeQuery(parsedQuery.query);
  if (options.definition === undefined) {
    const normalizedIndex = canonicalizeStateIndex(validatedIndex.index);
    return queryValidatedStateIndex(
      normalizedIndex,
      query,
      rawEntries(normalizedIndex)
    );
  }
  const normalized = canonicalizeStateIndex<State, Metadata>(
    options.index,
    options.definition
  );
  return queryValidatedStateIndex(
    normalized,
    query,
    effectiveEntries({
      definition: options.definition,
      index: normalized,
      runtimeStates: options.runtimeStates
    })
  );
}

export function findStateIndexEntry(
  index: StateIndex,
  stateId: string
): StateIndexResult<StateIndexEntry | null> {
  if (!isStateIndexText(stateId)) {
    return failure(
      "state-index.query-invalid",
      "state id must be non-empty text without surrounding whitespace or control characters"
    );
  }
  const validated = validateStateIndexValue(index, null, "<memory>");
  if (validated.index === null) {
    return { diagnostics: validated.diagnostics, status: "error", value: null };
  }
  const entry = Object.hasOwn(validated.index.entries, stateId)
    ? validated.index.entries[stateId]
    : undefined;
  return {
    diagnostics: [],
    status: "ok",
    value: entry === undefined ? null : stateIndexEntryOf(stateId, entry)
  };
}

function queryValidatedStateIndex<
  State extends object,
  Metadata extends JsonObject
>(
  index: StateIndex<State, Metadata>,
  query: StateIndexQueryValue,
  entriesResult: StateIndexResult<StateIndexEntry<State>[]>
): StateIndexResult<StateIndexQueryOutput<State, Metadata>> {
  if (entriesResult.status === "error") {
    return entriesResult;
  }
  const semanticDiagnostics = validateQuerySemantics(
    query,
    index.keyDefinitions
  );
  if (semanticDiagnostics.length > 0) {
    return { diagnostics: semanticDiagnostics, status: "error", value: null };
  }

  const entries = entriesResult.value.filter((entry) =>
    query.filters.every((filter) => matchesFilter(entry, filter))
  );
  const sort = effectiveSort(query);
  const sortDiagnostics = validateSortCardinality(entries, sort);
  if (sortDiagnostics.length > 0) {
    return { diagnostics: sortDiagnostics, status: "error", value: null };
  }
  entries.sort((left, right) => compareEntries(left, right, sort));
  const total = entries.length;
  return {
    diagnostics: [],
    status: "ok",
    value: {
      entries: entries.slice(query.offset, query.offset + query.limit),
      limit: query.limit,
      metadata: readonlyStateIndexMetadata(index),
      offset: query.offset,
      total
    }
  };
}

function rawEntries(index: StateIndex): StateIndexResult<StateIndexEntry[]> {
  return {
    diagnostics: [],
    status: "ok",
    value: Object.entries(index.entries).map(([id, entry]) =>
      stateIndexEntryOf(id, entry)
    )
  };
}

function effectiveEntries<
  State extends object,
  Metadata extends JsonObject
>(options: {
  definition: StateIndexDefinition<State, Metadata>;
  index: StateIndex<State, Metadata>;
  runtimeStates: StateRecord<State> | undefined;
}): StateIndexResult<StateIndexEntry<State>[]> {
  const definitionErrors = validateStateIndexDefinition(options.definition);
  if (definitionErrors.length > 0) {
    return failure(
      "state-index.definition-invalid",
      definitionErrors.join("; ")
    );
  }
  if (
    options.index.namespace !== options.definition.namespace ||
    options.index.definitionVersion !== options.definition.definitionVersion
  ) {
    const expectation = expectationOf(options.definition);
    return failure(
      "state-index.definition-mismatch",
      `index ${options.index.namespace}@${options.index.definitionVersion} does not match ` +
        `${expectation.namespace}@${expectation.definitionVersion}`
    );
  }
  if (
    !sameKeyDefinitions(
      options.index.keyDefinitions,
      keyDefinitionsOf(options.definition)
    )
  ) {
    return failure(
      "state-index.definition-mismatch",
      "index key definitions do not match the runtime definition"
    );
  }

  const byId = new Map<string, StateIndexEntry<State>>();
  for (const [id, entry] of Object.entries(options.index.entries)) {
    byId.set(id, stateIndexEntryOf(id, entry));
  }

  if (
    options.runtimeStates !== undefined &&
    !isPlainRecord(options.runtimeStates)
  ) {
    return failure(
      "state-index.runtime-states-invalid",
      "runtimeStates must be an object keyed by state id"
    );
  }
  for (const [id, state] of Object.entries(options.runtimeStates ?? {})) {
    const projected = projectStateIndexEntry(
      options.definition,
      state,
      createProjectionContext(id, options.index.metadata)
    );
    if (projected.status === "error") {
      return projected;
    }
    byId.set(id, stateIndexEntryOf(id, projected.value));
  }
  return { diagnostics: [], status: "ok", value: [...byId.values()] };
}

export function stateIndexEntryOf<State extends object>(
  id: string,
  entry: Omit<StateIndexEntry<State>, "id">
): StateIndexEntry<State> {
  return Object.freeze({ id, keys: entry.keys, state: entry.state });
}

type StateIndexQueryFilter = StateIndexQueryValue["filters"][number];

function validateIdFilter(
  filter: StateIndexQueryFilter
): StateIndexDiagnostic | null {
  if (filter.kind !== "exact" && filter.kind !== "exists") {
    return diagnostic({
      code: "state-index.query-key-mode-mismatch",
      message: `reserved id key does not support ${filter.kind} filters`
    });
  }
  if (
    filter.kind === "exact" &&
    filter.values.some((value) => typeof value !== "string")
  ) {
    return diagnostic({
      code: "state-index.query-key-value-invalid",
      message: "reserved id key only accepts string values"
    });
  }
  return null;
}

function validateDeclaredFilter(
  filter: StateIndexQueryFilter,
  definitions: ReadonlyMap<string, StateIndexKeyDefinition>
): StateIndexDiagnostic | null {
  const definition = definitions.get(filter.key);
  if (definition === undefined) {
    return diagnostic({
      code: "state-index.query-key-unknown",
      message: `query references undeclared key ${filter.key}`
    });
  }
  if (filter.kind !== "exists" && filter.kind !== definition.mode) {
    return diagnostic({
      code: "state-index.query-key-mode-mismatch",
      message: `key ${filter.key} uses ${definition.mode} mode, not ${filter.kind}`
    });
  }
  return null;
}

function validateQuerySemantics(
  query: StateIndexQueryValue,
  definitions: readonly StateIndexKeyDefinition[]
): ReturnType<typeof diagnostic>[] {
  const byName = new Map(
    definitions.map((definition) => [definition.name, definition])
  );
  const diagnostics = query.filters.flatMap((filter) => {
    const issue =
      filter.key === "id"
        ? validateIdFilter(filter)
        : validateDeclaredFilter(filter, byName);
    return issue === null ? [] : [issue];
  });
  for (const sort of query.sort ?? []) {
    if (sort.key !== "id" && !byName.has(sort.key)) {
      diagnostics.push(
        diagnostic({
          code: "state-index.query-key-unknown",
          message: `sort references undeclared key ${sort.key}`
        })
      );
    }
  }
  return diagnostics;
}

function normalizeQuery(query: StateIndexQueryValue): StateIndexQueryValue {
  return {
    ...query,
    filters: query.filters.map((filter) =>
      filter.kind === "exact"
        ? {
            ...filter,
            values: [
              ...new Map(
                filter.values.map((value) => [scalarIdentity(value), value])
              ).values()
            ]
          }
        : filter
    ),
    sort: query.sort
  };
}

function validateStateIndexQueryValue(input: unknown): {
  diagnostics: StateIndexDiagnostic[];
  query: StateIndexQueryValue | null;
} {
  const parsed = v.safeParse(stateIndexQuerySchema, input);
  if (!parsed.success) {
    return {
      diagnostics: parsed.issues.map((issue) =>
        diagnostic({
          code: "state-index.query-invalid",
          message: formatValibotIssue(issue)
        })
      ),
      query: null
    };
  }
  const sortKeys = parsed.output.sort?.map((entry) => entry.key) ?? [];
  if (new Set(sortKeys).size !== sortKeys.length) {
    return {
      diagnostics: [
        diagnostic({
          code: "state-index.query-invalid",
          message: "sort rules must not repeat a key"
        })
      ],
      query: null
    };
  }
  return { diagnostics: [], query: parsed.output };
}

function matchesFilter(
  entry: StateIndexEntry<object>,
  filter: StateIndexFilter
): boolean {
  const actual =
    filter.key === "id" ? [entry.id] : (entry.keys[filter.key] ?? []);
  if (filter.kind === "exists") {
    return actual.length > 0 === filter.value;
  }
  if (filter.kind === "exact") {
    const identities = new Set(actual.map(scalarIdentity));
    switch (filter.operator) {
      case "all":
        return filter.values.every((value) =>
          identities.has(scalarIdentity(value))
        );
      case "any":
        return filter.values.some((value) =>
          identities.has(scalarIdentity(value))
        );
      case "none":
        return filter.values.every(
          (value) => !identities.has(scalarIdentity(value))
        );
    }
  }
  if (filter.kind === "range") {
    return actual.some((value) =>
      matchesRange(value, filter.operator, filter.value)
    );
  }
  const terms = unique(
    normalizeText(filter.text).split(/\s+/u).filter(Boolean)
  );
  const candidates = actual
    .filter((value): value is string => typeof value === "string")
    .map(normalizeText);
  return filter.operator === "all"
    ? terms.every((term) =>
        candidates.some((candidate) => candidate.includes(term))
      )
    : terms.some((term) =>
        candidates.some((candidate) => candidate.includes(term))
      );
}

function compareRangeScalar(
  actual: StateIndexKeyScalar,
  expected: number | string
): number | null {
  if (typeof actual !== typeof expected || typeof actual === "boolean") {
    return null;
  }
  return typeof actual === "number" && typeof expected === "number"
    ? actual - expected
    : compareIndexText(String(actual), String(expected));
}

function matchesComparison(
  comparison: number,
  operator: "eq" | "gt" | "gte" | "lt" | "lte"
): boolean {
  const predicates = {
    eq: (value: number) => value === 0,
    gt: (value: number) => value > 0,
    gte: (value: number) => value >= 0,
    lt: (value: number) => value < 0,
    lte: (value: number) => value <= 0
  };
  return predicates[operator](comparison);
}

function matchesRange(
  actual: StateIndexKeyScalar,
  operator: "eq" | "gt" | "gte" | "lt" | "lte",
  expected: number | string
): boolean {
  const comparison = compareRangeScalar(actual, expected);
  return comparison !== null && matchesComparison(comparison, operator);
}

function effectiveSort(query: StateIndexQueryValue): StateIndexSort[] {
  return query.sort === undefined
    ? [{ direction: "asc", key: "id" }]
    : [...query.sort];
}

function validateSortCardinality(
  entries: readonly StateIndexEntry<object>[],
  sorts: readonly StateIndexSort[]
): ReturnType<typeof diagnostic>[] {
  for (const sort of sorts) {
    if (sort.key === "id") {
      continue;
    }
    const multivalued = entries.find(
      (entry) => (entry.keys[sort.key]?.length ?? 0) > 1
    );
    if (multivalued !== undefined) {
      return [
        diagnostic({
          code: "state-index.sort-key-multivalued",
          message: `key ${sort.key} has multiple values for state ${multivalued.id}`,
          stateId: multivalued.id
        })
      ];
    }
  }
  return [];
}

function compareEntries(
  left: StateIndexEntry<object>,
  right: StateIndexEntry<object>,
  sorts: readonly StateIndexSort[]
): number {
  for (const sort of sorts) {
    const leftValue = sort.key === "id" ? left.id : left.keys[sort.key]?.[0];
    const rightValue = sort.key === "id" ? right.id : right.keys[sort.key]?.[0];
    const comparison = compareOptionalScalars(
      leftValue,
      rightValue,
      sort.direction
    );
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
  const comparison = compareStateIndexKeyScalars(left, right);
  return direction === "desc" ? -comparison : comparison;
}

function normalizeText(value: string): string {
  return value.normalize("NFKC").toLowerCase();
}

function unique<Value>(values: readonly Value[]): Value[] {
  return [...new Set(values)];
}
