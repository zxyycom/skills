import {
  assertProtectedTopologyUnchanged,
  assertRunningControlUnchanged,
  childrenByTask,
  descendantIds,
  projectScope
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
  CompleteTaskOptions,
  RecoverTaskOptions,
  ScopeCloseProjection,
  ScopeCloseRequest,
  ScopeGcProjection,
  TaskContentInput,
  TaskControlInput,
  TaskGraphApplyRequest,
  TaskGraphApplyResult,
  TaskGraphRevisionOperation,
  TaskIndex,
  TaskScope
} from "./types.ts";

const compareText = (left: string, right: string): number =>
  left < right ? -1 : left > right ? 1 : 0;

export type IndexMutation<TData> = {
  index: TaskIndex;
  data: TData;
};

function formatId(prefix: "scope" | "task", value: number): string {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new TaskGraphError(
      "STATE_CONFLICT",
      `Cannot allocate ${prefix} id outside the positive safe integer range`,
      { value }
    );
  }
  return `${prefix}-${String(value).padStart(6, "0")}`;
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

function requireExpectedRevision(index: TaskIndex, expectedRevision: number): void {
  if (index.revision !== expectedRevision) {
    throw new TaskGraphError(
      "REVISION_CONFLICT",
      `Expected revision ${expectedRevision}, found ${index.revision}`,
      { expectedRevision, actualRevision: index.revision }
    );
  }
}

function requireScope(index: TaskIndex, scopeId: string): TaskScope {
  const scope = Object.hasOwn(index.scopes, scopeId) ? index.scopes[scopeId] : undefined;
  if (scope === undefined) {
    throw new TaskGraphError(
      "SCOPE_NOT_FOUND",
      `Scope ${scopeId} does not exist`,
      { scopeId }
    );
  }
  return scope;
}

function requireTask(scope: TaskScope, scopeId: string, taskId: string) {
  const task = Object.hasOwn(scope.tasks, taskId) ? scope.tasks[taskId] : undefined;
  if (task === undefined) {
    throw new TaskGraphError(
      "TASK_NOT_FOUND",
      `Task ${taskId} does not exist in scope ${scopeId}`,
      { scopeId, taskId }
    );
  }
  return task;
}

function canonicalNow(now: Date): string {
  if (Number.isNaN(now.valueOf())) {
    throw new TaskGraphError("ARGUMENT_INVALID", "Clock returned an invalid date");
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
    length < 1
    || length > maximum
    || value.trim() !== value
    || (options.singleLine === true && /[\r\n]/u.test(value))
  ) {
    throw new TaskGraphError(
      "ARGUMENT_INVALID",
      `${label} must be trimmed${options.singleLine === true ? " single-line" : ""} text from 1 to ${maximum} Unicode code points`
    );
  }
  return value;
}

function updateScopeTime(scope: TaskScope, now: string): void {
  scope.timestamps.updatedAt = now;
}

function updateTaskTime(scope: TaskScope, taskId: string, now: string): void {
  const task = scope.tasks[taskId];
  if (task !== undefined) {
    task.state.timestamps.updatedAt = now;
  }
  updateScopeTime(scope, now);
}

function parseControl(input: TaskControlInput) {
  try {
    return normalizeTaskControl(input);
  } catch (error) {
    throw taskGraphError(error, "REQUEST_INVALID");
  }
}

function createScope(
  index: TaskIndex,
  operation: Extract<TaskGraphRevisionOperation, { kind: "create-scope" }>,
  now: string
): string {
  if (Object.values(index.scopes).some((scope) => scope.key === operation.key)) {
    throw new TaskGraphError(
      "SCOPE_KEY_CONFLICT",
      `Scope key ${operation.key} is already in use`,
      { key: operation.key }
    );
  }
  for (const [kind, value] of Object.entries(operation.bindings ?? {})) {
    assertBindingAvailable(index, kind, value);
  }
  const scopeId = formatId("scope", index.nextIds.scope);
  index.nextIds.scope += 1;
  index.scopes[scopeId] = {
    key: operation.key,
    bindings: { ...(operation.bindings ?? {}) },
    timestamps: { createdAt: now, updatedAt: now },
    tasks: {}
  };
  return scopeId;
}

function assertBindingAvailable(
  index: TaskIndex,
  kind: string,
  value: string,
  currentScopeId?: string
): void {
  for (const [scopeId, scope] of Object.entries(index.scopes)) {
    if (
      scopeId !== currentScopeId
      && Object.hasOwn(scope.bindings, kind)
      && scope.bindings[kind] === value
    ) {
      throw new TaskGraphError(
        "BINDING_CONFLICT",
        `Binding ${kind}=${value} is already in use`,
        { scopeId, kind, value }
      );
    }
  }
}

function setScopeBinding(
  index: TaskIndex,
  operation: Extract<TaskGraphRevisionOperation, { kind: "set-scope-binding" }>,
  now: string
): void {
  const scope = requireScope(index, operation.scopeId);
  if (operation.value === null) {
    delete scope.bindings[operation.bindingKind];
  } else {
    assertBindingAvailable(
      index,
      operation.bindingKind,
      operation.value,
      operation.scopeId
    );
    scope.bindings[operation.bindingKind] = operation.value;
  }
  updateScopeTime(scope, now);
}

function createTask(
  index: TaskIndex,
  operation: Extract<TaskGraphRevisionOperation, { kind: "create-task" }>,
  now: string
): string {
  const scope = requireScope(index, operation.scopeId);
  const before = structuredClone(scope);
  const parentId = operation.parentId ?? null;
  if (parentId !== null) {
    const parent = requireTask(scope, operation.scopeId, parentId);
    if (parent.state.execution.phase !== "idle") {
      throw new TaskGraphError(
        "STATE_CONFLICT",
        `Parent ${parentId} must be idle before adding a child`,
        { parentId, phase: parent.state.execution.phase }
      );
    }
  }
  const control = operation.control === undefined
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
  const taskId = formatId("task", index.nextIds.task);
  index.nextIds.task += 1;
  scope.tasks[taskId] = {
    content: normalizeTaskContent(operation.content),
    state: {
      control,
      execution: { phase: "idle", attempt: 0 },
      relations: { parentId, dependsOn: {}, excludes: {} },
      timestamps: { createdAt: now, updatedAt: now }
    }
  };
  assertProtectedTopologyUnchanged(before, scope);
  updateScopeTime(scope, now);
  return taskId;
}

function updateTaskContent(
  index: TaskIndex,
  operation: Extract<TaskGraphRevisionOperation, { kind: "update-task-content" }>,
  now: string
): void {
  const scope = requireScope(index, operation.scopeId);
  const task = requireTask(scope, operation.scopeId, operation.taskId);
  const phase = task.state.execution.phase;
  if (phase === "running" || phase === "succeeded" || phase === "cancelled") {
    throw new TaskGraphError(
      "STATE_CONFLICT",
      `Content for ${phase} task ${operation.taskId} cannot change`,
      { taskId: operation.taskId, phase }
    );
  }
  task.content = normalizeTaskContent(operation.content);
  updateTaskTime(scope, operation.taskId, now);
}

function updateTaskControl(
  index: TaskIndex,
  operation: Extract<TaskGraphRevisionOperation, { kind: "update-task-control" }>,
  now: string
): void {
  const scope = requireScope(index, operation.scopeId);
  const before = structuredClone(scope);
  const task = requireTask(scope, operation.scopeId, operation.taskId);
  if (task.state.execution.phase === "succeeded" || task.state.execution.phase === "cancelled") {
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
  assertRunningControlUnchanged(before, scope);
  updateTaskTime(scope, operation.taskId, now);
}

function setParent(
  index: TaskIndex,
  operation: Extract<TaskGraphRevisionOperation, { kind: "set-parent" }>,
  now: string
): void {
  const scope = requireScope(index, operation.scopeId);
  const before = structuredClone(scope);
  const task = requireTask(scope, operation.scopeId, operation.taskId);
  if (operation.parentId !== null) {
    const parent = requireTask(scope, operation.scopeId, operation.parentId);
    if (parent.state.execution.phase !== "idle") {
      throw new TaskGraphError(
        "STATE_CONFLICT",
        `Parent ${operation.parentId} must be idle before adding a child`,
        { parentId: operation.parentId, phase: parent.state.execution.phase }
      );
    }
  }
  task.state.relations.parentId = operation.parentId;
  assertProtectedTopologyUnchanged(before, scope);
  updateTaskTime(scope, operation.taskId, now);
}

function setDependency(
  index: TaskIndex,
  operation: Extract<TaskGraphRevisionOperation, { kind: "set-dependency" }>,
  now: string
): void {
  const scope = requireScope(index, operation.scopeId);
  const before = structuredClone(scope);
  const task = requireTask(scope, operation.scopeId, operation.taskId);
  requireTask(scope, operation.scopeId, operation.dependencyId);
  if (operation.present) {
    task.state.relations.dependsOn[operation.dependencyId] = true;
  } else {
    delete task.state.relations.dependsOn[operation.dependencyId];
  }
  assertProtectedTopologyUnchanged(before, scope);
  updateTaskTime(scope, operation.taskId, now);
}

function setExclusion(
  index: TaskIndex,
  operation: Extract<TaskGraphRevisionOperation, { kind: "set-exclusion" }>,
  now: string
): void {
  const scope = requireScope(index, operation.scopeId);
  const before = structuredClone(scope);
  const task = requireTask(scope, operation.scopeId, operation.taskId);
  const other = requireTask(scope, operation.scopeId, operation.excludedTaskId);
  if (operation.present) {
    task.state.relations.excludes[operation.excludedTaskId] = true;
    other.state.relations.excludes[operation.taskId] = true;
  } else {
    delete task.state.relations.excludes[operation.excludedTaskId];
    delete other.state.relations.excludes[operation.taskId];
  }
  assertProtectedTopologyUnchanged(before, scope);
  updateTaskTime(scope, operation.taskId, now);
  updateTaskTime(scope, operation.excludedTaskId, now);
}

function resolveTaskReference(value: string, aliases: ReadonlyMap<string, string>): string {
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
    case "create-scope":
    case "set-scope-binding":
      return operation;
    case "create-task":
      return {
        ...operation,
        parentId: operation.parentId === undefined || operation.parentId === null
          ? operation.parentId
          : resolveTaskReference(operation.parentId, aliases)
      };
    case "update-task-content":
    case "update-task-control":
      return { ...operation, taskId: resolveTaskReference(operation.taskId, aliases) };
    case "set-parent":
      return {
        ...operation,
        taskId: resolveTaskReference(operation.taskId, aliases),
        parentId: operation.parentId === null
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
  const createdScopeIds: string[] = [];
  const createdTaskIds: string[] = [];

  for (const rawOperation of request.operations) {
    const operation = resolveOperationAliases(rawOperation, aliases);
    switch (operation.kind) {
      case "create-scope":
        createdScopeIds.push(createScope(candidate, operation, timestamp));
        break;
      case "set-scope-binding":
        setScopeBinding(candidate, operation, timestamp);
        break;
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
        [...aliases.entries()].sort(([left], [right]) => compareText(left, right))
      ),
      createdScopeIds,
      createdTaskIds
    }
  };
}

function mutateExecution<TData>(
  current: TaskIndex,
  scopeId: string,
  taskId: string,
  now: Date,
  mutate: (candidate: TaskIndex, scope: TaskScope, timestamp: string) => TData
): IndexMutation<TData> {
  const candidate = cloneIndex(current);
  const scope = requireScope(candidate, scopeId);
  requireTask(scope, scopeId, taskId);
  const timestamp = canonicalNow(now);
  const data = mutate(candidate, scope, timestamp);
  updateTaskTime(scope, taskId, timestamp);
  candidate.revision = nextRevision(current);
  return { index: parseTaskIndex(candidate), data };
}

function leaseDurationMilliseconds(durationSeconds: number): number {
  if (
    !Number.isInteger(durationSeconds)
    || durationSeconds < 60
    || durationSeconds > 86_400
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
  if (!/^lease-[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u.test(id)) {
    throw new TaskGraphError(
      "ARGUMENT_INVALID",
      "Lease generator returned a non-canonical UUID",
      { leaseId: id }
    );
  }
  return id;
}

function requireRunningLease(
  scope: TaskScope,
  scopeId: string,
  taskId: string,
  leaseId: string,
  now: Date,
  allowExpired: boolean
) {
  const task = requireTask(scope, scopeId, taskId);
  const execution = task.state.execution;
  if (execution.phase !== "running" || execution.lease.id !== leaseId) {
    throw new TaskGraphError(
      "LEASE_CONFLICT",
      `Lease ${leaseId} does not own task ${taskId}`,
      { scopeId, taskId, leaseId }
    );
  }
  if (!allowExpired && new Date(execution.lease.expiresAt) <= now) {
    throw new TaskGraphError(
      "LEASE_EXPIRED",
      `Lease ${leaseId} has expired and requires recover`,
      { scopeId, taskId, leaseId, expiresAt: execution.lease.expiresAt }
    );
  }
  return execution;
}

export function claimTask(
  current: TaskIndex,
  options: {
    scopeId: string;
    taskId: string;
    actor: string;
    durationSeconds?: number;
    leaseUuid: string;
  },
  now: Date
): IndexMutation<{ taskId: string; leaseId: string; expiresAt: string }> {
  const duration = leaseDurationMilliseconds(options.durationSeconds ?? 1800);
  const actor = boundedString(options.actor, "actor", 200, { singleLine: true });
  return mutateExecution(current, options.scopeId, options.taskId, now, (
    candidate,
    scope,
    timestamp
  ) => {
    const task = requireTask(scope, options.scopeId, options.taskId);
    const projection = projectScope(candidate, options.scopeId, now).tasks[options.taskId];
    if (
      task.state.execution.phase !== "idle"
      || projection?.effectiveState !== "ready"
      || projection.nextAction !== "claim"
    ) {
      throw new TaskGraphError(
        "STATE_CONFLICT",
        `Task ${options.taskId} is not claimable`,
        { projection }
      );
    }
    const leaseId = canonicalLeaseId(options.leaseUuid);
    for (const [candidateScopeId, candidateScope] of Object.entries(candidate.scopes)) {
      for (const [candidateTaskId, candidateTask] of Object.entries(candidateScope.tasks)) {
        const execution = candidateTask.state.execution;
        if (execution.phase === "running" && execution.lease.id === leaseId) {
          throw new TaskGraphError(
            "LEASE_CONFLICT",
            `Lease ${leaseId} is already assigned to another running task`,
            {
              leaseId,
              ownerScopeId: candidateScopeId,
              ownerTaskId: candidateTaskId,
              requestedScopeId: options.scopeId,
              requestedTaskId: options.taskId
            }
          );
        }
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
  });
}

export function renewTaskLease(
  current: TaskIndex,
  options: {
    scopeId: string;
    taskId: string;
    leaseId: string;
    durationSeconds?: number;
  },
  now: Date
): IndexMutation<{ taskId: string; leaseId: string; expiresAt: string }> {
  const duration = leaseDurationMilliseconds(options.durationSeconds ?? 1800);
  return mutateExecution(current, options.scopeId, options.taskId, now, (
    _candidate,
    scope,
    timestamp
  ) => {
    const execution = requireRunningLease(
      scope,
      options.scopeId,
      options.taskId,
      options.leaseId,
      now,
      false
    );
    const expiresAt = new Date(now.valueOf() + duration).toISOString();
    execution.lease.renewedAt = timestamp;
    execution.lease.expiresAt = expiresAt;
    return { taskId: options.taskId, leaseId: options.leaseId, expiresAt };
  });
}

export function releaseTask(
  current: TaskIndex,
  options: {
    scopeId: string;
    taskId: string;
    leaseId: string;
    control: TaskControlInput;
  },
  now: Date
): IndexMutation<{ taskId: string; phase: "idle" }> {
  return mutateExecution(current, options.scopeId, options.taskId, now, (
    _candidate,
    scope
  ) => {
    const execution = requireRunningLease(
      scope,
      options.scopeId,
      options.taskId,
      options.leaseId,
      now,
      false
    );
    const task = requireTask(scope, options.scopeId, options.taskId);
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
  if ((options.leaseId === undefined) === (options.expectedRevision === undefined)) {
    throw new TaskGraphError(
      "ARGUMENT_INVALID",
      "Task completion requires exactly one of leaseId or expectedRevision"
    );
  }
  const scope = requireScope(current, options.scopeId);
  requireTask(scope, options.scopeId, options.taskId);
  const children = childrenByTask(scope).get(options.taskId) ?? [];
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
  return mutateExecution(current, options.scopeId, options.taskId, now, (
    candidate,
    candidateScope
  ) => {
    const task = requireTask(candidateScope, options.scopeId, options.taskId);
    if (children.length === 0) {
      const execution = requireRunningLease(
        candidateScope,
        options.scopeId,
        options.taskId,
        options.leaseId ?? "",
        now,
        false
      );
      task.state.execution = { phase: "succeeded", attempt: execution.attempt };
    } else {
      const projection = projectScope(candidate, options.scopeId, now).tasks[options.taskId];
      if (
        task.state.execution.phase !== "idle"
        || projection?.effectiveState !== "ready"
        || projection.nextAction !== "complete"
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
  options: { scopeId: string; taskId: string; leaseId: string; reason: string },
  now: Date
): IndexMutation<{ taskId: string; phase: "failed" }> {
  const reason = boundedString(options.reason, "failure reason", 1000);
  return mutateExecution(current, options.scopeId, options.taskId, now, (
    _candidate,
    scope
  ) => {
    const execution = requireRunningLease(
      scope,
      options.scopeId,
      options.taskId,
      options.leaseId,
      now,
      false
    );
    const task = requireTask(scope, options.scopeId, options.taskId);
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
  options: { scopeId: string; taskId: string; expectedRevision: number },
  now: Date
): IndexMutation<{ taskId: string; phase: "idle" }> {
  requireExpectedRevision(current, options.expectedRevision);
  return mutateExecution(current, options.scopeId, options.taskId, now, (
    _candidate,
    scope
  ) => {
    const task = requireTask(scope, options.scopeId, options.taskId);
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
  if ((options.leaseId === undefined) === (options.expectedRevision === undefined)) {
    throw new TaskGraphError(
      "ARGUMENT_INVALID",
      "Task cancellation requires exactly one of leaseId or expectedRevision"
    );
  }
  const reason = boundedString(options.reason, "cancellation reason", 1000);
  const currentScope = requireScope(current, options.scopeId);
  const currentTask = requireTask(currentScope, options.scopeId, options.taskId);
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
  return mutateExecution(current, options.scopeId, options.taskId, now, (
    _candidate,
    scope,
    timestamp
  ) => {
    const task = requireTask(scope, options.scopeId, options.taskId);
    if (task.state.execution.phase === "succeeded" || task.state.execution.phase === "cancelled") {
      throw new TaskGraphError(
        "STATE_CONFLICT",
        `Terminal task ${options.taskId} cannot be cancelled again`
      );
    }
    if (task.state.execution.phase === "running") {
      requireRunningLease(
        scope,
        options.scopeId,
        options.taskId,
        options.leaseId ?? "",
        now,
        false
      );
    }
    const targets = [options.taskId, ...descendantIds(scope, options.taskId)];
    for (const targetId of targets) {
      if (scope.tasks[targetId]?.state.execution.phase === "running") {
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
      const target = scope.tasks[targetId];
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
  });
}

export function recoverTask(
  current: TaskIndex,
  options: RecoverTaskOptions,
  now: Date
): IndexMutation<{ taskId: string; phase: "failed"; forced: boolean }> {
  const reason = boundedString(options.reason, "recovery reason", 1000);
  const scope = requireScope(current, options.scopeId);
  const execution = requireRunningLease(
    scope,
    options.scopeId,
    options.taskId,
    options.leaseId,
    now,
    true
  );
  const expired = new Date(execution.lease.expiresAt) <= now;
  if (expired && (options.force === true || options.expectedRevision !== undefined)) {
    throw new TaskGraphError(
      "ARGUMENT_INVALID",
      "Expired lease recovery does not accept force or expectedRevision"
    );
  }
  if (!expired) {
    if (options.force !== true || options.expectedRevision === undefined) {
      throw new TaskGraphError(
        "LEASE_CONFLICT",
        "An active lease can only be recovered with force and expectedRevision",
        { leaseId: options.leaseId }
      );
    }
    requireExpectedRevision(current, options.expectedRevision);
  }
  return mutateExecution(current, options.scopeId, options.taskId, now, (
    _candidate,
    candidateScope
  ) => {
    const currentExecution = requireRunningLease(
      candidateScope,
      options.scopeId,
      options.taskId,
      options.leaseId,
      now,
      true
    );
    const task = requireTask(candidateScope, options.scopeId, options.taskId);
    task.state.execution = {
      phase: "failed",
      attempt: currentExecution.attempt,
      reason
    };
    task.content.result = null;
    return { taskId: options.taskId, phase: "failed", forced: !expired };
  });
}

export function scopeCloseProjection(
  index: TaskIndex,
  scopeId: string,
  now: Date
): ScopeCloseProjection {
  const scope = requireScope(index, scopeId);
  const projection = projectScope(index, scopeId, now);
  const blockers: ScopeCloseProjection["blockers"] = [];
  for (const [taskId, task] of Object.entries(scope.tasks)) {
    const state = projection.tasks[taskId]?.effectiveState ?? "waiting";
    const phase = task.state.execution.phase;
    if (task.state.relations.parentId === null && phase !== "succeeded" && phase !== "cancelled") {
      blockers.push({ kind: "top-task-not-terminal", scopeId, taskId, state });
    }
    if (phase === "failed") {
      blockers.push({ kind: "failed-task", scopeId, taskId, state: "failed" });
    }
    if (phase === "running") {
      blockers.push({
        kind: state === "recovery-needed" ? "recovery-needed" : "active-lease",
        scopeId,
        taskId,
        state
      });
    }
  }
  blockers.sort((left, right) =>
    compareText(left.taskId, right.taskId) || compareText(left.kind, right.kind)
  );
  return {
    scopeId,
    closable: blockers.length === 0,
    blockers,
    requiresResultsDelivered: true,
    taskCount: Object.keys(scope.tasks).length
  };
}

export function queryScopeGc(index: TaskIndex, now: Date): ScopeGcProjection {
  const scopeOrder = Object.keys(index.scopes).sort(compareText);
  return {
    revision: index.revision,
    scopes: Object.fromEntries(
      scopeOrder.map((scopeId) => [scopeId, scopeCloseProjection(index, scopeId, now)])
    ),
    scopeOrder
  };
}

export function closeScopes(
  current: TaskIndex,
  options: {
    expectedRevision: number;
    scopes: ScopeCloseRequest[];
  },
  now: Date
): IndexMutation<{
  closedScopeIds: string[];
  scopes: Record<string, ScopeCloseProjection>;
}> {
  requireExpectedRevision(current, options.expectedRevision);
  if (options.scopes.length === 0) {
    throw new TaskGraphError(
      "ARGUMENT_INVALID",
      "Scope close requires at least one explicitly selected scope"
    );
  }
  const scopeIds = options.scopes.map((request) => request.scopeId);
  if (new Set(scopeIds).size !== scopeIds.length) {
    throw new TaskGraphError(
      "ARGUMENT_INVALID",
      "Scope close selection must not repeat a scope id"
    );
  }
  const projections: Record<string, ScopeCloseProjection> = {};
  for (const request of options.scopes) {
    if (request.resultsDelivered !== true) {
      throw new TaskGraphError(
        "DELIVERY_NOT_CONFIRMED",
        `Scope ${request.scopeId} results must be explicitly confirmed delivered`,
        { scopeId: request.scopeId }
      );
    }
    const projection = scopeCloseProjection(current, request.scopeId, now);
    projections[request.scopeId] = projection;
    if (!projection.closable) {
      throw new TaskGraphError(
        "SCOPE_NOT_CLOSABLE",
        `Scope ${request.scopeId} does not satisfy the close gate`,
        { scope: projection }
      );
    }
  }
  const candidate = cloneIndex(current);
  const closedScopeIds = [...scopeIds].sort(compareText);
  for (const scopeId of closedScopeIds) {
    delete candidate.scopes[scopeId];
  }
  candidate.revision = nextRevision(current);
  return {
    index: parseTaskIndex(candidate),
    data: {
      closedScopeIds,
      scopes: Object.fromEntries(
        Object.entries(projections).sort(([left], [right]) => compareText(left, right))
      )
    }
  };
}
