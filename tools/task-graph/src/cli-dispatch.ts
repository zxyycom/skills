import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import {
  failArgument,
  parseCommandOptions,
  requirePositionals,
  stringsValue
} from "./cli-arguments.ts";
import type { DispatchResult } from "./cli-contract.ts";
import { dispatchExecutionCommand } from "./cli-execution-dispatch.ts";
import { dispatchRelationCommand } from "./cli-relation-dispatch.ts";
import { dispatchTaskCommand } from "./cli-task-dispatch.ts";
import { TaskGraphError } from "./errors.ts";
import {
  getTaskGraphRuntimeInfo,
  type RuntimeContextOptions
} from "./runtime.ts";
import { TaskGraphService, type ServiceResult } from "./service.ts";
import type { TaskIndexStageResult, TaskListItem } from "./types.ts";

export async function readJsonRequest(
  filePath: string | undefined
): Promise<unknown> {
  let text: string;
  try {
    if (filePath === undefined || filePath === "-") {
      process.stdin.setEncoding("utf8");
      const chunks: string[] = [];
      for await (const chunk of process.stdin) chunks.push(String(chunk));
      text = chunks.join("");
    } else {
      text = await fs.readFile(path.resolve(filePath), "utf8");
    }
  } catch (error) {
    throw new TaskGraphError(
      "REQUEST_INVALID",
      "Unable to read apply request JSON",
      {
        filePath: filePath ?? "stdin",
        cause: error
      }
    );
  }
  try {
    return JSON.parse(text) as unknown;
  } catch (error) {
    throw new TaskGraphError(
      "REQUEST_INVALID",
      "Apply request is not valid JSON",
      {
        filePath: filePath ?? "stdin",
        cause: error
      }
    );
  }
}

export async function dispatchTaskList(
  service: TaskGraphService,
  tokens: readonly string[]
): Promise<ServiceResult<Record<string, TaskListItem>>> {
  const parsed = parseCommandOptions(tokens.slice(2), {});
  requirePositionals(parsed, 0, "task-graph task list");
  return await service.listTasks();
}

export async function dispatchIndexStage(
  service: TaskGraphService,
  tokens: readonly string[]
): Promise<ServiceResult<TaskIndexStageResult>> {
  const parsed = parseCommandOptions(tokens.slice(2), {
    task: { kind: "string", multiple: true }
  });
  requirePositionals(
    parsed,
    0,
    "task-graph index stage --task <id> [--task <id>...]"
  );
  const taskIds = stringsValue(parsed, "task");
  if (taskIds.length === 0)
    failArgument("--task is required and may be repeated");
  return await service.stageTaskIndex(taskIds);
}

export async function dispatch(
  service: TaskGraphService,
  tokens: readonly string[],
  runtimeOptions: RuntimeContextOptions
): Promise<DispatchResult> {
  const command = tokens[0];
  if (command === "runtime")
    return await dispatchRuntimeCommand(tokens, runtimeOptions);
  if (command === "index") return await dispatchIndexCommand(service, tokens);
  if (command === "task") return await dispatchTaskCommand(service, tokens);
  if (command === "relation")
    return await dispatchRelationCommand(service, tokens);
  if (command === "actionable") {
    const parsed = parseCommandOptions(tokens.slice(1), {});
    requirePositionals(parsed, 0, "task-graph actionable");
    return await service.actionable();
  }
  return await dispatchExecutionCommand(service, command, tokens);
}

async function dispatchRuntimeCommand(
  tokens: readonly string[],
  runtimeOptions: RuntimeContextOptions
): Promise<DispatchResult> {
  const subcommand = tokens[1];
  const parsed = parseCommandOptions(tokens.slice(2), {});
  requirePositionals(parsed, 0, `task-graph runtime ${subcommand ?? "<info>"}`);
  if (subcommand !== "info") failArgument("runtime command must be info");
  return {
    revision: null,
    data: await getTaskGraphRuntimeInfo(runtimeOptions)
  };
}

async function dispatchIndexCommand(
  service: TaskGraphService,
  tokens: readonly string[]
): Promise<DispatchResult> {
  const subcommand = tokens[1];
  if (subcommand === "stage") return await dispatchIndexStage(service, tokens);
  const parsed = parseCommandOptions(tokens.slice(2), {});
  requirePositionals(
    parsed,
    0,
    `task-graph index ${subcommand ?? "<init|info>"}`
  );
  if (subcommand === "init") return await service.init();
  if (subcommand === "info") return await service.info();
  failArgument("index command must be init, info, or stage");
}
