/*
 * Synced TypeScript runtime; repository maintenance edits tools/decision-records/src/decision-stage-refresh-sources.ts.
 * Installed skill copies may be edited directly; updates overwrite matching files.
 * Repository: https://github.com/zxyycom/skills
 * Source path: tools/decision-records/src/decision-stage-refresh-sources.ts
 * Maintained source: https://github.com/zxyycom/skills/blob/main/tools/decision-records/src/decision-stage-refresh-sources.ts
 * Skill source directory: https://github.com/zxyycom/skills/tree/main/skills/decision-records
 * Rebuild: bun run sync:decision-records-cli
 */
import path from "node:path";
import fs from "node:fs/promises";
import type { PendingFileUpdate } from "../../shared/src/version-control/pending-snapshot.ts";
import { isFileSystemError } from "../../shared/src/node/filesystem.ts";
import { ensureDecisionDirectoryPath } from "./decision-source-path-safety.ts";
import { decisionSourceRevision } from "./decision-source-revision.ts";
import { stageSourceFromFile } from "./decision-stage-sources.ts";
import {
  decisionRelativePath,
  DecisionStageConflictError,
  readStageFile,
  repositoryPath
} from "./decision-stage-support.ts";
import type {
  RefreshOptions,
  RefreshContext
} from "./decision-stage-refresh-context.ts";
import type { DecisionId, DecisionIndexState } from "./types.ts";

/** Builds only selected domain writes, checking known old locations before cleanup. */
export async function collectRefreshSourceUpdates(
  options: RefreshOptions,
  context: RefreshContext
): Promise<ReadonlyMap<string, PendingFileUpdate>> {
  const { decisionScope } = options.opened;
  const { workspace, selectedIds } = context;
  const updates = new Map<string, PendingFileUpdate>();
  const selectedIdSet = new Set(selectedIds);
  for (const id of selectedIds) {
    const current = workspace.entries[id];
    const oldPaths = selectedOldSourcePaths(context, id, decisionScope);
    for (const oldPath of oldPaths)
      if (!updates.has(oldPath))
        updates.set(oldPath, { path: oldPath, data: null });
    if (current === undefined) {
      // An object removed from the published workspace must not still exist at an old managed path.
      for (const oldPath of oldPaths)
        await verifyRemovedSourcePath(
          options,
          context,
          selectedIdSet,
          id,
          oldPath
        );

      continue;
    }
    const file = await readRefreshWorkspaceSource(
      options,
      context,
      id,
      current
    );
    updates.set(file.path, file);
  }
  return updates;
}

async function verifyRemovedSourcePath(
  options: RefreshOptions,
  context: RefreshContext,
  selectedIds: ReadonlySet<DecisionId>,
  id: DecisionId,
  oldPath: string
): Promise<void> {
  const { repository, decisionScope } = options.opened;
  const { workspace } = context;
  try {
    await ensureDecisionDirectoryPath(
      options.decisionsDirectory,
      path.dirname(path.join(repository.rootDirectory, oldPath)),
      true
    );
    await fs.lstat(path.join(repository.rootDirectory, oldPath));
    const data = await readStageFile(
      path.join(repository.rootDirectory, oldPath)
    );
    const replacement = stageSourceFromFile(
      { path: oldPath, kind: "regular", data },
      decisionRelativePath(decisionScope, oldPath)
    );
    if (
      selectedIds.has(replacement.source.decisionId) &&
      workspace.entries[replacement.source.decisionId]?.sourcePath ===
        replacement.source.sourcePath
    )
      return;
    throw new Error(
      "Selected removed Decision still has a workspace source; run sync-index: " +
        id
    );
  } catch (error) {
    if (!isFileSystemError(error, "ENOENT")) throw error;
  }
}

async function readRefreshWorkspaceSource(
  options: RefreshOptions,
  context: RefreshContext,
  id: DecisionId,
  current: DecisionIndexState
) {
  const { decisionScope } = options.opened;
  const { workspace } = context;
  const sourcePath = current.sourcePath;
  const filePath = repositoryPath(decisionScope, sourcePath);
  await ensureDecisionDirectoryPath(
    options.decisionsDirectory,
    path.dirname(path.join(options.decisionsDirectory, sourcePath))
  );
  const data = await readStageFile(
    path.join(options.decisionsDirectory, sourcePath)
  );
  const source = stageSourceFromFile(
    { path: filePath, data, kind: "regular" },
    sourcePath
  );
  if (
    source.source.decisionId !== id ||
    decisionSourceRevision([source.source]).entries[id] !==
      workspace.sourceRevision.entries[id]
  ) {
    throw new DecisionStageConflictError(
      "source",
      "Selected Decision source differs from the published projection; run sync-index: " +
        id
    );
  }
  return source.file;
}

/** Known managed paths come from the two captured projections and changed pending identities. */
function selectedOldSourcePaths(
  context: RefreshContext,
  id: DecisionId,
  decisionScope: string
): ReadonlySet<string> {
  const paths = new Set<string>();
  for (const index of [context.head, context.pending]) {
    const entry = index?.entries[id];
    if (entry !== undefined)
      paths.add(repositoryPath(decisionScope, entry.sourcePath));
  }
  for (const pendingPath of context.pendingIds.get(id) ?? [])
    paths.add(pendingPath);
  return paths;
}
