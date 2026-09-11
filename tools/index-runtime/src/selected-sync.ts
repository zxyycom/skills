import fs from "node:fs/promises";
import { isFileSystemError } from "../../shared/src/node/filesystem.ts";
import { sameStateSourceRevision } from "./canonicalization.ts";
import { expectationOf } from "./definition.ts";
import {
  diagnostic,
  filesystemDiagnostic,
  filesystemFailure,
  failure
} from "./diagnostics.ts";
import {
  decodeUtf8Text,
  type ResolvedIndexPath,
  verifyWrittenText,
  writeTextAtomically
} from "./index-path.ts";
import { sameStateIndexCollectionMetadata } from "./selection.ts";
import { buildStateIndex } from "./snapshot-builder.ts";
import { parseStateIndex, serializeStateIndex } from "./snapshot-parser.ts";
import {
  normalizeIndexLineEndings,
  readSourceRevision,
  failedSync
} from "./storage-shared.ts";
import type {
  JsonObject,
  StateIndex,
  StateIndexContext,
  StateIndexDefinition,
  StateIndexDiagnostic,
  StateIndexResult,
  StateIndexSyncMode,
  StateIndexSyncResult
} from "./types.ts";

export async function syncSelectedStateIndex<
  State extends object,
  Metadata extends JsonObject
>(options: {
  context: StateIndexContext;
  definition: StateIndexDefinition<State, Metadata>;
  indexPath: string;
  mode: StateIndexSyncMode;
  resolved: ResolvedIndexPath;
  selectedIds: string[];
}): Promise<StateIndexSyncResult> {
  const baseline = await readSelectedBaseline({
    definition: options.definition,
    indexPath: options.indexPath,
    resolved: options.resolved
  });
  if (baseline.status === "error") {
    return failedSync(
      options,
      "selected-baseline-invalid",
      selectedBaselineDiagnostics(baseline.diagnostics, options.indexPath),
      "selected",
      options.selectedIds
    );
  }

  const candidate = await buildStateIndex(options.definition, options.context);
  if (candidate.status === "error") {
    return failedSync(
      options,
      "source-invalid",
      candidate.diagnostics,
      "selected",
      options.selectedIds
    );
  }
  const currentRevision = await readSourceRevision(
    options.definition,
    options.context,
    options.indexPath
  );
  if (currentRevision.status === "error") {
    return failedSync(
      options,
      "source-invalid",
      currentRevision.diagnostics,
      "selected",
      options.selectedIds
    );
  }
  if (
    !sameStateSourceRevision(
      currentRevision.value,
      candidate.value.sourceRevision
    )
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
          path: options.indexPath
        })
      ],
      "selected",
      options.selectedIds
    );
  }
  if (!sameStateIndexCollectionMetadata(baseline.value, candidate.value)) {
    return failedSync(
      options,
      "collection-changed",
      [
        diagnostic({
          code: "state-index.collection-changed",
          message:
            "collection metadata or its source revision changed; run a full sync instead",
          path: options.indexPath
        })
      ],
      "selected",
      options.selectedIds
    );
  }

  const missingId = options.selectedIds.find(
    (id) =>
      !Object.hasOwn(baseline.value.entries, id) &&
      !Object.hasOwn(candidate.value.entries, id)
  );
  if (missingId !== undefined) {
    return failedSync(
      options,
      "selected-id-missing",
      [
        diagnostic({
          code: "state-index.selected-id-missing",
          message: `selected state id ${JSON.stringify(missingId)} is absent from both indexes`,
          path: options.indexPath,
          stateId: missingId
        })
      ],
      "selected",
      options.selectedIds
    );
  }

  const changedIds = changedStateIds(baseline.value, candidate.value);
  const selectedIdSet = new Set(options.selectedIds);
  const unselectedChangedIds = changedIds.filter(
    (id) => !selectedIdSet.has(id)
  );
  if (unselectedChangedIds.length > 0) {
    return failedSync(
      options,
      "unselected-changes",
      unselectedChangedIds.map((stateId) =>
        diagnostic({
          code: "state-index.unselected-changes",
          message:
            "this source change is outside the selected sync scope; add the ID " +
            "to --select or run a full sync",
          path: options.indexPath,
          stateId
        })
      ),
      "selected",
      options.selectedIds,
      changedIds
    );
  }
  if (changedIds.length === 0) {
    return {
      changed: false,
      changedIds,
      diagnostics: [],
      indexPath: options.indexPath,
      mode: options.mode,
      namespace: options.definition.namespace,
      scope: "selected",
      selectedIds: options.selectedIds,
      state: options.mode === "check" ? "current" : "unchanged",
      status: "ok"
    };
  }
  if (options.mode === "check") {
    return failedSync(
      options,
      "scoped-stale",
      changedIds.map((stateId) =>
        diagnostic({
          code: "state-index.scoped-stale",
          message:
            "the selected source change is not present in the current index; rerun " +
            "the selected sync in write mode to publish the complete projection",
          path: options.indexPath,
          stateId
        })
      ),
      "selected",
      options.selectedIds,
      changedIds
    );
  }

  const expectedText = serializeStateIndex(candidate.value, options.definition);
  let writtenPath: string;
  try {
    writtenPath = await writeTextAtomically(options.resolved, expectedText);
  } catch (error) {
    return failedSync(
      options,
      "index-write-failed",
      [
        diagnostic({
          code: "state-index.index-write-failed",
          filesystem: filesystemDiagnostic(error, {
            operation: "write a state-index file",
            target: options.indexPath
          }),
          message:
            "failed to write the state-index file; inspect index availability and access, then retry",
          path: options.indexPath
        })
      ],
      "selected",
      options.selectedIds,
      changedIds
    );
  }
  try {
    await verifyWrittenText(writtenPath, expectedText);
    return {
      changed: true,
      changedIds,
      diagnostics: [],
      indexPath: options.indexPath,
      mode: options.mode,
      namespace: options.definition.namespace,
      scope: "selected",
      selectedIds: options.selectedIds,
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
            target: options.indexPath
          }),
          message:
            "failed to verify the written state-index file; inspect index availability and access, then retry",
          path: options.indexPath
        })
      ],
      "selected",
      options.selectedIds,
      changedIds
    );
  }
}

async function readSelectedBaseline<
  State extends object,
  Metadata extends JsonObject
>(options: {
  definition: StateIndexDefinition<State, Metadata>;
  indexPath: string;
  resolved: ResolvedIndexPath;
}): Promise<StateIndexResult<StateIndex<State, Metadata>>> {
  let data: Buffer;
  try {
    data = await fs.readFile(options.resolved.targetPath);
  } catch (error) {
    return filesystemFailure(
      isFileSystemError(error, "ENOENT")
        ? "state-index.index-missing"
        : "state-index.index-read-failed",
      isFileSystemError(error, "ENOENT")
        ? "the state-index file does not exist"
        : "failed to read the state-index file; inspect index availability and access, then retry",
      {
        error,
        operation: "read a state-index file",
        path: options.indexPath,
        target: options.indexPath
      }
    );
  }
  let text: string;
  try {
    text = decodeUtf8Text(data);
  } catch {
    return failure(
      "state-index.index-encoding-invalid",
      `${options.indexPath} must contain valid UTF-8 text`,
      { path: options.indexPath }
    );
  }
  const parsed = parseStateIndex({
    definition: options.definition,
    expectation: expectationOf(options.definition),
    sourcePath: options.indexPath,
    text
  });
  if (parsed.status === "error") return parsed;
  return normalizeIndexLineEndings(text) ===
    serializeStateIndex(parsed.value, options.definition)
    ? parsed
    : failure(
        "state-index.index-noncanonical",
        "selected sync requires a canonical persisted index; run a full sync instead",
        { path: options.indexPath }
      );
}

function selectedBaselineDiagnostics(
  diagnostics: readonly StateIndexDiagnostic[],
  indexPath: string
): StateIndexDiagnostic[] {
  return diagnostics.map((entry) =>
    diagnostic({
      ...entry,
      code: "state-index.selected-baseline-invalid",
      message: `selected sync requires a valid baseline; ${entry.message}`,
      path: entry.path ?? indexPath
    })
  );
}

function changedStateIds<State extends object, Metadata extends JsonObject>(
  baseline: StateIndex<State, Metadata>,
  candidate: StateIndex<State, Metadata>
): string[] {
  const ids = new Set([
    ...Object.keys(baseline.entries),
    ...Object.keys(candidate.entries),
    ...Object.keys(baseline.sourceRevision.entries),
    ...Object.keys(candidate.sourceRevision.entries)
  ]);
  return [...ids]
    .sort((left, right) => (left < right ? -1 : left > right ? 1 : 0))
    .filter(
      (id) =>
        JSON.stringify(baseline.entries[id]) !==
          JSON.stringify(candidate.entries[id]) ||
        baseline.sourceRevision.entries[id] !==
          candidate.sourceRevision.entries[id]
    );
}
