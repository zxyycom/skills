/*
 * Synced TypeScript runtime; repository maintenance edits tools/record-operations/src/selected-synchronize.ts.
 * Installed skill copies may be edited directly; updates overwrite matching files.
 * Repository: https://github.com/zxyycom/skills
 * Source path: tools/record-operations/src/selected-synchronize.ts
 * Maintained source: https://github.com/zxyycom/skills/blob/main/tools/record-operations/src/selected-synchronize.ts
 * Skill source directory: https://github.com/zxyycom/skills/tree/main/skills/decision-records
 * Rebuild: bun run sync:decision-records-cli
 */
import path from "node:path";
import {
  prepareSelectedStateIndexBaseline,
  prepareStateIndexFromSnapshot,
  syncStateIndexPrepared,
  type PreparedSelectedStateIndexBaseline
} from "../../index-runtime/src/prepared.ts";
import { filesystemDiagnostic } from "../../index-runtime/src/diagnostics.ts";
import { selectedBaselineDiagnostics } from "../../index-runtime/src/selected-sync.ts";
import type {
  JsonObject,
  StateIndex,
  StateIndexDefinition,
  StateIndexDiagnostic,
  StateIndexSyncMode,
  StateIndexSyncResult
} from "../../index-runtime/src/types.ts";
import {
  readRecordFileSnapshot,
  sameRecordFile,
  type RecordFileSnapshot
} from "./transaction-snapshot.ts";
import {
  resolveSelectors,
  validateSelectors,
  type RecordSelectorPolicy
} from "./synchronize.ts";
import {
  SelectedRecordSources,
  type SelectedRecordDomain
} from "./selected-sync-sources.ts";
export type { SelectedRecordSource } from "./selected-sync-sources.ts";

export type RecordSelectedCoverage = Readonly<{
  source: "published-index+selected-current-sources";
  currentness: "selected-and-dependencies";
  /** 身份标签含所选删除/更正的旧新 ID，不表示它们均存在或未知位置发现完整。 */
  checkedIds: readonly string[];
}>;
export type SelectedRecordSyncResult = Readonly<{
  synchronized: StateIndexSyncResult;
  entryCount: number;
  coverage?: RecordSelectedCoverage;
}>;
type SelectedOptions<
  State extends { sourcePath: string },
  Metadata extends JsonObject
> = SelectedRecordDomain<State, Metadata> &
  Readonly<{
    indexPath: string;
    definition: StateIndexDefinition<State, Metadata>;
    mode: StateIndexSyncMode;
    selectors: readonly string[];
    selectorPolicy: RecordSelectorPolicy;
  }>;
type FailureState =
  | "selection-invalid"
  | "source-invalid"
  | "selected-baseline-invalid";

/** DR/IR 独立的局部更新协调，不改变通用 Index Runtime selected 或 stage。 */
export async function synchronizeSelectedRecordIndex<
  State extends { sourcePath: string },
  Metadata extends JsonObject
>(
  options: SelectedOptions<State, Metadata>
): Promise<SelectedRecordSyncResult> {
  return await new SelectedSynchronization(options).run();
}

class SelectedSynchronization<
  State extends { sourcePath: string },
  Metadata extends JsonObject
> {
  readonly #options: SelectedOptions<State, Metadata>;
  readonly #indexTarget: string;
  readonly #definition: StateIndexDefinition<State, Metadata>;
  #selectedIds: string[] = [];
  #entryCount = 0;
  #indexBefore: RecordFileSnapshot | null = null;
  #sources: SelectedRecordSources<State, Metadata> | null = null;

  constructor(options: SelectedOptions<State, Metadata>) {
    this.#options = options;
    this.#indexTarget = path.join(options.root, options.indexPath);
    this.#definition = {
      ...options.definition,
      read: async () => this.sources().snapshot(),
      readRevision: async () => {
        await this.sources().fresh();
        if (
          !sameRecordFile(
            await readRecordFileSnapshot(options.root, this.#indexTarget),
            this.#indexBefore
          )
        )
          throw new Error(
            "Published index changed during selected synchronization; inspect the actual index before retrying"
          );
        await this.sources().verifyDomain();
        return this.sources().snapshot().sourceRevision;
      }
    };
  }

  private sources(): SelectedRecordSources<State, Metadata> {
    if (this.#sources === null)
      throw new Error("Selected sources were not prepared");
    return this.#sources;
  }

  private nativeOptions() {
    return {
      context: { root: this.#options.root },
      definition: this.#definition,
      indexPath: this.#options.indexPath
    };
  }

  async run(): Promise<SelectedRecordSyncResult> {
    try {
      const raw = validateSelectors(
        this.#options.selectors,
        this.#options.selectorPolicy,
        this.#options.indexPath
      );
      if (raw.length > 0) return this.failure(raw, "selection-invalid");
      const baseline = await prepareSelectedStateIndexBaseline(
        this.nativeOptions()
      );
      if (baseline.status === "error")
        return this.failure(
          selectedBaselineDiagnostics(
            baseline.diagnostics,
            this.#options.indexPath
          ),
          "selected-baseline-invalid"
        );
      await this.verifyBaseline(baseline.value);
      const selection = resolveSelectors(
        this.#options.selectors,
        new Set(Object.keys(baseline.value.index.entries)),
        this.#options.selectorPolicy,
        this.#options.indexPath,
        true
      );
      if (selection.errors.length > 0)
        return this.failure(selection.errors, "selection-invalid");
      this.#selectedIds = selection.ids;
      this.#sources = new SelectedRecordSources(
        this.#options,
        baseline.value.index,
        new Set(selection.ids)
      );
      await this.#sources.prepare();
      return await this.synchronize(baseline.value);
    } catch (error) {
      return this.sourceFailure(error);
    }
  }

  private async verifyBaseline(
    baseline: PreparedSelectedStateIndexBaseline<State, Metadata>
  ): Promise<void> {
    this.#indexBefore = await readRecordFileSnapshot(
      this.#options.root,
      this.#indexTarget
    );
    if (
      this.#indexBefore === null ||
      !Buffer.from(this.#indexBefore.bytes).equals(Buffer.from(baseline.bytes))
    )
      throw new Error(
        "Published baseline changed while loading; run full sync-index after inspecting the index"
      );
    const index = baseline.index;
    this.#entryCount = Object.keys(index.entries).length;
    this.verifyBaselineProjection(index);
  }

  private verifyBaselineProjection(index: StateIndex<State, Metadata>): void {
    if (this.#options.revision([]).metadata !== index.sourceRevision.metadata)
      throw new Error(
        "Collection source metadata revision differs from published baseline; run full sync-index"
      );
    const errors = this.#options.graphErrors(index.entries);
    if (errors.length > 0)
      throw new Error(
        "Published baseline graph invalid; run full sync-index: " +
          errors.join("; ")
      );
  }

  private async synchronize(
    baseline: PreparedSelectedStateIndexBaseline<State, Metadata>
  ): Promise<SelectedRecordSyncResult> {
    const snapshot = this.sources().snapshot();
    const prepared = prepareStateIndexFromSnapshot({
      ...this.nativeOptions(),
      snapshot
    });
    if (prepared.status === "error")
      return this.failure(prepared.diagnostics, "source-invalid");
    const synchronized = await syncStateIndexPrepared({
      ...this.nativeOptions(),
      mode: this.#options.mode,
      prepared: prepared.value,
      baseline,
      scope: { kind: "selected", selectedIds: this.#selectedIds }
    });
    return {
      synchronized,
      entryCount: Object.keys(snapshot.states).length,
      ...(synchronized.status === "ok"
        ? {
            coverage: {
              source: "published-index+selected-current-sources" as const,
              currentness: "selected-and-dependencies" as const,
              checkedIds: [...this.sources().checked].sort()
            }
          }
        : {})
    };
  }

  private failure(
    diagnostics: StateIndexDiagnostic[],
    state: FailureState
  ): SelectedRecordSyncResult {
    return {
      entryCount: this.#entryCount,
      synchronized: {
        changed: false,
        changedIds: [],
        diagnostics,
        indexPath: this.#options.indexPath,
        mode: this.#options.mode,
        namespace: this.#definition.namespace,
        scope: "selected",
        selectedIds: this.#selectedIds,
        state,
        status: "error"
      }
    };
  }

  private sourceFailure(error: unknown): SelectedRecordSyncResult {
    return this.failure(
      [
        {
          code: `${this.#options.selectorPolicy.codePrefix}.selected-sync-invalid`,
          message:
            error instanceof Error
              ? error.message
              : "Selected source acquisition failed",
          path: this.#options.indexPath,
          stateId: null,
          filesystem: filesystemDiagnostic(error, {
            operation: "read selected record sources",
            target: this.#options.root
          })
        }
      ],
      "source-invalid"
    );
  }
}
