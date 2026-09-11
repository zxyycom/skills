import fs from "node:fs/promises";
import { isFileSystemError } from "../../shared/src/node/filesystem.ts";
import { sameStateSourceRevision } from "./canonicalization.ts";
import { expectationOf } from "./definition.ts";
import { diagnostic, filesystemDiagnostic, failure } from "./diagnostics.ts";
import {
  decodeUtf8Text,
  resolveIndexPath,
  verifyWrittenText,
  writeTextAtomically
} from "./index-path.ts";
import { validateStateIndexSelectedIds } from "./selection.ts";
import { syncSelectedStateIndex } from "./selected-sync.ts";
import { buildStateIndex } from "./snapshot-builder.ts";
import { parseStateIndex, serializeStateIndex } from "./snapshot-parser.ts";
import {
  failedSync,
  isStateIndexSyncMode,
  normalizeIndexLineEndings,
  readSourceRevision
} from "./storage-shared.ts";
import type {
  JsonObject,
  StateIndexContext,
  StateIndexResult,
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
  const { context, definition, indexPath, mode } = options;
  if (!isStateIndexSyncMode(mode)) {
    return {
      changed: false,
      diagnostics: [
        diagnostic({
          code: "state-index.mode-invalid",
          message: "sync mode must be check or write",
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

  const built = await buildStateIndex(definition, context);
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
  const expectedText = serializeStateIndex(built.value, definition);
  let currentText: string | null = null;
  try {
    const currentData = await fs.readFile(resolved.value.targetPath);
    try {
      currentText = decodeUtf8Text(currentData);
    } catch {
      if (mode === "check") {
        return failedSync(
          options,
          "index-invalid",
          [
            diagnostic({
              code: "state-index.index-encoding-invalid",
              message: `${indexPath} must contain valid UTF-8 text`,
              path: indexPath
            })
          ],
          "all",
          []
        );
      }
    }
  } catch (error) {
    if (!isFileSystemError(error, "ENOENT")) {
      return failedSync(
        options,
        "index-read-failed",
        [
          diagnostic({
            code: "state-index.index-read-failed",
            filesystem: filesystemDiagnostic(error, {
              operation: "read a state-index file",
              target: indexPath
            }),
            message:
              "failed to read the state-index file; inspect index availability and access, then retry",
            path: indexPath
          })
        ],
        "all",
        []
      );
    }
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

type ResolvedSyncScope =
  | Readonly<{ kind: "all" }>
  | Readonly<{ kind: "selected"; selectedIds: string[] }>;

export function resolveSyncScope(
  input: StateIndexSyncScope | undefined,
  indexPath: string
): StateIndexResult<ResolvedSyncScope> {
  if (
    input === undefined ||
    (typeof input === "object" && input !== null && input.kind === "all")
  ) {
    return { diagnostics: [], status: "ok", value: { kind: "all" } };
  }
  if (
    typeof input !== "object" ||
    input === null ||
    input.kind !== "selected"
  ) {
    return failure(
      "state-index.selection-invalid",
      "sync scope must be all or a non-empty selected ID set",
      { path: indexPath }
    );
  }
  const selected = validateStateIndexSelectedIds(input.selectedIds, indexPath);
  return selected.status === "error"
    ? { ...selected, value: null }
    : {
        diagnostics: [],
        status: "ok",
        value: { kind: "selected", selectedIds: selected.selectedIds }
      };
}
