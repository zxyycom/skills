import process from "node:process";
import { failArgument } from "./cli-arguments.ts";
import type { CommandHelp, HelpParameter } from "./cli-contract.ts";
import {
  defaultTaskGraphIndexPath,
  taskControlModes,
  taskGraphSupportedNodeRange
} from "./types.ts";

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

export function resolveCommandPath(
  tokens: readonly string[]
): CommandPath | null {
  const twoPart = tokens.slice(0, 2).join(" ");
  if (isCommandPath(twoPart)) return twoPart;
  const onePart = tokens[0] ?? "";
  return isCommandPath(onePart) ? onePart : null;
}

export function requiresMutationRuntime(tokens: readonly string[]): boolean {
  const command = resolveCommandPath(tokens);
  if (command === null) return false;
  const entry: CommandHelp = commandHelpCatalog[command];
  return entry.requiresMutationRuntime === true;
}

function helpParameters(entry: CommandHelp | null) {
  if (entry === null) return null;
  return {
    positionals: entry.positionals,
    options: entry.options,
    ...(entry.input === undefined ? {} : { input: entry.input })
  };
}

function globalHelpOptions() {
  return [
    { name: "--root", required: false, type: "string", default: process.cwd() },
    {
      name: "--index",
      required: false,
      type: "string",
      default: defaultTaskGraphIndexPath
    },
    { name: "--json", required: false, type: "boolean", default: false }
  ];
}

export function helpData(pathTokens: readonly string[]) {
  const command = resolveCommandPath(pathTokens);
  if (pathTokens.length > 0 && command === null)
    failArgument("Unknown task-graph help command", {
      command: pathTokens.slice(0, 2).join(" ")
    });
  const entry = command === null ? null : commandHelpCatalog[command];
  return {
    command,
    requiresMutationRuntime:
      entry === null
        ? null
        : "requiresMutationRuntime" in entry &&
          entry.requiresMutationRuntime === true,
    usage:
      entry?.usage ??
      "task-graph <command> [arguments] [--root <path>] [--index <path>] [--json]",
    parameters: helpParameters(entry),
    globalOptions: globalHelpOptions(),
    runtimeRequirements: {
      supportedNodeRange: taskGraphSupportedNodeRange,
      mutationPrerequisite: "compatible-runtime",
      setupCommand: ["runtime", "info"],
      installCommandSource: "runtime info data.installCommand"
    },
    commands: command === null ? [...commandPaths] : []
  };
}
