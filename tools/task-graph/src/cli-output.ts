import process from "node:process";
import type {
  CliInvocation,
  CliIo,
  CliOutput,
  GlobalArguments
} from "./cli-contract.ts";
import {
  dispatch,
  dispatchIndexStage,
  dispatchTaskList
} from "./cli-dispatch.ts";
import {
  helpData,
  requiresMutationRuntime,
  resolveCommandPath
} from "./cli-help.ts";
import { TaskGraphError } from "./errors.ts";
import type { RuntimeContextOptions } from "./runtime.ts";
import { renderTaskIndexStageResult } from "./task-index-stage-renderer.ts";
import { renderTaskListResult } from "./task-list-renderer.ts";
import { assertTaskGraphMutationRuntime, TaskGraphService } from "./service.ts";
import {
  taskGraphVersion,
  type TaskGraphFailure,
  type TaskGraphResult,
  type TaskGraphSuccess
} from "./types.ts";

function success<TData>(
  indexPath: string,
  revision: number | null,
  data: TData
): TaskGraphSuccess<TData> {
  return { ok: true, indexPath, revision, data };
}

export function failure(
  indexPath: string,
  revision: number | null,
  error: TaskGraphError
): TaskGraphFailure {
  return {
    ok: false,
    indexPath,
    revision,
    error: {
      code: error.code,
      retryable: error.retryable,
      message: error.message,
      details: error.details
    }
  };
}

function normalizeRenderColumns(value: unknown): number | undefined {
  return typeof value === "number" && Number.isInteger(value) && value > 0
    ? value
    : undefined;
}

function resolveRenderColumns(injectedColumns: unknown): number {
  const injected = normalizeRenderColumns(injectedColumns);
  if (injected !== undefined) return injected;
  const ttyColumns = process.stdout.isTTY
    ? normalizeRenderColumns(process.stdout.columns)
    : undefined;
  return ttyColumns ?? 80;
}

export function resolveInvocation(
  globals: GlobalArguments,
  injectedColumns: unknown
): CliInvocation {
  if (globals.version) return { kind: "version" };
  const helpCommand = globals.remaining[0] === "help";
  if (globals.help || helpCommand || globals.remaining.length === 0) {
    const pathTokens = helpCommand
      ? globals.remaining.slice(1)
      : globals.remaining;
    return {
      kind: "help",
      pathTokens
    };
  }
  const command = resolveCommandPath(globals.remaining);
  if (!globals.json && command === "task list") {
    return {
      columns: resolveRenderColumns(injectedColumns),
      kind: "task-list",
      tokens: globals.remaining
    };
  }
  if (!globals.json && command === "index stage") {
    return { kind: "index-stage", tokens: globals.remaining };
  }
  return {
    kind: "json-command",
    tokens: globals.remaining
  };
}

function unreachable(value: never): never {
  throw new Error(`Unsupported CLI branch: ${String(value)}`);
}

async function executeJsonCommand(
  service: TaskGraphService,
  invocation: Extract<CliInvocation, { kind: "json-command" }>,
  runtimeOptions: RuntimeContextOptions
): Promise<CliOutput> {
  if (requiresMutationRuntime(invocation.tokens))
    await assertTaskGraphMutationRuntime(service);
  const dispatched = await dispatch(service, invocation.tokens, runtimeOptions);
  return {
    kind: "json",
    result: success(
      service.store.indexPath,
      dispatched.revision,
      dispatched.data
    )
  };
}

export async function executeInvocation(
  service: TaskGraphService,
  invocation: CliInvocation,
  runtimeOptions: RuntimeContextOptions
): Promise<CliOutput> {
  if (invocation.kind === "version")
    return {
      kind: "json",
      result: success(service.store.indexPath, null, {
        name: "task-graph",
        version: taskGraphVersion
      })
    };
  if (invocation.kind === "help")
    return {
      kind: "json",
      result: success(
        service.store.indexPath,
        null,
        helpData(invocation.pathTokens)
      )
    };
  if (invocation.kind === "json-command")
    return await executeJsonCommand(service, invocation, runtimeOptions);
  if (invocation.kind === "index-stage") {
    const staged = await dispatchIndexStage(service, invocation.tokens);
    return {
      kind: "index-stage",
      result: success(service.store.indexPath, staged.revision, staged.data)
    };
  }
  const listed = await dispatchTaskList(service, invocation.tokens);
  return {
    columns: invocation.columns,
    kind: "task-list",
    result: success(service.store.indexPath, listed.revision, listed.data)
  };
}

export function outputFailure(
  invocation: CliInvocation,
  result: TaskGraphFailure
): CliOutput {
  switch (invocation.kind) {
    case "index-stage":
      return { kind: "index-stage", result };
    case "task-list":
      return { columns: invocation.columns, kind: "task-list", result };
    case "help":
    case "json-command":
    case "version":
      return { kind: "json", result };
  }
  return unreachable(invocation);
}

export function writeJsonResult(io: CliIo, result: TaskGraphResult): void {
  io.stdout(`${JSON.stringify(result)}\n`);
}

export function writeOutput(io: CliIo, output: CliOutput): void {
  switch (output.kind) {
    case "json":
      writeJsonResult(io, output.result);
      return;
    case "index-stage":
      io.stdout(renderTaskIndexStageResult(output.result));
      return;
    case "task-list":
      io.stdout(
        renderTaskListResult(output.result, { columns: output.columns })
      );
      return;
  }
  return unreachable(output);
}
