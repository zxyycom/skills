import { VersionControlError } from "../../shared/src/version-control/index.ts";
import { TaskGraphError } from "./errors.ts";
import { parseTaskIndex } from "./schema.ts";
import type { TaskIndex } from "./types.ts";
type StagingVersionControlOperation =
  | "discover-repository"
  | "read-head"
  | "replace-pending";

import type { TaskSelection } from "./staging-snapshots.ts";

export function assertRootWatermarksDoNotRegress(
  baseline: TaskIndex,
  workspace: TaskIndex,
  selectedTaskIds: readonly string[]
): void {
  if (
    workspace.revision < baseline.revision ||
    workspace.nextTaskId < baseline.nextTaskId
  ) {
    throw new TaskGraphError(
      "REVISION_CONFLICT",
      "Workspace task-index watermarks precede the HEAD baseline; reread the target workspace index and retry",
      {
        baselineNextTaskId: baseline.nextTaskId,
        baselineRevision: baseline.revision,
        selectedTaskIds: [...selectedTaskIds],
        workspaceNextTaskId: workspace.nextTaskId,
        workspaceRevision: workspace.revision
      }
    );
  }
}

export function assertSelectedTasksExist(
  baseline: TaskIndex,
  workspace: TaskIndex,
  selectedTaskIds: readonly string[]
): void {
  const missingTaskId = selectedTaskIds.find(
    (taskId) =>
      !Object.hasOwn(baseline.tasks, taskId) &&
      !Object.hasOwn(workspace.tasks, taskId)
  );
  if (missingTaskId !== undefined) {
    throw new TaskGraphError(
      "TASK_NOT_FOUND",
      `Selected task ${missingTaskId} is absent from both the Git HEAD and workspace indexes`,
      { taskId: missingTaskId, selectedTaskIds: [...selectedTaskIds] }
    );
  }
}

export function buildTargetIndex(
  baseline: TaskIndex,
  workspace: TaskIndex,
  selection: TaskSelection
): TaskIndex {
  const tasks = structuredClone(baseline.tasks);
  for (const taskId of selection.selectedTaskIds) {
    if (Object.hasOwn(workspace.tasks, taskId)) {
      tasks[taskId] = structuredClone(workspace.tasks[taskId]!);
    } else {
      delete tasks[taskId];
    }
  }
  const candidate: TaskIndex = {
    schemaVersion: workspace.schemaVersion,
    revision: workspace.revision,
    nextTaskId: workspace.nextTaskId,
    tasks
  };
  try {
    return parseTaskIndex(candidate);
  } catch (error) {
    if (!(error instanceof TaskGraphError)) throw error;
    throw new TaskGraphError(
      "TOPOLOGY_INVALID",
      "Selected task entries do not form a complete valid task index with the Git HEAD baseline",
      {
        causeCode: error.code,
        causeDetails: error.details,
        selectedTaskIds: selection.selectedTaskIds
      },
      { cause: error }
    );
  }
}

export function versionControlFailure(
  error: unknown,
  operation: StagingVersionControlOperation,
  selectedTaskIds: readonly string[]
): TaskGraphError {
  const versionControlCode =
    error instanceof VersionControlError ? error.code : null;
  const details = {
    operation,
    selectedTaskIds: [...selectedTaskIds],
    versionControlCode
  };
  const options = error instanceof Error ? { cause: error } : undefined;
  switch (versionControlCode) {
    case "not-repository":
    case "invalid-path":
      return new TaskGraphError(
        "ARGUMENT_INVALID",
        "Task index staging requires an index inside a version-control repository",
        details,
        options
      );
    case "pending-conflict":
      return new TaskGraphError(
        "REVISION_CONFLICT",
        "The Git HEAD commit, task-index pending content, or pending write lock changed; reread HEAD and the pending task-index path, then retry",
        details,
        options
      );
    case "pending-recovery-failed":
      return new TaskGraphError(
        "WRITE_OUTCOME_UNKNOWN",
        "Task-index pending recovery was incomplete; inspect and reconcile the pending index before continuing",
        details,
        options
      );
  }
  return new TaskGraphError(
    "WRITE_FAILED",
    versionControlFailureMessage(operation),
    details,
    options
  );
}

export function versionControlFailureMessage(
  operation: StagingVersionControlOperation
): string {
  switch (operation) {
    case "discover-repository":
      return "Unable to discover the task-index version-control repository";
    case "read-head":
      return "Unable to read the Git HEAD task index";
    case "replace-pending":
      return "Unable to replace task-index pending content; the previous pending range was preserved";
  }
}

export function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

export function isMissingFileError(error: unknown): boolean {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}
