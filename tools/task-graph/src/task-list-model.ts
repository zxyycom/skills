import type { JsonValue, TaskBlocker, TaskListItem } from "./types.ts";

export const compareText = (left: string, right: string): number =>
  left < right ? -1 : left > right ? 1 : 0;

export const blockIndent = "  ";
export const maximumInlineItems = 3;
export const minimumInlineColumns = 80;
export const minimumTrackLabelDigits = 2;

export type DisplayBlockerKind =
  | "all-children-cancelled"
  | "ancestor-terminal"
  | "dependency-cancelled"
  | "dependency-failed"
  | "descendant-lease";

export type DisplayBlocker = {
  kind: DisplayBlockerKind;
  relatedTaskId: string;
};

export type FoldedBlockers = {
  blockedBy: DisplayBlocker[];
  mutex: string[];
};

export type DisplayTask = FoldedBlockers & {
  item: TaskListItem;
  needs: string[];
};

export type DisplayNode = DisplayTask & {
  layer: number;
  parentPath: string[];
};

export type Track = {
  label: string;
  nodes: DisplayNode[];
};

export type MutexGroup = {
  leftTaskId: string;
  rightTaskIds: string[];
};

export type TaskListSummary = {
  tasks: number;
  tracks: number;
  actionable: number;
  running: number;
  recoveryNeeded: number;
  mutexBlocked: number;
};

export type TaskListLayout = {
  summary: TaskListSummary;
  tracks: Track[];
  trackLabels: ReadonlyMap<string, string>;
  mutexGroups: MutexGroup[];
};

export type TaskListRenderContext = {
  columns: number;
};

export function sortedUniqueTaskIds(taskIds: Iterable<string>): string[] {
  return [...new Set(taskIds)].sort(compareText);
}

export function compareDisplayBlockers(
  left: DisplayBlocker,
  right: DisplayBlocker
): number {
  return (
    compareText(left.kind, right.kind) ||
    compareText(left.relatedTaskId, right.relatedTaskId)
  );
}

export function sortedUniqueDisplayBlockers(
  blockers: Iterable<DisplayBlocker>
): DisplayBlocker[] {
  const unique: DisplayBlocker[] = [];
  for (const blocker of [...blockers].sort(compareDisplayBlockers)) {
    const previous = unique.at(-1);
    if (
      previous === undefined ||
      compareDisplayBlockers(previous, blocker) !== 0
    ) {
      unique.push(blocker);
    }
  }
  return unique;
}

export function serializeJsonValue(value: JsonValue): string {
  const serialized = JSON.stringify(value);
  if (serialized === undefined) {
    throw new Error(
      "Task list renderer received a value outside JsonValue; " +
        "inspect task-list result construction"
    );
  }
  return serialized;
}

export function unsupportedBlocker(blocker: never): never {
  throw new Error(
    `Task list renderer has no folding rule for blocker ${JSON.stringify(blocker)}; ` +
      "add an explicit foldBlockers() case"
  );
}

const blockerRules = {
  "all-children-cancelled": "blocked",
  "ancestor-terminal": "blocked",
  "child-incomplete": "ignore",
  "control-candidate": "ignore",
  "control-paused": "ignore",
  "control-waiting": "ignore",
  "dependency-cancelled": "blocked",
  "dependency-failed": "blocked",
  "dependency-incomplete": "ignore",
  "descendant-lease": "blocked",
  "exclusion-running": "mutex"
} as const satisfies Record<
  TaskBlocker["kind"],
  "blocked" | "ignore" | "mutex"
>;

export function foldBlockers(blockers: readonly TaskBlocker[]): FoldedBlockers {
  const blockedBy: DisplayBlocker[] = [];
  const mutex: string[] = [];
  for (const blocker of blockers) {
    const rule = blockerRules[blocker.kind];
    if (rule === "blocked") {
      blockedBy.push({
        kind: blocker.kind as DisplayBlockerKind,
        relatedTaskId: blocker.relatedTaskId
      });
    } else if (rule === "mutex") {
      mutex.push(blocker.relatedTaskId);
    }
  }
  return {
    blockedBy: sortedUniqueDisplayBlockers(blockedBy),
    mutex: sortedUniqueTaskIds(mutex)
  };
}

export function dependencyEndpoints(item: TaskListItem): string[] {
  return sortedUniqueTaskIds(
    item.dependencies.map((source) => source.targetTaskId)
  );
}

export function requireTask(
  tasksById: ReadonlyMap<string, DisplayTask>,
  taskId: string
): DisplayTask {
  const task = tasksById.get(taskId);
  if (task === undefined) {
    throw new Error(
      `Task list layout lost task ${taskId}; inspect task-list projection normalization`
    );
  }
  return task;
}

export function prepareDisplayTasks(data: Record<string, TaskListItem>): {
  tasks: DisplayTask[];
  tasksById: ReadonlyMap<string, DisplayTask>;
} {
  const tasks = Object.values(data)
    .sort((left, right) => compareText(left.taskId, right.taskId))
    .map((item): DisplayTask => ({
      item,
      needs: dependencyEndpoints(item),
      ...foldBlockers(item.blockers)
    }));
  const tasksById = new Map(tasks.map((task) => [task.item.taskId, task]));
  return { tasks, tasksById };
}

export function parentPath(
  task: DisplayTask,
  tasksById: ReadonlyMap<string, DisplayTask>
): string[] {
  const path: string[] = [];
  const visited = new Set([task.item.taskId]);
  let parentId = task.item.parentId;
  while (parentId !== null) {
    if (visited.has(parentId)) {
      throw new Error(
        `Task list projection contains a parent cycle at ${parentId}; ` +
          "inspect the projected parent relationships"
      );
    }
    visited.add(parentId);
    path.push(parentId);
    parentId = requireTask(tasksById, parentId).item.parentId;
  }
  return path.reverse();
}

export function compareParentPaths(
  left: readonly string[],
  right: readonly string[]
): number {
  for (const [index, leftTaskId] of left.entries()) {
    const rightTaskId = right[index];
    if (rightTaskId === undefined) return 1;
    const result = compareText(leftTaskId, rightTaskId);
    if (result !== 0) return result;
  }
  return left.length - right.length;
}

export function taskLayers(
  tasks: readonly DisplayTask[],
  tasksById: ReadonlyMap<string, DisplayTask>
): Map<string, number> {
  const layers = new Map<string, number>();
  const visiting = new Set<string>();

  const visit = (taskId: string): number => {
    const known = layers.get(taskId);
    if (known !== undefined) return known;
    if (visiting.has(taskId)) {
      throw new Error(
        `Task list projection contains a dependency cycle at ${taskId}; ` +
          "inspect the projected effective dependencies"
      );
    }
    visiting.add(taskId);
    const task = requireTask(tasksById, taskId);
    let layer = 0;
    for (const dependencyId of task.needs) {
      layer = Math.max(layer, visit(dependencyId) + 1);
    }
    visiting.delete(taskId);
    layers.set(taskId, layer);
    return layer;
  };

  for (const task of tasks) visit(task.item.taskId);
  return layers;
}
