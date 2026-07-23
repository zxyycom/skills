import path from "node:path";
import { queryStateIndex } from "./query.ts";
import {
  loadCurrentStateIndex,
  syncStateIndex
} from "./storage.ts";
import type {
  JsonObject,
  StateIndexContext,
  StateIndexDefinition,
  StateIndexEntry,
  StateIndexQuery,
  StateIndexQueryOutput,
  StateIndexResult,
  StateIndexSyncMode,
  StateIndexSyncResult
} from "./types.ts";
import { validateStateIndexDefinition } from "./validation.ts";

export type StateIndexRuntime<State extends JsonObject> = {
  get: (
    stateId: string,
    options?: { runtimeStates?: readonly State[] }
  ) => Promise<StateIndexResult<StateIndexEntry<State> | null>>;
  query: (
    query?: StateIndexQuery,
    options?: { runtimeStates?: readonly State[] }
  ) => Promise<StateIndexResult<StateIndexQueryOutput<State>>>;
  sync: (mode: StateIndexSyncMode) => Promise<StateIndexSyncResult>;
};

export function createStateIndexRuntime<State extends JsonObject>(options: {
  definition: StateIndexDefinition<State>;
  indexPath: string;
  root: string;
  signal?: AbortSignal;
}): StateIndexRuntime<State> {
  const errors = validateStateIndexDefinition(options.definition);
  if (errors.length > 0) {
    throw new TypeError(`Invalid state index runtime: ${errors.join("; ")}`);
  }
  const context: StateIndexContext = {
    root: path.resolve(options.root),
    ...(options.signal === undefined ? {} : { signal: options.signal })
  };

  async function query(
    input: StateIndexQuery = {},
    queryOptions: { runtimeStates?: readonly State[] } = {}
  ): Promise<StateIndexResult<StateIndexQueryOutput<State>>> {
    const loaded = await loadCurrentStateIndex({
      context,
      definition: options.definition,
      indexPath: options.indexPath
    });
    if (loaded.status === "error") {
      return loaded;
    }
    const queried = queryStateIndex({
      definition: options.definition,
      index: loaded.value,
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

  async function get(
    stateId: string,
    getOptions: { runtimeStates?: readonly State[] } = {}
  ): Promise<StateIndexResult<StateIndexEntry<State> | null>> {
    const queried = await query({
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

  return Object.freeze({
    get,
    query,
    sync: (mode) => syncStateIndex({
      context,
      definition: options.definition,
      indexPath: options.indexPath,
      mode
    })
  });
}
