import type { TaskListItem } from "./types.ts";
import {
  compareParentPaths,
  compareText,
  prepareDisplayTasks,
  requireTask,
  taskLayers,
  type DisplayNode,
  type DisplayTask,
  type MutexGroup,
  type Track,
  minimumTrackLabelDigits,
  parentPath,
  type TaskListLayout
} from "./task-list-model.ts";

function addTrackEdge(
  adjacency: ReadonlyMap<string, Set<string>>,
  leftTaskId: string,
  rightTaskId: string
): void {
  const left = adjacency.get(leftTaskId);
  const right = adjacency.get(rightTaskId);
  if (left === undefined || right === undefined) {
    throw new Error(
      `Task list layout cannot connect ${leftTaskId} and ${rightTaskId}; ` +
        "inspect task-list projection reference validation"
    );
  }
  left.add(rightTaskId);
  right.add(leftTaskId);
}

function trackAdjacency(
  tasks: readonly DisplayTask[]
): ReadonlyMap<string, Set<string>> {
  const adjacency = new Map(
    tasks.map((task) => [task.item.taskId, new Set<string>()])
  );
  for (const { item, needs } of tasks) {
    if (item.parentId !== null)
      addTrackEdge(adjacency, item.taskId, item.parentId);
    for (const dependencyId of needs)
      addTrackEdge(adjacency, item.taskId, dependencyId);
  }
  return adjacency;
}

function collectTrackComponent(
  adjacency: ReadonlyMap<string, Set<string>>,
  unseen: Set<string>,
  rootTaskId: string
): string[] {
  const members: string[] = [];
  const pending = [rootTaskId];
  while (pending.length > 0) {
    const taskId = pending.pop();
    if (taskId === undefined) {
      throw new Error(
        `Task list layout could not pop the non-empty traversal stack rooted at ` +
          `${rootTaskId}; inspect track traversal`
      );
    }
    members.push(taskId);
    const adjacentTaskIds = adjacency.get(taskId);
    if (adjacentTaskIds === undefined) {
      throw new Error(
        `Task list layout lost adjacency for ${taskId}; inspect track construction`
      );
    }
    for (const adjacentId of adjacentTaskIds) {
      if (unseen.delete(adjacentId)) pending.push(adjacentId);
    }
  }
  return members;
}

export function trackComponents(tasks: readonly DisplayTask[]): string[][] {
  const adjacency = trackAdjacency(tasks);
  const unseen = new Set(tasks.map((task) => task.item.taskId));
  const components: string[][] = [];
  for (const { item } of tasks) {
    if (unseen.delete(item.taskId)) {
      components.push(collectTrackComponent(adjacency, unseen, item.taskId));
    }
  }
  return components;
}

export function mutexGroups(tasks: readonly DisplayTask[]): MutexGroup[] {
  const grouped = new Map<string, Set<string>>();
  for (const { item } of tasks) {
    for (const exclusion of item.exclusions) {
      const targetTaskId = exclusion.targetTaskId;
      if (item.taskId === targetTaskId) {
        throw new Error(
          `Task list projection contains a self exclusion at ${item.taskId}; ` +
            "inspect the projected effective exclusions"
        );
      }
      const leftTaskId =
        compareText(item.taskId, targetTaskId) < 0 ? item.taskId : targetTaskId;
      const rightTaskId =
        leftTaskId === item.taskId ? targetTaskId : item.taskId;
      const rightTaskIds = grouped.get(leftTaskId) ?? new Set<string>();
      rightTaskIds.add(rightTaskId);
      grouped.set(leftTaskId, rightTaskIds);
    }
  }

  return [...grouped.entries()]
    .sort(([left], [right]) => compareText(left, right))
    .map(([leftTaskId, rightTaskIds]) => ({
      leftTaskId,
      rightTaskIds: [...rightTaskIds].sort(compareText)
    }));
}

export function layoutTaskList(
  data: Record<string, TaskListItem>
): TaskListLayout {
  const { tasks, tasksById } = prepareDisplayTasks(data);
  const layers = taskLayers(tasks, tasksById);
  const components = trackComponents(tasks);
  const trackLabels = new Map<string, string>();
  const tracks = components.map((taskIds, index): Track => {
    const label = `T${String(index + 1).padStart(minimumTrackLabelDigits, "0")}`;
    const nodes = taskIds
      .map((taskId): DisplayNode => {
        const task = requireTask(tasksById, taskId);
        const layer = layers.get(taskId);
        if (layer === undefined) {
          throw new Error(
            `Task list layout cannot locate a dependency layer for ${taskId}; ` +
              "inspect dependency layer construction"
          );
        }
        return {
          ...task,
          layer,
          parentPath: parentPath(task, tasksById)
        };
      })
      .sort(
        (left, right) =>
          left.layer - right.layer ||
          compareParentPaths(left.parentPath, right.parentPath) ||
          compareText(left.item.taskId, right.item.taskId)
      );
    for (const taskId of taskIds) trackLabels.set(taskId, label);
    return { label, nodes };
  });

  return {
    summary: {
      tasks: tasks.length,
      tracks: tracks.length,
      actionable: tasks.filter((task) => task.item.nextAction !== null).length,
      running: tasks.filter((task) => task.item.effectiveState === "running")
        .length,
      recoveryNeeded: tasks.filter(
        (task) => task.item.effectiveState === "recovery-needed"
      ).length,
      mutexBlocked: tasks.filter((task) => task.mutex.length > 0).length
    },
    tracks,
    trackLabels,
    mutexGroups: mutexGroups(tasks)
  };
}
