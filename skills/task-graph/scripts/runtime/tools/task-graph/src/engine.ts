/*
 * Synced TypeScript runtime; repository maintenance edits tools/task-graph/src/engine.ts.
 * Installed skill copies may be edited directly; updates overwrite matching files.
 * Repository: https://github.com/zxyycom/skills
 * Source path: tools/task-graph/src/engine.ts
 * Maintained source: https://github.com/zxyycom/skills/blob/main/tools/task-graph/src/engine.ts
 * Skill source directory: https://github.com/zxyycom/skills/tree/main/skills/task-graph
 * Rebuild: bun run sync:task-graph-cli
 */
export type { IndexMutation } from "./engine-content.ts";
export { applyTaskGraphOperations } from "./engine-apply.ts";
export { claimTask } from "./engine-claim.ts";
export {
  cancelTask,
  completeTask,
  failTask,
  releaseTask,
  renewTaskLease,
  retryTask
} from "./engine-lifecycle.ts";
export { removeTasks } from "./engine-removal.ts";
