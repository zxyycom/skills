/*
 * Synced TypeScript runtime; repository maintenance edits tools/index-runtime/src/prepared/prepared.ts.
 * Installed skill copies may be edited directly; updates overwrite matching files.
 * Repository: https://github.com/zxyycom/skills
 * Source path: tools/index-runtime/src/prepared/prepared.ts
 * Maintained source: https://github.com/zxyycom/skills/blob/main/tools/index-runtime/src/prepared/prepared.ts
 * Skill source directory: https://github.com/zxyycom/skills/tree/main/skills/investigation-report
 * Rebuild: bun run sync:investigation-report-check
 */
import path from "node:path";
import {
  preparationDefinition,
  sameDefinition
} from "./prepared-definition.ts";
import { failure } from "../diagnostics.ts";
import {
  resolveIndexPath,
  type ResolvedIndexPath
} from "../storage/index-path.ts";
import {
  bindMaterializedEntries,
  type MaterializedStateIndexEntry
} from "../query/query-fields.ts";
import {
  buildStateIndex,
  buildStateIndexFromSnapshot
} from "../snapshot/snapshot-builder.ts";
import {
  parseStateIndex,
  serializeStateIndex
} from "../snapshot/snapshot-parser.ts";
import {
  loadCurrentStateIndex,
  loadStateIndex
} from "../storage/storage-load.ts";
import { normalizeIndexLineEndings } from "../storage/storage-shared.ts";
import { readBaselineSource } from "./prepared-baseline-source.ts";
import type {
  JsonObject,
  StateIndex,
  StateIndexContext,
  StateIndexDefinition,
  StateIndexExpectation,
  StateIndexResult
} from "../types.ts";

const preparationAuthority = Symbol("state-index-preparation");

type PreparationOptions<
  State extends object,
  Metadata extends JsonObject
> = Readonly<{
  context: StateIndexContext;
  definition: StateIndexDefinition<State, Metadata>;
  indexPath: string;
}>;

/** Operation-local evidence, not a cache and never a substitute for a fresh revision read. */
class PreparedIndex<State extends object, Metadata extends JsonObject> {
  readonly index: StateIndex<State, Metadata>;
  readonly #definition: StateIndexDefinition<State, Metadata>;
  readonly #fixedDefinition: StateIndexDefinition<State, Metadata>;
  readonly #root: string;
  readonly #indexPath: string;
  readonly #entries: readonly MaterializedStateIndexEntry<State>[];

  constructor(
    authority: symbol,
    options: PreparationOptions<State, Metadata>,
    index: StateIndex<State, Metadata>,
    entries: readonly MaterializedStateIndexEntry<State>[],
    fixedDefinition: StateIndexDefinition<State, Metadata>
  ) {
    if (authority !== preparationAuthority)
      throw new TypeError("invalid preparation authority");
    this.#definition = options.definition;
    this.#fixedDefinition = fixedDefinition;
    this.#root = path.resolve(options.context.root);
    this.#indexPath = options.indexPath;
    this.index = index;
    this.#entries = bindMaterializedEntries(index, entries);
    Object.freeze(this);
  }

  static isPrepared<State extends object, Metadata extends JsonObject>(
    value: PreparedStateIndex<State, Metadata>
  ): boolean {
    return typeof value === "object" && value !== null && #definition in value;
  }

  consume(
    options: PreparationOptions<State, Metadata>
  ): StateIndexResult<readonly MaterializedStateIndexEntry<State>[]> {
    if (
      this.#definition !== options.definition ||
      this.#root !== path.resolve(options.context.root) ||
      this.#indexPath !== options.indexPath ||
      !sameDefinition(this.#fixedDefinition, options.definition)
    ) {
      return invalidPreparation(options.indexPath);
    }
    return { diagnostics: [], status: "ok", value: this.#entries };
  }
}

export type PreparedStateIndex<
  State extends object,
  Metadata extends JsonObject
> = PreparedIndex<State, Metadata>;

export function consumePreparedStateIndex<
  State extends object,
  Metadata extends JsonObject
>(
  options: PreparationOptions<State, Metadata> &
    Readonly<{
      prepared: PreparedStateIndex<State, Metadata>;
      index?: StateIndex<State, Metadata>;
    }>
): StateIndexResult<readonly MaterializedStateIndexEntry<State>[]> {
  if (
    !PreparedIndex.isPrepared(options.prepared) ||
    (options.index !== undefined && options.index !== options.prepared.index)
  )
    return invalidPreparation(options.indexPath);
  return options.prepared.consume(options);
}

export async function prepareStateIndex<
  State extends object,
  Metadata extends JsonObject
>(
  options: PreparationOptions<State, Metadata>
): Promise<StateIndexResult<PreparedStateIndex<State, Metadata>>> {
  options = { ...options, context: Object.freeze({ ...options.context }) };
  const fixed = preparationDefinition(options);
  if (fixed.status === "error") return fixed;
  const entries: MaterializedStateIndexEntry<State>[] = [];
  const built = await buildStateIndex(fixed.value, options.context, entries);
  return built.status === "error"
    ? built
    : {
        ...built,
        value: new PreparedIndex(
          preparationAuthority,
          options,
          built.value,
          entries,
          fixed.value
        )
      };
}

export function prepareStateIndexFromSnapshot<
  State extends object,
  Metadata extends JsonObject
>(
  options: PreparationOptions<State, Metadata> & Readonly<{ snapshot: unknown }>
): StateIndexResult<PreparedStateIndex<State, Metadata>> {
  options = { ...options, context: Object.freeze({ ...options.context }) };
  const fixed = preparationDefinition(options);
  if (fixed.status === "error") return fixed;
  const entries: MaterializedStateIndexEntry<State>[] = [];
  const built = buildStateIndexFromSnapshot(
    fixed.value,
    options.snapshot,
    options.indexPath,
    entries
  );
  return built.status === "error"
    ? built
    : {
        ...built,
        value: new PreparedIndex(
          preparationAuthority,
          options,
          built.value,
          entries,
          fixed.value
        )
      };
}

export async function loadPreparedStateIndex<
  State extends object,
  Metadata extends JsonObject
>(
  options: PreparationOptions<State, Metadata> &
    Readonly<{
      current?: boolean;
      expectation?: StateIndexExpectation;
    }>
): Promise<StateIndexResult<PreparedStateIndex<State, Metadata>>> {
  options = { ...options, context: Object.freeze({ ...options.context }) };
  const fixed = preparationDefinition(options);
  if (fixed.status === "error") return fixed;
  const entries: MaterializedStateIndexEntry<State>[] = [];
  const loaded =
    options.current === true
      ? await loadCurrentStateIndex({
          ...options,
          definition: fixed.value,
          materializedEntries: entries
        })
      : await loadStateIndex({
          ...options,
          definition: fixed.value,
          materializedEntries: entries
        });
  return loaded.status === "error"
    ? loaded
    : {
        ...loaded,
        value: new PreparedIndex(
          preparationAuthority,
          options,
          loaded.value,
          entries,
          fixed.value
        )
      };
}

class PreparedBaseline<State extends object, Metadata extends JsonObject> {
  readonly prepared: PreparedStateIndex<State, Metadata>;
  readonly index: StateIndex<State, Metadata>;
  readonly text: string;
  readonly #bytes: Uint8Array;
  readonly #resolved: ResolvedIndexPath;

  constructor(
    authority: symbol,
    prepared: PreparedStateIndex<State, Metadata>,
    resolved: ResolvedIndexPath,
    bytes: Uint8Array,
    text: string
  ) {
    if (authority !== preparationAuthority)
      throw new TypeError("invalid preparation authority");
    this.prepared = prepared;
    this.index = prepared.index;
    this.text = text;
    this.#bytes = bytes;
    this.#resolved = Object.freeze({ ...resolved });
    Object.freeze(this);
  }

  get bytes(): Uint8Array {
    return Uint8Array.from(this.#bytes);
  }

  static isPrepared<State extends object, Metadata extends JsonObject>(
    value: PreparedSelectedStateIndexBaseline<State, Metadata>
  ): boolean {
    return typeof value === "object" && value !== null && #resolved in value;
  }

  consume(
    options: PreparationOptions<State, Metadata> &
      Readonly<{
        resolved: ResolvedIndexPath;
      }>
  ): StateIndexResult<StateIndex<State, Metadata>> {
    if (
      options.resolved.canonicalRoot !== this.#resolved.canonicalRoot ||
      options.resolved.targetPath !== this.#resolved.targetPath
    )
      return invalidPreparation(options.indexPath);
    const consumed = consumePreparedStateIndex({
      ...options,
      prepared: this.prepared,
      index: this.index
    });
    if (consumed.status === "error") return consumed;
    return normalizeIndexLineEndings(this.text) ===
      serializeStateIndex(this.index, options.definition)
      ? { diagnostics: [], status: "ok", value: this.index }
      : failure(
          "state-index.index-noncanonical",
          "selected sync requires a canonical persisted index; run a full sync instead",
          { path: options.indexPath }
        );
  }
}

export type PreparedSelectedStateIndexBaseline<
  State extends object,
  Metadata extends JsonObject
> = PreparedBaseline<State, Metadata>;

export function consumePreparedSelectedBaseline<
  State extends object,
  Metadata extends JsonObject
>(
  options: PreparationOptions<State, Metadata> &
    Readonly<{
      baseline: PreparedSelectedStateIndexBaseline<State, Metadata>;
      resolved: ResolvedIndexPath;
    }>
): StateIndexResult<StateIndex<State, Metadata>> {
  return PreparedBaseline.isPrepared(options.baseline)
    ? options.baseline.consume(options)
    : invalidPreparation(options.indexPath);
}

export async function prepareSelectedStateIndexBaseline<
  State extends object,
  Metadata extends JsonObject
>(
  options: PreparationOptions<State, Metadata>
): Promise<
  StateIndexResult<PreparedSelectedStateIndexBaseline<State, Metadata>>
> {
  options = { ...options, context: Object.freeze({ ...options.context }) };
  const fixed = preparationDefinition(options);
  if (fixed.status === "error") return fixed;
  const resolved = await resolveIndexPath(
    options.indexPath,
    options.context.root
  );
  if (resolved.status === "error") return resolved;
  const source = await readBaselineSource({
    ...options,
    resolved: resolved.value
  });
  if (source.status === "error") return source;
  const entries: MaterializedStateIndexEntry<State>[] = [];
  const parsed = parseStateIndex({
    definition: fixed.value,
    sourcePath: options.indexPath,
    text: source.value.text,
    materializedEntries: entries
  });
  if (parsed.status === "error") return parsed;
  const prepared = new PreparedIndex(
    preparationAuthority,
    options,
    parsed.value,
    entries,
    fixed.value
  );
  return {
    diagnostics: [],
    status: "ok",
    value: new PreparedBaseline(
      preparationAuthority,
      prepared,
      resolved.value,
      source.value.bytes,
      source.value.text
    )
  };
}

function invalidPreparation<Value>(indexPath: string): StateIndexResult<Value> {
  return failure(
    "state-index.preparation-mismatch",
    "prepared index evidence does not match the definition, root, path, or immutable index identity",
    { path: indexPath }
  );
}

export { syncStateIndexPrepared } from "../storage/storage-sync.ts";
