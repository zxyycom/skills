import type { TaskGraphResult, TaskIndexStageResult } from "./types.ts";

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
