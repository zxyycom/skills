import type {
  JsonValue,
  TaskBlocker,
  TaskGraphFailure,
  TaskGraphResult,
  TaskListItem
} from "./types.ts";

const compareText = (left: string, right: string): number =>
  left < right ? -1 : left > right ? 1 : 0;

const blockIndent = "  ";
const maximumInlineItems = 3;
const minimumInlineColumns = 80;
const minimumTrackLabelDigits = 2;

type DisplayBlockerKind =
  | "all-children-cancelled"
  | "ancestor-terminal"
  | "dependency-cancelled"
  | "dependency-failed"
  | "descendant-lease";

type DisplayBlocker = {
  kind: DisplayBlockerKind;
  relatedTaskId: string;
};

type FoldedBlockers = {
  blockedBy: DisplayBlocker[];
  mutex: string[];
};

type DisplayTask = FoldedBlockers & {
  item: TaskListItem;
  needs: string[];
};

type DisplayNode = DisplayTask & {
  layer: number;
  parentPath: string[];
};

type Track = {
  label: string;
  nodes: DisplayNode[];
};

type MutexGroup = {
  leftTaskId: string;
  rightTaskIds: string[];
};

type TaskListSummary = {
  tasks: number;
  tracks: number;
  actionable: number;
  running: number;
  recoveryNeeded: number;
  mutexBlocked: number;
};

type TaskListLayout = {
  summary: TaskListSummary;
  tracks: Track[];
  trackLabels: ReadonlyMap<string, string>;
  mutexGroups: MutexGroup[];
};

type TaskListRenderContext = {
  columns: number;
};

function sortedUniqueTaskIds(taskIds: Iterable<string>): string[] {
  return [...new Set(taskIds)].sort(compareText);
}

function compareDisplayBlockers(
  left: DisplayBlocker,
  right: DisplayBlocker
): number {
  return (
    compareText(left.kind, right.kind) ||
    compareText(left.relatedTaskId, right.relatedTaskId)
  );
}

function sortedUniqueDisplayBlockers(
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

function serializeJsonValue(value: JsonValue): string {
  const serialized = JSON.stringify(value);
  if (serialized === undefined) {
    throw new Error(
      "Task list renderer received a value outside JsonValue; " +
        "inspect task-list result construction"
    );
  }
  return serialized;
}

function unsupportedBlocker(blocker: never): never {
  throw new Error(
    `Task list renderer has no folding rule for blocker ${JSON.stringify(blocker)}; ` +
      "add an explicit foldBlockers() case"
  );
}

function foldBlockers(blockers: readonly TaskBlocker[]): FoldedBlockers {
  const blockedBy: DisplayBlocker[] = [];
  const mutex: string[] = [];
  for (const blocker of blockers) {
    switch (blocker.kind) {
      case "all-children-cancelled":
      case "ancestor-terminal":
      case "dependency-cancelled":
      case "dependency-failed":
      case "descendant-lease":
        blockedBy.push({
          kind: blocker.kind,
          relatedTaskId: blocker.relatedTaskId
        });
        break;
      case "exclusion-running":
        mutex.push(blocker.relatedTaskId);
        break;
      case "child-incomplete":
      case "control-candidate":
      case "control-paused":
      case "control-waiting":
      case "dependency-incomplete":
        break;
      default:
        unsupportedBlocker(blocker);
    }
  }
  return {
    blockedBy: sortedUniqueDisplayBlockers(blockedBy),
    mutex: sortedUniqueTaskIds(mutex)
  };
}

function dependencyEndpoints(item: TaskListItem): string[] {
  return sortedUniqueTaskIds(
    item.dependencies.map((source) => source.targetTaskId)
  );
}

function requireTask(
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

function prepareDisplayTasks(data: Record<string, TaskListItem>): {
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

function parentPath(
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

function compareParentPaths(
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

function taskLayers(
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

function trackComponents(tasks: readonly DisplayTask[]): string[][] {
  const adjacency = new Map(
    tasks.map((task) => [task.item.taskId, new Set<string>()])
  );
  const addEdge = (leftTaskId: string, rightTaskId: string): void => {
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
  };

  for (const { item, needs } of tasks) {
    if (item.parentId !== null) addEdge(item.taskId, item.parentId);
    for (const dependencyId of needs) addEdge(item.taskId, dependencyId);
  }

  const unseen = new Set(tasks.map((task) => task.item.taskId));
  const components: string[][] = [];
  for (const { item } of tasks) {
    if (!unseen.delete(item.taskId)) continue;
    const members: string[] = [];
    const pending = [item.taskId];
    while (pending.length > 0) {
      const taskId = pending.pop();
      if (taskId === undefined) {
        throw new Error(
          `Task list layout could not pop the non-empty traversal stack rooted at ` +
            `${item.taskId}; inspect track traversal`
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
    components.push(members);
  }
  return components;
}

function mutexGroups(tasks: readonly DisplayTask[]): MutexGroup[] {
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

function layoutTaskList(data: Record<string, TaskListItem>): TaskListLayout {
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

function renderNode(node: DisplayNode, columns: number): string {
  const { item } = node;
  const indent = blockIndent.repeat(node.parentPath.length);
  const detailIndent = `${indent}${blockIndent}`;
  const blockedBy = node.blockedBy.map(
    (blocker) => `${blocker.kind}@${blocker.relatedTaskId}`
  );
  const tokens = [
    ...(item.parentId === null ? [] : [`parent:[${item.parentId}]`]),
    ...(node.needs.length === 0 ? [] : [`needs:[${node.needs.join(",")}]`]),
    ...(blockedBy.length === 0 ? [] : [`blocked-by:[${blockedBy.join(",")}]`]),
    ...(node.mutex.length === 0 ? [] : [`mutex:[${node.mutex.join(",")}]`]),
    ...(item.effectiveControl.reason === null
      ? []
      : [`reason:${serializeJsonValue(item.effectiveControl.reason)}`]),
    ...(item.nextAction === null ? [] : [`next:${item.nextAction}`])
  ];
  const inline =
    columns >= minimumInlineColumns &&
    node.needs.length <= maximumInlineItems &&
    blockedBy.length <= maximumInlineItems &&
    node.mutex.length <= maximumInlineItems;
  if (inline) {
    return [
      `${indent}L${node.layer}`,
      `[${item.taskId}]`,
      item.effectiveState,
      ...tokens,
      item.title
    ].join(" ");
  }
  return [
    `${indent}L${node.layer} [${item.taskId}] ${item.effectiveState}`,
    ...tokens.map((token) => `${detailIndent}${token}`),
    `${detailIndent}title:${item.title}`
  ].join("\n");
}

function requireTrackLabel(
  trackLabels: ReadonlyMap<string, string>,
  taskId: string
): string {
  const trackLabel = trackLabels.get(taskId);
  if (trackLabel === undefined) {
    throw new Error(
      `Task list layout cannot locate a track for mutex endpoint ${taskId}; ` +
        "inspect track label construction"
    );
  }
  return trackLabel;
}

function renderMutexGroup(
  group: MutexGroup,
  trackLabels: ReadonlyMap<string, string>,
  columns: number
): string {
  const left = `${requireTrackLabel(trackLabels, group.leftTaskId)} [${group.leftTaskId}]`;
  const right = group.rightTaskIds.map(
    (taskId) => `${requireTrackLabel(trackLabels, taskId)} [${taskId}]`
  );
  if (columns >= minimumInlineColumns && right.length <= maximumInlineItems) {
    return `${left} mutex ${right.join(", ")}`;
  }
  return [
    `${left} mutex`,
    ...right.map((endpoint) => `${blockIndent}${endpoint}`)
  ].join("\n");
}

function renderSuccess(
  data: Record<string, TaskListItem>,
  columns: number
): string {
  const layout = layoutTaskList(data);
  const { summary } = layout;
  const sections = [
    [
      `TASK LIST tasks=${summary.tasks}`,
      `tracks=${summary.tracks}`,
      `actionable=${summary.actionable}`,
      `running=${summary.running}`,
      `recovery-needed=${summary.recoveryNeeded}`,
      `mutex-blocked=${summary.mutexBlocked}`
    ].join(" "),
    ...layout.tracks.map((track) =>
      [
        `TRACK ${track.label} tasks=${track.nodes.length}`,
        ...track.nodes.map((node) => renderNode(node, columns))
      ].join("\n")
    )
  ];
  if (layout.mutexGroups.length > 0) {
    sections.push(
      [
        "RUN MUTEX - cannot run at the same time",
        ...layout.mutexGroups.map((group) =>
          renderMutexGroup(group, layout.trackLabels, columns)
        )
      ].join("\n")
    );
  }
  return `${sections.join("\n\n")}\n`;
}

function renderFailure(result: TaskGraphFailure): string {
  const lines = [
    [
      `TASK LIST ERROR code=${result.error.code}`,
      `revision=${result.revision}`,
      `retryable=${result.error.retryable}`,
      `message=${serializeJsonValue(result.error.message)}`
    ].join(" ")
  ];
  for (const [key, value] of Object.entries(result.error.details).sort(
    ([left], [right]) => compareText(left, right)
  )) {
    lines.push(`  detail ${key}=${serializeJsonValue(value)}`);
  }
  return `${lines.join("\n")}\n`;
}

export function renderTaskListResult(
  result: TaskGraphResult<Record<string, TaskListItem>>,
  context: TaskListRenderContext
): string {
  return result.ok
    ? renderSuccess(result.data, context.columns)
    : renderFailure(result);
}
