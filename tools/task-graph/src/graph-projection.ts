import { TaskGraphError } from "./errors.ts";
import {
  ancestorIds,
  childrenByTask,
  compareText,
  descendantIds,
  effectiveControl,
  effectiveDependencySources,
  effectiveExclusionSources,
  lineage
} from "./graph-topology.ts";
import { blocker, directEffectiveState, sortBlockers } from "./graph-state.ts";
import type {
  TaskBlocker,
  TaskEffectiveState,
  TaskGraphProjection,
  TaskIndex,
  TaskProjection
} from "./types.ts";

export function projectOneTask(
  index: TaskIndex,
  taskId: string,
  now: Date,
  children: Map<string, string[]>,
  dependents: Map<string, string[]>
): TaskProjection {
  const task = Object.hasOwn(index.tasks, taskId)
    ? index.tasks[taskId]
    : undefined;
  if (task === undefined) {
    throw new TaskGraphError("TASK_NOT_FOUND", `Task ${taskId} does not exist`);
  }
  const control = effectiveControl(index, taskId);
  const dependencies = effectiveDependencySources(index, taskId);
  const exclusions = effectiveExclusionSources(index, taskId);
  const taskChildren = children.get(taskId) ?? [];
  const phase = task.state.execution.phase;
  const commonProjection = {
    taskId,
    effectiveControl: control,
    dependencies,
    exclusions,
    children: [...taskChildren],
    dependents: [...(dependents.get(taskId) ?? [])]
  };
  if (phase !== "idle") {
    const effectiveState = directEffectiveState(index, taskId, now);
    return {
      ...commonProjection,
      effectiveState,
      blockers: [],
      nextAction: effectiveState === "recovery-needed" ? "claim" : null
    };
  }
  const blockers: TaskBlocker[] = [];

  if (control.mode === "candidate") {
    blockers.push(
      blocker({
        kind: "control-candidate",
        taskId: taskId,
        relatedTaskId: control.sourceTaskId,
        sourceTaskId: control.sourceTaskId,
        inheritancePath: control.inheritancePath,
        state: control.mode
      })
    );
  } else if (control.mode === "waiting") {
    blockers.push(
      blocker({
        kind: "control-waiting",
        taskId: taskId,
        relatedTaskId: control.sourceTaskId,
        sourceTaskId: control.sourceTaskId,
        inheritancePath: control.inheritancePath,
        state: control.mode
      })
    );
  } else if (control.mode === "paused") {
    blockers.push(
      blocker({
        kind: "control-paused",
        taskId: taskId,
        relatedTaskId: control.sourceTaskId,
        sourceTaskId: control.sourceTaskId,
        inheritancePath: control.inheritancePath,
        state: control.mode
      })
    );
  }

  if (control.mode !== "queued") {
    return {
      ...commonProjection,
      effectiveState: control.mode,
      blockers: sortBlockers(blockers),
      nextAction: null
    };
  }

  for (const dependency of dependencies) {
    const target = index.tasks[dependency.targetTaskId];
    if (target === undefined || target.state.execution.phase === "succeeded") {
      continue;
    }
    const phase = target.state.execution.phase;
    blockers.push(
      blocker({
        kind:
          phase === "failed"
            ? "dependency-failed"
            : phase === "cancelled"
              ? "dependency-cancelled"
              : "dependency-incomplete",
        taskId: taskId,
        relatedTaskId: dependency.targetTaskId,
        sourceTaskId: dependency.sourceTaskId,
        inheritancePath: dependency.inheritancePath,
        state: directEffectiveState(index, dependency.targetTaskId, now)
      })
    );
  }

  for (const exclusion of taskChildren.length === 0 ? exclusions : []) {
    const target = index.tasks[exclusion.targetTaskId];
    if (target?.state.execution.phase !== "running") {
      continue;
    }
    blockers.push(
      blocker({
        kind: "exclusion-running",
        taskId: taskId,
        relatedTaskId: exclusion.targetTaskId,
        sourceTaskId: exclusion.sourceTaskId,
        inheritancePath: exclusion.inheritancePath,
        state: directEffectiveState(index, exclusion.targetTaskId, now)
      })
    );
  }

  for (const ancestorId of ancestorIds(index, taskId)) {
    const ancestor = index.tasks[ancestorId];
    const phase = ancestor?.state.execution.phase;
    if (phase === "succeeded" || phase === "cancelled") {
      blockers.push(
        blocker({
          kind: "ancestor-terminal",
          taskId: taskId,
          relatedTaskId: ancestorId,
          sourceTaskId: ancestorId,
          inheritancePath: lineage(index, taskId).slice(
            0,
            lineage(index, taskId).indexOf(ancestorId) + 1
          ),
          state: phase
        })
      );
    }
  }

  if (taskChildren.length > 0) {
    for (const childId of taskChildren) {
      const child = index.tasks[childId];
      if (
        child !== undefined &&
        child.state.execution.phase !== "succeeded" &&
        child.state.execution.phase !== "cancelled"
      ) {
        blockers.push(
          blocker({
            kind: "child-incomplete",
            taskId: taskId,
            relatedTaskId: childId,
            sourceTaskId: taskId,
            inheritancePath: [taskId],
            state: directEffectiveState(index, childId, now)
          })
        );
      }
    }
    if (
      taskChildren.every(
        (childId) => index.tasks[childId]?.state.execution.phase === "cancelled"
      )
    ) {
      blockers.push(
        blocker({
          kind: "all-children-cancelled",
          taskId: taskId,
          relatedTaskId: taskId,
          sourceTaskId: taskId,
          inheritancePath: [taskId],
          state: "cancelled"
        })
      );
    }
    for (const descendantId of descendantIds(index, taskId)) {
      const descendant = index.tasks[descendantId];
      if (descendant?.state.execution.phase === "running") {
        blockers.push(
          blocker({
            kind: "descendant-lease",
            taskId: taskId,
            relatedTaskId: descendantId,
            sourceTaskId: taskId,
            inheritancePath: [taskId],
            state: directEffectiveState(index, descendantId, now)
          })
        );
      }
    }
  }

  const sortedBlockers = sortBlockers(blockers);
  let effectiveState: TaskEffectiveState;
  let nextAction: TaskProjection["nextAction"] = null;
  if (sortedBlockers.length > 0) {
    effectiveState = "waiting";
  } else {
    effectiveState = "ready";
    nextAction = taskChildren.length === 0 ? "claim" : "complete";
  }

  return {
    ...commonProjection,
    effectiveState,
    blockers: sortedBlockers,
    nextAction
  };
}

export function projectTaskGraph(
  index: TaskIndex,
  now: Date
): TaskGraphProjection {
  const children = childrenByTask(index);
  const dependents = new Map<string, string[]>(
    Object.keys(index.tasks).map((taskId) => [taskId, []])
  );
  for (const taskId of Object.keys(index.tasks)) {
    for (const dependency of effectiveDependencySources(index, taskId)) {
      const targets = dependents.get(dependency.targetTaskId);
      if (targets !== undefined && !targets.includes(taskId)) {
        targets.push(taskId);
      }
    }
  }
  for (const targets of dependents.values()) {
    targets.sort(compareText);
  }

  const tasks: Record<string, TaskProjection> = {};
  for (const taskId of Object.keys(index.tasks).sort(compareText)) {
    tasks[taskId] = projectOneTask(index, taskId, now, children, dependents);
  }
  const actionableOrder = Object.keys(tasks).filter(
    (taskId) => tasks[taskId]?.nextAction !== null
  );
  return {
    revision: index.revision,
    tasks,
    actionable: Object.fromEntries(
      actionableOrder.map((taskId) => [taskId, tasks[taskId]])
    ),
    actionableOrder
  };
}

export function detectCycle(edges: Map<string, Set<string>>): string[] | null {
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const stack: string[] = [];
  const visit = (node: string): string[] | null => {
    if (visiting.has(node)) {
      const offset = stack.indexOf(node);
      return [...stack.slice(offset), node];
    }
    if (visited.has(node)) {
      return null;
    }
    visiting.add(node);
    stack.push(node);
    for (const target of edges.get(node) ?? []) {
      const found = visit(target);
      if (found !== null) {
        return found;
      }
    }
    stack.pop();
    visiting.delete(node);
    visited.add(node);
    return null;
  };
  for (const node of edges.keys()) {
    const found = visit(node);
    if (found !== null) {
      return found;
    }
  }
  return null;
}
