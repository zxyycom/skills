#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { isMainModule } from "../../shared/src/node/main-module.ts";
import { TaskGraphError } from "./errors.ts";
import {
  getTaskGraphRuntimeInfo,
  loadNativeLockBinding,
  type RuntimeContextOptions
} from "./runtime.ts";
import { parseTaskGraphApplyRequest } from "./schema.ts";
import { renderTaskListResult } from "./task-list-renderer.ts";
import { renderTaskIndexStageResult } from "./task-index-stage-renderer.ts";
import {
  TaskGraphService,
  assertTaskGraphMutationRuntime,
  type ServiceResult,
  type TaskGraphServiceInternalOptions,
  type TaskGraphServiceOptions
} from "./service.ts";
import {
  defaultTaskGraphIndexPath,
  taskControlModes,
  taskGraphSupportedNodeRange,
  taskGraphVersion,
  type JsonObject,
  type TaskContentInput,
  type TaskControlInput,
  type TaskGraphFailure,
  type TaskIndexStageResult,
  type TaskListItem,
  type TaskGraphResult,
  type TaskGraphSuccess
} from "./types.ts";

type CliIo = {
  stdout: (text: string) => void;
};

export type TaskGraphCliOptions = {
  io?: CliIo;
  serviceOptions?: Omit<TaskGraphServiceOptions, "root" | "indexPath">;
};

/** @internal */
export type TaskGraphCliInternalOptions = {
  columns?: number;
  io?: CliIo;
  runtimeOptions?: RuntimeContextOptions;
  serviceOptions?: Omit<TaskGraphServiceInternalOptions, "root" | "indexPath">;
};

type GlobalArguments = {
  help: boolean;
  indexPath?: string;
  json: boolean;
  remaining: string[];
  root: string;
  version: boolean;
};

type CliInvocation =
  | {
      kind: "help";
      pathTokens: readonly string[];
    }
  | {
      kind: "index-stage";
      tokens: readonly string[];
    }
  | {
      kind: "json-command";
      tokens: readonly string[];
    }
  | {
      columns: number;
      kind: "task-list";
      tokens: readonly string[];
    }
  | { kind: "version" };

type TaskListResult = TaskGraphResult<Record<string, TaskListItem>>;
type TaskIndexStageCliResult = TaskGraphResult<TaskIndexStageResult>;

type CliOutput =
  | { kind: "json"; result: TaskGraphResult }
  | { kind: "index-stage"; result: TaskIndexStageCliResult }
  | { columns: number; kind: "task-list"; result: TaskListResult };

type OptionDefinition = {
  kind: "boolean" | "string";
  multiple?: boolean;
};

type ParsedCommandOptions = {
  positionals: string[];
  values: Record<string, string | string[] | true>;
};

type HelpParameter = {
  default?: boolean | string | number | null;
  enum?: readonly string[];
  multiple?: boolean;
  name: string;
  required: boolean;
  type: "boolean" | "integer" | "key-value" | "string";
};

type CommandHelp = {
  input?: {
    default: "stdin";
    fileOption: "--file";
    format: "json";
  };
  options: readonly HelpParameter[];
  positionals: readonly HelpParameter[];
  requiresMutationRuntime?: true;
  usage: string;
};

const positional = (name: string): HelpParameter => ({
  name,
  required: true,
  type: "string"
});
const expectedRevisionHelp = {
  name: "--expected-revision",
  required: true,
  type: "integer"
} as const satisfies HelpParameter;
const contentHelp = [
  { name: "--title", required: true, type: "string" },
  { name: "--goal", required: true, type: "string" },
  { name: "--acceptance", required: false, type: "string", multiple: true },
  { name: "--context", required: false, type: "string", default: null },
  { name: "--reference", required: false, type: "key-value", multiple: true }
] as const satisfies readonly HelpParameter[];
const controlHelp = [
  {
    name: "--control",
    required: true,
    type: "string",
    enum: taskControlModes
  },
  { name: "--reason", required: false, type: "string" }
] as const satisfies readonly HelpParameter[];

const commandHelpCatalog = {
  "runtime info": {
    usage: "task-graph runtime info",
    positionals: [],
    options: []
  },
  "index init": {
    usage: "task-graph index init",
    positionals: [],
    options: [],
    requiresMutationRuntime: true
  },
  "index info": {
    usage: "task-graph index info",
    positionals: [],
    options: []
  },
  "index stage": {
    usage: "task-graph index stage --task <id> [--task <id>...]",
    positionals: [],
    options: [
      { name: "--task", required: true, type: "string", multiple: true }
    ]
  },
  "task create": {
    usage:
      "task-graph task create --title <text> --goal <text> --expected-revision <n> [options]",
    positionals: [],
    options: [
      ...contentHelp,
      { name: "--parent", required: false, type: "string", default: null },
      {
        name: "--control",
        required: false,
        type: "string",
        enum: taskControlModes
      },
      { name: "--reason", required: false, type: "string" },
      expectedRevisionHelp
    ],
    requiresMutationRuntime: true
  },
  "task list": {
    usage: "task-graph task list",
    positionals: [],
    options: []
  },
  "task show": {
    usage: "task-graph task show <task-id>",
    positionals: [positional("task-id")],
    options: []
  },
  "task update-content": {
    usage:
      "task-graph task update-content <task-id> --title <text> --goal <text> --expected-revision <n> [options]",
    positionals: [positional("task-id")],
    options: [...contentHelp, expectedRevisionHelp],
    requiresMutationRuntime: true
  },
  "task update-control": {
    usage:
      "task-graph task update-control <task-id> --control <mode> --expected-revision <n> [--reason <text>]",
    positionals: [positional("task-id")],
    options: [...controlHelp, expectedRevisionHelp],
    requiresMutationRuntime: true
  },
  "task remove": {
    usage:
      "task-graph task remove --task <id>... --expected-revision <n> --results-delivered",
    positionals: [],
    options: [
      { name: "--task", required: true, type: "string", multiple: true },
      expectedRevisionHelp,
      { name: "--results-delivered", required: true, type: "boolean" }
    ],
    requiresMutationRuntime: true
  },
  "relation parent": {
    usage:
      "task-graph relation parent <task-id> <parent-id|null> --expected-revision <n>",
    positionals: [positional("task-id"), positional("parent-id|null")],
    options: [expectedRevisionHelp],
    requiresMutationRuntime: true
  },
  "relation dependency-add": {
    usage:
      "task-graph relation dependency-add <task-id> <dependency-id> --expected-revision <n>",
    positionals: [positional("task-id"), positional("dependency-id")],
    options: [expectedRevisionHelp],
    requiresMutationRuntime: true
  },
  "relation dependency-remove": {
    usage:
      "task-graph relation dependency-remove <task-id> <dependency-id> --expected-revision <n>",
    positionals: [positional("task-id"), positional("dependency-id")],
    options: [expectedRevisionHelp],
    requiresMutationRuntime: true
  },
  "relation exclusion-add": {
    usage:
      "task-graph relation exclusion-add <task-id> <excluded-id> --expected-revision <n>",
    positionals: [positional("task-id"), positional("excluded-id")],
    options: [expectedRevisionHelp],
    requiresMutationRuntime: true
  },
  "relation exclusion-remove": {
    usage:
      "task-graph relation exclusion-remove <task-id> <excluded-id> --expected-revision <n>",
    positionals: [positional("task-id"), positional("excluded-id")],
    options: [expectedRevisionHelp],
    requiresMutationRuntime: true
  },
  actionable: {
    usage: "task-graph actionable",
    positionals: [],
    options: []
  },
  claim: {
    usage:
      "task-graph claim <task-id> --actor <actor> [--duration <seconds>] [--recover-lease <id> --expected-revision <n> --reason <text>]",
    positionals: [positional("task-id")],
    options: [
      { name: "--actor", required: true, type: "string" },
      { name: "--duration", required: false, type: "integer", default: 1800 },
      { name: "--recover-lease", required: false, type: "string" },
      { ...expectedRevisionHelp, required: false },
      { name: "--reason", required: false, type: "string" }
    ],
    requiresMutationRuntime: true
  },
  renew: {
    usage: "task-graph renew <task-id> --lease <id> [--duration <seconds>]",
    positionals: [positional("task-id")],
    options: [
      { name: "--lease", required: true, type: "string" },
      { name: "--duration", required: false, type: "integer", default: 1800 }
    ],
    requiresMutationRuntime: true
  },
  release: {
    usage:
      "task-graph release <task-id> --lease <id> --control <mode> [--reason <text>]",
    positionals: [positional("task-id")],
    options: [
      { name: "--lease", required: true, type: "string" },
      ...controlHelp
    ],
    requiresMutationRuntime: true
  },
  complete: {
    usage:
      "task-graph complete <task-id> --result-summary <text> (--lease <id>|--expected-revision <n>) [--result-reference <kind=value> ...]",
    positionals: [positional("task-id")],
    options: [
      { name: "--result-summary", required: true, type: "string" },
      {
        name: "--result-reference",
        required: false,
        type: "key-value",
        multiple: true
      },
      { name: "--lease", required: false, type: "string" },
      { ...expectedRevisionHelp, required: false }
    ],
    requiresMutationRuntime: true
  },
  fail: {
    usage: "task-graph fail <task-id> --lease <id> --reason <text>",
    positionals: [positional("task-id")],
    options: [
      { name: "--lease", required: true, type: "string" },
      { name: "--reason", required: true, type: "string" }
    ],
    requiresMutationRuntime: true
  },
  retry: {
    usage: "task-graph retry <task-id> --expected-revision <n>",
    positionals: [positional("task-id")],
    options: [expectedRevisionHelp],
    requiresMutationRuntime: true
  },
  cancel: {
    usage:
      "task-graph cancel <task-id> --reason <text> (--lease <id>|--expected-revision <n>)",
    positionals: [positional("task-id")],
    options: [
      { name: "--reason", required: true, type: "string" },
      { name: "--lease", required: false, type: "string" },
      { ...expectedRevisionHelp, required: false }
    ],
    requiresMutationRuntime: true
  },
  apply: {
    usage: "task-graph apply [--file <path>]",
    positionals: [],
    options: [
      { name: "--file", required: false, type: "string", default: "stdin" }
    ],
    input: { default: "stdin", fileOption: "--file", format: "json" },
    requiresMutationRuntime: true
  }
} as const satisfies Record<string, CommandHelp>;

const commandPaths = Object.keys(commandHelpCatalog).sort();

type CommandPath = keyof typeof commandHelpCatalog;

function isCommandPath(value: string): value is CommandPath {
  return Object.hasOwn(commandHelpCatalog, value);
}

function resolveCommandPath(tokens: readonly string[]): CommandPath | null {
  const twoPart = tokens.slice(0, 2).join(" ");
  if (isCommandPath(twoPart)) return twoPart;
  const onePart = tokens[0] ?? "";
  return isCommandPath(onePart) ? onePart : null;
}

function requiresMutationRuntime(tokens: readonly string[]): boolean {
  const command = resolveCommandPath(tokens);
  if (command === null) return false;
  const entry: CommandHelp = commandHelpCatalog[command];
  return entry.requiresMutationRuntime === true;
}

function failArgument(message: string, details: JsonObject = {}): never {
  throw new TaskGraphError("ARGUMENT_INVALID", message, details);
}

function parseGlobalArguments(argv: readonly string[]): GlobalArguments {
  const remaining: string[] = [];
  let root = process.cwd();
  let indexPath: string | undefined;
  let help = false;
  let json = false;
  let version = false;
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index] ?? "";
    const [name, inline] = token.split(/=(.*)/su, 2);
    if (name === "--root" || name === "--index") {
      const value = inline ?? argv[index + 1];
      if (
        value === undefined ||
        value === "" ||
        (inline === undefined && value.startsWith("--"))
      ) {
        failArgument(`${name} requires a non-empty path`);
      }
      if (inline === undefined) index += 1;
      if (name === "--root") root = value;
      else indexPath = value;
      continue;
    }
    if (token === "--help" || token === "-h") {
      help = true;
      continue;
    }
    if (token === "--version" || token === "-v") {
      version = true;
      continue;
    }
    if (name === "--json") {
      if (inline !== undefined) failArgument("--json does not accept a value");
      if (json) failArgument("--json must not be repeated");
      json = true;
      continue;
    }
    remaining.push(token);
  }
  return {
    help,
    indexPath,
    json,
    remaining,
    root: path.resolve(root),
    version
  };
}

function parseCommandOptions(
  tokens: readonly string[],
  definitions: Record<string, OptionDefinition>
): ParsedCommandOptions {
  const positionals: string[] = [];
  const values = Object.create(null) as Record<
    string,
    string | string[] | true
  >;
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index] ?? "";
    if (!token.startsWith("--")) {
      if (token.startsWith("-")) failArgument(`Unknown option ${token}`);
      positionals.push(token);
      continue;
    }
    const [rawName, inline] = token.slice(2).split(/=(.*)/su, 2);
    const optionName = rawName ?? "";
    const definition = Object.hasOwn(definitions, optionName)
      ? definitions[optionName]
      : undefined;
    if (definition === undefined) failArgument(`Unknown option --${rawName}`);
    if (definition.kind === "boolean") {
      if (inline !== undefined)
        failArgument(`--${rawName} does not accept a value`);
      if (values[rawName ?? ""] !== undefined)
        failArgument(`--${rawName} must not be repeated`);
      values[rawName ?? ""] = true;
      continue;
    }
    const value = inline ?? tokens[index + 1];
    if (
      value === undefined ||
      value === "" ||
      (inline === undefined && value.startsWith("--"))
    ) {
      failArgument(`--${rawName} requires a non-empty value`);
    }
    if (inline === undefined) index += 1;
    if (definition.multiple === true) {
      const previous = values[rawName ?? ""];
      values[rawName ?? ""] = [
        ...(Array.isArray(previous) ? previous : []),
        value
      ];
    } else {
      if (values[rawName ?? ""] !== undefined)
        failArgument(`--${rawName} must not be repeated`);
      values[rawName ?? ""] = value;
    }
  }
  return { positionals, values };
}

function stringValue(
  parsed: ParsedCommandOptions,
  name: string,
  options: { required?: boolean } = {}
): string | undefined {
  const value = parsed.values[name];
  if (typeof value === "string") return value;
  if (options.required === true) failArgument(`--${name} is required`);
  return undefined;
}

function stringsValue(parsed: ParsedCommandOptions, name: string): string[] {
  const value = parsed.values[name];
  return Array.isArray(value) ? value : [];
}

function booleanValue(parsed: ParsedCommandOptions, name: string): boolean {
  return parsed.values[name] === true;
}

function integerValue(
  parsed: ParsedCommandOptions,
  name: string,
  options: { required?: boolean; minimum?: number; maximum?: number } = {}
): number | undefined {
  const value = stringValue(parsed, name, { required: options.required });
  if (value === undefined) return undefined;
  if (!/^(?:0|[1-9][0-9]*)$/u.test(value)) {
    failArgument(`--${name} must be a non-negative integer`);
  }
  const number = Number(value);
  if (
    !Number.isSafeInteger(number) ||
    (options.minimum !== undefined && number < options.minimum) ||
    (options.maximum !== undefined && number > options.maximum)
  ) {
    failArgument(`--${name} is outside its supported integer range`);
  }
  return number;
}

function requirePositionals(
  parsed: ParsedCommandOptions,
  count: number,
  usage: string
): string[] {
  if (parsed.positionals.length !== count) {
    failArgument(`Usage: ${usage}`, {
      expectedPositionals: count,
      actualPositionals: parsed.positionals.length
    });
  }
  return parsed.positionals;
}

function keyValueDictionary(
  values: string[],
  label: string
): Record<string, string> {
  const entries = new Map<string, string>();
  for (const value of values) {
    const separator = value.indexOf("=");
    if (separator <= 0 || separator === value.length - 1) {
      failArgument(`${label} must use <kind>=<value>`, { value });
    }
    const key = value.slice(0, separator);
    if (entries.has(key)) failArgument(`${label} key ${key} must not repeat`);
    entries.set(key, value.slice(separator + 1));
  }
  return Object.fromEntries(
    [...entries.entries()].sort(([left], [right]) =>
      left < right ? -1 : left > right ? 1 : 0
    )
  );
}

function controlInput(
  mode: string | undefined,
  reason: string | undefined,
  fallback?: TaskControlInput
): TaskControlInput | undefined {
  if (mode === undefined) {
    if (reason !== undefined) {
      failArgument("--reason requires --control waiting or --control paused");
    }
    return fallback;
  }
  if (!(taskControlModes as readonly string[]).includes(mode)) {
    failArgument(`--control must be one of ${taskControlModes.join(", ")}`);
  }
  if (mode === "waiting" || mode === "paused") {
    if (reason === undefined)
      failArgument(`--reason is required for ${mode} control`);
    return { mode, reason };
  }
  if (reason !== undefined)
    failArgument(`--reason is only valid for waiting or paused control`);
  return { mode: mode as "inherit" | "candidate" | "queued" };
}

function contentInput(parsed: ParsedCommandOptions): TaskContentInput {
  const title = stringValue(parsed, "title", { required: true }) ?? "";
  const goal = stringValue(parsed, "goal", { required: true }) ?? "";
  return {
    title,
    goal,
    acceptance: stringsValue(parsed, "acceptance"),
    context: stringValue(parsed, "context") ?? null,
    references: keyValueDictionary(
      stringsValue(parsed, "reference"),
      "--reference"
    )
  };
}

const contentOptionDefinitions = {
  title: { kind: "string" },
  goal: { kind: "string" },
  acceptance: { kind: "string", multiple: true },
  context: { kind: "string" },
  reference: { kind: "string", multiple: true }
} as const satisfies Record<string, OptionDefinition>;

function helpData(pathTokens: readonly string[]) {
  const command = resolveCommandPath(pathTokens);
  if (pathTokens.length > 0 && command === null) {
    failArgument("Unknown task-graph help command", {
      command: pathTokens.slice(0, 2).join(" ")
    });
  }
  const entry: CommandHelp | null =
    command === null ? null : commandHelpCatalog[command];
  return {
    command,
    requiresMutationRuntime:
      entry === null ? null : entry.requiresMutationRuntime === true,
    usage:
      entry?.usage ??
      "task-graph <command> [arguments] [--root <path>] [--index <path>] [--json]",
    parameters:
      entry === null
        ? null
        : {
            positionals: entry.positionals,
            options: entry.options,
            ...(entry.input === undefined ? {} : { input: entry.input })
          },
    globalOptions: [
      {
        name: "--root",
        required: false,
        type: "string",
        default: process.cwd()
      },
      {
        name: "--index",
        required: false,
        type: "string",
        default: defaultTaskGraphIndexPath
      },
      { name: "--json", required: false, type: "boolean", default: false }
    ],
    runtimeRequirements: {
      supportedNodeRange: taskGraphSupportedNodeRange,
      mutationPrerequisite: "compatible-runtime",
      setupCommand: ["runtime", "info"],
      installCommandSource: "runtime info data.installCommand"
    },
    commands: command === null ? [...commandPaths] : []
  };
}

async function readJsonRequest(filePath: string | undefined): Promise<unknown> {
  let text: string;
  try {
    if (filePath === undefined || filePath === "-") {
      process.stdin.setEncoding("utf8");
      const chunks: string[] = [];
      for await (const chunk of process.stdin) {
        chunks.push(String(chunk));
      }
      text = chunks.join("");
    } else {
      text = await fs.readFile(path.resolve(filePath), "utf8");
    }
  } catch (error) {
    throw new TaskGraphError(
      "REQUEST_INVALID",
      "Unable to read apply request JSON",
      { filePath: filePath ?? "stdin", cause: error }
    );
  }
  try {
    return JSON.parse(text) as unknown;
  } catch (error) {
    throw new TaskGraphError(
      "REQUEST_INVALID",
      "Apply request is not valid JSON",
      { filePath: filePath ?? "stdin", cause: error }
    );
  }
}

async function dispatchTaskList(
  service: TaskGraphService,
  tokens: readonly string[]
): Promise<ServiceResult<Record<string, TaskListItem>>> {
  const parsed = parseCommandOptions(tokens.slice(2), {});
  requirePositionals(parsed, 0, "task-graph task list");
  return await service.listTasks();
}

async function dispatchIndexStage(
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

async function dispatch(
  service: TaskGraphService,
  tokens: readonly string[],
  runtimeOptions: RuntimeContextOptions
): Promise<
  ServiceResult<unknown> | { revision: number | null; data: unknown }
> {
  const first = tokens[0];
  const second = tokens[1];
  if (first === "runtime") {
    const parsed = parseCommandOptions(tokens.slice(2), {});
    requirePositionals(parsed, 0, `task-graph runtime ${second ?? "<info>"}`);
    if (second === "info") {
      return {
        revision: null,
        data: await getTaskGraphRuntimeInfo(runtimeOptions)
      };
    }
    failArgument("runtime command must be info");
  }
  if (first === "index") {
    if (second === "stage") return await dispatchIndexStage(service, tokens);
    const parsed = parseCommandOptions(tokens.slice(2), {});
    requirePositionals(
      parsed,
      0,
      `task-graph index ${second ?? "<init|info>"}`
    );
    if (second === "init") return await service.init();
    if (second === "info") return await service.info();
    failArgument("index command must be init, info, or stage");
  }

  if (first === "task") {
    if (second === "create") {
      const parsed = parseCommandOptions(tokens.slice(2), {
        ...contentOptionDefinitions,
        parent: { kind: "string" },
        control: { kind: "string" },
        reason: { kind: "string" },
        "expected-revision": { kind: "string" }
      });
      requirePositionals(parsed, 0, "task-graph task create [options]");
      const applied = await service.apply({
        expectedRevision:
          integerValue(parsed, "expected-revision", { required: true }) ?? 0,
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
      if (taskId === undefined)
        throw new Error("create-task mutation returned no task id");
      return { revision: applied.revision, data: { taskId } };
    }
    if (second === "list") {
      return await dispatchTaskList(service, tokens);
    }
    if (second === "show") {
      const parsed = parseCommandOptions(tokens.slice(2), {});
      const [taskId = ""] = requirePositionals(
        parsed,
        1,
        "task-graph task show <task-id>"
      );
      return await service.showTask(taskId);
    }
    if (second === "update-content") {
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
        expectedRevision:
          integerValue(parsed, "expected-revision", { required: true }) ?? 0,
        operations: [
          {
            kind: "update-task-content",
            taskId,
            content: contentInput(parsed)
          }
        ]
      });
      return { revision: applied.revision, data: { taskId } };
    }
    if (second === "update-control") {
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
        expectedRevision:
          integerValue(parsed, "expected-revision", { required: true }) ?? 0,
        operations: [{ kind: "update-task-control", taskId, control }]
      });
      return { revision: applied.revision, data: { taskId } };
    }
    if (second === "remove") {
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
        expectedRevision:
          integerValue(parsed, "expected-revision", { required: true }) ?? 0,
        resultsDelivered: true
      });
    }
    failArgument("Unknown task command", { command: second ?? null });
  }

  if (first === "relation") {
    const parsed = parseCommandOptions(tokens.slice(2), {
      "expected-revision": { kind: "string" }
    });
    const expectedRevision =
      integerValue(parsed, "expected-revision", { required: true }) ?? 0;
    if (second === "parent") {
      const [taskId = "", parent = ""] = requirePositionals(
        parsed,
        2,
        "task-graph relation parent <task-id> <parent-id|null> --expected-revision <n>"
      );
      const applied = await service.apply({
        expectedRevision,
        operations: [
          {
            kind: "set-parent",
            taskId,
            parentId: parent === "null" ? null : parent
          }
        ]
      });
      return { revision: applied.revision, data: { taskId } };
    }
    if (second === "dependency-add" || second === "dependency-remove") {
      const [taskId = "", dependencyId = ""] = requirePositionals(
        parsed,
        2,
        `task-graph relation ${second} <task-id> <dependency-id> --expected-revision <n>`
      );
      const applied = await service.apply({
        expectedRevision,
        operations: [
          {
            kind: "set-dependency",
            taskId,
            dependencyId,
            present: second === "dependency-add"
          }
        ]
      });
      return { revision: applied.revision, data: { taskId } };
    }
    if (second === "exclusion-add" || second === "exclusion-remove") {
      const [taskId = "", excludedTaskId = ""] = requirePositionals(
        parsed,
        2,
        `task-graph relation ${second} <task-id> <excluded-id> --expected-revision <n>`
      );
      const applied = await service.apply({
        expectedRevision,
        operations: [
          {
            kind: "set-exclusion",
            taskId,
            excludedTaskId,
            present: second === "exclusion-add"
          }
        ]
      });
      return { revision: applied.revision, data: { taskId, excludedTaskId } };
    }
    failArgument("Unknown relation command", { command: second ?? null });
  }

  if (first === "actionable") {
    const parsed = parseCommandOptions(tokens.slice(1), {});
    requirePositionals(parsed, 0, "task-graph actionable");
    return await service.actionable();
  }
  if (first === "claim") {
    const parsed = parseCommandOptions(tokens.slice(1), {
      actor: { kind: "string" },
      duration: { kind: "string" },
      "recover-lease": { kind: "string" },
      "expected-revision": { kind: "string" },
      reason: { kind: "string" }
    });
    const [taskId = ""] = requirePositionals(
      parsed,
      1,
      "task-graph claim <task-id> --actor <actor> [--recover-lease <id> --expected-revision <n> --reason <text>]"
    );
    const recoverLeaseId = stringValue(parsed, "recover-lease");
    const expectedRevision = integerValue(parsed, "expected-revision");
    const reason = stringValue(parsed, "reason");
    const recoveryValueCount = [
      recoverLeaseId,
      expectedRevision,
      reason
    ].filter((value) => value !== undefined).length;
    if (recoveryValueCount !== 0 && recoveryValueCount !== 3) {
      failArgument(
        "--recover-lease, --expected-revision, and --reason must be provided together"
      );
    }
    const common = {
      taskId,
      actor: stringValue(parsed, "actor", { required: true }) ?? "",
      durationSeconds: integerValue(parsed, "duration", {
        minimum: 60,
        maximum: 86_400
      })
    };
    return recoverLeaseId === undefined
      ? await service.claim(common)
      : await service.claim({
          ...common,
          recoverLeaseId,
          expectedRevision: expectedRevision ?? 0,
          reason: reason ?? ""
        });
  }
  if (first === "renew") {
    const parsed = parseCommandOptions(tokens.slice(1), {
      lease: { kind: "string" },
      duration: { kind: "string" }
    });
    const [taskId = ""] = requirePositionals(
      parsed,
      1,
      "task-graph renew <task-id> --lease <id> [--duration <seconds>]"
    );
    return await service.renew({
      taskId,
      leaseId: stringValue(parsed, "lease", { required: true }) ?? "",
      durationSeconds: integerValue(parsed, "duration", {
        minimum: 60,
        maximum: 86_400
      })
    });
  }
  if (first === "release") {
    const parsed = parseCommandOptions(tokens.slice(1), {
      lease: { kind: "string" },
      control: { kind: "string" },
      reason: { kind: "string" }
    });
    const [taskId = ""] = requirePositionals(
      parsed,
      1,
      "task-graph release <task-id> --lease <id> --control <mode>"
    );
    const control = controlInput(
      stringValue(parsed, "control", { required: true }),
      stringValue(parsed, "reason")
    );
    if (control === undefined) failArgument("--control is required");
    return await service.release({
      taskId,
      leaseId: stringValue(parsed, "lease", { required: true }) ?? "",
      control
    });
  }
  if (first === "complete") {
    const parsed = parseCommandOptions(tokens.slice(1), {
      lease: { kind: "string" },
      "expected-revision": { kind: "string" },
      "result-summary": { kind: "string" },
      "result-reference": { kind: "string", multiple: true }
    });
    const [taskId = ""] = requirePositionals(
      parsed,
      1,
      "task-graph complete <task-id> --result-summary <text> [--lease <id>|--expected-revision <n>]"
    );
    const leaseId = stringValue(parsed, "lease");
    const expectedRevision = integerValue(parsed, "expected-revision");
    if (leaseId !== undefined && expectedRevision !== undefined) {
      failArgument("--lease and --expected-revision are mutually exclusive");
    }
    if (leaseId === undefined && expectedRevision === undefined) {
      failArgument("One of --lease or --expected-revision is required");
    }
    const common = {
      taskId,
      result: {
        summary:
          stringValue(parsed, "result-summary", { required: true }) ?? "",
        references: keyValueDictionary(
          stringsValue(parsed, "result-reference"),
          "--result-reference"
        )
      }
    };
    return await service.complete(
      leaseId !== undefined
        ? { ...common, leaseId }
        : { ...common, expectedRevision: expectedRevision ?? 0 }
    );
  }
  if (first === "fail") {
    const parsed = parseCommandOptions(tokens.slice(1), {
      lease: { kind: "string" },
      reason: { kind: "string" }
    });
    const [taskId = ""] = requirePositionals(
      parsed,
      1,
      "task-graph fail <task-id> --lease <id> --reason <text>"
    );
    return await service.fail({
      taskId,
      leaseId: stringValue(parsed, "lease", { required: true }) ?? "",
      reason: stringValue(parsed, "reason", { required: true }) ?? ""
    });
  }
  if (first === "retry") {
    const parsed = parseCommandOptions(tokens.slice(1), {
      "expected-revision": { kind: "string" }
    });
    const [taskId = ""] = requirePositionals(
      parsed,
      1,
      "task-graph retry <task-id> --expected-revision <n>"
    );
    return await service.retry({
      taskId,
      expectedRevision:
        integerValue(parsed, "expected-revision", { required: true }) ?? 0
    });
  }
  if (first === "cancel") {
    const parsed = parseCommandOptions(tokens.slice(1), {
      lease: { kind: "string" },
      "expected-revision": { kind: "string" },
      reason: { kind: "string" }
    });
    const [taskId = ""] = requirePositionals(
      parsed,
      1,
      "task-graph cancel <task-id> --reason <text> [--lease <id>|--expected-revision <n>]"
    );
    const leaseId = stringValue(parsed, "lease");
    const expectedRevision = integerValue(parsed, "expected-revision");
    if (leaseId !== undefined && expectedRevision !== undefined) {
      failArgument("--lease and --expected-revision are mutually exclusive");
    }
    if (leaseId === undefined && expectedRevision === undefined) {
      failArgument("One of --lease or --expected-revision is required");
    }
    const common = {
      taskId,
      reason: stringValue(parsed, "reason", { required: true }) ?? ""
    };
    return await service.cancel(
      leaseId !== undefined
        ? { ...common, leaseId }
        : { ...common, expectedRevision: expectedRevision ?? 0 }
    );
  }
  if (first === "apply") {
    const parsed = parseCommandOptions(tokens.slice(1), {
      file: { kind: "string" }
    });
    requirePositionals(parsed, 0, "task-graph apply [--file <path>|stdin]");
    const request = parseTaskGraphApplyRequest(
      await readJsonRequest(stringValue(parsed, "file"))
    );
    return await service.apply(request);
  }
  failArgument("Unknown task-graph command", { command: first ?? null });
}

function success<TData>(
  indexPath: string,
  revision: number | null,
  data: TData
): TaskGraphSuccess<TData> {
  return { ok: true, indexPath, revision, data };
}

function failure(
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

function resolveInvocation(
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

async function executeInvocation(
  service: TaskGraphService,
  invocation: CliInvocation,
  runtimeOptions: RuntimeContextOptions
): Promise<CliOutput> {
  switch (invocation.kind) {
    case "version":
      return {
        kind: "json",
        result: success(service.store.indexPath, null, {
          name: "task-graph",
          version: taskGraphVersion
        })
      };
    case "help":
      return {
        kind: "json",
        result: success(
          service.store.indexPath,
          null,
          helpData(invocation.pathTokens)
        )
      };
    case "index-stage": {
      const staged = await dispatchIndexStage(service, invocation.tokens);
      return {
        kind: "index-stage",
        result: success(service.store.indexPath, staged.revision, staged.data)
      };
    }
    case "task-list": {
      const listed = await dispatchTaskList(service, invocation.tokens);
      return {
        columns: invocation.columns,
        kind: "task-list",
        result: success(service.store.indexPath, listed.revision, listed.data)
      };
    }
    case "json-command": {
      if (requiresMutationRuntime(invocation.tokens)) {
        await assertTaskGraphMutationRuntime(service);
      }
      const dispatched = await dispatch(
        service,
        invocation.tokens,
        runtimeOptions
      );
      return {
        kind: "json",
        result: success(
          service.store.indexPath,
          dispatched.revision,
          dispatched.data
        )
      };
    }
  }
  return unreachable(invocation);
}

function outputFailure(
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

function writeJsonResult(io: CliIo, result: TaskGraphResult): void {
  io.stdout(`${JSON.stringify(result)}\n`);
}

function writeOutput(io: CliIo, output: CliOutput): void {
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

/** @internal */
export function runTaskGraphCli(
  argv: readonly string[],
  options: TaskGraphCliInternalOptions
): Promise<number>;
export function runTaskGraphCli(
  argv?: readonly string[],
  options?: TaskGraphCliOptions
): Promise<number>;
export async function runTaskGraphCli(
  argv: readonly string[] = process.argv.slice(2),
  options: TaskGraphCliInternalOptions = {}
): Promise<number> {
  const io = options.io ?? {
    stdout: (text: string) => process.stdout.write(text)
  };
  let globals: GlobalArguments;
  try {
    globals = parseGlobalArguments(argv);
  } catch (error) {
    if (!(error instanceof TaskGraphError)) throw error;
    const fallbackPath = path.resolve(process.cwd(), defaultTaskGraphIndexPath);
    writeJsonResult(io, failure(fallbackPath, null, error));
    return 1;
  }
  let service: TaskGraphService;
  try {
    service = new TaskGraphService({
      ...(options.serviceOptions ?? {}),
      root: globals.root,
      indexPath: globals.indexPath,
      loadNativeLock:
        options.serviceOptions?.loadNativeLock ??
        (() => loadNativeLockBinding(options.runtimeOptions))
    });
  } catch (error) {
    if (!(error instanceof TaskGraphError)) throw error;
    const fallbackPath = path.resolve(
      globals.root,
      globals.indexPath ?? defaultTaskGraphIndexPath
    );
    writeJsonResult(io, failure(fallbackPath, null, error));
    return 1;
  }
  const invocation = resolveInvocation(globals, options.columns);

  let output: CliOutput;
  let exitCode: 0 | 1;
  try {
    output = await executeInvocation(
      service,
      invocation,
      options.runtimeOptions ?? {}
    );
    exitCode = 0;
  } catch (error) {
    if (!(error instanceof TaskGraphError)) throw error;
    const runtimeInvocation =
      globals.remaining[0] === "runtime" ||
      (globals.remaining[0] === "help" && globals.remaining[1] === "runtime");
    let revision: number | null = null;
    if (!runtimeInvocation && !error.code.startsWith("RUNTIME_")) {
      try {
        revision = (await service.info()).revision;
      } catch {
        // The error envelope still remains valid without a readable index.
      }
    }
    output = outputFailure(
      invocation,
      failure(service.store.indexPath, revision, error)
    );
    exitCode = 1;
  }
  writeOutput(io, output);
  return exitCode;
}

if (isMainModule(import.meta.url)) {
  try {
    process.exitCode = await runTaskGraphCli();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 2;
  }
}

export * from "./index.ts";
