import * as v from "valibot";
import {
  expectationOf,
  queryFieldDefinitionsOf,
  validateStateIndexDefinition
} from "./definition.ts";
import { diagnostic, failure, formatValibotIssue } from "./diagnostics.ts";
import {
  createProjectionContext,
  normalizeStateIndex,
  projectStateIndexState,
  readonlyStateIndexMetadata,
  validateCompleteStateIndex
} from "./projection.ts";
import { isPlainRecord } from "./record.ts";
import { isStateIndexText, stateIndexQuerySchema } from "./schemas.ts";
import { scalarIdentity } from "./key-values.ts";
import { matchesFilter } from "./query-matching.ts";
import {
  compareEntries,
  effectiveSort,
  validateSortCardinality
} from "./query-sorting.ts";
import {
  materializeStateIndexEntry,
  type MaterializedStateIndexEntry
} from "./query-fields.ts";
import type {
  JsonObject,
  StateIndex,
  StateIndexDefinition,
  StateIndexDiagnostic,
  StateIndexEntry,
  StateIndexQuery,
  StateIndexQueryFieldDefinition,
  StateIndexQueryOutput,
  StateIndexQueryValue,
  StateIndexResult,
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
}): StateIndexResult<StateIndexQueryOutput<State, Metadata>> {
  const prepared = prepareStrictIndex(
    options.definition,
    options.index,
    "<memory>"
  );
  if (prepared.status === "error") return prepared;
  const materialized = materializeEffectiveEntries({
    definition: options.definition,
    index: prepared.value,
    runtimeStates: options.runtimeStates
  });
  if (materialized.status === "error") return materialized;
  return queryMaterializedStateIndex({
    definition: options.definition,
    entries: materialized.value,
    index: prepared.value,
    query: options.query
  });
}

export function findStateIndexEntry<
  State extends object,
  Metadata extends JsonObject
>(options: {
  definition: StateIndexDefinition<State, Metadata>;
  index: StateIndex<State, Metadata>;
  stateId: string;
}): StateIndexResult<StateIndexEntry<State> | null> {
  if (!isStateIndexText(options.stateId)) {
    return failure(
      "state-index.query-invalid",
      "state id must be non-empty text without surrounding whitespace or control characters"
    );
  }
  const prepared = prepareStrictIndex(
    options.definition,
    options.index,
    "<memory>"
  );
  if (prepared.status === "error") return prepared;
  const state = Object.hasOwn(prepared.value.entries, options.stateId)
    ? prepared.value.entries[options.stateId]
    : undefined;
  return {
    diagnostics: [],
    status: "ok",
    value:
      state === undefined ? null : stateIndexEntryOf(options.stateId, state)
  };
}

export function queryMaterializedStateIndex<
  State extends object,
  Metadata extends JsonObject
>(options: {
  definition: StateIndexDefinition<State, Metadata>;
  entries: MaterializedStateIndexEntry<State>[];
  index: StateIndex<State, Metadata>;
  query?: StateIndexQuery;
}): StateIndexResult<StateIndexQueryOutput<State, Metadata>> {
  const parsedQuery = validateStateIndexQueryValue(options.query ?? {});
  if (parsedQuery.query === null) {
    return {
      diagnostics: parsedQuery.diagnostics,
      status: "error",
      value: null
    };
  }
  const query = normalizeQuery(parsedQuery.query);
  const semanticDiagnostics = validateQuerySemantics(
    query,
    queryFieldDefinitionsOf(options.definition)
  );
  if (semanticDiagnostics.length > 0) {
    return { diagnostics: semanticDiagnostics, status: "error", value: null };
  }
  const entries = options.entries.filter((entry) =>
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
      entries: entries
        .slice(query.offset, query.offset + query.limit)
        .map((entry) => stateIndexEntryOf(entry.id, entry.state)),
      limit: query.limit,
      metadata: readonlyStateIndexMetadata(options.index),
      offset: query.offset,
      total
    }
  };
}

export function materializeEffectiveEntries<
  State extends object,
  Metadata extends JsonObject
>(options: {
  definition: StateIndexDefinition<State, Metadata>;
  index: StateIndex<State, Metadata>;
  runtimeStates?: StateRecord<State>;
  staticEntries?: readonly MaterializedStateIndexEntry<State>[];
}): StateIndexResult<MaterializedStateIndexEntry<State>[]> {
  if (
    options.runtimeStates !== undefined &&
    !isPlainRecord(options.runtimeStates)
  ) {
    return failure(
      "state-index.runtime-states-invalid",
      "runtimeStates must be an object keyed by state id"
    );
  }
  const byId = new Map<string, MaterializedStateIndexEntry<State>>();
  if (options.staticEntries === undefined) {
    for (const [id, state] of Object.entries(options.index.entries)) {
      const materialized = materializeStateIndexEntry(
        options.definition,
        id,
        state
      );
      if (materialized.status === "error") return materialized;
      byId.set(id, materialized.value);
    }
  } else {
    for (const entry of options.staticEntries) byId.set(entry.id, entry);
  }
  for (const [id, input] of Object.entries(options.runtimeStates ?? {})) {
    const projected = projectStateIndexState(
      options.definition,
      input,
      createProjectionContext(id, options.index.metadata)
    );
    if (projected.status === "error") return projected;
    const materialized = materializeStateIndexEntry(
      options.definition,
      id,
      projected.value
    );
    if (materialized.status === "error") return materialized;
    byId.set(id, materialized.value);
  }
  return { diagnostics: [], status: "ok", value: [...byId.values()] };
}

export function stateIndexEntryOf<State extends object>(
  id: string,
  state: State
): StateIndexEntry<State> {
  return Object.freeze({ id, state });
}

function prepareStrictIndex<State extends object, Metadata extends JsonObject>(
  definition: StateIndexDefinition<State, Metadata>,
  index: StateIndex<State, Metadata>,
  sourcePath: string
): StateIndexResult<StateIndex<State, Metadata>> {
  const definitionErrors = validateStateIndexDefinition(definition);
  if (definitionErrors.length > 0) {
    return failure(
      "state-index.definition-invalid",
      definitionErrors.join("; ")
    );
  }
  const validated = validateStateIndexValue(
    index,
    expectationOf(definition),
    sourcePath
  );
  if (validated.index === null) {
    return { diagnostics: validated.diagnostics, status: "error", value: null };
  }
  const normalized = normalizeStateIndex(
    validated.index,
    definition,
    sourcePath
  );
  if (normalized.status === "error") return normalized;
  return validateCompleteStateIndex(definition, normalized.value, sourcePath);
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
  definitions: ReadonlyMap<string, StateIndexQueryFieldDefinition>
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
  definitions: readonly StateIndexQueryFieldDefinition[]
): StateIndexDiagnostic[] {
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
