import {
  emptyTaskIndex as createEmptyTaskIndex,
  parseTaskGraphApplyRequest as parseApplyRequest,
  parseTaskIndex as parseIndex,
  serializeTaskIndex as serializeIndex
} from "./schema.ts";
import type { TaskGraphApplyRequest, TaskIndex } from "./types.ts";

export { TaskGraphError } from "./errors.ts";
export {
  applyTaskGraphOperations,
  cancelTask,
  claimTask,
  completeTask,
  failTask,
  releaseTask,
  removeTasks,
  renewTaskLease,
  retryTask,
  type IndexMutation
} from "./engine.ts";
export { projectTaskGraph, validateTaskIndexGraph } from "./graph.ts";
export {
  TaskGraphService,
  type ServiceResult,
  type TaskGraphServiceOptions
} from "./service.ts";
export * from "./types.ts";

// Keep the SDK declaration closure independent of schema implementation types.
export function emptyTaskIndex(): TaskIndex {
  return createEmptyTaskIndex();
}

export function parseTaskGraphApplyRequest(
  input: unknown
): TaskGraphApplyRequest {
  return parseApplyRequest(input);
}

export function parseTaskIndex(input: unknown): TaskIndex {
  return parseIndex(input);
}

export function serializeTaskIndex(index: TaskIndex): string {
  return serializeIndex(index);
}
