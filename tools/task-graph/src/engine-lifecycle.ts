import { childrenByTask, descendantIds, projectTaskGraph } from "./graph.ts";
import { TaskGraphError } from "./errors.ts";
import type { IndexMutation } from "./engine-content.ts";
import {
  boundedString,
  compareText,
  parseControl,
  requireExpectedRevision,
  requireTask
} from "./engine-content.ts";
import {
  leaseDurationMilliseconds,
  mutateExecution,
  requireRunningLease
} from "./engine-claim.ts";
import { parseTaskResult } from "./schema.ts";
import type {
  CancelTaskOptions,
  TaskControlInput,
  CompleteTaskOptions,
  TaskIndex
} from "./types.ts";

export function renewTaskLease(
  current: TaskIndex,
  options: {
    taskId: string;
    leaseId: string;
    durationSeconds?: number;
  },
  now: Date
): IndexMutation<{ taskId: string; leaseId: string; expiresAt: string }> {
  const duration = leaseDurationMilliseconds(options.durationSeconds ?? 1800);
  return mutateExecution(
    current,
    options.taskId,
    now,
    (candidate, timestamp) => {
      const execution = requireRunningLease(
        candidate,
        options.taskId,
        options.leaseId,
        now,
        false
      );
      const expiresAt = new Date(now.valueOf() + duration).toISOString();
      execution.lease.renewedAt = timestamp;
      execution.lease.expiresAt = expiresAt;
      return { taskId: options.taskId, leaseId: options.leaseId, expiresAt };
    }
  );
}

export function releaseTask(
  current: TaskIndex,
  options: {
    taskId: string;
    leaseId: string;
    control: TaskControlInput;
  },
  now: Date
): IndexMutation<{ taskId: string; phase: "idle" }> {
  return mutateExecution(current, options.taskId, now, (candidate) => {
    const execution = requireRunningLease(
      candidate,
      options.taskId,
      options.leaseId,
      now,
      false
    );
    const task = requireTask(candidate, options.taskId);
    const control = parseControl(options.control);
    if (task.state.relations.parentId === null && control.mode === "inherit") {
      throw new TaskGraphError(
        "STATE_CONFLICT",
        "Top-level task control cannot inherit"
      );
    }
    task.state.execution = { phase: "idle", attempt: execution.attempt };
    task.state.control = control;
    return { taskId: options.taskId, phase: "idle" };
  });
}

export function completeTask(
  current: TaskIndex,
  options: CompleteTaskOptions,
  now: Date
): IndexMutation<{ taskId: string; phase: "succeeded" }> {
  if (
    (options.leaseId === undefined) ===
    (options.expectedRevision === undefined)
  ) {
    throw new TaskGraphError(
      "ARGUMENT_INVALID",
      "Task completion requires exactly one of leaseId or expectedRevision"
    );
  }
  requireTask(current, options.taskId);
  const children = childrenByTask(current).get(options.taskId) ?? [];
  if (children.length === 0) {
    if (options.leaseId === undefined) {
      throw new TaskGraphError(
        "LEASE_CONFLICT",
        `Leaf task ${options.taskId} completion requires its lease`
      );
    }
  } else {
    if (options.expectedRevision === undefined) {
      throw new TaskGraphError(
        "ARGUMENT_INVALID",
        `Parent task ${options.taskId} completion requires expectedRevision`
      );
    }
    requireExpectedRevision(current, options.expectedRevision);
  }
  const result = parseTaskResult(options.result);
  return mutateExecution(current, options.taskId, now, (candidate) => {
    const task = requireTask(candidate, options.taskId);
    if (children.length === 0) {
      const execution = requireRunningLease(
        candidate,
        options.taskId,
        options.leaseId ?? "",
        now,
        false
      );
      task.state.execution = { phase: "succeeded", attempt: execution.attempt };
    } else {
      const projection = projectTaskGraph(candidate, now).tasks[options.taskId];
      if (
        task.state.execution.phase !== "idle" ||
        projection?.effectiveState !== "ready" ||
        projection.nextAction !== "complete"
      ) {
        throw new TaskGraphError(
          "STATE_CONFLICT",
          `Parent task ${options.taskId} does not satisfy completion gate`,
          { projection }
        );
      }
      task.state.execution = {
        phase: "succeeded",
        attempt: task.state.execution.attempt
      };
    }
    task.content.result = result;
    return { taskId: options.taskId, phase: "succeeded" };
  });
}

export function failTask(
  current: TaskIndex,
  options: { taskId: string; leaseId: string; reason: string },
  now: Date
): IndexMutation<{ taskId: string; phase: "failed" }> {
  const reason = boundedString(options.reason, "failure reason", 1000);
  return mutateExecution(current, options.taskId, now, (candidate) => {
    const execution = requireRunningLease(
      candidate,
      options.taskId,
      options.leaseId,
      now,
      false
    );
    const task = requireTask(candidate, options.taskId);
    task.state.execution = {
      phase: "failed",
      attempt: execution.attempt,
      reason
    };
    task.content.result = null;
    return { taskId: options.taskId, phase: "failed" };
  });
}

export function retryTask(
  current: TaskIndex,
  options: { taskId: string; expectedRevision: number },
  now: Date
): IndexMutation<{ taskId: string; phase: "idle" }> {
  requireExpectedRevision(current, options.expectedRevision);
  return mutateExecution(current, options.taskId, now, (candidate) => {
    const task = requireTask(candidate, options.taskId);
    if (task.state.execution.phase !== "failed") {
      throw new TaskGraphError(
        "STATE_CONFLICT",
        `Task ${options.taskId} is not failed`
      );
    }
    task.state.execution = {
      phase: "idle",
      attempt: task.state.execution.attempt
    };
    return { taskId: options.taskId, phase: "idle" };
  });
}

export function cancelTask(
  current: TaskIndex,
  options: CancelTaskOptions,
  now: Date
): IndexMutation<{ taskId: string; cancelledTaskIds: string[] }> {
  if (
    (options.leaseId === undefined) ===
    (options.expectedRevision === undefined)
  ) {
    throw new TaskGraphError(
      "ARGUMENT_INVALID",
      "Task cancellation requires exactly one of leaseId or expectedRevision"
    );
  }
  const reason = boundedString(options.reason, "cancellation reason", 1000);
  const currentTask = requireTask(current, options.taskId);
  if (currentTask.state.execution.phase === "running") {
    if (options.leaseId === undefined) {
      throw new TaskGraphError(
        "LEASE_CONFLICT",
        `Running task ${options.taskId} cancellation requires its lease`
      );
    }
  } else {
    if (options.expectedRevision === undefined) {
      throw new TaskGraphError(
        "ARGUMENT_INVALID",
        `Non-running task ${options.taskId} cancellation requires expectedRevision`
      );
    }
    requireExpectedRevision(current, options.expectedRevision);
  }
  return mutateExecution(current, options.taskId, now, (candidate, timestamp) =>
    applyCancelMutation(candidate, timestamp, { now, options, reason })
  );
}

export function applyCancelMutation(
  candidate: TaskIndex,
  timestamp: string,
  context: { now: Date; options: CancelTaskOptions; reason: string }
): { taskId: string; cancelledTaskIds: string[] } {
  const task = requireTask(candidate, context.options.taskId);
  assertTaskCanBeCancelled(candidate, task, context);
  const targets = [context.options.taskId].concat(
    descendantIds(candidate, context.options.taskId)
  );
  assertNoActiveDescendant(candidate, context.options.taskId, targets);
  const cancelledTaskIds = cancelTargets(
    candidate,
    targets,
    timestamp,
    context.reason
  );
  return { cancelledTaskIds, taskId: context.options.taskId };
}

export function assertTaskCanBeCancelled(
  candidate: TaskIndex,
  task: TaskIndex["tasks"][string],
  context: { now: Date; options: CancelTaskOptions }
): void {
  const phase = task.state.execution.phase;
  if (phase === "succeeded" || phase === "cancelled") {
    throw new TaskGraphError(
      "STATE_CONFLICT",
      `Terminal task ${context.options.taskId} cannot be cancelled again`
    );
  }
  if (phase === "running") {
    requireRunningLease(
      candidate,
      context.options.taskId,
      context.options.leaseId ?? "",
      context.now,
      false
    );
  }
}

export function assertNoActiveDescendant(
  candidate: TaskIndex,
  taskId: string,
  targets: readonly string[]
): void {
  for (const targetId of targets) {
    if (
      targetId !== taskId &&
      candidate.tasks[targetId]?.state.execution.phase === "running"
    ) {
      throw new TaskGraphError(
        "STATE_CONFLICT",
        `Descendant ${targetId} has an active or recovery lease`,
        { taskId: targetId }
      );
    }
  }
}

export function cancelTargets(
  candidate: TaskIndex,
  targets: readonly string[],
  timestamp: string,
  reason: string
): string[] {
  const cancelledTaskIds: string[] = [];
  for (const targetId of targets) {
    const target = candidate.tasks[targetId];
    if (target === undefined) continue;
    const phase = target.state.execution.phase;
    if (phase === "succeeded" || phase === "cancelled") continue;
    target.state.execution = {
      attempt: target.state.execution.attempt,
      phase: "cancelled",
      reason
    };
    target.content.result = null;
    target.state.timestamps.updatedAt = timestamp;
    cancelledTaskIds.push(targetId);
  }
  return cancelledTaskIds.sort(compareText);
}
