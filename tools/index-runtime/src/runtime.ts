import path from "node:path";
import {
  defineStateIndexDefinition,
  expectationOf,
  keyDefinitionsOf,
  sameKeyDefinitions
} from "./definition.ts";
import { diagnostic } from "./diagnostics.ts";
import {
  normalizeStateIndex,
  createProjectionContext,
  projectStateIndexEntry,
  readonlyStateIndexMetadata,
  validateCompleteStateIndex
} from "./projection.ts";
import {
  queryStateIndex,
  stateIndexEntryOf
} from "./query.ts";
import { isPlainRecord } from "./record.ts";
import {
  isStateIndexText,
  stateIndexQueryMaximumLimit
} from "./schemas.ts";
import {
  loadCurrentStateIndex,
  syncStateIndex
} from "./storage.ts";
import type {
  JsonObject,
  StateIndexContext,
  DeepReadonly,
  StateIndexDefinition,
  StateIndexDiagnostic,
  StateIndexEntry,
  StateIndexFilter,
  StateIndex,
  StateIndexQuery,
  StateIndexQueryOutput,
  StateIndexResult,
  StateIndexSort,
  StateIndexSyncMode,
  StateIndexSyncResult,
  StateRecord
} from "./types.ts";
import { validateStateIndexValue } from "./validation.ts";

export type StateIndexQueryOptions<State extends object> = {
  runtimeStates?: StateRecord<State>;
};

export type StateIndexAllQuery = {
  filters?: readonly StateIndexFilter[];
  sort?: readonly StateIndexSort[];
};

export type StateIndexReader<
  State extends object,
  Metadata extends JsonObject = JsonObject
> = {
  all: (
    query?: StateIndexAllQuery,
    options?: StateIndexQueryOptions<State>
  ) => StateIndexResult<StateIndexEntry<State>[]>;
  get: (
    stateId: string,
    options?: StateIndexQueryOptions<State>
  ) => StateIndexResult<StateIndexEntry<State> | null>;
  query: (
    query?: StateIndexQuery,
    options?: StateIndexQueryOptions<State>
  ) => StateIndexResult<StateIndexQueryOutput<State, Metadata>>;
  readonly metadata: DeepReadonly<Metadata>;
};

export type StateIndexRuntime<
  State extends object,
  Metadata extends JsonObject = JsonObject
> = {
  get: (
    stateId: string,
    options?: StateIndexQueryOptions<State>
  ) => Promise<StateIndexResult<StateIndexEntry<State> | null>>;
  open: () => Promise<StateIndexResult<StateIndexReader<State, Metadata>>>;
  query: (
    query?: StateIndexQuery,
    options?: StateIndexQueryOptions<State>
  ) => Promise<StateIndexResult<StateIndexQueryOutput<State, Metadata>>>;
  sync: (mode: StateIndexSyncMode) => Promise<StateIndexSyncResult>;
};

export function createStateIndexRuntime<
  State extends object,
  Metadata extends JsonObject
>(options: {
  definition: StateIndexDefinition<State, Metadata>;
  indexPath: string;
  root: string;
  signal?: AbortSignal;
}): StateIndexRuntime<State, Metadata> {
  const definition = defineStateIndexDefinition(options.definition);
  const context: StateIndexContext = {
    root: path.resolve(options.root),
    ...(options.signal === undefined ? {} : { signal: options.signal })
  };

  async function open(): Promise<
    StateIndexResult<StateIndexReader<State, Metadata>>
  > {
    const loaded = await loadCurrentStateIndex({
      context,
      definition,
      indexPath: options.indexPath
    });
    if (loaded.status === "error") {
      return loaded;
    }
    return {
      diagnostics: [],
      status: "ok",
      value: createStateIndexReaderFromSnapshot({
        definition,
        index: loaded.value,
        indexPath: options.indexPath
      })
    };
  }

  async function query(
    input: StateIndexQuery = {},
    queryOptions: StateIndexQueryOptions<State> = {}
  ): Promise<StateIndexResult<StateIndexQueryOutput<State, Metadata>>> {
    const opened = await open();
    if (opened.status === "error") {
      return opened;
    }
    return opened.value.query(input, queryOptions);
  }

  async function get(
    stateId: string,
    getOptions: StateIndexQueryOptions<State> = {}
  ): Promise<StateIndexResult<StateIndexEntry<State> | null>> {
    const opened = await open();
    if (opened.status === "error") {
      return opened;
    }
    return opened.value.get(stateId, getOptions);
  }

  return Object.freeze({
    get,
    open,
    query,
    sync: (mode) => syncStateIndex({
      context,
      definition,
      indexPath: options.indexPath,
      mode
    })
  });
}

export function createStateIndexReader<
  State extends object,
  Metadata extends JsonObject
>(options: {
  definition: StateIndexDefinition<State, Metadata>;
  index: StateIndex<State, Metadata>;
  indexPath: string;
}): StateIndexReader<State, Metadata> {
  const definition = defineStateIndexDefinition(options.definition);
  const index = createReaderSnapshot({
    definition,
    index: options.index,
    indexPath: options.indexPath
  });
  return createStateIndexReaderFromSnapshot({
    definition,
    index,
    indexPath: options.indexPath
  });
}

function createStateIndexReaderFromSnapshot<
  State extends object,
  Metadata extends JsonObject
>(options: {
  definition: StateIndexDefinition<State, Metadata>;
  index: StateIndex<State, Metadata>;
  indexPath: string;
}): StateIndexReader<State, Metadata> {
  function query(
    input: StateIndexQuery = {},
    queryOptions: StateIndexQueryOptions<State> = {}
  ): StateIndexResult<StateIndexQueryOutput<State, Metadata>> {
    const queried = queryStateIndex({
      definition: options.definition,
      index: options.index,
      query: input,
      runtimeStates: queryOptions.runtimeStates
    });
    return queried.status === "ok"
      ? queried
      : {
        ...queried,
        diagnostics: queried.diagnostics.map((entry) => ({
          ...entry,
          path: entry.path ?? options.indexPath
        }))
      };
  }

  function get(
    stateId: string,
    getOptions: StateIndexQueryOptions<State> = {}
  ): StateIndexResult<StateIndexEntry<State> | null> {
    if (!isStateIndexText(stateId)) {
      return withIndexPath({
        diagnostics: [diagnostic({
          code: "state-index.query-invalid",
          message: "state id must be non-empty text without surrounding whitespace or "
            + "control characters"
        })],
        status: "error",
        value: null
      }, options.indexPath);
    }
    const runtimeStates = getOptions.runtimeStates;
    if (runtimeStates !== undefined && !isPlainRecord(runtimeStates)) {
      return withIndexPath({
        diagnostics: [diagnostic({
          code: "state-index.runtime-states-invalid",
          message: "runtimeStates must be an object keyed by state id"
        })],
        status: "error",
        value: null
      }, options.indexPath);
    }
    if (
      runtimeStates !== undefined
      && Object.hasOwn(runtimeStates, stateId)
    ) {
      const projected = projectStateIndexEntry(
        options.definition,
        runtimeStates[stateId],
        createProjectionContext(stateId, options.index.metadata)
      );
      if (projected.status === "error") {
        return withIndexPath(projected, options.indexPath);
      }
      return {
        diagnostics: [],
        status: "ok",
        value: stateIndexEntryOf(stateId, projected.value)
      };
    }
    const stored = Object.hasOwn(options.index.entries, stateId)
      ? options.index.entries[stateId]
      : undefined;
    return {
      diagnostics: [],
      status: "ok",
      value: stored === undefined ? null : stateIndexEntryOf(stateId, stored)
    };
  }

  function all(
    input: StateIndexAllQuery = {},
    queryOptions: StateIndexQueryOptions<State> = {}
  ): StateIndexResult<StateIndexEntry<State>[]> {
    const entries: StateIndexEntry<State>[] = [];
    let offset = 0;
    while (true) {
      const queried = query({
        filters: input.filters === undefined ? [] : [...input.filters],
        limit: stateIndexQueryMaximumLimit,
        offset,
        ...(input.sort === undefined ? {} : { sort: [...input.sort] })
      }, queryOptions);
      if (queried.status === "error") {
        return queried;
      }
      entries.push(...queried.value.entries);
      offset += queried.value.entries.length;
      if (
        offset >= queried.value.total
        || queried.value.entries.length === 0
      ) {
        return { diagnostics: [], status: "ok", value: entries };
      }
    }
  }

  return Object.freeze({
    all,
    get,
    metadata: readonlyStateIndexMetadata(options.index),
    query
  });
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
}): StateIndex<State, Metadata> {
  const validated = validateStateIndexValue(
    options.index,
    expectationOf(options.definition),
    options.indexPath
  );
  if (validated.index === null) {
    throw invalidReaderError(validated.diagnostics);
  }
  if (!sameKeyDefinitions(
    validated.index.keyDefinitions,
    keyDefinitionsOf(options.definition)
  )) {
    throw invalidReaderError([diagnostic({
      code: "state-index.definition-mismatch",
      message: "index key definitions do not match the runtime definition",
      path: options.indexPath
    })]);
  }
  const normalized = normalizeStateIndex(
    validated.index,
    options.definition,
    options.indexPath
  );
  if (normalized.status === "error") {
    throw invalidReaderError(normalized.diagnostics);
  }
  const complete = validateCompleteStateIndex(
    options.definition,
    normalized.value,
    options.indexPath
  );
  if (complete.status === "error") {
    throw invalidReaderError(complete.diagnostics);
  }
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
