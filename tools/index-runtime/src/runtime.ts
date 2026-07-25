import path from "node:path";
import { queryStateIndex } from "./query.ts";
import { readonlyStateIndexMetadata } from "./snapshot.ts";
import { stateIndexQueryMaximumLimit } from "./schemas.ts";
import {
  loadCurrentStateIndex,
  syncStateIndex
} from "./storage.ts";
import type {
  JsonObject,
  StateIndexContext,
  DeepReadonly,
  StateIndexDefinition,
  StateIndexEntry,
  StateIndexFilter,
  StateIndex,
  StateIndexQuery,
  StateIndexQueryOutput,
  StateIndexResult,
  StateIndexSort,
  StateIndexSyncMode,
  StateIndexSyncResult
} from "./types.ts";
import { validateStateIndexDefinition } from "./validation.ts";

export type StateIndexQueryOptions<State extends object> = {
  runtimeStates?: readonly State[];
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
  const errors = validateStateIndexDefinition(options.definition);
  if (errors.length > 0) {
    throw new TypeError(`Invalid state index runtime: ${errors.join("; ")}`);
  }
  const context: StateIndexContext = {
    root: path.resolve(options.root),
    ...(options.signal === undefined ? {} : { signal: options.signal })
  };

  async function open(): Promise<
    StateIndexResult<StateIndexReader<State, Metadata>>
  > {
    const loaded = await loadCurrentStateIndex({
      context,
      definition: options.definition,
      indexPath: options.indexPath
    });
    if (loaded.status === "error") {
      return loaded;
    }
    return {
      diagnostics: [],
      status: "ok",
      value: createStateIndexReader({
        definition: options.definition,
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
      definition: options.definition,
      indexPath: options.indexPath,
      mode
    })
  });
}

function createStateIndexReader<
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
    const queried = query({
      filters: [{
        key: "id",
        kind: "exact",
        operator: "all",
        values: [stateId]
      }],
      limit: 1
    }, getOptions);
    if (queried.status === "error") {
      return queried;
    }
    return {
      diagnostics: [],
      status: "ok",
      value: queried.value.entries[0] ?? null
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
