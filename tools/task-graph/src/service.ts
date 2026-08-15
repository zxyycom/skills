import { randomUUID } from "node:crypto";
import { TaskGraphError } from "./errors.ts";
import {
  applyTaskGraphOperations,
  cancelTask,
  claimTask,
  completeTask,
  failTask,
  releaseTask,
  removeTasks as removeTaskEntries,
  renewTaskLease,
  retryTask
} from "./engine.ts";
import { projectTaskGraph } from "./graph.ts";
import { stageSelectedTaskIndex } from "./staging.ts";
import { TaskGraphStore, type TaskGraphStoreOptions } from "./store.ts";
import type {
  CancelTaskOptions,
  ClaimTaskOptions,
  Clock,
  CompleteTaskOptions,
  RemoveTasksOptions,
  TaskControlInput,
  TaskGraphApplyRequest,
  TaskGraphApplyResult,
  TaskGraphProjection,
  TaskIndex,
  TaskIndexInfo,
  TaskIndexStageResult,
  TaskListItem
} from "./types.ts";

const compareText = (left: string, right: string): number =>
  left < right ? -1 : left > right ? 1 : 0;

export type TaskGraphServiceOptions = {
  clock?: Clock;
  indexPath?: string;
  root?: string;
};

/** @internal */
export type TaskGraphServiceInternalOptions = TaskGraphServiceOptions &
  Omit<TaskGraphStoreOptions, "indexPath" | "root"> & {
    leaseIdGenerator?: () => string;
  };

export type ServiceResult<TData> = {
  revision: number;
  data: TData;
};

export class TaskGraphService {
  /** @internal */
  readonly store: TaskGraphStore;
  private readonly clock: Clock;
  private readonly leaseIdGenerator: () => string;

  /** @internal */
  constructor(options: TaskGraphServiceInternalOptions);
  constructor(options?: TaskGraphServiceOptions);
  constructor(options: TaskGraphServiceInternalOptions = {}) {
    this.clock = options.clock ?? (() => new Date());
    this.leaseIdGenerator = options.leaseIdGenerator ?? randomUUID;
    this.store = new TaskGraphStore({
      atomicWrite: options.atomicWrite,
      indexPath: options.indexPath,
      loadNativeLock: options.loadNativeLock,
      lockPollMilliseconds: options.lockPollMilliseconds,
      lockRoot: options.lockRoot,
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
        valid: true,
        canonical: true,
        diagnostics: [],
        revision: index.revision,
        schemaVersion: index.schemaVersion,
        taskCount: Object.keys(index.tasks).length,
        topTaskCount: Object.values(index.tasks).filter(
          (task) => task.state.relations.parentId === null
        ).length,
        nextTaskId: index.nextTaskId
      }
    };
  }

  async info(): Promise<ServiceResult<TaskIndexInfo>> {
    const data = await this.store.info();
    return { revision: data.revision, data };
  }

  async readIndex(): Promise<ServiceResult<TaskIndex>> {
    const { index } = await this.store.read();
    return { revision: index.revision, data: index };
  }

  async stageTaskIndex(
    taskIds: readonly string[]
  ): Promise<ServiceResult<TaskIndexStageResult>> {
    return await stageSelectedTaskIndex({
      indexPath: this.store.indexPath,
      selectedTaskIds: taskIds
    });
  }

  async apply(
    request: TaskGraphApplyRequest
  ): Promise<ServiceResult<TaskGraphApplyResult>> {
    const transformed = await this.store.mutate((index) =>
      applyTaskGraphOperations(index, request, this.clock())
    );
    return { revision: transformed.index.revision, data: transformed.data };
  }

  async listTasks(): Promise<ServiceResult<Record<string, TaskListItem>>> {
    const { index } = await this.store.read();
    const projection = projectTaskGraph(index, this.clock());
    const taskEntries = Object.entries(index.tasks).sort(([left], [right]) =>
      compareText(left, right)
    );
    return {
      revision: index.revision,
      data: Object.fromEntries(
        taskEntries.map(([taskId, task]) => {
          const effective = projection.tasks[taskId];
          if (effective === undefined) {
            throw new Error(
              `Task graph projection omitted ${taskId}; inspect projectTaskGraph() task enumeration`
            );
          }
          return [
            taskId,
            {
              ...effective,
              title: task.content.title,
              parentId: task.state.relations.parentId,
              phase: task.state.execution.phase
            } satisfies TaskListItem
          ];
        })
      )
    };
  }

  async showTask(taskId: string): Promise<
    ServiceResult<{
      task: TaskIndex["tasks"][string];
      projection: TaskGraphProjection["tasks"][string];
    }>
  > {
    const { index } = await this.store.read();
    const task = Object.hasOwn(index.tasks, taskId)
      ? index.tasks[taskId]
      : undefined;
    const projectedTasks = projectTaskGraph(index, this.clock()).tasks;
    const projection = Object.hasOwn(projectedTasks, taskId)
      ? projectedTasks[taskId]
      : undefined;
    if (task === undefined || projection === undefined) {
      throw new TaskGraphError(
        "TASK_NOT_FOUND",
        `Task ${taskId} does not exist`
      );
    }
    return { revision: index.revision, data: { task, projection } };
  }

  async actionable(): Promise<
    ServiceResult<{
      tasks: TaskGraphProjection["actionable"];
      order: string[];
    }>
  > {
    const { index } = await this.store.read();
    const projection = projectTaskGraph(index, this.clock());
    return {
      revision: index.revision,
      data: { tasks: projection.actionable, order: projection.actionableOrder }
    };
  }

  async claim(options: ClaimTaskOptions) {
    return await this.executionMutation((index) =>
      claimTask(
        index,
        {
          ...options,
          leaseUuid: this.leaseIdGenerator()
        },
        this.clock()
      )
    );
  }

  async renew(options: {
    taskId: string;
    leaseId: string;
    durationSeconds?: number;
  }) {
    return await this.executionMutation((index) =>
      renewTaskLease(index, options, this.clock())
    );
  }

  async release(options: {
    taskId: string;
    leaseId: string;
    control: TaskControlInput;
  }) {
    return await this.executionMutation((index) =>
      releaseTask(index, options, this.clock())
    );
  }

  async complete(options: CompleteTaskOptions) {
    return await this.executionMutation((index) =>
      completeTask(index, options, this.clock())
    );
  }

  async fail(options: { taskId: string; leaseId: string; reason: string }) {
    return await this.executionMutation((index) =>
      failTask(index, options, this.clock())
    );
  }

  async retry(options: { taskId: string; expectedRevision: number }) {
    return await this.executionMutation((index) =>
      retryTask(index, options, this.clock())
    );
  }

  async cancel(options: CancelTaskOptions) {
    return await this.executionMutation((index) =>
      cancelTask(index, options, this.clock())
    );
  }

  async removeTasks(options: RemoveTasksOptions) {
    return await this.executionMutation((index) =>
      removeTaskEntries(index, options)
    );
  }

  private async executionMutation<TData>(
    transform: (index: TaskIndex) => { index: TaskIndex; data: TData }
  ): Promise<ServiceResult<TData>> {
    const result = await this.store.mutate(transform);
    return { revision: result.index.revision, data: result.data };
  }
}

/** @internal */
export async function assertTaskGraphMutationRuntime(
  service: TaskGraphService
): Promise<void> {
  await service.store.assertMutationRuntime();
}
