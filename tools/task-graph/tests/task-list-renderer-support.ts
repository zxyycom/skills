import type {
  TaskBlocker,
  TaskConstraintSource,
  TaskEffectiveState,
  TaskExecutionPhase,
  TaskGraphResult,
  TaskListItem
} from "../src/types.ts";

export type ItemOptions = Readonly<{
  blockers?: TaskBlocker[];
  dependencyTargets?: string[];
  effectiveState?: TaskEffectiveState;
  exclusionTargets?: string[];
  nextAction?: TaskListItem["nextAction"];
  parentId?: string | null;
  phase?: TaskExecutionPhase;
  reason?: string | null;
  title?: string;
}>;

export function constraint(
  sourceTaskId: string,
  targetTaskId: string
): TaskConstraintSource {
  return {
    targetTaskId,
    sourceTaskId,
    inheritancePath: [sourceTaskId],
    declaredTargetTaskId: targetTaskId,
    targetInheritancePath: [targetTaskId]
  };
}

export function item(taskId: string, options: ItemOptions = {}): TaskListItem {
  const {
    blockers = [],
    dependencyTargets = [],
    effectiveState = "waiting",
    exclusionTargets = [],
    nextAction = null,
    parentId = null,
    phase = "idle",
    reason = null,
    title = taskId
  } = options;
  return {
    taskId,
    title,
    parentId,
    phase,
    effectiveState,
    effectiveControl: {
      mode: "queued",
      reason,
      sourceTaskId: taskId,
      inheritancePath: [taskId]
    },
    blockers,
    dependencies: dependencyTargets.map((targetTaskId) =>
      constraint(taskId, targetTaskId)
    ),
    exclusions: exclusionTargets.map((targetTaskId) =>
      constraint(taskId, targetTaskId)
    ),
    children: [],
    dependents: [],
    nextAction
  };
}

export function blocker(value: TaskBlocker): TaskBlocker {
  return value;
}

export function dictionary(
  items: readonly TaskListItem[]
): Record<string, TaskListItem> {
  return Object.fromEntries(items.map((entry) => [entry.taskId, entry]));
}

export function successData(
  data: Record<string, TaskListItem>
): TaskGraphResult<Record<string, TaskListItem>> {
  return {
    ok: true,
    indexPath: "/workspace/docs/task-graph/task-graph-index.json",
    revision: 12,
    data
  };
}

export function success(
  items: readonly TaskListItem[]
): TaskGraphResult<Record<string, TaskListItem>> {
  return successData(dictionary(items));
}
