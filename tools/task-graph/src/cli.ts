#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { isMainModule } from "../../shared/src/node/main-module.ts";
import { TaskGraphError } from "./errors.ts";
import {
  checkTaskGraphRuntime,
  getTaskGraphRuntimeInfo,
  installTaskGraphRuntime,
  loadNativeLockBinding,
  type RuntimeInstallInternalOptions
} from "./runtime.ts";
import { parseTaskGraphApplyRequest } from "./schema.ts";
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

type TaskGraphCliInternalOptions = {
  io?: CliIo;
  runtimeOptions?: RuntimeInstallInternalOptions;
  serviceOptions?: Omit<TaskGraphServiceInternalOptions, "root" | "indexPath">;
};

type GlobalArguments = {
  help: boolean;
  indexPath?: string;
  remaining: string[];
  root: string;
  version: boolean;
};

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
  { name: "--acceptance", required: true, type: "string", multiple: true },
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
  "runtime info": { usage: "task-graph runtime info", positionals: [], options: [] },
  "runtime install": { usage: "task-graph runtime install", positionals: [], options: [] },
  "runtime check": { usage: "task-graph runtime check", positionals: [], options: [] },
  "index init": { usage: "task-graph index init", positionals: [], options: [] },
  "index info": { usage: "task-graph index info", positionals: [], options: [] },
  "index check": { usage: "task-graph index check", positionals: [], options: [] },
  "scope create": {
    usage: "task-graph scope create --key <key> --expected-revision <n> [--binding <kind=value> ...]",
    positionals: [],
    options: [
      { name: "--key", required: true, type: "string" },
      expectedRevisionHelp,
      { name: "--binding", required: false, type: "key-value", multiple: true }
    ]
  },
  "scope list": {
    usage: "task-graph scope list [--key <key>] [--binding <kind=value>]",
    positionals: [],
    options: [
      { name: "--key", required: false, type: "string" },
      { name: "--binding", required: false, type: "key-value" }
    ]
  },
  "scope show": {
    usage: "task-graph scope show <scope-id>",
    positionals: [positional("scope-id")], options: []
  },
  "scope binding-set": {
    usage: "task-graph scope binding-set <scope-id> <kind> <value> --expected-revision <n>",
    positionals: [positional("scope-id"), positional("kind"), positional("value")],
    options: [expectedRevisionHelp]
  },
  "scope binding-remove": {
    usage: "task-graph scope binding-remove <scope-id> <kind> --expected-revision <n>",
    positionals: [positional("scope-id"), positional("kind")],
    options: [expectedRevisionHelp]
  },
  "scope close": {
    usage: "task-graph scope close <scope-id> --expected-revision <n> --results-delivered",
    positionals: [positional("scope-id")],
    options: [
      expectedRevisionHelp,
      { name: "--results-delivered", required: true, type: "boolean" }
    ]
  },
  "scope gc-query": { usage: "task-graph scope gc-query", positionals: [], options: [] },
  "scope gc": {
    usage: "task-graph scope gc --scope <id> --results-delivered <id> --expected-revision <n>",
    positionals: [],
    options: [
      { name: "--scope", required: true, type: "string", multiple: true },
      { name: "--results-delivered", required: true, type: "string", multiple: true },
      expectedRevisionHelp
    ]
  },
  "task create": {
    usage: "task-graph task create <scope-id> --title <text> --goal <text> --acceptance <text> --expected-revision <n> [options]",
    positionals: [positional("scope-id")],
    options: [
      ...contentHelp,
      { name: "--parent", required: false, type: "string", default: null },
      { name: "--control", required: false, type: "string", enum: taskControlModes },
      { name: "--reason", required: false, type: "string" },
      expectedRevisionHelp
    ]
  },
  "task list": {
    usage: "task-graph task list <scope-id>",
    positionals: [positional("scope-id")], options: []
  },
  "task show": {
    usage: "task-graph task show <scope-id> <task-id>",
    positionals: [positional("scope-id"), positional("task-id")], options: []
  },
  "task update-content": {
    usage: "task-graph task update-content <scope-id> <task-id> --title <text> --goal <text> --acceptance <text> --expected-revision <n>",
    positionals: [positional("scope-id"), positional("task-id")],
    options: [...contentHelp, expectedRevisionHelp]
  },
  "task update-control": {
    usage: "task-graph task update-control <scope-id> <task-id> --control <mode> --expected-revision <n> [--reason <text>]",
    positionals: [positional("scope-id"), positional("task-id")],
    options: [...controlHelp, expectedRevisionHelp]
  },
  "relation parent": {
    usage: "task-graph relation parent <scope-id> <task-id> <parent-id|null> --expected-revision <n>",
    positionals: [positional("scope-id"), positional("task-id"), positional("parent-id|null")],
    options: [expectedRevisionHelp]
  },
  "relation dependency-add": {
    usage: "task-graph relation dependency-add <scope-id> <task-id> <dependency-id> --expected-revision <n>",
    positionals: [positional("scope-id"), positional("task-id"), positional("dependency-id")],
    options: [expectedRevisionHelp]
  },
  "relation dependency-remove": {
    usage: "task-graph relation dependency-remove <scope-id> <task-id> <dependency-id> --expected-revision <n>",
    positionals: [positional("scope-id"), positional("task-id"), positional("dependency-id")],
    options: [expectedRevisionHelp]
  },
  "relation exclusion-add": {
    usage: "task-graph relation exclusion-add <scope-id> <task-id> <excluded-id> --expected-revision <n>",
    positionals: [positional("scope-id"), positional("task-id"), positional("excluded-id")],
    options: [expectedRevisionHelp]
  },
  "relation exclusion-remove": {
    usage: "task-graph relation exclusion-remove <scope-id> <task-id> <excluded-id> --expected-revision <n>",
    positionals: [positional("scope-id"), positional("task-id"), positional("excluded-id")],
    options: [expectedRevisionHelp]
  },
  actionable: {
    usage: "task-graph actionable <scope-id>",
    positionals: [positional("scope-id")], options: []
  },
  trace: {
    usage: "task-graph trace <scope-id> <task-id>",
    positionals: [positional("scope-id"), positional("task-id")], options: []
  },
  claim: {
    usage: "task-graph claim <scope-id> <task-id> --actor <actor> [--duration <seconds>]",
    positionals: [positional("scope-id"), positional("task-id")],
    options: [
      { name: "--actor", required: true, type: "string" },
      { name: "--duration", required: false, type: "integer", default: 1800 }
    ]
  },
  renew: {
    usage: "task-graph renew <scope-id> <task-id> --lease <id> [--duration <seconds>]",
    positionals: [positional("scope-id"), positional("task-id")],
    options: [
      { name: "--lease", required: true, type: "string" },
      { name: "--duration", required: false, type: "integer", default: 1800 }
    ]
  },
  release: {
    usage: "task-graph release <scope-id> <task-id> --lease <id> --control <mode> [--reason <text>]",
    positionals: [positional("scope-id"), positional("task-id")],
    options: [{ name: "--lease", required: true, type: "string" }, ...controlHelp]
  },
  complete: {
    usage: "task-graph complete <scope-id> <task-id> --result-summary <text> (--lease <id>|--expected-revision <n>) [--result-reference <kind=value> ...]",
    positionals: [positional("scope-id"), positional("task-id")],
    options: [
      { name: "--result-summary", required: true, type: "string" },
      { name: "--result-reference", required: false, type: "key-value", multiple: true },
      { name: "--lease", required: false, type: "string" },
      { ...expectedRevisionHelp, required: false }
    ]
  },
  fail: {
    usage: "task-graph fail <scope-id> <task-id> --lease <id> --reason <text>",
    positionals: [positional("scope-id"), positional("task-id")],
    options: [
      { name: "--lease", required: true, type: "string" },
      { name: "--reason", required: true, type: "string" }
    ]
  },
  retry: {
    usage: "task-graph retry <scope-id> <task-id> --expected-revision <n>",
    positionals: [positional("scope-id"), positional("task-id")],
    options: [expectedRevisionHelp]
  },
  cancel: {
    usage: "task-graph cancel <scope-id> <task-id> --reason <text> (--lease <id>|--expected-revision <n>)",
    positionals: [positional("scope-id"), positional("task-id")],
    options: [
      { name: "--reason", required: true, type: "string" },
      { name: "--lease", required: false, type: "string" },
      { ...expectedRevisionHelp, required: false }
    ]
  },
  recover: {
    usage: "task-graph recover <scope-id> <task-id> --lease <id> --reason <text> [--force --expected-revision <n>]",
    positionals: [positional("scope-id"), positional("task-id")],
    options: [
      { name: "--lease", required: true, type: "string" },
      { name: "--reason", required: true, type: "string" },
      { name: "--force", required: false, type: "boolean", default: false },
      { ...expectedRevisionHelp, required: false }
    ]
  },
  apply: {
    usage: "task-graph apply [--file <path>]",
    positionals: [],
    options: [{ name: "--file", required: false, type: "string", default: "stdin" }],
    input: { default: "stdin", fileOption: "--file", format: "json" }
  }
} as const satisfies Record<string, CommandHelp>;

const commandPaths = Object.keys(commandHelpCatalog).sort();

const mutationCommandPaths = new Set([
  "index init",
  "scope create",
  "scope binding-set",
  "scope binding-remove",
  "scope close",
  "scope gc",
  "task create",
  "task update-content",
  "task update-control",
  "relation parent",
  "relation dependency-add",
  "relation dependency-remove",
  "relation exclusion-add",
  "relation exclusion-remove",
  "claim",
  "renew",
  "release",
  "complete",
  "fail",
  "retry",
  "cancel",
  "recover",
  "apply"
]);

function isMutationInvocation(tokens: readonly string[]): boolean {
  const twoPart = tokens.slice(0, 2).join(" ");
  return mutationCommandPaths.has(twoPart) || mutationCommandPaths.has(tokens[0] ?? "");
}

function failArgument(message: string, details: JsonObject = {}): never {
  throw new TaskGraphError("ARGUMENT_INVALID", message, details);
}

function parseGlobalArguments(argv: readonly string[]): GlobalArguments {
  const remaining: string[] = [];
  let root = process.cwd();
  let indexPath: string | undefined;
  let help = false;
  let version = false;
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index] ?? "";
    const [name, inline] = token.split(/=(.*)/su, 2);
    if (name === "--root" || name === "--index") {
      const value = inline ?? argv[index + 1];
      if (value === undefined || value === "") {
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
    remaining.push(token);
  }
  return { help, indexPath, remaining, root: path.resolve(root), version };
}

function parseCommandOptions(
  tokens: readonly string[],
  definitions: Record<string, OptionDefinition>
): ParsedCommandOptions {
  const positionals: string[] = [];
  const values = Object.create(null) as Record<string, string | string[] | true>;
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
      if (inline !== undefined) failArgument(`--${rawName} does not accept a value`);
      if (values[rawName ?? ""] !== undefined) failArgument(`--${rawName} must not be repeated`);
      values[rawName ?? ""] = true;
      continue;
    }
    const value = inline ?? tokens[index + 1];
    if (value === undefined || value === "" || (inline === undefined && value.startsWith("--"))) {
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
      if (values[rawName ?? ""] !== undefined) failArgument(`--${rawName} must not be repeated`);
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
    !Number.isSafeInteger(number)
    || (options.minimum !== undefined && number < options.minimum)
    || (options.maximum !== undefined && number > options.maximum)
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

function keyValueDictionary(values: string[], label: string): Record<string, string> {
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
    [...entries.entries()].sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)
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
    if (reason === undefined) failArgument(`--reason is required for ${mode} control`);
    return { mode, reason };
  }
  if (reason !== undefined) failArgument(`--reason is only valid for waiting or paused control`);
  return { mode: mode as "inherit" | "candidate" | "queued" };
}

function contentInput(parsed: ParsedCommandOptions): TaskContentInput {
  const title = stringValue(parsed, "title", { required: true }) ?? "";
  const goal = stringValue(parsed, "goal", { required: true }) ?? "";
  const acceptance = stringsValue(parsed, "acceptance");
  if (acceptance.length === 0) failArgument("--acceptance is required and may be repeated");
  return {
    title,
    goal,
    acceptance,
    context: stringValue(parsed, "context") ?? null,
    references: keyValueDictionary(stringsValue(parsed, "reference"), "--reference")
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
  const twoPart = pathTokens.slice(0, 2).join(" ");
  const onePart = pathTokens[0] ?? "";
  const command = Object.hasOwn(commandHelpCatalog, twoPart)
    ? twoPart
    : Object.hasOwn(commandHelpCatalog, onePart)
      ? onePart
      : null;
  if (pathTokens.length > 0 && command === null) {
    failArgument("Unknown task-graph help command", {
      command: pathTokens.slice(0, 2).join(" ")
    });
  }
  const entry: CommandHelp | null = command === null
    ? null
    : commandHelpCatalog[command as keyof typeof commandHelpCatalog];
  return {
    command,
    usage: entry?.usage
      ?? "task-graph <command> [arguments] [--root <path>] [--index <path>]",
    parameters: entry === null
      ? null
      : {
          positionals: entry.positionals,
          options: entry.options,
          ...(entry.input === undefined ? {} : { input: entry.input })
        },
    globalOptions: [
      { name: "--root", required: false, type: "string", default: process.cwd() },
      { name: "--index", required: false, type: "string", default: defaultTaskGraphIndexPath }
    ],
    runtimeRequirements: {
      supportedNodeRange: taskGraphSupportedNodeRange,
      mutationPrerequisite: "installed-compatible-runtime",
      installCommand: ["runtime", "install"]
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

async function dispatch(
  service: TaskGraphService,
  tokens: readonly string[],
  runtimeOptions: RuntimeInstallInternalOptions
): Promise<ServiceResult<unknown> | { revision: number | null; data: unknown }> {
  const first = tokens[0];
  const second = tokens[1];
  if (first === "runtime") {
    const parsed = parseCommandOptions(tokens.slice(2), {});
    requirePositionals(parsed, 0, `task-graph runtime ${second ?? "<info|install|check>"}`);
    if (second === "info") {
      return { revision: null, data: await getTaskGraphRuntimeInfo(runtimeOptions) };
    }
    if (second === "install") {
      return { revision: null, data: await installTaskGraphRuntime(runtimeOptions) };
    }
    if (second === "check") {
      return { revision: null, data: await checkTaskGraphRuntime(runtimeOptions) };
    }
    failArgument("runtime command must be info, install, or check");
  }
  if (first === "index") {
    const parsed = parseCommandOptions(tokens.slice(2), {});
    requirePositionals(parsed, 0, `task-graph index ${second ?? "<init|info|check>"}`);
    if (second === "init") return await service.init();
    if (second === "info") return await service.info();
    if (second === "check") {
      const result = await service.check();
      if (!result.data.valid) {
        const unsupported = result.data.diagnostics.some(
          (diagnostic) => diagnostic.code === "schema-unsupported"
        );
        throw new TaskGraphError(
          unsupported ? "SCHEMA_UNSUPPORTED" : "INDEX_INVALID",
          "Task index check failed",
          { diagnostics: result.data.diagnostics }
        );
      }
      return result;
    }
    failArgument("index command must be init, info, or check");
  }

  if (first === "scope") {
    if (second === "create") {
      const parsed = parseCommandOptions(tokens.slice(2), {
        key: { kind: "string" },
        binding: { kind: "string", multiple: true },
        "expected-revision": { kind: "string" }
      });
      requirePositionals(parsed, 0, "task-graph scope create --key <key> --expected-revision <n>");
      return await service.createScope({
        expectedRevision: integerValue(parsed, "expected-revision", { required: true }) ?? 0,
        key: stringValue(parsed, "key", { required: true }) ?? "",
        bindings: keyValueDictionary(stringsValue(parsed, "binding"), "--binding")
      });
    }
    if (second === "list") {
      const parsed = parseCommandOptions(tokens.slice(2), {
        key: { kind: "string" },
        binding: { kind: "string" }
      });
      requirePositionals(parsed, 0, "task-graph scope list [--key <key>] [--binding <kind=value>]");
      const binding = stringValue(parsed, "binding");
      const dictionary = binding === undefined ? {} : keyValueDictionary([binding], "--binding");
      const entry = Object.entries(dictionary)[0];
      const key = stringValue(parsed, "key");
      return await service.listScopes(entry === undefined
        ? { key }
        : { key, bindingKind: entry[0], bindingValue: entry[1] });
    }
    if (second === "show") {
      const parsed = parseCommandOptions(tokens.slice(2), {});
      const [scopeId = ""] = requirePositionals(parsed, 1, "task-graph scope show <scope-id>");
      return await service.showScope(scopeId);
    }
    if (second === "binding-set" || second === "binding-remove") {
      const parsed = parseCommandOptions(tokens.slice(2), {
        "expected-revision": { kind: "string" }
      });
      const count = second === "binding-set" ? 3 : 2;
      const positionals = requirePositionals(
        parsed,
        count,
        second === "binding-set"
          ? "task-graph scope binding-set <scope-id> <kind> <value> --expected-revision <n>"
          : "task-graph scope binding-remove <scope-id> <kind> --expected-revision <n>"
      );
      return await service.setScopeBinding({
        scopeId: positionals[0] ?? "",
        kind: positionals[1] ?? "",
        value: second === "binding-set" ? positionals[2] ?? "" : null,
        expectedRevision: integerValue(parsed, "expected-revision", { required: true }) ?? 0
      });
    }
    if (second === "close") {
      const parsed = parseCommandOptions(tokens.slice(2), {
        "expected-revision": { kind: "string" },
        "results-delivered": { kind: "boolean" }
      });
      const [scopeId = ""] = requirePositionals(
        parsed,
        1,
        "task-graph scope close <scope-id> --expected-revision <n> --results-delivered"
      );
      if (!booleanValue(parsed, "results-delivered")) {
        failArgument("--results-delivered is required");
      }
      return await service.closeScope({
        scopeId,
        expectedRevision: integerValue(parsed, "expected-revision", { required: true }) ?? 0,
        resultsDelivered: true
      });
    }
    if (second === "gc-query") {
      const parsed = parseCommandOptions(tokens.slice(2), {});
      requirePositionals(parsed, 0, "task-graph scope gc-query");
      return await service.queryGc();
    }
    if (second === "gc") {
      const parsed = parseCommandOptions(tokens.slice(2), {
        scope: { kind: "string", multiple: true },
        "results-delivered": { kind: "string", multiple: true },
        "expected-revision": { kind: "string" }
      });
      requirePositionals(parsed, 0, "task-graph scope gc --scope <id> --results-delivered <id> --expected-revision <n>");
      const scopes = stringsValue(parsed, "scope");
      const delivered = stringsValue(parsed, "results-delivered");
      if (
        scopes.length === 0
        || delivered.length !== scopes.length
        || scopes.some((scopeId) => !delivered.includes(scopeId))
      ) {
        failArgument("Every explicit --scope must have one matching --results-delivered value");
      }
      return await service.closeScopeSet({
        expectedRevision: integerValue(parsed, "expected-revision", { required: true }) ?? 0,
        scopes: scopes.map((scopeId) => ({ scopeId, resultsDelivered: true }))
      });
    }
    failArgument("Unknown scope command", { command: second ?? null });
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
      const [scopeId = ""] = requirePositionals(parsed, 1, "task-graph task create <scope-id> [options]");
      return await service.createTask({
        scopeId,
        expectedRevision: integerValue(parsed, "expected-revision", { required: true }) ?? 0,
        content: contentInput(parsed),
        parentId: stringValue(parsed, "parent"),
        control: controlInput(stringValue(parsed, "control"), stringValue(parsed, "reason"))
      });
    }
    if (second === "list") {
      const parsed = parseCommandOptions(tokens.slice(2), {});
      const [scopeId = ""] = requirePositionals(parsed, 1, "task-graph task list <scope-id>");
      return await service.listTasks(scopeId);
    }
    if (second === "show") {
      const parsed = parseCommandOptions(tokens.slice(2), {});
      const [scopeId = "", taskId = ""] = requirePositionals(parsed, 2, "task-graph task show <scope-id> <task-id>");
      return await service.showTask(scopeId, taskId);
    }
    if (second === "update-content") {
      const parsed = parseCommandOptions(tokens.slice(2), {
        ...contentOptionDefinitions,
        "expected-revision": { kind: "string" }
      });
      const [scopeId = "", taskId = ""] = requirePositionals(parsed, 2, "task-graph task update-content <scope-id> <task-id> [options]");
      return await service.updateTaskContent({
        scopeId,
        taskId,
        expectedRevision: integerValue(parsed, "expected-revision", { required: true }) ?? 0,
        content: contentInput(parsed)
      });
    }
    if (second === "update-control") {
      const parsed = parseCommandOptions(tokens.slice(2), {
        control: { kind: "string" },
        reason: { kind: "string" },
        "expected-revision": { kind: "string" }
      });
      const [scopeId = "", taskId = ""] = requirePositionals(parsed, 2, "task-graph task update-control <scope-id> <task-id> [options]");
      const control = controlInput(
        stringValue(parsed, "control", { required: true }),
        stringValue(parsed, "reason")
      );
      if (control === undefined) failArgument("--control is required");
      return await service.updateTaskControl({
        scopeId,
        taskId,
        expectedRevision: integerValue(parsed, "expected-revision", { required: true }) ?? 0,
        control
      });
    }
    failArgument("Unknown task command", { command: second ?? null });
  }

  if (first === "relation") {
    const parsed = parseCommandOptions(tokens.slice(2), {
      "expected-revision": { kind: "string" }
    });
    const expectedRevision = integerValue(parsed, "expected-revision", { required: true }) ?? 0;
    if (second === "parent") {
      const [scopeId = "", taskId = "", parent = ""] = requirePositionals(parsed, 3, "task-graph relation parent <scope-id> <task-id> <parent-id|null> --expected-revision <n>");
      return await service.setParent({
        scopeId,
        taskId,
        parentId: parent === "null" ? null : parent,
        expectedRevision
      });
    }
    if (second === "dependency-add" || second === "dependency-remove") {
      const [scopeId = "", taskId = "", dependencyId = ""] = requirePositionals(parsed, 3, `task-graph relation ${second} <scope-id> <task-id> <dependency-id> --expected-revision <n>`);
      return await service.setDependency({
        scopeId,
        taskId,
        dependencyId,
        present: second === "dependency-add",
        expectedRevision
      });
    }
    if (second === "exclusion-add" || second === "exclusion-remove") {
      const [scopeId = "", taskId = "", excludedTaskId = ""] = requirePositionals(parsed, 3, `task-graph relation ${second} <scope-id> <task-id> <excluded-id> --expected-revision <n>`);
      return await service.setExclusion({
        scopeId,
        taskId,
        excludedTaskId,
        present: second === "exclusion-add",
        expectedRevision
      });
    }
    failArgument("Unknown relation command", { command: second ?? null });
  }

  if (first === "actionable") {
    const parsed = parseCommandOptions(tokens.slice(1), {});
    const [scopeId = ""] = requirePositionals(parsed, 1, "task-graph actionable <scope-id>");
    return await service.actionable(scopeId);
  }
  if (first === "trace") {
    const parsed = parseCommandOptions(tokens.slice(1), {});
    const [scopeId = "", taskId = ""] = requirePositionals(parsed, 2, "task-graph trace <scope-id> <task-id>");
    return await service.trace(scopeId, taskId);
  }

  if (first === "claim") {
    const parsed = parseCommandOptions(tokens.slice(1), {
      actor: { kind: "string" },
      duration: { kind: "string" }
    });
    const [scopeId = "", taskId = ""] = requirePositionals(parsed, 2, "task-graph claim <scope-id> <task-id> --actor <actor> [--duration <seconds>]");
    return await service.claim({
      scopeId,
      taskId,
      actor: stringValue(parsed, "actor", { required: true }) ?? "",
      durationSeconds: integerValue(parsed, "duration", { minimum: 60, maximum: 86_400 })
    });
  }
  if (first === "renew") {
    const parsed = parseCommandOptions(tokens.slice(1), {
      lease: { kind: "string" },
      duration: { kind: "string" }
    });
    const [scopeId = "", taskId = ""] = requirePositionals(parsed, 2, "task-graph renew <scope-id> <task-id> --lease <id> [--duration <seconds>]");
    return await service.renew({
      scopeId,
      taskId,
      leaseId: stringValue(parsed, "lease", { required: true }) ?? "",
      durationSeconds: integerValue(parsed, "duration", { minimum: 60, maximum: 86_400 })
    });
  }
  if (first === "release") {
    const parsed = parseCommandOptions(tokens.slice(1), {
      lease: { kind: "string" },
      control: { kind: "string" },
      reason: { kind: "string" }
    });
    const [scopeId = "", taskId = ""] = requirePositionals(parsed, 2, "task-graph release <scope-id> <task-id> --lease <id> --control <mode>");
    const control = controlInput(
      stringValue(parsed, "control", { required: true }),
      stringValue(parsed, "reason")
    );
    if (control === undefined) failArgument("--control is required");
    return await service.release({
      scopeId,
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
    const [scopeId = "", taskId = ""] = requirePositionals(parsed, 2, "task-graph complete <scope-id> <task-id> --result-summary <text> [--lease <id>|--expected-revision <n>]");
    const leaseId = stringValue(parsed, "lease");
    const expectedRevision = integerValue(parsed, "expected-revision");
    if (leaseId !== undefined && expectedRevision !== undefined) {
      failArgument("--lease and --expected-revision are mutually exclusive");
    }
    if (leaseId === undefined && expectedRevision === undefined) {
      failArgument("One of --lease or --expected-revision is required");
    }
    const common = {
      scopeId,
      taskId,
      result: {
        summary: stringValue(parsed, "result-summary", { required: true }) ?? "",
        references: keyValueDictionary(stringsValue(parsed, "result-reference"), "--result-reference")
      }
    };
    return await service.complete(leaseId !== undefined
      ? { ...common, leaseId }
      : { ...common, expectedRevision: expectedRevision ?? 0 });
  }
  if (first === "fail") {
    const parsed = parseCommandOptions(tokens.slice(1), {
      lease: { kind: "string" },
      reason: { kind: "string" }
    });
    const [scopeId = "", taskId = ""] = requirePositionals(parsed, 2, "task-graph fail <scope-id> <task-id> --lease <id> --reason <text>");
    return await service.fail({
      scopeId,
      taskId,
      leaseId: stringValue(parsed, "lease", { required: true }) ?? "",
      reason: stringValue(parsed, "reason", { required: true }) ?? ""
    });
  }
  if (first === "retry") {
    const parsed = parseCommandOptions(tokens.slice(1), {
      "expected-revision": { kind: "string" }
    });
    const [scopeId = "", taskId = ""] = requirePositionals(parsed, 2, "task-graph retry <scope-id> <task-id> --expected-revision <n>");
    return await service.retry({
      scopeId,
      taskId,
      expectedRevision: integerValue(parsed, "expected-revision", { required: true }) ?? 0
    });
  }
  if (first === "cancel") {
    const parsed = parseCommandOptions(tokens.slice(1), {
      lease: { kind: "string" },
      "expected-revision": { kind: "string" },
      reason: { kind: "string" }
    });
    const [scopeId = "", taskId = ""] = requirePositionals(parsed, 2, "task-graph cancel <scope-id> <task-id> --reason <text> [--lease <id>|--expected-revision <n>]");
    const leaseId = stringValue(parsed, "lease");
    const expectedRevision = integerValue(parsed, "expected-revision");
    if (leaseId !== undefined && expectedRevision !== undefined) {
      failArgument("--lease and --expected-revision are mutually exclusive");
    }
    if (leaseId === undefined && expectedRevision === undefined) {
      failArgument("One of --lease or --expected-revision is required");
    }
    const common = {
      scopeId,
      taskId,
      reason: stringValue(parsed, "reason", { required: true }) ?? ""
    };
    return await service.cancel(leaseId !== undefined
      ? { ...common, leaseId }
      : { ...common, expectedRevision: expectedRevision ?? 0 });
  }
  if (first === "recover") {
    const parsed = parseCommandOptions(tokens.slice(1), {
      lease: { kind: "string" },
      reason: { kind: "string" },
      force: { kind: "boolean" },
      "expected-revision": { kind: "string" }
    });
    const [scopeId = "", taskId = ""] = requirePositionals(parsed, 2, "task-graph recover <scope-id> <task-id> --lease <id> --reason <text> [--force --expected-revision <n>]");
    const force = booleanValue(parsed, "force");
    const expectedRevision = integerValue(parsed, "expected-revision");
    if (force !== (expectedRevision !== undefined)) {
      failArgument("--force and --expected-revision must be provided together");
    }
    const common = {
      scopeId,
      taskId,
      leaseId: stringValue(parsed, "lease", { required: true }) ?? "",
      reason: stringValue(parsed, "reason", { required: true }) ?? ""
    };
    return force
      ? await service.recover({ ...common, force: true, expectedRevision: expectedRevision ?? 0 })
      : await service.recover(common);
  }
  if (first === "apply") {
    const parsed = parseCommandOptions(tokens.slice(1), { file: { kind: "string" } });
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

function writeResult(io: CliIo, result: TaskGraphResult): void {
  io.stdout(`${JSON.stringify(result)}\n`);
}

export async function runTaskGraphCli(
  argv: readonly string[] = process.argv.slice(2),
  options: TaskGraphCliInternalOptions = {}
): Promise<number> {
  const io = options.io ?? { stdout: (text: string) => process.stdout.write(text) };
  let globals: GlobalArguments;
  try {
    globals = parseGlobalArguments(argv);
  } catch (error) {
    if (!(error instanceof TaskGraphError)) throw error;
    const fallbackPath = path.resolve(process.cwd(), defaultTaskGraphIndexPath);
    writeResult(io, {
      ok: false,
      indexPath: fallbackPath,
      revision: null,
      error: {
        code: error.code,
        retryable: error.retryable,
        message: error.message,
        details: error.details
      }
    });
    return 1;
  }

  let service: TaskGraphService;
  try {
    service = new TaskGraphService({
      ...(options.serviceOptions ?? {}),
      root: globals.root,
      indexPath: globals.indexPath,
      loadNativeLock: options.serviceOptions?.loadNativeLock
        ?? (() => loadNativeLockBinding(options.runtimeOptions))
    });
  } catch (error) {
    if (!(error instanceof TaskGraphError)) throw error;
    const fallbackPath = path.resolve(
      globals.root,
      globals.indexPath ?? defaultTaskGraphIndexPath
    );
    writeResult(io, {
      ok: false,
      indexPath: fallbackPath,
      revision: null,
      error: {
        code: error.code,
        retryable: error.retryable,
        message: error.message,
        details: error.details
      }
    });
    return 1;
  }

  try {
    if (globals.version) {
      writeResult(io, success(service.store.indexPath, null, {
        name: "task-graph",
        version: taskGraphVersion
      }));
      return 0;
    }
    const helpCommand = globals.remaining[0] === "help";
    if (globals.help || helpCommand || globals.remaining.length === 0) {
      writeResult(io, success(
        service.store.indexPath,
        null,
        helpData(helpCommand ? globals.remaining.slice(1) : globals.remaining)
      ));
      return 0;
    }
    if (isMutationInvocation(globals.remaining)) {
      await assertTaskGraphMutationRuntime(service);
    }
    const result = await dispatch(service, globals.remaining, options.runtimeOptions ?? {});
    writeResult(io, success(service.store.indexPath, result.revision, result.data));
    return 0;
  } catch (error) {
    if (!(error instanceof TaskGraphError)) throw error;
    const runtimeInvocation = globals.remaining[0] === "runtime"
      || (globals.remaining[0] === "help" && globals.remaining[1] === "runtime");
    let revision: number | null = null;
    if (!runtimeInvocation && !error.code.startsWith("RUNTIME_")) {
      try {
        revision = (await service.info()).revision;
      } catch {
        // The error envelope still remains valid without a readable index.
      }
    }
    const failure: TaskGraphFailure = {
      ok: false,
      indexPath: service.store.indexPath,
      revision,
      error: {
        code: error.code,
        retryable: error.retryable,
        message: error.message,
        details: error.details
      }
    };
    writeResult(io, failure);
    return 1;
  }
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
