import fs from "node:fs/promises";
import path from "node:path";
import {
  openVersionControl,
  VersionControlError,
  type VersionControlFile
} from "../../shared/src/version-control/index.ts";
import {
  repositoryRelativePathFromFileSystemPath
} from "../../shared/src/version-control/repository-relative-path.ts";
import { TaskGraphError } from "./errors.ts";
import {
  emptyTaskIndex,
  isCanonicalTaskId,
  parseTaskIndex,
  serializeTaskIndex
} from "./schema.ts";
import type {
  TaskIndex,
  TaskIndexStageResult
} from "./types.ts";

type TaskSelection = {
  selectedTaskIds: string[];
};

export async function stageSelectedTaskIndex(options: Readonly<{
  indexPath: string;
  selectedTaskIds: readonly string[];
}>): Promise<{ revision: number; data: TaskIndexStageResult }> {
  const selection = validateTaskSelection(options.selectedTaskIds);
  const workspace = await readWorkspaceIndex(options.indexPath);

  let repository: Awaited<ReturnType<typeof openVersionControl>>;
  try {
    repository = await openVersionControl(path.dirname(options.indexPath));
  } catch (error) {
    throw versionControlFailure(error, "discover-repository", selection.selectedTaskIds);
  }

  let repositoryIndexPath: string;
  try {
    repositoryIndexPath = repositoryRelativePathFromFileSystemPath(
      repository.rootDirectory,
      options.indexPath
    );
  } catch (error) {
    throw new TaskGraphError(
      "ARGUMENT_INVALID",
      "The task index must be a file in the discovered version-control repository",
      {
        indexPath: options.indexPath,
        selectedTaskIds: selection.selectedTaskIds,
        cause: error
      },
      error instanceof Error ? { cause: error } : undefined
    );
  }

  let revision: string | null;
  let revisionFile: VersionControlFile | null;
  try {
    revision = await repository.getCurrentRevision();
    revisionFile = revision === null
      ? null
      : await repository.readRevisionFile(revision, repositoryIndexPath);
  } catch (error) {
    throw versionControlFailure(error, "read-revision", selection.selectedTaskIds);
  }

  const baseline = revisionFile === null
    ? emptyTaskIndex()
    : parseSnapshot(revisionFile.data, options.indexPath, "current revision");
  assertRootWatermarksDoNotRegress(
    baseline,
    workspace,
    selection.selectedTaskIds
  );
  assertSelectedTasksExist(
    baseline,
    workspace,
    selection.selectedTaskIds
  );
  const target = buildTargetIndex(
    baseline,
    workspace,
    selection
  );
  const targetData = Buffer.from(serializeTaskIndex(target), "utf8");
  const changed = revisionFile === null
    || !targetData.equals(Buffer.from(revisionFile.data));

  try {
    await repository.replacePendingFiles({
      expectedFiles: revisionFile === null ? [] : [revisionFile],
      expectedRevision: revision,
      files: [{ data: targetData, path: repositoryIndexPath }],
      pathScope: repositoryIndexPath
    });
  } catch (error) {
    throw versionControlFailure(error, "replace-pending", selection.selectedTaskIds);
  }

  return {
    revision: target.revision,
    data: {
      changed,
      nextTaskId: target.nextTaskId,
      selectedTaskIds: selection.selectedTaskIds,
      state: changed ? "staged" : "unchanged",
      taskCount: Object.keys(target.tasks).length
    }
  };
}

function validateTaskSelection(input: readonly string[]): TaskSelection {
  if (!Array.isArray(input) || input.length === 0) {
    throw new TaskGraphError(
      "ARGUMENT_INVALID",
      "Task index staging requires at least one --task value"
    );
  }
  const selectedTaskIds: string[] = [];
  const selectedTaskIdSet = new Set<string>();
  for (const taskId of input) {
    if (typeof taskId !== "string" || !isCanonicalTaskId(taskId)) {
      throw new TaskGraphError(
        "ARGUMENT_INVALID",
        "Selected task ids must use canonical task-000001 form",
        { taskId: typeof taskId === "string" ? taskId : null }
      );
    }
    if (selectedTaskIdSet.has(taskId)) {
      throw new TaskGraphError(
        "ARGUMENT_INVALID",
        `Selected task id ${taskId} appears more than once`,
        { taskId }
      );
    }
    selectedTaskIdSet.add(taskId);
    selectedTaskIds.push(taskId);
  }
  selectedTaskIds.sort(compareText);
  return { selectedTaskIds };
}

async function readWorkspaceIndex(indexPath: string): Promise<TaskIndex> {
  let data: Buffer;
  try {
    data = await fs.readFile(indexPath);
  } catch (error) {
    if (isFileSystemError(error, "ENOENT")) {
      throw new TaskGraphError(
        "INDEX_NOT_FOUND",
        `Task index does not exist: ${indexPath}`,
        { indexPath }
      );
    }
    throw new TaskGraphError(
      "INDEX_READ_FAILED",
      `Unable to read task index: ${indexPath}`,
      { indexPath, cause: error },
      error instanceof Error ? { cause: error } : undefined
    );
  }
  return parseSnapshot(data, indexPath, "workspace");
}

function parseSnapshot(
  input: Uint8Array,
  indexPath: string,
  source: "current revision" | "workspace"
): TaskIndex {
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(input);
  } catch (error) {
    throw new TaskGraphError(
      "INDEX_INVALID",
      `The ${source} task index is not valid UTF-8 text`,
      { indexPath, source, cause: error },
      error instanceof Error ? { cause: error } : undefined
    );
  }
  let raw: unknown;
  try {
    raw = JSON.parse(text) as unknown;
  } catch (error) {
    throw new TaskGraphError(
      "INDEX_INVALID",
      `The ${source} task index is not valid JSON`,
      { indexPath, source, cause: error },
      error instanceof Error ? { cause: error } : undefined
    );
  }
  let index: TaskIndex;
  try {
    index = parseTaskIndex(raw);
  } catch (error) {
    if (error instanceof TaskGraphError) {
      throw new TaskGraphError(
        error.code,
        `The ${source} task index is invalid: ${error.message}`,
        {
          indexPath,
          source,
          causeCode: error.code,
          causeDetails: error.details
        },
        { cause: error }
      );
    }
    throw error;
  }
  if (serializeTaskIndex(index) !== text) {
    throw new TaskGraphError(
      "INDEX_INVALID",
      `The ${source} task index is not canonical`,
      {
        indexPath,
        source,
        requirement: "canonical field order, two-space JSON, LF, and one trailing newline"
      }
    );
  }
  return index;
}

function assertRootWatermarksDoNotRegress(
  baseline: TaskIndex,
  workspace: TaskIndex,
  selectedTaskIds: readonly string[]
): void {
  if (
    workspace.revision < baseline.revision
    || workspace.nextTaskId < baseline.nextTaskId
  ) {
    throw new TaskGraphError(
      "REVISION_CONFLICT",
      "Workspace task-index watermarks precede the current revision baseline; reread the central index and retry",
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

function assertSelectedTasksExist(
  baseline: TaskIndex,
  workspace: TaskIndex,
  selectedTaskIds: readonly string[]
): void {
  const missingTaskId = selectedTaskIds.find((taskId) => (
    !Object.hasOwn(baseline.tasks, taskId)
    && !Object.hasOwn(workspace.tasks, taskId)
  ));
  if (missingTaskId !== undefined) {
    throw new TaskGraphError(
      "TASK_NOT_FOUND",
      `Selected task ${missingTaskId} is absent from both the current revision and workspace indexes`,
      { taskId: missingTaskId, selectedTaskIds: [...selectedTaskIds] }
    );
  }
}

function buildTargetIndex(
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
      "Selected task entries do not form a complete valid task index with the current revision baseline",
      {
        causeCode: error.code,
        causeDetails: error.details,
        selectedTaskIds: selection.selectedTaskIds
      },
      { cause: error }
    );
  }
}

function versionControlFailure(
  error: unknown,
  operation: "discover-repository" | "read-revision" | "replace-pending",
  selectedTaskIds: readonly string[]
): TaskGraphError {
  const versionControlCode = error instanceof VersionControlError
    ? error.code
    : null;
  const details = {
    operation,
    selectedTaskIds: [...selectedTaskIds],
    versionControlCode
  };
  if (versionControlCode === "not-repository" || versionControlCode === "invalid-path") {
    return new TaskGraphError(
      "ARGUMENT_INVALID",
      "Task index staging requires an index inside a version-control repository",
      details,
      error instanceof Error ? { cause: error } : undefined
    );
  }
  if (versionControlCode === "pending-conflict") {
    return new TaskGraphError(
      "REVISION_CONFLICT",
      "The current Git revision, task-index pending content, or pending write lock changed; reread HEAD and pending state, then retry",
      details,
      error instanceof Error ? { cause: error } : undefined
    );
  }
  if (versionControlCode === "pending-recovery-failed") {
    return new TaskGraphError(
      "WRITE_OUTCOME_UNKNOWN",
      "Task-index pending recovery was incomplete; inspect and reconcile the pending index before continuing",
      details,
      error instanceof Error ? { cause: error } : undefined
    );
  }
  return new TaskGraphError(
    "WRITE_FAILED",
    operation === "read-revision"
      ? "Unable to read the current Git revision task index"
      : operation === "replace-pending"
        ? "Unable to replace task-index pending content; the previous pending range was preserved"
        : "Unable to discover the task-index version-control repository",
    details,
    error instanceof Error ? { cause: error } : undefined
  );
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function isFileSystemError(error: unknown, code: string): boolean {
  return error instanceof Error
    && "code" in error
    && error.code === code;
}
