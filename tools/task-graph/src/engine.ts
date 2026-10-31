export type { IndexMutation } from "./engine/engine-content.ts";
export { applyTaskGraphOperations } from "./engine/engine-apply.ts";
export { claimTask } from "./engine/engine-claim.ts";
export {
  cancelTask,
  completeTask,
  failTask,
  releaseTask,
  renewTaskLease,
  retryTask
} from "./engine/engine-lifecycle.ts";
export { removeTasks } from "./engine/engine-removal.ts";
