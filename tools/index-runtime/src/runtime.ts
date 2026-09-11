import path from "node:path";
import { defineStateIndexDefinition } from "./definition.ts";
import { createStateIndexReaderFromSnapshot } from "./reader.ts";
import { loadCurrentStateIndex, syncStateIndex } from "./storage.ts";
import {
  stageSelectedIndexEntries,
  type StateIndexEntrySelectionResolver
} from "./staging.ts";
import type {
  DeepReadonly,
  JsonObject,
  StateIndexContext,
  StateIndexDefinition,
  StateIndexEntry,
  StateIndexEntryStageResult,
  StateIndexFilter,
  StateIndexQuery,
  StateIndexQueryOutput,
  StateIndexResult,
  StateIndexSort,
  StateIndexSyncMode,
  StateIndexSyncScope,
  StateIndexSyncResult,
  StateRecord
} from "./types.ts";

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
  stageSelectedEntries: (
    selectedIds: readonly string[]
  ) => Promise<StateIndexEntryStageResult>;
  sync: (
    mode: StateIndexSyncMode,
    scope?: StateIndexSyncScope
  ) => Promise<StateIndexSyncResult>;
};

export function createStateIndexRuntime<
  State extends object,
  Metadata extends JsonObject
>(options: {
  definition: StateIndexDefinition<State, Metadata>;
  indexPath: string;
  resolveSelectedIds?: StateIndexEntrySelectionResolver<State, Metadata>;
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
    if (loaded.status === "error") return loaded;
    return createStateIndexReaderFromSnapshot({
      definition,
      index: loaded.value,
      indexPath: options.indexPath
    });
  }
  async function query(
    input: StateIndexQuery = {},
    queryOptions: StateIndexQueryOptions<State> = {}
  ): Promise<StateIndexResult<StateIndexQueryOutput<State, Metadata>>> {
    const opened = await open();
    return opened.status === "error"
      ? opened
      : opened.value.query(input, queryOptions);
  }
  async function get(
    stateId: string,
    getOptions: StateIndexQueryOptions<State> = {}
  ): Promise<StateIndexResult<StateIndexEntry<State> | null>> {
    const opened = await open();
    return opened.status === "error"
      ? opened
      : opened.value.get(stateId, getOptions);
  }
  return Object.freeze({
    get,
    open,
    query,
    stageSelectedEntries: (selectedIds) =>
      stageSelectedIndexEntries({
        context,
        definition,
        indexPath: options.indexPath,
        resolveSelectedIds: options.resolveSelectedIds,
        selectedIds
      }),
    sync: (mode, scope) =>
      syncStateIndex({
        context,
        definition,
        indexPath: options.indexPath,
        mode,
        ...(scope === undefined ? {} : { scope })
      })
  });
}

export { createStateIndexReader } from "./reader.ts";
