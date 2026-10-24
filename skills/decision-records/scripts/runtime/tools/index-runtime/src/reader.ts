/*
 * Synced TypeScript runtime; repository maintenance edits tools/index-runtime/src/reader.ts.
 * Installed skill copies may be edited directly; updates overwrite matching files.
 * Repository: https://github.com/zxyycom/skills
 * Source path: tools/index-runtime/src/reader.ts
 * Maintained source: https://github.com/zxyycom/skills/blob/main/tools/index-runtime/src/reader.ts
 * Skill source directory: https://github.com/zxyycom/skills/tree/main/skills/decision-records
 * Rebuild: bun run sync:decision-records-cli
 */
import {
  consumePreparedStateIndex,
  type PreparedStateIndex
} from "./prepared.ts";
import {
  createProjectionContext,
  normalizeStateIndex,
  projectStateIndexState,
  readonlyStateIndexMetadata,
  validateCompleteStateIndex
} from "./projection.ts";
import {
  materializeEffectiveEntries,
  queryMaterializedStateIndex,
  stateIndexEntryOf
} from "./query.ts";
import {
  bindMaterializedEntries,
  type MaterializedStateIndexEntry
} from "./query-fields.ts";
import { isPlainRecord } from "./record.ts";
import { isStateIndexText, stateIndexQueryMaximumLimit } from "./schemas.ts";
import type {
  JsonObject,
  StateIndex,
  StateIndexContext,
  StateIndexDefinition,
  StateIndexDiagnostic,
  StateIndexEntry,
  StateIndexQuery,
  StateIndexQueryOutput,
  StateIndexResult,
  StateRecord
} from "./types.ts";
import { defineStateIndexDefinition, expectationOf } from "./definition.ts";
import { diagnostic } from "./diagnostics.ts";
import { readonlyFrozenStateIndex } from "./frozen-json.ts";
import { validateStateIndexValue } from "./validation.ts";
import type {
  StateIndexAllQuery,
  StateIndexQueryOptions,
  StateIndexReader
} from "./runtime.ts";

export function createStateIndexReader<
  State extends object,
  Metadata extends JsonObject
>(options: {
  definition: StateIndexDefinition<State, Metadata>;
  index: StateIndex<State, Metadata>;
  indexPath: string;
}): StateIndexReader<State, Metadata> {
  const definition = defineStateIndexDefinition(options.definition);
  const materializedEntries: MaterializedStateIndexEntry<State>[] = [];
  const index = createReaderSnapshot({
    definition,
    index: options.index,
    indexPath: options.indexPath,
    materializedEntries
  });
  const created = createReaderWithEntries({
    definition,
    index,
    indexPath: options.indexPath,
    entries: bindMaterializedEntries(index, materializedEntries)
  });
  if (created.status === "error") throw invalidReaderError(created.diagnostics);
  return created.value;
}

export function createStateIndexReaderFromPrepared<
  State extends object,
  Metadata extends JsonObject
>(options: {
  context: StateIndexContext;
  definition: StateIndexDefinition<State, Metadata>;
  prepared: PreparedStateIndex<State, Metadata>;
  indexPath: string;
}): StateIndexResult<StateIndexReader<State, Metadata>> {
  const entries = consumePreparedStateIndex(options);
  if (entries.status === "error") return entries;
  return createReaderWithEntries({
    ...options,
    definition: defineStateIndexDefinition(options.definition),
    index: options.prepared.index,
    entries: entries.value
  });
}

function createReaderWithEntries<
  State extends object,
  Metadata extends JsonObject
>(options: {
  definition: StateIndexDefinition<State, Metadata>;
  index: StateIndex<State, Metadata>;
  indexPath: string;
  entries: readonly MaterializedStateIndexEntry<State>[];
}): StateIndexResult<StateIndexReader<State, Metadata>> {
  const cachedEntries = options.entries;

  function getError(
    code: "state-index.query-invalid" | "state-index.runtime-states-invalid",
    message: string
  ): StateIndexResult<StateIndexEntry<State> | null> {
    return withIndexPath(
      {
        diagnostics: [diagnostic({ code, message })],
        status: "error",
        value: null
      },
      options.indexPath
    );
  }
  function effectiveEntries(
    runtimeStates?: StateRecord<State>
  ): StateIndexResult<readonly MaterializedStateIndexEntry<State>[]> {
    return materializeEffectiveEntries({
      definition: options.definition,
      index: options.index,
      runtimeStates,
      staticEntries: cachedEntries
    });
  }
  function query(
    input: StateIndexQuery = {},
    queryOptions: StateIndexQueryOptions<State> = {}
  ): StateIndexResult<StateIndexQueryOutput<State, Metadata>> {
    const entries = effectiveEntries(queryOptions.runtimeStates);
    if (entries.status === "error") {
      return {
        diagnostics: entries.diagnostics.map((entry) => ({
          ...entry,
          path: entry.path ?? options.indexPath
        })),
        status: "error",
        value: null
      };
    }
    const queried = queryMaterializedStateIndex({
      definition: options.definition,
      entries: entries.value,
      index: options.index,
      query: input
    });
    return withIndexPath(queried, options.indexPath);
  }
  function get(
    stateId: string,
    getOptions: StateIndexQueryOptions<State> = {}
  ): StateIndexResult<StateIndexEntry<State> | null> {
    if (!isStateIndexText(stateId)) {
      return getError(
        "state-index.query-invalid",
        "state id must be non-empty text without surrounding whitespace or control characters"
      );
    }
    const runtimeStates = getOptions.runtimeStates;
    if (runtimeStates !== undefined && !isPlainRecord(runtimeStates)) {
      return getError(
        "state-index.runtime-states-invalid",
        "runtimeStates must be an object keyed by state id"
      );
    }
    if (runtimeStates !== undefined && Object.hasOwn(runtimeStates, stateId)) {
      const projected = projectStateIndexState(
        options.definition,
        runtimeStates[stateId],
        createProjectionContext(stateId, options.index.metadata)
      );
      if (projected.status === "error")
        return withIndexPath(projected, options.indexPath);
      return {
        diagnostics: [],
        status: "ok",
        value: stateIndexEntryOf(stateId, projected.value)
      };
    }
    const state = Object.hasOwn(options.index.entries, stateId)
      ? options.index.entries[stateId]
      : undefined;
    return {
      diagnostics: [],
      status: "ok",
      value: state === undefined ? null : stateIndexEntryOf(stateId, state)
    };
  }
  function all(
    input: StateIndexAllQuery = {},
    queryOptions: StateIndexQueryOptions<State> = {}
  ): StateIndexResult<StateIndexEntry<State>[]> {
    const entries: StateIndexEntry<State>[] = [];
    let offset = 0;
    while (true) {
      const queried = query(
        {
          filters: input.filters === undefined ? [] : [...input.filters],
          limit: stateIndexQueryMaximumLimit,
          offset,
          ...(input.sort === undefined ? {} : { sort: [...input.sort] })
        },
        queryOptions
      );
      if (queried.status === "error") return queried;
      entries.push(...queried.value.entries);
      offset += queried.value.entries.length;
      if (offset >= queried.value.total || queried.value.entries.length === 0) {
        return { diagnostics: [], status: "ok", value: entries };
      }
    }
  }
  return {
    diagnostics: [],
    status: "ok",
    value: Object.freeze({
      all,
      get,
      index: readonlyFrozenStateIndex(options.index),
      metadata: readonlyStateIndexMetadata(options.index),
      query
    })
  };
}

function withIndexPath<Value>(
  result: StateIndexResult<Value>,
  indexPath: string
): StateIndexResult<Value> {
  return result.status === "ok"
    ? result
    : {
        ...result,
        diagnostics: result.diagnostics.map((entry) => ({
          ...entry,
          path: entry.path ?? indexPath
        }))
      };
}

function createReaderSnapshot<
  State extends object,
  Metadata extends JsonObject
>(options: {
  definition: StateIndexDefinition<State, Metadata>;
  index: StateIndex<State, Metadata>;
  indexPath: string;
  materializedEntries: MaterializedStateIndexEntry<State>[];
}): StateIndex<State, Metadata> {
  const validated = validateStateIndexValue(
    options.index,
    expectationOf(options.definition),
    options.indexPath
  );
  if (validated.index === null) throw invalidReaderError(validated.diagnostics);
  const normalized = normalizeStateIndex(
    validated.index,
    options.definition,
    options.indexPath,
    options.materializedEntries
  );
  if (normalized.status === "error")
    throw invalidReaderError(normalized.diagnostics);
  const complete = validateCompleteStateIndex(
    options.definition,
    normalized.value,
    options.indexPath
  );
  if (complete.status === "error")
    throw invalidReaderError(complete.diagnostics);
  return complete.value;
}

function invalidReaderError(
  diagnostics: readonly StateIndexDiagnostic[]
): TypeError {
  const details = diagnostics
    .map((entry) => `${entry.code}: ${entry.message}`)
    .join("; ");
  return new TypeError(`Invalid state index reader: ${details}`);
}
