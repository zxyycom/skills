/*
 * Synced TypeScript runtime; repository maintenance edits tools/record-operations/src/selected-sync-sources.ts.
 * Installed skill copies may be edited directly; updates overwrite matching files.
 * Repository: https://github.com/zxyycom/skills
 * Source path: tools/record-operations/src/selected-sync-sources.ts
 * Maintained source: https://github.com/zxyycom/skills/blob/main/tools/record-operations/src/selected-sync-sources.ts
 * Skill source directory: https://github.com/zxyycom/skills/tree/main/skills/decision-records
 * Rebuild: bun run sync:decision-records-cli
 */
import path from "node:path";
import { isDeepStrictEqual } from "node:util";
import type {
  JsonObject,
  StateIndex,
  StateSnapshot,
  StateSourceRevision
} from "../../index-runtime/src/types.ts";
import {
  readRecordFileSnapshot,
  sameRecordFile,
  type RecordFileSnapshot
} from "./transaction-snapshot.ts";

export type SelectedRecordSource = Readonly<{
  id: string;
  sourcePath: string;
  text: string;
}>;
export type SelectedRecordDomain<
  State extends { sourcePath: string },
  Metadata extends JsonObject
> = Readonly<{
  root: string;
  identity: (text: string) => string | null;
  parse: (
    source: SelectedRecordSource,
    availableIds: ReadonlySet<string>
  ) => Promise<State>;
  revision: (sources: readonly SelectedRecordSource[]) => StateSourceRevision;
  dependencies: (
    index: StateIndex<State, Metadata>,
    selected: ReadonlySet<string>
  ) => readonly string[];
  graphErrors: (entries: Readonly<Record<string, State>>) => readonly string[];
  verifyResources?: (states: readonly State[]) => Promise<void>;
  verifyAffected?: (
    baseline: Readonly<Record<string, State>>,
    next: Readonly<Record<string, State>>,
    selected: ReadonlySet<string>
  ) => Promise<void>;
}>;

/** 本次 selected 的真实来源、组合投影与独立 fresh；不发现未知位置。 */
export class SelectedRecordSources<
  State extends { sourcePath: string },
  Metadata extends JsonObject
> {
  readonly #checked: Set<string>;
  readonly #options: SelectedRecordDomain<State, Metadata>;
  readonly #baseline: StateIndex<State, Metadata>;
  readonly #selected: ReadonlySet<string>;
  readonly #states: Record<string, State>;
  readonly #revisions: Record<string, string>;
  readonly #observations = new Map<string, RecordFileSnapshot | null>();

  constructor(
    options: SelectedRecordDomain<State, Metadata>,
    baseline: StateIndex<State, Metadata>,
    selected: ReadonlySet<string>
  ) {
    this.#options = options;
    this.#baseline = baseline;
    this.#selected = selected;
    this.#checked = new Set(selected);
    this.#states = { ...baseline.entries };
    this.#revisions = { ...baseline.sourceRevision.entries };
    for (const id of selected) {
      delete this.#states[id];
      delete this.#revisions[id];
    }
  }

  get checked(): ReadonlySet<string> {
    return this.#checked;
  }

  snapshot(): StateSnapshot<State, Metadata> {
    return {
      metadata: this.#baseline.metadata,
      sourceRevision: {
        metadata: this.#baseline.sourceRevision.metadata,
        entries: this.#revisions
      },
      states: this.#states
    };
  }

  async prepare(): Promise<void> {
    const sources = await this.readSelected();
    const available = new Set([
      ...Object.keys(this.#states),
      ...sources.keys()
    ]);
    for (const source of sources.values())
      this.#states[source.id] = await this.#options.parse(source, available);
    Object.assign(
      this.#revisions,
      this.#options.revision([...sources.values()]).entries
    );
    for (const id of this.dependencies())
      if (!this.#selected.has(id)) await this.readDependency(id, available);
    await this.verifyDomain();
    const errors = this.#options.graphErrors(this.#states);
    if (errors.length > 0) throw new Error(errors.join("; "));
  }

  private async readSelected(): Promise<Map<string, SelectedRecordSource>> {
    const sources = new Map<string, SelectedRecordSource>();
    for (const id of this.#selected) {
      const prior = this.#baseline.entries[id];
      if (prior === undefined) continue;
      const text = await this.read(prior.sourcePath);
      if (text === null) continue;
      const source = this.selectedSource(prior.sourcePath, text, sources);
      sources.set(source.id, source);
    }
    for (const id of this.#selected)
      if (!Object.hasOwn(this.#baseline.entries, id) && !sources.has(id))
        throw new Error(
          `Unknown selected ID or source location: ${id}; run full sync-index (selected sync does not discover new paths)`
        );
    return sources;
  }

  private selectedSource(
    sourcePath: string,
    text: string,
    sources: ReadonlyMap<string, SelectedRecordSource>
  ): SelectedRecordSource {
    const id = this.#options.identity(text);
    if (id === null || !this.#selected.has(id))
      throw new Error(
        `Selected source identity changed at ${sourcePath}; explicitly select both old and new IDs or run full sync-index`
      );
    if (sources.has(id) || Object.hasOwn(this.#states, id))
      throw new Error(
        `Duplicate selected identity: ${id}; run full sync-index`
      );
    return { id, sourcePath, text };
  }

  private async read(sourcePath: string): Promise<string | null> {
    const snapshot = await readRecordFileSnapshot(
      this.#options.root,
      path.join(this.#options.root, sourcePath)
    );
    this.#observations.set(sourcePath, snapshot);
    return snapshot === null
      ? null
      : new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(
          snapshot.bytes
        );
  }

  private dependencies(): ReadonlySet<string> {
    const candidate = {
      ...this.#baseline,
      entries: this.#states,
      sourceRevision: this.snapshot().sourceRevision
    };
    return new Set([
      ...this.#options.dependencies(this.#baseline, this.#selected),
      ...this.#options.dependencies(candidate, this.#selected)
    ]);
  }

  private async readDependency(
    id: string,
    available: ReadonlySet<string>
  ): Promise<void> {
    const state = this.#baseline.entries[id];
    if (state === undefined)
      throw new Error(
        `Required dependency is not published: ${id}; run full sync-index`
      );
    const text = await this.read(state.sourcePath);
    if (text === null)
      throw new Error(
        `Required dependency is missing: ${id}; run full sync-index`
      );
    const source = { id, sourcePath: state.sourcePath, text };
    if (
      this.#options.identity(text) !== id ||
      !isDeepStrictEqual(await this.#options.parse(source, available), state) ||
      this.#options.revision([source]).entries[id] !==
        this.#baseline.sourceRevision.entries[id]
    )
      throw new Error(
        `Required dependency differs from published baseline: ${id}; select it explicitly or run full sync-index`
      );
    this.#checked.add(id);
  }

  async verifyDomain(): Promise<void> {
    await this.#options.verifyResources?.(
      [...this.#checked].flatMap((id) =>
        this.#states[id] === undefined ? [] : [this.#states[id]!]
      )
    );
    await this.#options.verifyAffected?.(
      this.#baseline.entries,
      this.#states,
      this.#selected
    );
  }

  async fresh(): Promise<void> {
    for (const [sourcePath, before] of this.#observations)
      if (
        !sameRecordFile(
          await readRecordFileSnapshot(
            this.#options.root,
            path.join(this.#options.root, sourcePath)
          ),
          before
        )
      )
        throw new Error(
          `Selected source changed during synchronization: ${sourcePath}`
        );
  }
}
