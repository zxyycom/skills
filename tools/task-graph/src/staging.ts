import {
  changedPendingPaths,
  type VersionControlFile
} from "../../shared/src/version-control/index.ts";
import { TaskGraphError } from "./errors.ts";
import {
  emptyTaskIndex,
  parseTaskIndex,
  serializeTaskIndex
} from "./schema.ts";
import {
  openStagingRepository,
  readHeadIndex,
  replacePendingIndex
} from "./staging-repository.ts";
import {
  assertRootWatermarksDoNotRegress,
  assertSelectedTasksExist,
  buildTargetIndex
} from "./staging-projection.ts";
import {
  readWorkspaceIndex,
  validateTaskSelection
} from "./staging-snapshots.ts";
import type { TaskIndex, TaskIndexStageResult } from "./types.ts";

export async function stageSelectedTaskIndex(
  options: Readonly<{ indexPath: string; selectedTaskIds: readonly string[] }>
): Promise<{ revision: number; data: TaskIndexStageResult }> {
  const selection = validateTaskSelection(options.selectedTaskIds);
  const workspace = await readWorkspaceIndex(options.indexPath);
  const opened = await openStagingRepository(
    options.indexPath,
    selection.selectedTaskIds
  );
  const head = await readHeadIndex(
    opened.repository,
    opened.repositoryIndexPath,
    selection.selectedTaskIds
  );
  const baseline =
    head.indexFile === null
      ? emptyTaskIndex()
      : parseTaskIndexSnapshot(head.indexFile.data, options.indexPath);
  assertRootWatermarksDoNotRegress(
    baseline,
    workspace,
    selection.selectedTaskIds
  );
  assertSelectedTasksExist(baseline, workspace, selection.selectedTaskIds);
  const target = buildTargetIndex(baseline, workspace, selection);
  const targetFile: VersionControlFile = {
    data: Buffer.from(serializeTaskIndex(target), "utf8"),
    kind: "regular",
    path: opened.repositoryIndexPath
  };
  const differsFromHead =
    changedPendingPaths(head.indexFile === null ? [] : [head.indexFile], [
      targetFile
    ]).length > 0;
  await replacePendingIndex({
    file: targetFile,
    head,
    opened,
    selectedTaskIds: selection.selectedTaskIds
  });
  return taskIndexStageResult(
    target,
    selection.selectedTaskIds,
    differsFromHead
  );
}

function taskIndexStageResult(
  target: Readonly<TaskIndex>,
  selectedTaskIds: readonly string[],
  changed: boolean
): Readonly<{ revision: number; data: TaskIndexStageResult }> {
  const common = {
    nextTaskId: target.nextTaskId,
    selectedTaskIds: [...selectedTaskIds],
    taskCount: Object.keys(target.tasks).length
  };
  return {
    revision: target.revision,
    data: changed
      ? { ...common, changed: true, state: "staged" }
      : { ...common, changed: false, state: "unchanged" }
  };
}

function parseTaskIndexSnapshot(data: Uint8Array, indexPath: string) {
  try {
    return parseTaskIndex(JSON.parse(Buffer.from(data).toString("utf8")));
  } catch (error) {
    throw new TaskGraphError("INDEX_INVALID", "HEAD task index is invalid", {
      path: indexPath,
      source: "HEAD",
      cause: error
    });
  }
}
