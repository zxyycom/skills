export { TaskGraphError } from "./errors.ts";
export {
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
  retryTask,
  scopeCloseProjection,
  type IndexMutation
} from "./engine.ts";
export { projectScope, validateTaskIndexGraph } from "./graph.ts";
export {
  emptyTaskIndex,
  parseTaskGraphApplyRequest,
  parseTaskIndex,
  serializeTaskIndex
} from "./schema.ts";
export {
  createTaskGraphService,
  TaskGraphService,
  type ListScopesOptions,
  type ScopeSummary,
  type ServiceResult,
  type TaskGraphServiceOptions,
  type TaskSummary
} from "./service.ts";
export * from "./types.ts";
