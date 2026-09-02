import fs from "node:fs/promises";
import path from "node:path";
import {
  openVersionControl,
  repositoryRelativePathFromFileSystemPath,
  VersionControlError,
  type VersionControlFile,
  type VersionControlRepository
} from "../../shared/src/version-control/index.ts";
import { TaskGraphError } from "./errors.ts";
import {
  emptyTaskIndex,
  isCanonicalTaskId,
  parseTaskIndex,
  serializeTaskIndex
} from "./schema.ts";
import type { TaskIndex, TaskIndexStageResult } from "./types.ts";

type TaskSelection = Readonly<{
  selectedTaskIds: readonly string[];
}>;

type StagingVersionControlOperation =
  | "discover-repository"
  | "read-head"
  | "replace-pending";

export async function stageSelectedTaskIndex(
  options: Readonly<{
    indexPath: string;
    selectedTaskIds: readonly string[];
  }>
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
      : parseSnapshot(head.indexFile.data, options.indexPath, "HEAD");
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

async function openStagingRepository(
  indexPath: string,
  selectedTaskIds: readonly string[]
): Promise<{
  repository: VersionControlRepository;
  repositoryIndexPath: string;
}> {
  let repository: VersionControlRepository;
  try {
    repository = await openVersionControl(path.dirname(indexPath));
  } catch (error) {
    throw versionControlFailure(error, "discover-repository", selectedTaskIds);
  }
  try {
    return {
      repository,
      repositoryIndexPath: repositoryRelativePathFromFileSystemPath(
        repository.rootDirectory,
        indexPath
      )
    };
  } catch (error) {
    throw new TaskGraphError(
      "ARGUMENT_INVALID",
      "The task index must be a file in the discovered version-control repository",
      { cause: error, indexPath, selectedTaskIds },
      error instanceof Error ? { cause: error } : undefined
    );
  }
}

async function readHeadIndex(
  repository: VersionControlRepository,
  repositoryIndexPath: string,
  selectedTaskIds: readonly string[]
): Promise<{ indexFile: VersionControlFile | null; revision: string | null }> {
  try {
    const revision = await repository.getCurrentRevision();
    const indexFile =
      revision === null
        ? null
        : await repository.readRevisionFile(revision, repositoryIndexPath);
    return { indexFile, revision };
  } catch (error) {
    throw versionControlFailure(error, "read-head", selectedTaskIds);
  }
}

async function replacePendingIndex(options: {
  data: Buffer;
  head: Awaited<ReturnType<typeof readHeadIndex>>;
  opened: Awaited<ReturnType<typeof openStagingRepository>>;
  selectedTaskIds: readonly string[];
}): Promise<void> {
  try {
    await options.opened.repository.replacePendingFiles({
      expectedFiles:
        options.head.indexFile === null ? [] : [options.head.indexFile],
      expectedRevision: options.head.revision,
      files: [{ data: options.data, path: options.opened.repositoryIndexPath }],
      pathScope: options.opened.repositoryIndexPath
    });
  } catch (error) {
    throw versionControlFailure(
      error,
      "replace-pending",
      options.selectedTaskIds
    );
  }
}

function validateTaskSelection(input: unknown): TaskSelection {
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
    if (isMissingFileError(error)) {
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
  source: "HEAD" | "workspace"
): TaskIndex {
  const text = decodeSnapshot(input, indexPath, source);
  const raw = parseSnapshotJson(text, indexPath, source);
  const index = parseSnapshotIndex(raw, indexPath, source);
  if (serializeTaskIndex(index) !== text) {
    throw new TaskGraphError(
      "INDEX_INVALID",
      `The ${source} task index is not canonical`,
      {
        indexPath,
        source,
        requirement:
          "canonical field order, two-space JSON, LF, and one trailing newline"
      }
    );
  }
  return index;
}

function decodeSnapshot(
  input: Uint8Array,
  indexPath: string,
  source: "HEAD" | "workspace"
): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(input);
  } catch (error) {
    throw new TaskGraphError(
      "INDEX_INVALID",
      `The ${source} task index is not valid UTF-8 text`,
      { indexPath, source, cause: error },
      error instanceof Error ? { cause: error } : undefined
    );
  }
}

function parseSnapshotJson(
  text: string,
  indexPath: string,
  source: "HEAD" | "workspace"
): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch (error) {
    throw new TaskGraphError(
      "INDEX_INVALID",
      `The ${source} task index is not valid JSON`,
      { indexPath, source, cause: error },
      error instanceof Error ? { cause: error } : undefined
    );
  }
}

function parseSnapshotIndex(
  raw: unknown,
  indexPath: string,
  source: "HEAD" | "workspace"
): TaskIndex {
  try {
    return parseTaskIndex(raw);
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
}

function assertRootWatermarksDoNotRegress(
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

function assertSelectedTasksExist(
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

function versionControlFailure(
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

function versionControlFailureMessage(
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

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function isMissingFileError(error: unknown): boolean {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}
