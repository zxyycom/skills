import {
  assertProtectedTopologyUnchanged,
  assertRunningControlUnchanged,
  childrenByTask,
  descendantIds,
  projectTaskGraph
} from "./graph.ts";
import { TaskGraphError, taskGraphError } from "./errors.ts";
import {
  normalizeTaskContent,
  normalizeTaskControl,
  parseTaskGraphApplyRequest,
  parseTaskIndex,
  parseTaskResult
} from "./schema.ts";
import type {
  CancelTaskOptions,
  ClaimTaskOptions,
  CompleteTaskOptions,
  RemoveTasksOptions,
  TaskContentInput,
  TaskControlInput,
  TaskExecutionPhase,
  TaskGraphApplyRequest,
  TaskGraphApplyResult,
  TaskGraphRevisionOperation,
  TaskIndex
} from "./types.ts";

const compareText = (left: string, right: string): number =>
  left < right ? -1 : left > right ? 1 : 0;

export type IndexMutation<TData> = {
  index: TaskIndex;
  data: TData;
};

function formatTaskId(value: number): string {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new TaskGraphError(
      "STATE_CONFLICT",
      "Cannot allocate task id outside the positive safe integer range",
      { value }
    );
  }
  return `task-${String(value).padStart(6, "0")}`;
}

function nextRevision(index: TaskIndex): number {
  if (index.revision >= Number.MAX_SAFE_INTEGER) {
    throw new TaskGraphError(
      "STATE_CONFLICT",
      "Task index revision has reached the safe integer limit"
    );
  }
  return index.revision + 1;
}

function cloneIndex(index: TaskIndex): TaskIndex {
  return structuredClone(index);
}

function requireExpectedRevision(
  index: TaskIndex,
  expectedRevision: number
): void {
  if (index.revision !== expectedRevision) {
    throw new TaskGraphError(
      "REVISION_CONFLICT",
      `Expected revision ${expectedRevision}, found ${index.revision}`,
      { expectedRevision, actualRevision: index.revision }
    );
  }
}

function requireTask(index: TaskIndex, taskId: string) {
  const task = Object.hasOwn(index.tasks, taskId)
    ? index.tasks[taskId]
    : undefined;
  if (task === undefined) {
    throw new TaskGraphError(
      "TASK_NOT_FOUND",
      `Task ${taskId} does not exist`,
      { taskId }
    );
  }
  return task;
}

function canonicalNow(now: Date): string {
  if (Number.isNaN(now.valueOf())) {
    throw new TaskGraphError(
      "ARGUMENT_INVALID",
      "Clock returned an invalid date"
    );
  }
  return now.toISOString();
}

function boundedString(
  value: unknown,
  label: string,
  maximum: number,
  options: { singleLine?: boolean } = {}
): string {
  if (typeof value !== "string") {
    throw new TaskGraphError("ARGUMENT_INVALID", `${label} must be a string`);
  }
  const length = Array.from(value).length;
  if (
    length < 1 ||
    length > maximum ||
    value.trim() !== value ||
    (options.singleLine === true && /[\r\n]/u.test(value))
  ) {
    throw new TaskGraphError(
      "ARGUMENT_INVALID",
      `${label} must be trimmed${options.singleLine === true ? " single-line" : ""} text from 1 to ${maximum} Unicode code points`
    );
  }
  return value;
}

function updateTaskTime(index: TaskIndex, taskId: string, now: string): void {
  const task = index.tasks[taskId];
  if (task !== undefined) {
    task.state.timestamps.updatedAt = now;
  }
}

function parseControl(input: TaskControlInput) {
  try {
    return normalizeTaskControl(input);
  } catch (error) {
    throw taskGraphError(error, "REQUEST_INVALID");
  }
}

function createTask(
  index: TaskIndex,
  operation: Extract<TaskGraphRevisionOperation, { kind: "create-task" }>,
  now: string
): string {
  const before = structuredClone(index);
  const parentId = operation.parentId ?? null;
  if (parentId !== null) {
    const parent = requireTask(index, parentId);
    if (parent.state.execution.phase !== "idle") {
      throw new TaskGraphError(
        "STATE_CONFLICT",
        `Parent ${parentId} must be idle before adding a child`,
        { parentId, phase: parent.state.execution.phase }
      );
    }
  }
  const control =
    operation.control === undefined
      ? parentId === null
        ? { mode: "candidate" as const, reason: null }
        : { mode: "inherit" as const, reason: null }
      : parseControl(operation.control);
  if (parentId === null && control.mode === "inherit") {
    throw new TaskGraphError(
      "STATE_CONFLICT",
      "Top-level task control cannot inherit"
    );
  }
  const taskId = formatTaskId(index.nextTaskId);
  index.nextTaskId += 1;
  index.tasks[taskId] = {
    content: normalizeTaskContent(operation.content),
    state: {
      control,
      execution: { phase: "idle", attempt: 0 },
      relations: { parentId, dependsOn: {}, excludes: {} },
      timestamps: { createdAt: now, updatedAt: now }
    }
  };
  assertProtectedTopologyUnchanged(before, index);
  return taskId;
}

function updateTaskContent(
  index: TaskIndex,
  operation: Extract<
    TaskGraphRevisionOperation,
    { kind: "update-task-content" }
  >,
  now: string
): void {
  const task = requireTask(index, operation.taskId);
  const phase = task.state.execution.phase;
  if (phase === "running" || phase === "succeeded" || phase === "cancelled") {
    throw new TaskGraphError(
      "STATE_CONFLICT",
      `Content for ${phase} task ${operation.taskId} cannot change`,
      { taskId: operation.taskId, phase }
    );
  }
  task.content = normalizeTaskContent(operation.content);
  updateTaskTime(index, operation.taskId, now);
}

function updateTaskControl(
  index: TaskIndex,
  operation: Extract<
    TaskGraphRevisionOperation,
    { kind: "update-task-control" }
  >,
  now: string
): void {
  const before = structuredClone(index);
  const task = requireTask(index, operation.taskId);
  if (
    task.state.execution.phase === "succeeded" ||
    task.state.execution.phase === "cancelled"
  ) {
    throw new TaskGraphError(
      "STATE_CONFLICT",
      `Control for terminal task ${operation.taskId} cannot change`
    );
  }
  const control = parseControl(operation.control);
  if (task.state.relations.parentId === null && control.mode === "inherit") {
    throw new TaskGraphError(
      "STATE_CONFLICT",
      "Top-level task control cannot inherit"
    );
  }
  task.state.control = control;
  assertRunningControlUnchanged(before, index);
  updateTaskTime(index, operation.taskId, now);
}

function setParent(
  index: TaskIndex,
  operation: Extract<TaskGraphRevisionOperation, { kind: "set-parent" }>,
  now: string
): void {
  const before = structuredClone(index);
  const task = requireTask(index, operation.taskId);
  if (operation.parentId !== null) {
    const parent = requireTask(index, operation.parentId);
    if (parent.state.execution.phase !== "idle") {
      throw new TaskGraphError(
        "STATE_CONFLICT",
        `Parent ${operation.parentId} must be idle before adding a child`,
        { parentId: operation.parentId, phase: parent.state.execution.phase }
      );
    }
  }
  task.state.relations.parentId = operation.parentId;
  assertProtectedTopologyUnchanged(before, index);
  updateTaskTime(index, operation.taskId, now);
}

function setDependency(
  index: TaskIndex,
  operation: Extract<TaskGraphRevisionOperation, { kind: "set-dependency" }>,
  now: string
): void {
  const before = structuredClone(index);
  const task = requireTask(index, operation.taskId);
  requireTask(index, operation.dependencyId);
  if (operation.present) {
    task.state.relations.dependsOn[operation.dependencyId] = true;
  } else {
    delete task.state.relations.dependsOn[operation.dependencyId];
  }
  assertProtectedTopologyUnchanged(before, index);
  updateTaskTime(index, operation.taskId, now);
}

function setExclusion(
  index: TaskIndex,
  operation: Extract<TaskGraphRevisionOperation, { kind: "set-exclusion" }>,
  now: string
): void {
  const before = structuredClone(index);
  const task = requireTask(index, operation.taskId);
  const other = requireTask(index, operation.excludedTaskId);
  if (operation.present) {
    task.state.relations.excludes[operation.excludedTaskId] = true;
    other.state.relations.excludes[operation.taskId] = true;
  } else {
    delete task.state.relations.excludes[operation.excludedTaskId];
    delete other.state.relations.excludes[operation.taskId];
  }
  assertProtectedTopologyUnchanged(before, index);
  updateTaskTime(index, operation.taskId, now);
  updateTaskTime(index, operation.excludedTaskId, now);
}

function resolveTaskReference(
  value: string,
  aliases: ReadonlyMap<string, string>
): string {
  if (!value.startsWith("@")) {
    return value;
  }
  const alias = value.slice(1);
  const taskId = aliases.get(alias);
  if (taskId === undefined) {
    throw new TaskGraphError(
      "REQUEST_INVALID",
      `Apply alias @${alias} has not been created earlier in this transaction`,
      { alias }
    );
  }
  return taskId;
}

function resolveOperationAliases(
  operation: TaskGraphRevisionOperation,
  aliases: ReadonlyMap<string, string>
): TaskGraphRevisionOperation {
  switch (operation.kind) {
    case "create-task":
      return {
        ...operation,
        parentId:
          operation.parentId === undefined || operation.parentId === null
            ? operation.parentId
            : resolveTaskReference(operation.parentId, aliases)
      };
    case "update-task-content":
    case "update-task-control":
      return {
        ...operation,
        taskId: resolveTaskReference(operation.taskId, aliases)
      };
    case "set-parent":
      return {
        ...operation,
        taskId: resolveTaskReference(operation.taskId, aliases),
        parentId:
          operation.parentId === null
            ? null
            : resolveTaskReference(operation.parentId, aliases)
      };
    case "set-dependency":
      return {
        ...operation,
        taskId: resolveTaskReference(operation.taskId, aliases),
        dependencyId: resolveTaskReference(operation.dependencyId, aliases)
      };
    case "set-exclusion":
      return {
        ...operation,
        taskId: resolveTaskReference(operation.taskId, aliases),
        excludedTaskId: resolveTaskReference(operation.excludedTaskId, aliases)
      };
  }
}

export function applyTaskGraphOperations(
  current: TaskIndex,
  requestInput: TaskGraphApplyRequest,
  now: Date
): IndexMutation<TaskGraphApplyResult> {
  const request = parseTaskGraphApplyRequest(requestInput);
  requireExpectedRevision(current, request.expectedRevision);
  const candidate = cloneIndex(current);
  const timestamp = canonicalNow(now);
  const aliases = new Map<string, string>();
  const createdTaskIds: string[] = [];

  for (const rawOperation of request.operations) {
    const operation = resolveOperationAliases(rawOperation, aliases);
    switch (operation.kind) {
      case "create-task": {
        if (operation.alias !== undefined && aliases.has(operation.alias)) {
          throw new TaskGraphError(
            "REQUEST_INVALID",
            `Apply alias ${operation.alias} is duplicated`,
            { alias: operation.alias }
          );
        }
        const taskId = createTask(candidate, operation, timestamp);
        createdTaskIds.push(taskId);
        if (operation.alias !== undefined) {
          aliases.set(operation.alias, taskId);
        }
        break;
      }
      case "update-task-content":
        updateTaskContent(candidate, operation, timestamp);
        break;
      case "update-task-control":
        updateTaskControl(candidate, operation, timestamp);
        break;
      case "set-parent":
        setParent(candidate, operation, timestamp);
        break;
      case "set-dependency":
        setDependency(candidate, operation, timestamp);
        break;
      case "set-exclusion":
        setExclusion(candidate, operation, timestamp);
        break;
    }
  }
  candidate.revision = nextRevision(current);
  const index = parseTaskIndex(candidate);
  return {
    index,
    data: {
      aliases: Object.fromEntries(
        [...aliases.entries()].sort(([left], [right]) =>
          compareText(left, right)
        )
      ),
      createdTaskIds
    }
  };
}

function mutateExecution<TData>(
  current: TaskIndex,
  taskId: string,
  now: Date,
  mutate: (candidate: TaskIndex, timestamp: string) => TData
): IndexMutation<TData> {
  const candidate = cloneIndex(current);
  requireTask(candidate, taskId);
  const timestamp = canonicalNow(now);
  const data = mutate(candidate, timestamp);
  updateTaskTime(candidate, taskId, timestamp);
  candidate.revision = nextRevision(current);
  return { index: parseTaskIndex(candidate), data };
}

function leaseDurationMilliseconds(durationSeconds: number): number {
  if (
    !Number.isInteger(durationSeconds) ||
    durationSeconds < 60 ||
    durationSeconds > 86_400
  ) {
    throw new TaskGraphError(
      "ARGUMENT_INVALID",
      "Lease duration must be an integer from 60 to 86400 seconds",
      { durationSeconds }
    );
  }
  return durationSeconds * 1000;
}

function canonicalLeaseId(value: string): string {
  const id = value.startsWith("lease-") ? value : `lease-${value}`;
  if (
    !/^lease-[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u.test(
      id
    )
  ) {
    throw new TaskGraphError(
      "ARGUMENT_INVALID",
      "Lease generator returned a non-canonical UUID",
      { leaseId: id }
    );
  }
  return id;
}

function requireRunningLease(
  index: TaskIndex,
  taskId: string,
  leaseId: string,
  now: Date,
  allowExpired: boolean
) {
  const task = requireTask(index, taskId);
  const execution = task.state.execution;
  if (execution.phase !== "running" || execution.lease.id !== leaseId) {
    throw new TaskGraphError(
      "LEASE_CONFLICT",
      `Lease ${leaseId} does not own task ${taskId}`,
      { taskId, leaseId }
    );
  }
  if (!allowExpired && new Date(execution.lease.expiresAt) <= now) {
    throw new TaskGraphError(
      "LEASE_EXPIRED",
      `Lease ${leaseId} has expired and requires claim recovery`,
      { taskId, leaseId, expiresAt: execution.lease.expiresAt }
    );
  }
  return execution;
}

export function claimTask(
  current: TaskIndex,
  options: ClaimTaskOptions & { leaseUuid: string },
  now: Date
): IndexMutation<{ taskId: string; leaseId: string; expiresAt: string }> {
  const duration = leaseDurationMilliseconds(options.durationSeconds ?? 1800);
  const actor = boundedString(options.actor, "actor", 200, {
    singleLine: true
  });
  const recoveryValues = [
    options.recoverLeaseId,
    options.expectedRevision,
    options.reason
  ];
  const recoveryValueCount = recoveryValues.filter(
    (value) => value !== undefined
  ).length;
  if (
    recoveryValueCount !== 0 &&
    recoveryValueCount !== recoveryValues.length
  ) {
    throw new TaskGraphError(
      "ARGUMENT_INVALID",
      "Expired lease recovery requires recoverLeaseId, expectedRevision, and reason together"
    );
  }
  const recovering = recoveryValueCount === recoveryValues.length;
  if (recovering) boundedString(options.reason ?? "", "recovery reason", 1000);
  return mutateExecution(
    current,
    options.taskId,
    now,
    (candidate, timestamp) => {
      const task = requireTask(candidate, options.taskId);
      const projection = projectTaskGraph(candidate, now).tasks[options.taskId];
      const execution = task.state.execution;
      if (execution.phase === "idle") {
        if (recovering) {
          throw new TaskGraphError(
            "ARGUMENT_INVALID",
            "An idle task claim does not accept lease recovery arguments"
          );
        }
        if (
          projection?.effectiveState !== "ready" ||
          projection.nextAction !== "claim"
        ) {
          throw new TaskGraphError(
            "STATE_CONFLICT",
            `Task ${options.taskId} is not claimable`,
            { projection }
          );
        }
      } else if (execution.phase === "running") {
        if (new Date(execution.lease.expiresAt) > now) {
          throw new TaskGraphError(
            "LEASE_CONFLICT",
            `Task ${options.taskId} still has an active lease`,
            {
              leaseId: execution.lease.id,
              expiresAt: execution.lease.expiresAt
            }
          );
        }
        if (!recovering) {
          throw new TaskGraphError(
            "LEASE_EXPIRED",
            `Task ${options.taskId} requires explicit expired lease recovery`,
            {
              leaseId: execution.lease.id,
              expiresAt: execution.lease.expiresAt
            }
          );
        }
        requireExpectedRevision(candidate, options.expectedRevision ?? -1);
        if (execution.lease.id !== options.recoverLeaseId) {
          throw new TaskGraphError(
            "LEASE_CONFLICT",
            `Lease ${options.recoverLeaseId ?? ""} does not own task ${options.taskId}`,
            {
              expectedLeaseId: execution.lease.id,
              recoverLeaseId: options.recoverLeaseId ?? ""
            }
          );
        }
        if (
          projection?.effectiveState !== "recovery-needed" ||
          projection.nextAction !== "claim"
        ) {
          throw new TaskGraphError(
            "STATE_CONFLICT",
            `Task ${options.taskId} is not recoverable through claim`,
            { projection }
          );
        }
      } else {
        throw new TaskGraphError(
          "STATE_CONFLICT",
          `Task ${options.taskId} is not claimable`,
          { projection }
        );
      }
      const leaseId = canonicalLeaseId(options.leaseUuid);
      for (const [candidateTaskId, candidateTask] of Object.entries(
        candidate.tasks
      )) {
        const candidateExecution = candidateTask.state.execution;
        if (
          candidateExecution.phase === "running" &&
          candidateExecution.lease.id === leaseId
        ) {
          throw new TaskGraphError(
            "LEASE_CONFLICT",
            `Lease ${leaseId} is already assigned to another running task`,
            {
              leaseId,
              ownerTaskId: candidateTaskId,
              requestedTaskId: options.taskId
            }
          );
        }
      }
      const expiresAt = new Date(now.valueOf() + duration).toISOString();
      task.state.execution = {
        phase: "running",
        attempt: task.state.execution.attempt + 1,
        lease: {
          id: leaseId,
          actor,
          claimedAt: timestamp,
          renewedAt: timestamp,
          expiresAt
        }
      };
      return { taskId: options.taskId, leaseId, expiresAt };
    }
  );
}

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
  return mutateExecution(
    current,
    options.taskId,
    now,
    (candidate, timestamp) => {
      const task = requireTask(candidate, options.taskId);
      if (
        task.state.execution.phase === "succeeded" ||
        task.state.execution.phase === "cancelled"
      ) {
        throw new TaskGraphError(
          "STATE_CONFLICT",
          `Terminal task ${options.taskId} cannot be cancelled again`
        );
      }
      if (task.state.execution.phase === "running") {
        requireRunningLease(
          candidate,
          options.taskId,
          options.leaseId ?? "",
          now,
          false
        );
      }
      const targets = [
        options.taskId,
        ...descendantIds(candidate, options.taskId)
      ];
      for (const targetId of targets) {
        if (candidate.tasks[targetId]?.state.execution.phase === "running") {
          if (targetId !== options.taskId) {
            throw new TaskGraphError(
              "STATE_CONFLICT",
              `Descendant ${targetId} has an active or recovery lease`,
              { taskId: targetId }
            );
          }
        }
      }
      const cancelledTaskIds: string[] = [];
      for (const targetId of targets) {
        const target = candidate.tasks[targetId];
        if (target === undefined) continue;
        const phase = target.state.execution.phase;
        if (phase === "succeeded" || phase === "cancelled") continue;
        target.state.execution = {
          phase: "cancelled",
          attempt: target.state.execution.attempt,
          reason
        };
        target.content.result = null;
        target.state.timestamps.updatedAt = timestamp;
        cancelledTaskIds.push(targetId);
      }
      cancelledTaskIds.sort(compareText);
      return { taskId: options.taskId, cancelledTaskIds };
    }
  );
}

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

  const selected = new Set(options.taskIds);
  for (const taskId of selected) requireTask(current, taskId);
  const blockers: TaskRemovalBlocker[] = [];
  for (const taskId of selected) {
    const task = requireTask(current, taskId);
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
    for (const dependencyId of Object.keys(task.state.relations.dependsOn)) {
      if (!selected.has(dependencyId)) {
        blockers.push({
          kind: "dependency-crosses-selection",
          taskId,
          relatedTaskId: dependencyId
        });
      }
    }
    for (const excludedTaskId of Object.keys(task.state.relations.excludes)) {
      if (!selected.has(excludedTaskId)) {
        blockers.push({
          kind: "exclusion-crosses-selection",
          taskId,
          relatedTaskId: excludedTaskId
        });
      }
    }
  }
  for (const [taskId, task] of Object.entries(current.tasks)) {
    if (selected.has(taskId)) continue;
    const parentId = task.state.relations.parentId;
    if (parentId !== null && selected.has(parentId)) {
      blockers.push({
        kind: "child-crosses-selection",
        taskId: parentId,
        relatedTaskId: taskId
      });
    }
    for (const dependencyId of Object.keys(task.state.relations.dependsOn)) {
      if (selected.has(dependencyId)) {
        blockers.push({
          kind: "dependency-crosses-selection",
          taskId,
          relatedTaskId: dependencyId
        });
      }
    }
  }
  blockers.sort(
    (left, right) =>
      compareText(left.taskId, right.taskId) ||
      compareText(left.kind, right.kind) ||
      compareText(
        "relatedTaskId" in left ? left.relatedTaskId : "",
        "relatedTaskId" in right ? right.relatedTaskId : ""
      )
  );
  if (blockers.length > 0) {
    throw new TaskGraphError(
      "TASKS_NOT_REMOVABLE",
      "Selected tasks are not terminal and detached from the remaining graph",
      { blockers }
    );
  }

  const candidate = cloneIndex(current);
  const removedTaskIds = [...selected].sort(compareText);
  for (const taskId of removedTaskIds) delete candidate.tasks[taskId];
  candidate.revision = nextRevision(current);
  return {
    index: parseTaskIndex(candidate),
    data: { removedTaskIds }
  };
}
