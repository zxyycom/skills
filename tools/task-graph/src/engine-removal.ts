import { TaskGraphError } from "./errors.ts";
import {
  cloneIndex,
  compareText,
  nextRevision,
  requireExpectedRevision,
  requireTask
} from "./engine-content.ts";
import { parseTaskIndex } from "./schema.ts";
import type { IndexMutation } from "./engine-content.ts";
import type {
  RemoveTasksOptions,
  TaskExecutionPhase,
  TaskIndex
} from "./types.ts";

type TaskRemovalBlocker =
  | { kind: "task-not-terminal"; taskId: string; phase: TaskExecutionPhase }
  | {
      kind:
        | "parent-crosses-selection"
        | "child-crosses-selection"
        | "dependency-crosses-selection"
        | "exclusion-crosses-selection";
      taskId: string;
      relatedTaskId: string;
    };

export function removeTasks(
  current: TaskIndex,
  options: RemoveTasksOptions
): IndexMutation<{
  removedTaskIds: string[];
}> {
  requireExpectedRevision(current, options.expectedRevision);
  validateRemovalSelection(options);
  const selected = new Set(options.taskIds);
  for (const taskId of selected) requireTask(current, taskId);
  const blockers = collectRemovalBlockers(current, selected);
  sortRemovalBlockers(blockers);
  if (blockers.length > 0) {
    throw new TaskGraphError(
      "TASKS_NOT_REMOVABLE",
      "Selected tasks are not terminal and detached from the remaining graph",
      { blockers }
    );
  }
  return removeSelectedTasks(current, selected);
}

export function validateRemovalSelection(options: RemoveTasksOptions): void {
  if (options.taskIds.length === 0) {
    throw new TaskGraphError(
      "ARGUMENT_INVALID",
      "Task removal requires at least one explicitly selected task"
    );
  }
  if (new Set(options.taskIds).size !== options.taskIds.length) {
    throw new TaskGraphError(
      "ARGUMENT_INVALID",
      "Task removal selection must not repeat a task id"
    );
  }
  if (options.resultsDelivered !== true) {
    throw new TaskGraphError(
      "DELIVERY_NOT_CONFIRMED",
      "Task results must be explicitly confirmed delivered"
    );
  }
}

export function collectRemovalBlockers(
  current: TaskIndex,
  selected: ReadonlySet<string>
): TaskRemovalBlocker[] {
  const blockers: TaskRemovalBlocker[] = [];
  for (const taskId of selected) {
    blockers.push(...selectedTaskRemovalBlockers(current, taskId, selected));
  }
  for (const [taskId, task] of Object.entries(current.tasks)) {
    if (!selected.has(taskId)) {
      blockers.push(...remainingTaskRemovalBlockers(taskId, task, selected));
    }
  }
  return blockers;
}

export function selectedTaskRemovalBlockers(
  current: TaskIndex,
  taskId: string,
  selected: ReadonlySet<string>
): TaskRemovalBlocker[] {
  const task = requireTask(current, taskId);
  const blockers: TaskRemovalBlocker[] = [];
  const phase = task.state.execution.phase;
  if (phase !== "succeeded" && phase !== "cancelled") {
    blockers.push({ kind: "task-not-terminal", taskId, phase });
  }
  const parentId = task.state.relations.parentId;
  if (parentId !== null && !selected.has(parentId)) {
    blockers.push({
      kind: "parent-crosses-selection",
      taskId,
      relatedTaskId: parentId
    });
  }
  appendCrossingRelations({
    blockers,
    taskId,
    relatedIds: Object.keys(task.state.relations.dependsOn),
    selected,
    kind: "dependency-crosses-selection",
    includeSelected: false
  });
  appendCrossingRelations({
    blockers,
    taskId,
    relatedIds: Object.keys(task.state.relations.excludes),
    selected,
    kind: "exclusion-crosses-selection",
    includeSelected: false
  });
  return blockers;
}

export function remainingTaskRemovalBlockers(
  taskId: string,
  task: TaskIndex["tasks"][string],
  selected: ReadonlySet<string>
): TaskRemovalBlocker[] {
  const blockers: TaskRemovalBlocker[] = [];
  const parentId = task.state.relations.parentId;
  if (parentId !== null && selected.has(parentId)) {
    blockers.push({
      kind: "child-crosses-selection",
      taskId: parentId,
      relatedTaskId: taskId
    });
  }
  appendCrossingRelations({
    blockers,
    taskId,
    relatedIds: Object.keys(task.state.relations.dependsOn),
    selected,
    kind: "dependency-crosses-selection",
    includeSelected: true
  });
  return blockers;
}

type CrossingRelationRequest = Readonly<{
  blockers: TaskRemovalBlocker[];
  includeSelected: boolean;
  kind: "dependency-crosses-selection" | "exclusion-crosses-selection";
  relatedIds: readonly string[];
  selected: ReadonlySet<string>;
  taskId: string;
}>;

export function appendCrossingRelations(
  request: CrossingRelationRequest
): void {
  for (const relatedTaskId of request.relatedIds) {
    if (request.selected.has(relatedTaskId) === request.includeSelected)
      request.blockers.push({
        kind: request.kind,
        relatedTaskId,
        taskId: request.taskId
      });
  }
}

export function sortRemovalBlockers(blockers: TaskRemovalBlocker[]): void {
  blockers.sort(
    (left, right) =>
      compareText(left.taskId, right.taskId) ||
      compareText(left.kind, right.kind) ||
      compareText(
        "relatedTaskId" in left ? left.relatedTaskId : "",
        "relatedTaskId" in right ? right.relatedTaskId : ""
      )
  );
}

export function removeSelectedTasks(
  current: TaskIndex,
  selected: ReadonlySet<string>
): IndexMutation<{ removedTaskIds: string[] }> {
  const candidate = cloneIndex(current);
  const removedTaskIds = [...selected].sort(compareText);
  for (const taskId of removedTaskIds) delete candidate.tasks[taskId];
  candidate.revision = nextRevision(current);
  return {
    index: parseTaskIndex(candidate),
    data: { removedTaskIds }
  };
}
