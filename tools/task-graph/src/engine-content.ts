import {
  assertProtectedTopologyUnchanged,
  assertRunningControlUnchanged
} from "./graph.ts";
import { TaskGraphError, taskGraphError } from "./errors.ts";
import { normalizeTaskContent, normalizeTaskControl } from "./schema.ts";
import type {
  TaskControlInput,
  TaskGraphRevisionOperation,
  TaskIndex
} from "./types.ts";

export const compareText = (left: string, right: string): number =>
  left < right ? -1 : left > right ? 1 : 0;

export type IndexMutation<TData> = {
  index: TaskIndex;
  data: TData;
};

export function formatTaskId(value: number): string {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new TaskGraphError(
      "STATE_CONFLICT",
      "Cannot allocate task id outside the positive safe integer range",
      { value }
    );
  }
  return `task-${String(value).padStart(6, "0")}`;
}

export function nextRevision(index: TaskIndex): number {
  if (index.revision >= Number.MAX_SAFE_INTEGER) {
    throw new TaskGraphError(
      "STATE_CONFLICT",
      "Task index revision has reached the safe integer limit"
    );
  }
  return index.revision + 1;
}

export function cloneIndex(index: TaskIndex): TaskIndex {
  return structuredClone(index);
}

export function requireExpectedRevision(
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

export function requireTask(index: TaskIndex, taskId: string) {
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

export function canonicalNow(now: Date): string {
  if (Number.isNaN(now.valueOf())) {
    throw new TaskGraphError(
      "ARGUMENT_INVALID",
      "Clock returned an invalid date"
    );
  }
  return now.toISOString();
}

export function boundedString(
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

export function updateTaskTime(
  index: TaskIndex,
  taskId: string,
  now: string
): void {
  const task = index.tasks[taskId];
  if (task !== undefined) {
    task.state.timestamps.updatedAt = now;
  }
}

export function parseControl(input: TaskControlInput) {
  try {
    return normalizeTaskControl(input);
  } catch (error) {
    throw taskGraphError(error, "REQUEST_INVALID");
  }
}

export function createTask(
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

export function updateTaskContent(
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

export function updateTaskControl(
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

export function setParent(
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

export function setDependency(
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

export function setExclusion(
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

export function resolveTaskReference(
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

export function resolveOperationAliases(
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
