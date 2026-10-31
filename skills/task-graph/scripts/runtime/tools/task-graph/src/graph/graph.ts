/*
 * Synced TypeScript runtime; repository maintenance edits tools/task-graph/src/graph/graph.ts.
 * Installed skill copies may be edited directly; updates overwrite matching files.
 * Repository: https://github.com/zxyycom/skills
 * Source path: tools/task-graph/src/graph/graph.ts
 * Maintained source: https://github.com/zxyycom/skills/blob/main/tools/task-graph/src/graph/graph.ts
 * Skill source directory: https://github.com/zxyycom/skills/tree/main/skills/task-graph
 * Rebuild: bun run sync:task-graph-cli
 */
export {
  childrenByTask,
  ancestorIds,
  descendantIds,
  effectiveControl,
  effectiveDependencySources,
  effectiveExclusionSources
} from "./graph-topology.ts";
export { projectTaskGraph } from "./graph-projection.ts";
export {
  assertProtectedTopologyUnchanged,
  assertRunningControlUnchanged,
  validateTaskIndexGraph
} from "./graph-validation.ts";
