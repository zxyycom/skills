import {
  canonicalNow,
  compareText,
  cloneIndex,
  nextRevision,
  requireExpectedRevision,
  resolveOperationAliases,
  createTask,
  updateTaskContent,
  updateTaskControl,
  setDependency,
  setExclusion,
  setParent
} from "./engine-content.ts";
import { TaskGraphError } from "./errors.ts";
import { parseTaskGraphApplyRequest, parseTaskIndex } from "./schema.ts";
import type { IndexMutation } from "./engine-content.ts";
import type {
  TaskGraphApplyRequest,
  TaskGraphApplyResult,
  TaskIndex
} from "./types.ts";

function applyOperation(
  candidate: TaskIndex,
  operation: TaskGraphApplyRequest["operations"][number],
  timestamp: string,
  aliases: Map<string, string>,
  createdTaskIds: string[]
): void {
  if (operation.kind === "create-task") {
    if (operation.alias !== undefined && aliases.has(operation.alias))
      throw new TaskGraphError(
        "REQUEST_INVALID",
        `Apply alias ${operation.alias} is duplicated`,
        { alias: operation.alias }
      );
    const taskId = createTask(candidate, operation, timestamp);
    createdTaskIds.push(taskId);
    if (operation.alias !== undefined) aliases.set(operation.alias, taskId);
    return;
  }
  switch (operation.kind) {
    case "update-task-content":
      updateTaskContent(candidate, operation, timestamp);
      return;
    case "update-task-control":
      updateTaskControl(candidate, operation, timestamp);
      return;
    case "set-parent":
      setParent(candidate, operation, timestamp);
      return;
    case "set-dependency":
      setDependency(candidate, operation, timestamp);
      return;
    case "set-exclusion":
      setExclusion(candidate, operation, timestamp);
      return;
  }
}

function applyOperations(
  candidate: TaskIndex,
  operations: TaskGraphApplyRequest["operations"],
  timestamp: string
): Readonly<{ aliases: Map<string, string>; createdTaskIds: string[] }> {
  const aliases = new Map<string, string>();
  const createdTaskIds: string[] = [];
  for (const rawOperation of operations)
    applyOperation(
      candidate,
      resolveOperationAliases(rawOperation, aliases),
      timestamp,
      aliases,
      createdTaskIds
    );
  return { aliases, createdTaskIds };
}

export function applyTaskGraphOperations(
  current: TaskIndex,
  requestInput: TaskGraphApplyRequest,
  now: Date
): IndexMutation<TaskGraphApplyResult> {
  const request = parseTaskGraphApplyRequest(requestInput);
  requireExpectedRevision(current, request.expectedRevision);
  const candidate = cloneIndex(current);
  const applied = applyOperations(
    candidate,
    request.operations,
    canonicalNow(now)
  );
  candidate.revision = nextRevision(current);
  return {
    index: parseTaskIndex(candidate),
    data: {
      aliases: Object.fromEntries(
        [...applied.aliases.entries()].sort(([left], [right]) =>
          compareText(left, right)
        )
      ),
      createdTaskIds: applied.createdTaskIds
    }
  };
}
