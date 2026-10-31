/*
 * Synced TypeScript runtime; repository maintenance edits tools/task-graph/src/rendering/task-index-stage-renderer.ts.
 * Installed skill copies may be edited directly; updates overwrite matching files.
 * Repository: https://github.com/zxyycom/skills
 * Source path: tools/task-graph/src/rendering/task-index-stage-renderer.ts
 * Maintained source: https://github.com/zxyycom/skills/blob/main/tools/task-graph/src/rendering/task-index-stage-renderer.ts
 * Skill source directory: https://github.com/zxyycom/skills/tree/main/skills/task-graph
 * Rebuild: bun run sync:task-graph-cli
 */
import type { TaskGraphResult, TaskIndexStageResult } from "../types.ts";

export function renderTaskIndexStageResult(
  result: TaskGraphResult<TaskIndexStageResult>
): string {
  if (!result.ok) {
    return (
      "TASK INDEX STAGE failed" +
      ` code=${result.error.code}` +
      ` retryable=${String(result.error.retryable)}` +
      ` message=${JSON.stringify(result.error.message)}\n`
    );
  }
  return (
    "TASK INDEX STAGE" +
    ` state=${result.data.state}` +
    ` revision=${String(result.revision)}` +
    ` task-count=${result.data.taskCount}` +
    ` next-task-id=${result.data.nextTaskId}` +
    ` selected-task-ids=${JSON.stringify(result.data.selectedTaskIds)}\n`
  );
}
