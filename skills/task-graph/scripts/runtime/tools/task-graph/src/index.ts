/*
 * Synced TypeScript runtime; repository maintenance edits tools/task-graph/src/index.ts.
 * Installed skill copies may be edited directly; updates overwrite matching files.
 * Repository: https://github.com/zxyycom/skills
 * Source path: tools/task-graph/src/index.ts
 * Maintained source: https://github.com/zxyycom/skills/blob/main/tools/task-graph/src/index.ts
 * Skill source directory: https://github.com/zxyycom/skills/tree/main/skills/task-graph
 * Rebuild: bun run sync:task-graph-cli
 */
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
