/*
 * Synced TypeScript runtime; repository maintenance edits tools/index-runtime/src/storage-sync.ts.
 * Installed skill copies may be edited directly; updates overwrite matching files.
 * Repository: https://github.com/zxyycom/skills
 * Source path: tools/index-runtime/src/storage-sync.ts
 * Maintained source: https://github.com/zxyycom/skills/blob/main/tools/index-runtime/src/storage-sync.ts
 * Skill source directory: https://github.com/zxyycom/skills/tree/main/skills/novel-cards
 * Rebuild: bun run sync:novel-cards-cli
 */
import { readBaselineSource } from "./prepared-baseline-source.ts";
import {
  consumePreparedStateIndex,
  type PreparedStateIndex,
  type PreparedSelectedStateIndexBaseline
} from "./prepared.ts";
import { sameStateSourceRevision } from "./canonicalization.ts";
import { expectationOf } from "./definition.ts";
import { diagnostic, filesystemDiagnostic } from "./diagnostics.ts";
import {
  resolveIndexPath,
  verifyWrittenText,
  writeTextAtomically
} from "./index-path.ts";
import { resolveSyncScope } from "./selection.ts";
import { syncSelectedStateIndex } from "./selected-sync.ts";
import { buildStateIndex } from "./snapshot-builder.ts";
import {
  hasStableOwnFieldOrder,
  parseStateIndex,
  serializeCanonicalStateIndex,
  serializeStateIndex
} from "./snapshot-parser.ts";
import {
  failedSync,
  isStateIndexSyncMode,
  normalizeIndexLineEndings,
  readSourceRevision
} from "./storage-shared.ts";
import type {
  JsonObject,
  StateIndexContext,
  StateIndexSyncMode,
  StateIndexSyncScope,
  StateIndexSyncResult,
  StateIndexDefinition
} from "./types.ts";

export async function syncStateIndex<
  State extends object,
  Metadata extends JsonObject
>(options: {
  context: StateIndexContext;
  definition: StateIndexDefinition<State, Metadata>;
  indexPath: string;
  mode: StateIndexSyncMode;
  scope?: StateIndexSyncScope;
}): Promise<StateIndexSyncResult> {
  return await syncStateIndexPrepared({
    context: options.context,
    definition: options.definition,
    indexPath: options.indexPath,
    mode: options.mode,
    scope: options.scope
  });
}

/** Internal same-operation handoff; raw public sync never trusts caller evidence. */
export async function syncStateIndexPrepared<
  State extends object,
  Metadata extends JsonObject
>(options: {
  context: StateIndexContext;
  definition: StateIndexDefinition<State, Metadata>;
  indexPath: string;
  mode: StateIndexSyncMode;
  scope?: StateIndexSyncScope;
  prepared?: PreparedStateIndex<State, Metadata>;
  baseline?: PreparedSelectedStateIndexBaseline<State, Metadata>;
}): Promise<StateIndexSyncResult> {
  const { context, definition, indexPath, mode } = options;
  if (!isStateIndexSyncMode(mode)) {
    return {
      changed: false,
      diagnostics: [
        diagnostic({
          code: "state-index.mode-invalid",
          message: "sync mode must be check, preview, or write",
          path: indexPath
        })
      ],
      changedIds: [],
      indexPath,
      mode: null,
      namespace: definition.namespace,
      scope: "all",
      selectedIds: [],
      state: "mode-invalid",
      status: "error"
    };
  }
  const scope = resolveSyncScope(options.scope, indexPath);
  if (scope.status === "error") {
    return failedSync(
      options,
      "selection-invalid",
      scope.diagnostics,
      "selected",
      []
    );
  }
  const resolved = await resolveIndexPath(indexPath, context.root);
  if (resolved.status === "error") {
    return failedSync(
      options,
      "index-path-invalid",
      resolved.diagnostics,
      scope.value.kind,
      scope.value.kind === "selected" ? scope.value.selectedIds : []
    );
  }

  if (scope.value.kind === "selected") {
    return await syncSelectedStateIndex({
      ...options,
      resolved: resolved.value,
      selectedIds: scope.value.selectedIds
    });
  }

  const stableFieldOrder = hasStableOwnFieldOrder(definition);
  const proof =
    options.prepared === undefined
      ? null
      : consumePreparedStateIndex({ ...options, prepared: options.prepared });
  const built =
    proof === null
      ? await buildStateIndex(definition, context)
      : proof.status === "error"
        ? proof
        : {
            diagnostics: [],
            status: "ok" as const,
            value: options.prepared!.index
          };
  if (built.status === "error") {
    return failedSync(options, "source-invalid", built.diagnostics, "all", []);
  }
  const currentRevision = await readSourceRevision(
    definition,
    context,
    indexPath
  );
  if (currentRevision.status === "error") {
    return failedSync(
      options,
      "source-invalid",
      currentRevision.diagnostics,
      "all",
      []
    );
  }
  if (
    !sameStateSourceRevision(currentRevision.value, built.value.sourceRevision)
  ) {
    return failedSync(
      options,
      "source-invalid",
      [
        diagnostic({
          code: "state-index.source-changed",
          message:
            "source revision changed while building the state projection; retry after " +
            "the source is stable",
          path: indexPath
        })
      ],
      "all",
      []
    );
  }
  const expectedText = stableFieldOrder
    ? serializeCanonicalStateIndex(built.value)
    : serializeStateIndex(built.value, definition);
  let currentText: string | null = null;
  const currentSource = await readBaselineSource({
    indexPath,
    resolved: resolved.value
  });
  if (currentSource.status === "ok") currentText = currentSource.value.text;
  else {
    const missing = currentSource.diagnostics.some(
      (item) => item.code === "state-index.index-missing"
    );
    const encoding = currentSource.diagnostics.some(
      (item) => item.code === "state-index.index-encoding-invalid"
    );
    if (!missing && !(encoding && mode !== "check"))
      return failedSync(
        options,
        encoding ? "index-invalid" : "index-read-failed",
        currentSource.diagnostics,
        "all",
        []
      );
  }

  if (
    currentText !== null &&
    normalizeIndexLineEndings(currentText) === expectedText
  ) {
    return {
      changed: false,
      changedIds: [],
      diagnostics: [],
      indexPath,
      mode,
      namespace: definition.namespace,
      scope: "all",
      selectedIds: [],
      state: mode === "check" ? "current" : "unchanged",
      status: "ok"
    };
  }
  if (mode === "check") {
    if (currentText === null) {
      return failedSync(
        options,
        "index-missing",
        [
          diagnostic({
            code: "state-index.index-missing",
            message: `${indexPath} does not exist`,
            path: indexPath
          })
        ],
        "all",
        []
      );
    }
    const parsed = parseStateIndex({
      definition,
      expectation: expectationOf(definition),
      sourcePath: indexPath,
      text: currentText
    });
    return parsed.status === "error"
      ? failedSync(options, "index-invalid", parsed.diagnostics, "all", [])
      : failedSync(
          options,
          "index-stale",
          [
            diagnostic({
              code: "state-index.index-stale",
              message: `${indexPath} does not match the current state projection`,
              path: indexPath
            })
          ],
          "all",
          []
        );
  }

  if (mode === "preview") {
    return {
      changed: false,
      changedIds: [],
      diagnostics: [],
      indexPath,
      mode,
      namespace: definition.namespace,
      scope: "all",
      selectedIds: [],
      state: "previewed",
      status: "ok"
    };
  }

  let writtenPath: string;
  try {
    writtenPath = await writeTextAtomically(resolved.value, expectedText);
  } catch (error) {
    return failedSync(
      options,
      "index-write-failed",
      [
        diagnostic({
          code: "state-index.index-write-failed",
          filesystem: filesystemDiagnostic(error, {
            operation: "write a state-index file",
            target: indexPath
          }),
          message:
            "failed to write the state-index file; inspect index availability and access, then retry",
          path: indexPath
        })
      ],
      "all",
      []
    );
  }
  try {
    await verifyWrittenText(writtenPath, expectedText);
    return {
      changed: true,
      changedIds: [],
      diagnostics: [],
      indexPath,
      mode,
      namespace: definition.namespace,
      scope: "all",
      selectedIds: [],
      state: "written",
      status: "ok"
    };
  } catch (error) {
    return failedSync(
      options,
      "index-write-failed",
      [
        diagnostic({
          code: "state-index.index-write-failed",
          filesystem: filesystemDiagnostic(error, {
            operation: "verify a state-index file",
            target: indexPath
          }),
          message:
            "failed to verify the written state-index file; inspect index availability and access, then retry",
          path: indexPath
        })
      ],
      "all",
      []
    );
  }
}
