/*
 * Synced TypeScript runtime; repository maintenance edits tools/record-operations/src/query.ts.
 * Installed skill copies may be edited directly; updates overwrite matching files.
 * Repository: https://github.com/zxyycom/skills
 * Source path: tools/record-operations/src/query.ts
 * Maintained source: https://github.com/zxyycom/skills/blob/main/tools/record-operations/src/query.ts
 * Skill source directory: https://github.com/zxyycom/skills/tree/main/skills/investigation-report
 * Rebuild: bun run sync:investigation-report-check
 */
import type { StateIndexReader } from "../../index-runtime/src/runtime.ts";
import {
  canonicalRecordCollection,
  readRecordSource,
  recordCollectionIdentity
} from "./source.ts";
import { err, ok, type Result } from "neverthrow";
import { loadStateIndexReader } from "../../index-runtime/src/index.ts";
import type {
  JsonObject,
  StateIndexContext,
  StateIndexDefinition,
  StateIndexExpectation,
  StateIndexResult,
  StateIndexDiagnostic
} from "../../index-runtime/src/types.ts";

/** 正式查询的共同准备：严格 reader → 领域投影 → 实际依赖的完整图证明。 */
export async function loadRecordQuery<
  State extends object,
  Metadata extends JsonObject,
  Projection
>(
  options: Readonly<{
    context: StateIndexContext;
    definition: StateIndexDefinition<State, Metadata>;
    indexPath: string;
    expectation?: StateIndexExpectation;
    project: (
      reader: StateIndexReader<State, Metadata>
    ) => StateIndexResult<Projection>;
    requiresRelations: boolean;
    relationErrors: (projection: Projection) => readonly string[];
    relationFailureCode: string;
  }>
): Promise<StateIndexResult<Projection>> {
  const reader = await loadRecordReader(options);
  if (reader.status === "error") return reader;
  const projected = options.project(reader.value);
  if (projected.status === "error") return projected;
  const errors = options.requiresRelations
    ? options.relationErrors(projected.value)
    : [];
  return errors.length === 0
    ? projected
    : {
        status: "error",
        value: null,
        diagnostics: [
          {
            code: options.relationFailureCode,
            message: errors.join("; "),
            path: options.indexPath,
            stateId: null
          }
        ]
      };
}

/** 单一发布投影的图证明，不跨调用或来源阶段复用。 */
export function recordGraphProof<Graph>(
  getGraph: () => Graph,
  validate: (graph: Graph) => readonly string[]
): () => readonly string[] {
  let errors: readonly string[] | undefined;
  return () => {
    errors ??= Object.freeze([...validate(getGraph())]);
    return errors;
  };
}

/** 精确扫描全部匹配，只为返回窗口建立 DTO；匹配证据不在窗口外保留。 */
export function collectRecordMetadataWindow<Entry, Evidence, Output, Failure>(
  options: Readonly<{
    entries: Iterable<Entry>;
    limit: number;
    match: (entry: Entry) => Result<Evidence | null, Failure>;
    project: (entry: Entry, evidence: Evidence) => Output;
  }>
): Result<Readonly<{ matched: number; entries: Output[] }>, Failure> {
  const entries: Output[] = [];
  let matched = 0;
  for (const entry of options.entries) {
    const evidence = options.match(entry);
    if (evidence.isErr()) return err(evidence.error);
    if (evidence.value === null) continue;
    matched += 1;
    if (entries.length < options.limit)
      entries.push(options.project(entry, evidence.value));
  }
  return ok({ entries, matched });
}

export type RecordShowFailure<State extends object> =
  | Readonly<{ status: "error"; phase: "location"; error: unknown }>
  | Readonly<{
      status: "error";
      phase: "index";
      diagnostics: readonly StateIndexDiagnostic[];
    }>
  | Readonly<{
      status: "error";
      phase: "selection";
      normalized: string;
      matches: readonly string[];
    }>
  | Readonly<{
      status: "error";
      phase: "source";
      id: string;
      state: State;
      error: unknown;
    }>;

/** show 的共同操作顺序只有此一份；领域只提供 definition、selector 规则和纯指纹投影。 */
export async function showPublishedRecord<
  State extends Readonly<{ name: string; sourcePath: string }>,
  Metadata extends JsonObject
>(
  options: Readonly<{
    workspaceRoot: string;
    collection: string;
    definition: StateIndexDefinition<State, Metadata>;
    indexPath: string;
    selector: string;
    normalizeSelector: (selector: string) => string;
    datedSelectorId: (selector: string) => string | null;
    idFromMarkdown: (text: string) => string | null;
    sourceFingerprint: (
      source: Readonly<{ id: string; sourcePath: string; text: string }>
    ) => string;
  }>
): Promise<
  | RecordShowFailure<State>
  | Readonly<{
      status: "ok";
      id: string;
      state: State;
      text: string;
      stale: boolean;
    }>
> {
  let root: string;
  try {
    root = (
      await canonicalRecordCollection(options.workspaceRoot, options.collection)
    ).collectionRoot;
  } catch (error) {
    return { status: "error", phase: "location", error };
  }
  const loaded = await loadRecordReader({
    context: { root },
    definition: options.definition,
    indexPath: options.indexPath
  });
  if (loaded.status === "error")
    return { status: "error", phase: "index", diagnostics: loaded.diagnostics };
  const normalized = options.normalizeSelector(options.selector);
  const dated = options.datedSelectorId(normalized);
  const matches =
    dated === null
      ? Object.entries(loaded.value.index.entries)
          .filter(([, state]) => state.name === normalized)
          .map(([id]) => id)
          .sort()
      : Object.hasOwn(loaded.value.index.entries, dated)
        ? [dated]
        : [];
  if (matches.length !== 1)
    return { status: "error", phase: "selection", normalized, matches };
  const id = matches[0]!;
  const selected = loaded.value.get(id);
  if (selected.status === "error")
    return {
      status: "error",
      phase: "index",
      diagnostics: selected.diagnostics
    };
  if (selected.value === null)
    throw new Error(
      "selected published record vanished from its immutable reader"
    );
  const state = selected.value.state;
  try {
    const text = await readRecordSource({
      collectionRoot: root,
      sourcePath: state.sourcePath,
      id,
      idFromMarkdown: options.idFromMarkdown
    });
    const stale =
      loaded.value.index.sourceRevision.entries[id] !==
      options.sourceFingerprint({ id, sourcePath: state.sourcePath, text });
    return { status: "ok", id, state, text, stale };
  } catch (error) {
    return { status: "error", phase: "source", id, state, error };
  }
}

async function loadRecordReader<
  State extends object,
  Metadata extends JsonObject
>(
  options: Readonly<{
    context: StateIndexContext;
    definition: StateIndexDefinition<State, Metadata>;
    indexPath: string;
    expectation?: StateIndexExpectation;
  }>
): Promise<StateIndexResult<StateIndexReader<State, Metadata>>> {
  try {
    const before = await recordCollectionIdentity(options.context.root);
    const loaded = await loadStateIndexReader(options);
    const after = await recordCollectionIdentity(options.context.root);
    if (before.dev !== after.dev || before.ino !== after.ino)
      throw new Error(
        "record collection identity changed while loading its index"
      );
    return loaded;
  } catch (error) {
    return {
      status: "error",
      value: null,
      diagnostics: [
        {
          code: "state-index.index-path-invalid",
          message:
            error instanceof Error
              ? error.message
              : "record collection could not be safely read",
          path: options.indexPath,
          stateId: null
        }
      ]
    };
  }
}
