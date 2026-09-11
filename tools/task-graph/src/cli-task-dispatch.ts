import {
  booleanValue,
  contentInput,
  contentOptionDefinitions,
  controlInput,
  failArgument,
  integerValue,
  parseCommandOptions,
  requirePositionals,
  stringValue,
  stringsValue
} from "./cli-arguments.ts";
import type { DispatchResult, ParsedCommandOptions } from "./cli-contract.ts";
import { dispatchTaskList } from "./cli-dispatch.ts";
import { TaskGraphService } from "./service.ts";

const taskDispatchers: Readonly<
  Record<
    string,
    (
      service: TaskGraphService,
      tokens: readonly string[]
    ) => Promise<DispatchResult>
  >
> = {
  create: dispatchTaskCreate,
  list: dispatchTaskList,
  remove: dispatchTaskRemove,
  show: dispatchTaskShow,
  "update-content": dispatchTaskContentUpdate,
  "update-control": dispatchTaskControlUpdate
};

export async function dispatchTaskCommand(
  service: TaskGraphService,
  tokens: readonly string[]
): Promise<DispatchResult> {
  const dispatcher = taskDispatchers[tokens[1] ?? ""];
  if (dispatcher === undefined)
    failArgument("Unknown task command", { command: tokens[1] ?? null });
  return await dispatcher(service, tokens);
}

async function dispatchTaskCreate(
  service: TaskGraphService,
  tokens: readonly string[]
): Promise<DispatchResult> {
  const parsed = parseCommandOptions(tokens.slice(2), {
    ...contentOptionDefinitions,
    parent: { kind: "string" },
    control: { kind: "string" },
    reason: { kind: "string" },
    "expected-revision": { kind: "string" }
  });
  requirePositionals(parsed, 0, "task-graph task create [options]");
  const applied = await service.apply({
    expectedRevision: requiredRevision(parsed),
    operations: [
      {
        kind: "create-task",
        content: contentInput(parsed),
        parentId: stringValue(parsed, "parent"),
        control: controlInput(
          stringValue(parsed, "control"),
          stringValue(parsed, "reason")
        )
      }
    ]
  });
  const taskId = applied.data.createdTaskIds[0];
  if (taskId === undefined) {
    throw new Error("create-task mutation returned no task id");
  }
  return taskMutationResult(applied.revision, taskId);
}

async function dispatchTaskShow(
  service: TaskGraphService,
  tokens: readonly string[]
): Promise<DispatchResult> {
  const parsed = parseCommandOptions(tokens.slice(2), {});
  const [taskId = ""] = requirePositionals(
    parsed,
    1,
    "task-graph task show <task-id>"
  );
  return await service.showTask(taskId);
}

async function dispatchTaskContentUpdate(
  service: TaskGraphService,
  tokens: readonly string[]
): Promise<DispatchResult> {
  const parsed = parseCommandOptions(tokens.slice(2), {
    ...contentOptionDefinitions,
    "expected-revision": { kind: "string" }
  });
  const [taskId = ""] = requirePositionals(
    parsed,
    1,
    "task-graph task update-content <task-id> [options]"
  );
  const applied = await service.apply({
    expectedRevision: requiredRevision(parsed),
    operations: [
      { kind: "update-task-content", taskId, content: contentInput(parsed) }
    ]
  });
  return taskMutationResult(applied.revision, taskId);
}

async function dispatchTaskControlUpdate(
  service: TaskGraphService,
  tokens: readonly string[]
): Promise<DispatchResult> {
  const parsed = parseCommandOptions(tokens.slice(2), {
    control: { kind: "string" },
    reason: { kind: "string" },
    "expected-revision": { kind: "string" }
  });
  const [taskId = ""] = requirePositionals(
    parsed,
    1,
    "task-graph task update-control <task-id> [options]"
  );
  const control = controlInput(
    stringValue(parsed, "control", { required: true }),
    stringValue(parsed, "reason")
  );
  if (control === undefined) failArgument("--control is required");
  const applied = await service.apply({
    expectedRevision: requiredRevision(parsed),
    operations: [{ kind: "update-task-control", taskId, control }]
  });
  return taskMutationResult(applied.revision, taskId);
}

async function dispatchTaskRemove(
  service: TaskGraphService,
  tokens: readonly string[]
): Promise<DispatchResult> {
  const parsed = parseCommandOptions(tokens.slice(2), {
    task: { kind: "string", multiple: true },
    "expected-revision": { kind: "string" },
    "results-delivered": { kind: "boolean" }
  });
  requirePositionals(
    parsed,
    0,
    "task-graph task remove --task <id>... --expected-revision <n> --results-delivered"
  );
  const taskIds = stringsValue(parsed, "task");
  if (taskIds.length === 0)
    failArgument("--task is required and may be repeated");
  if (!booleanValue(parsed, "results-delivered")) {
    failArgument("--results-delivered is required");
  }
  return await service.removeTasks({
    taskIds,
    expectedRevision: requiredRevision(parsed),
    resultsDelivered: true
  });
}

export function requiredRevision(parsed: ParsedCommandOptions): number {
  return integerValue(parsed, "expected-revision", { required: true });
}

export function taskMutationResult(
  revision: number,
  taskId: string
): DispatchResult {
  return { revision, data: { taskId } };
}
