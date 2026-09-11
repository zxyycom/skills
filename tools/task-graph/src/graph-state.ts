import { TaskGraphError } from "./errors.ts";
import {
  ancestorIds,
  childrenByTask,
  compareText,
  descendantIds,
  effectiveControl,
  effectiveDependencySources,
  effectiveExclusionSources
} from "./graph-topology.ts";
import type {
  TaskBlocker,
  TaskEffectiveState,
  TaskIndex,
  TaskProjection
} from "./types.ts";

export function directEffectiveState(
  index: TaskIndex,
  taskId: string,
  now: Date
): TaskEffectiveState {
  const task = index.tasks[taskId];
  if (task === undefined) {
    return "waiting";
  }
  const executionState = directExecutionState(task, now);
  if (executionState !== null) {
    return executionState;
  }
  const control = effectiveControl(index, taskId);
  if (isDirectControlMode(control.mode)) {
    return control.mode;
  }
  return taskIsBlocked(index, taskId) ? "waiting" : "ready";
}

const directControlModes: ReadonlySet<string> = new Set([
  "candidate",
  "waiting",
  "paused"
]);

export function isDirectControlMode(
  mode: TaskProjection["effectiveControl"]["mode"]
): mode is "candidate" | "paused" | "waiting" {
  return directControlModes.has(mode);
}

export function directExecutionState(
  task: TaskIndex["tasks"][string],
  now: Date
): TaskEffectiveState | null {
  const execution = task.state.execution;
  if (execution.phase === "idle") return null;
  if (execution.phase !== "running") return execution.phase;
  return new Date(execution.lease.expiresAt) <= now
    ? "recovery-needed"
    : "running";
}

export function taskIsBlocked(index: TaskIndex, taskId: string): boolean {
  const taskChildren = childrenByTask(index).get(taskId) ?? [];
  const blockers = [
    hasIncompleteDependency(index, taskId),
    hasActiveExclusion(index, taskId, taskChildren),
    hasTerminalAncestor(index, taskId),
    hasIncompleteChildren(index, taskId, taskChildren)
  ];
  return blockers.some(Boolean);
}

export function hasIncompleteDependency(
  index: TaskIndex,
  taskId: string
): boolean {
  return effectiveDependencySources(index, taskId).some(
    (source) =>
      index.tasks[source.targetTaskId]?.state.execution.phase !== "succeeded"
  );
}

export function hasActiveExclusion(
  index: TaskIndex,
  taskId: string,
  taskChildren: readonly string[]
): boolean {
  if (taskChildren.length > 0) return false;
  return effectiveExclusionSources(index, taskId).some(
    (source) =>
      index.tasks[source.targetTaskId]?.state.execution.phase === "running"
  );
}

export function hasTerminalAncestor(index: TaskIndex, taskId: string): boolean {
  return ancestorIds(index, taskId).some((ancestorId) => {
    const phase = index.tasks[ancestorId]?.state.execution.phase;
    return phase === "succeeded" || phase === "cancelled";
  });
}

export function hasIncompleteChildren(
  index: TaskIndex,
  taskId: string,
  taskChildren: readonly string[]
): boolean {
  if (taskChildren.length === 0) return false;
  const terminal = taskChildren.every((childId) => {
    const phase = index.tasks[childId]?.state.execution.phase;
    return phase === "succeeded" || phase === "cancelled";
  });
  const succeeded = taskChildren.some(
    (childId) => index.tasks[childId]?.state.execution.phase === "succeeded"
  );
  const activeDescendant = descendantIds(index, taskId).some(
    (descendantId) =>
      index.tasks[descendantId]?.state.execution.phase === "running"
  );
  return !terminal || !succeeded || activeDescendant;
}

export function blocker(candidate: UncheckedTaskBlocker): TaskBlocker {
  if (isTaskBlocker(candidate)) return candidate;
  throw new TaskGraphError(
    "INDEX_INVALID",
    `Blocker ${candidate.kind} cannot carry state ${candidate.state}`
  );
}

type UncheckedTaskBlocker = TaskBlockerBase & {
  kind: TaskBlocker["kind"];
  state: TaskEffectiveState;
};

type TaskBlockerBase = Pick<
  TaskBlocker,
  "taskId" | "relatedTaskId" | "sourceTaskId" | "inheritancePath"
>;

export function isTaskBlocker(
  candidate: UncheckedTaskBlocker
): candidate is TaskBlocker {
  return blockerStates[candidate.kind].has(candidate.state);
}

const blockerStates: Record<
  TaskBlocker["kind"],
  ReadonlySet<TaskEffectiveState>
> = {
  "all-children-cancelled": new Set(["cancelled"]),
  "ancestor-terminal": new Set(["cancelled", "succeeded"]),
  "child-incomplete": new Set([
    "candidate",
    "failed",
    "paused",
    "ready",
    "recovery-needed",
    "running",
    "waiting"
  ]),
  "control-candidate": new Set(["candidate"]),
  "control-paused": new Set(["paused"]),
  "control-waiting": new Set(["waiting"]),
  "dependency-cancelled": new Set(["cancelled"]),
  "dependency-failed": new Set(["failed"]),
  "dependency-incomplete": new Set([
    "candidate",
    "paused",
    "ready",
    "recovery-needed",
    "running",
    "waiting"
  ]),
  "descendant-lease": new Set(["recovery-needed", "running"]),
  "exclusion-running": new Set(["recovery-needed", "running"])
};

export function sortBlockers(blockers: TaskBlocker[]): TaskBlocker[] {
  const unique = new Map<string, TaskBlocker>();
  for (const item of blockers) {
    unique.set(
      [
        item.kind,
        item.relatedTaskId,
        item.sourceTaskId,
        item.inheritancePath.join("/")
      ].join("\0"),
      item
    );
  }
  return [...unique.values()].sort(
    (left, right) =>
      compareText(left.kind, right.kind) ||
      compareText(left.relatedTaskId, right.relatedTaskId) ||
      compareText(left.sourceTaskId, right.sourceTaskId)
  );
}
