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
import type { TaskIndexStageResult } from "./types.ts";

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
  const targetData = Buffer.from(serializeTaskIndex(target), "utf8");
  const differsFromHead =
    head.indexFile === null ||
    !targetData.equals(Buffer.from(head.indexFile.data));
  await replacePendingIndex({
    data: targetData,
    head,
    opened,
    selectedTaskIds: selection.selectedTaskIds
  });
  const commonResult = {
    nextTaskId: target.nextTaskId,
    selectedTaskIds: [...selection.selectedTaskIds],
    taskCount: Object.keys(target.tasks).length
  };
  return {
    revision: target.revision,
    data: differsFromHead
      ? { ...commonResult, changed: true, state: "staged" }
      : { ...commonResult, changed: false, state: "unchanged" }
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
