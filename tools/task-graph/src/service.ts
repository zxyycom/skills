import { randomUUID } from "node:crypto";
import { TaskGraphError } from "./errors.ts";
import {
  applyTaskGraphOperations,
  cancelTask,
  claimTask,
  closeScopes,
  completeTask,
  failTask,
  queryScopeGc,
  recoverTask,
  releaseTask,
  renewTaskLease,
  retryTask
} from "./engine.ts";
import { projectScope } from "./graph.ts";
import {
  TaskGraphStore,
  type TaskGraphStoreOptions,
  type TaskIndexCheck,
  type TaskIndexInfo
} from "./store.ts";
import type {
  CancelTaskOptions,
  Clock,
  CompleteTaskOptions,
  RecoverTaskOptions,
  ScopeCloseRequest,
  ScopeGcProjection,
  ScopeProjection,
  TaskContentInput,
  TaskControlInput,
  TaskGraphApplyRequest,
  TaskGraphApplyResult,
  TaskEffectiveState,
  TaskExecutionPhase,
  TaskIndex
} from "./types.ts";

const compareText = (left: string, right: string): number =>
  left < right ? -1 : left > right ? 1 : 0;

export type TaskGraphServiceOptions = {
  clock?: Clock;
  indexPath?: string;
  root?: string;
};

export type TaskGraphServiceInternalOptions = TaskGraphServiceOptions
& Omit<TaskGraphStoreOptions, "indexPath" | "root"> & {
  leaseIdGenerator?: () => string;
};

export type ServiceResult<TData> = {
  revision: number;
  data: TData;
};

export type ScopeSummary = {
  scopeId: string;
  key: string;
  bindings: Record<string, string>;
  taskCount: number;
  topTaskCount: number;
};

export type ListScopesOptions = { key?: string } & (
  | { bindingKind: string; bindingValue: string }
  | { bindingKind?: never; bindingValue?: never }
);

export type TaskSummary = {
  taskId: string;
  title: string;
  parentId: string | null;
  phase: TaskExecutionPhase;
  effectiveState: TaskEffectiveState;
  nextAction: "claim" | "complete" | null;
};

export class TaskGraphService {
  readonly store: TaskGraphStore;
  private readonly clock: Clock;
  private readonly leaseIdGenerator: () => string;

  constructor(options: TaskGraphServiceInternalOptions = {}) {
    this.clock = options.clock ?? (() => new Date());
    this.leaseIdGenerator = options.leaseIdGenerator ?? randomUUID;
    this.store = new TaskGraphStore({
      atomicWrite: options.atomicWrite,
      indexPath: options.indexPath,
      loadNativeLock: options.loadNativeLock,
      lockPollMilliseconds: options.lockPollMilliseconds,
      lockWaitMilliseconds: options.lockWaitMilliseconds,
      monotonicClock: options.monotonicClock,
      root: options.root,
      sleep: options.sleep
    });
  }

  async init(): Promise<ServiceResult<TaskIndexInfo>> {
    const index = await this.store.init();
    return {
      revision: index.revision,
      data: {
        revision: index.revision,
        schemaVersion: index.schemaVersion,
        scopeCount: Object.keys(index.scopes).length,
        taskCount: Object.values(index.scopes).reduce(
          (count, scope) => count + Object.keys(scope.tasks).length,
          0
        ),
        nextIds: { ...index.nextIds }
      }
    };
  }

  async info(): Promise<ServiceResult<TaskIndexInfo>> {
    const data = await this.store.info();
    return { revision: data.revision, data };
  }

  async check(): Promise<{ revision: number | null; data: TaskIndexCheck }> {
    const data = await this.store.check();
    return { revision: data.revision, data };
  }

  async readIndex(): Promise<ServiceResult<TaskIndex>> {
    const { index } = await this.store.read();
    return { revision: index.revision, data: index };
  }

  async apply(request: TaskGraphApplyRequest): Promise<ServiceResult<TaskGraphApplyResult>> {
    const transformed = await this.store.mutate((index) =>
      applyTaskGraphOperations(index, request, this.clock())
    );
    return { revision: transformed.index.revision, data: transformed.data };
  }

  async createScope(options: {
    expectedRevision: number;
    key: string;
    bindings?: Record<string, string>;
  }): Promise<ServiceResult<{ scopeId: string }>> {
    const result = await this.apply({
      expectedRevision: options.expectedRevision,
      operations: [{ kind: "create-scope", key: options.key, bindings: options.bindings }]
    });
    const scopeId = result.data.createdScopeIds[0];
    if (scopeId === undefined) {
      throw new Error("create-scope mutation did not return a scope id");
    }
    return { revision: result.revision, data: { scopeId } };
  }

  async setScopeBinding(options: {
    expectedRevision: number;
    scopeId: string;
    kind: string;
    value: string | null;
  }): Promise<ServiceResult<{ scopeId: string }>> {
    const result = await this.apply({
      expectedRevision: options.expectedRevision,
      operations: [{
        kind: "set-scope-binding",
        scopeId: options.scopeId,
        bindingKind: options.kind,
        value: options.value
      }]
    });
    return { revision: result.revision, data: { scopeId: options.scopeId } };
  }

  async listScopes(options: ListScopesOptions = {}): Promise<ServiceResult<Record<string, ScopeSummary>>> {
    const hasBindingKind = options.bindingKind !== undefined;
    const hasBindingValue = options.bindingValue !== undefined;
    if (hasBindingKind !== hasBindingValue) {
      throw new TaskGraphError(
        "ARGUMENT_INVALID",
        "Scope binding filters require bindingKind and bindingValue together"
      );
    }
    const { index } = await this.store.read();
    const entries = Object.entries(index.scopes)
      .filter(([, scope]) => options.key === undefined || scope.key === options.key)
      .filter(([, scope]) => options.bindingKind === undefined
        || (Object.hasOwn(scope.bindings, options.bindingKind)
          && scope.bindings[options.bindingKind] === options.bindingValue))
      .sort(([left], [right]) => compareText(left, right))
      .map(([scopeId, scope]) => [scopeId, {
        scopeId,
        key: scope.key,
        bindings: { ...scope.bindings },
        taskCount: Object.keys(scope.tasks).length,
        topTaskCount: Object.values(scope.tasks).filter(
          (task) => task.state.relations.parentId === null
        ).length
      } satisfies ScopeSummary]);
    return { revision: index.revision, data: Object.fromEntries(entries) };
  }

  async showScope(scopeId: string): Promise<ServiceResult<{
    scope: TaskIndex["scopes"][string];
    projection: ScopeProjection;
  }>> {
    const { index } = await this.store.read();
    const scope = Object.hasOwn(index.scopes, scopeId) ? index.scopes[scopeId] : undefined;
    if (scope === undefined) {
      throw new TaskGraphError("SCOPE_NOT_FOUND", `Scope ${scopeId} does not exist`);
    }
    return {
      revision: index.revision,
      data: { scope, projection: projectScope(index, scopeId, this.clock()) }
    };
  }

  async createTask(options: {
    expectedRevision: number;
    scopeId: string;
    content: TaskContentInput;
    parentId?: string | null;
    control?: TaskControlInput;
  }): Promise<ServiceResult<{ taskId: string }>> {
    const result = await this.apply({
      expectedRevision: options.expectedRevision,
      operations: [{
        kind: "create-task",
        scopeId: options.scopeId,
        content: options.content,
        parentId: options.parentId,
        control: options.control
      }]
    });
    const taskId = result.data.createdTaskIds[0];
    if (taskId === undefined) throw new Error("create-task mutation did not return a task id");
    return { revision: result.revision, data: { taskId } };
  }

  async updateTaskContent(options: {
    expectedRevision: number;
    scopeId: string;
    taskId: string;
    content: TaskContentInput;
  }): Promise<ServiceResult<{ taskId: string }>> {
    const result = await this.apply({
      expectedRevision: options.expectedRevision,
      operations: [{
        kind: "update-task-content",
        scopeId: options.scopeId,
        taskId: options.taskId,
        content: options.content
      }]
    });
    return { revision: result.revision, data: { taskId: options.taskId } };
  }

  async updateTaskControl(options: {
    expectedRevision: number;
    scopeId: string;
    taskId: string;
    control: TaskControlInput;
  }): Promise<ServiceResult<{ taskId: string }>> {
    const result = await this.apply({
      expectedRevision: options.expectedRevision,
      operations: [{
        kind: "update-task-control",
        scopeId: options.scopeId,
        taskId: options.taskId,
        control: options.control
      }]
    });
    return { revision: result.revision, data: { taskId: options.taskId } };
  }

  async setParent(options: {
    expectedRevision: number;
    scopeId: string;
    taskId: string;
    parentId: string | null;
  }): Promise<ServiceResult<{ taskId: string }>> {
    const result = await this.apply({
      expectedRevision: options.expectedRevision,
      operations: [{
        kind: "set-parent",
        scopeId: options.scopeId,
        taskId: options.taskId,
        parentId: options.parentId
      }]
    });
    return { revision: result.revision, data: { taskId: options.taskId } };
  }

  async setDependency(options: {
    expectedRevision: number;
    scopeId: string;
    taskId: string;
    dependencyId: string;
    present: boolean;
  }): Promise<ServiceResult<{ taskId: string }>> {
    const result = await this.apply({
      expectedRevision: options.expectedRevision,
      operations: [{
        kind: "set-dependency",
        scopeId: options.scopeId,
        taskId: options.taskId,
        dependencyId: options.dependencyId,
        present: options.present
      }]
    });
    return { revision: result.revision, data: { taskId: options.taskId } };
  }

  async setExclusion(options: {
    expectedRevision: number;
    scopeId: string;
    taskId: string;
    excludedTaskId: string;
    present: boolean;
  }): Promise<ServiceResult<{ taskId: string; excludedTaskId: string }>> {
    const result = await this.apply({
      expectedRevision: options.expectedRevision,
      operations: [{
        kind: "set-exclusion",
        scopeId: options.scopeId,
        taskId: options.taskId,
        excludedTaskId: options.excludedTaskId,
        present: options.present
      }]
    });
    return {
      revision: result.revision,
      data: { taskId: options.taskId, excludedTaskId: options.excludedTaskId }
    };
  }

  async listTasks(scopeId: string): Promise<ServiceResult<Record<string, TaskSummary>>> {
    const { index } = await this.store.read();
    const projection = projectScope(index, scopeId, this.clock());
    const scope = Object.hasOwn(index.scopes, scopeId) ? index.scopes[scopeId] : undefined;
    if (scope === undefined) throw new Error(`Scope ${scopeId} disappeared during projection`);
    return {
      revision: index.revision,
      data: Object.fromEntries(Object.keys(scope.tasks).sort(compareText).map((taskId) => {
        const task = scope.tasks[taskId];
        const effective = projection.tasks[taskId];
        if (task === undefined || effective === undefined) throw new Error("projection mismatch");
        return [taskId, {
          taskId,
          title: task.content.title,
          parentId: task.state.relations.parentId,
          phase: task.state.execution.phase,
          effectiveState: effective.effectiveState,
          nextAction: effective.nextAction
        } satisfies TaskSummary];
      }))
    };
  }

  async showTask(scopeId: string, taskId: string): Promise<ServiceResult<{
    task: TaskIndex["scopes"][string]["tasks"][string];
    projection: ScopeProjection["tasks"][string];
  }>> {
    const { index } = await this.store.read();
    const scope = Object.hasOwn(index.scopes, scopeId) ? index.scopes[scopeId] : undefined;
    if (scope === undefined) {
      throw new TaskGraphError("SCOPE_NOT_FOUND", `Scope ${scopeId} does not exist`);
    }
    const task = Object.hasOwn(scope.tasks, taskId) ? scope.tasks[taskId] : undefined;
    const projectedTasks = projectScope(index, scopeId, this.clock()).tasks;
    const projection = Object.hasOwn(projectedTasks, taskId) ? projectedTasks[taskId] : undefined;
    if (task === undefined || projection === undefined) {
      throw new TaskGraphError("TASK_NOT_FOUND", `Task ${taskId} does not exist`);
    }
    return { revision: index.revision, data: { task, projection } };
  }

  async actionable(scopeId: string): Promise<ServiceResult<{
    tasks: ScopeProjection["actionable"];
    order: string[];
  }>> {
    const { index } = await this.store.read();
    const projection = projectScope(index, scopeId, this.clock());
    return {
      revision: index.revision,
      data: { tasks: projection.actionable, order: projection.actionableOrder }
    };
  }

  async trace(scopeId: string, taskId: string) {
    return await this.showTask(scopeId, taskId);
  }

  async claim(options: {
    scopeId: string;
    taskId: string;
    actor: string;
    durationSeconds?: number;
  }) {
    return await this.executionMutation((index) => claimTask(index, {
      ...options,
      leaseUuid: this.leaseIdGenerator()
    }, this.clock()));
  }

  async renew(options: {
    scopeId: string;
    taskId: string;
    leaseId: string;
    durationSeconds?: number;
  }) {
    return await this.executionMutation((index) => renewTaskLease(index, options, this.clock()));
  }

  async release(options: {
    scopeId: string;
    taskId: string;
    leaseId: string;
    control: TaskControlInput;
  }) {
    return await this.executionMutation((index) => releaseTask(index, options, this.clock()));
  }

  async complete(options: CompleteTaskOptions) {
    return await this.executionMutation((index) => completeTask(index, options, this.clock()));
  }

  async fail(options: { scopeId: string; taskId: string; leaseId: string; reason: string }) {
    return await this.executionMutation((index) => failTask(index, options, this.clock()));
  }

  async retry(options: { scopeId: string; taskId: string; expectedRevision: number }) {
    return await this.executionMutation((index) => retryTask(index, options, this.clock()));
  }

  async cancel(options: CancelTaskOptions) {
    return await this.executionMutation((index) => cancelTask(index, options, this.clock()));
  }

  async recover(options: RecoverTaskOptions) {
    return await this.executionMutation((index) => recoverTask(index, options, this.clock()));
  }

  async queryGc(): Promise<ServiceResult<ScopeGcProjection>> {
    const { index } = await this.store.read();
    return { revision: index.revision, data: queryScopeGc(index, this.clock()) };
  }

  async closeScope(options: {
    expectedRevision: number;
    scopeId: string;
    resultsDelivered: true;
  }) {
    return await this.closeScopeSet({
      expectedRevision: options.expectedRevision,
      scopes: [{ scopeId: options.scopeId, resultsDelivered: options.resultsDelivered }]
    });
  }

  async closeScopeSet(options: {
    expectedRevision: number;
    scopes: ScopeCloseRequest[];
  }) {
    return await this.executionMutation((index) => closeScopes(index, options, this.clock()));
  }

  private async executionMutation<TData>(
    transform: (index: TaskIndex) => { index: TaskIndex; data: TData }
  ): Promise<ServiceResult<TData>> {
    const result = await this.store.mutate(transform);
    return { revision: result.index.revision, data: result.data };
  }
}

export function createTaskGraphService(
  options: TaskGraphServiceOptions = {}
): TaskGraphService {
  return new TaskGraphService(options);
}

export async function assertTaskGraphMutationRuntime(
  service: TaskGraphService
): Promise<void> {
  await service.store.assertMutationRuntime();
}
