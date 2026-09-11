import path from "node:path";
import process from "node:process";
import { TaskGraphError } from "./errors.ts";
import type {
  GlobalArguments,
  OptionDefinition,
  ParsedCommandOptions
} from "./cli-contract.ts";
import {
  taskControlModes,
  type JsonObject,
  type TaskContentInput,
  type TaskControlInput
} from "./types.ts";

export function failArgument(message: string, details: JsonObject = {}): never {
  throw new TaskGraphError("ARGUMENT_INVALID", message, details);
}

export function parseGlobalArguments(argv: readonly string[]): GlobalArguments {
  const state: GlobalParseState = {
    help: false,
    indexPath: undefined,
    json: false,
    remaining: [],
    root: process.cwd(),
    version: false
  };
  for (let index = 0; index < argv.length; index += 1) {
    index += consumeGlobalToken(argv, index, state);
  }
  return {
    ...state,
    root: path.resolve(state.root)
  };
}

type GlobalParseState = {
  help: boolean;
  indexPath: string | undefined;
  json: boolean;
  remaining: string[];
  root: string;
  version: boolean;
};

function consumeGlobalToken(
  argv: readonly string[],
  index: number,
  state: GlobalParseState
): number {
  const token = argv[index] ?? "";
  const [name, inline] = token.split(/=(.*)/su, 2);
  if (name === "--root" || name === "--index") {
    return consumeGlobalPath(name, inline, argv[index + 1], state);
  }
  consumeGlobalFlag(token, name, inline, state);
  return 0;
}

function consumeGlobalPath(
  name: "--index" | "--root",
  inline: string | undefined,
  next: string | undefined,
  state: GlobalParseState
): number {
  const value = optionValue(name, inline, next, "path");
  if (name === "--root") state.root = value;
  else state.indexPath = value;
  return inline === undefined ? 1 : 0;
}

function consumeGlobalFlag(
  token: string,
  name: string | undefined,
  inline: string | undefined,
  state: GlobalParseState
): void {
  if (token === "--help" || token === "-h") {
    state.help = true;
  } else if (token === "--version" || token === "-v") {
    state.version = true;
  } else if (name === "--json") {
    if (inline !== undefined) failArgument("--json does not accept a value");
    if (state.json) failArgument("--json must not be repeated");
    state.json = true;
  } else {
    state.remaining.push(token);
  }
}

function optionValue(
  name: string,
  inline: string | undefined,
  next: string | undefined,
  kind: "path" | "value"
): string {
  const value = inline ?? next;
  if (
    value === undefined ||
    value === "" ||
    (inline === undefined && value.startsWith("--"))
  ) {
    failArgument(`${name} requires a non-empty ${kind}`);
  }
  return value;
}

type CommandOptionState = Readonly<{
  positionals: string[];
  values: Record<string, string | string[] | true>;
}>;

function commandDefinition(
  definitions: Record<string, OptionDefinition>,
  optionName: string
): OptionDefinition {
  const definition = definitions[optionName];
  if (definition === undefined || !Object.hasOwn(definitions, optionName))
    failArgument(`Unknown option --${optionName}`);
  return definition;
}

function commandOptionParts(
  token: string
): readonly [string, string | undefined] {
  const [rawName, inline] = token.slice(2).split(/=(.*)/su, 2);
  return [rawName ?? "", inline];
}

function consumeCommandToken(
  tokens: readonly string[],
  definitions: Record<string, OptionDefinition>,
  state: CommandOptionState,
  index: number
): number {
  const token = tokens[index] ?? "";
  if (!token.startsWith("--")) {
    recordPositional(token, state.positionals);
    return 1;
  }
  const [name, inline] = commandOptionParts(token);
  const consumed = recordCommandOption(
    name,
    inline,
    tokens[index + 1],
    commandDefinition(definitions, name),
    state.values
  );
  return consumed + 1;
}

export function parseCommandOptions(
  tokens: readonly string[],
  definitions: Record<string, OptionDefinition>
): ParsedCommandOptions {
  const state: CommandOptionState = {
    positionals: [],
    values: Object.create(null) as Record<string, string | string[] | true>
  };
  for (let index = 0; index < tokens.length;)
    index += consumeCommandToken(tokens, definitions, state, index);
  return state;
}

function recordPositional(token: string, positionals: string[]): void {
  if (token.startsWith("-")) failArgument(`Unknown option ${token}`);
  positionals.push(token);
}

function recordCommandOption(
  name: string,
  inline: string | undefined,
  next: string | undefined,
  definition: OptionDefinition,
  values: Record<string, string | string[] | true>
): number {
  if (definition.kind === "boolean") {
    if (inline !== undefined) failArgument(`--${name} does not accept a value`);
    if (values[name] !== undefined)
      failArgument(`--${name} must not be repeated`);
    values[name] = true;
    return 0;
  }
  const value = optionValue(`--${name}`, inline, next, "value");
  if (definition.multiple === true) {
    const previous = values[name];
    values[name] = Array.isArray(previous) ? previous.concat(value) : [value];
  } else {
    if (values[name] !== undefined)
      failArgument(`--${name} must not be repeated`);
    values[name] = value;
  }
  return inline === undefined ? 1 : 0;
}

export function stringValue(
  parsed: ParsedCommandOptions,
  name: string,
  options: { required?: boolean } = {}
): string | undefined {
  const value = parsed.values[name];
  if (typeof value === "string") return value;
  if (options.required === true) failArgument(`--${name} is required`);
  return undefined;
}

export function stringsValue(
  parsed: ParsedCommandOptions,
  name: string
): string[] {
  const value = parsed.values[name];
  return Array.isArray(value) ? value : [];
}

export function booleanValue(
  parsed: ParsedCommandOptions,
  name: string
): boolean {
  return parsed.values[name] === true;
}

export function integerValue(
  parsed: ParsedCommandOptions,
  name: string,
  options: { required: true; minimum?: number; maximum?: number }
): number;
export function integerValue(
  parsed: ParsedCommandOptions,
  name: string,
  options?: { required?: false; minimum?: number; maximum?: number }
): number | undefined;
export function integerValue(
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

export function requirePositionals(
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

export function keyValueDictionary(
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

export function controlInput(
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

export function contentInput(parsed: ParsedCommandOptions): TaskContentInput {
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

export const contentOptionDefinitions = {
  title: { kind: "string" },
  goal: { kind: "string" },
  acceptance: { kind: "string", multiple: true },
  context: { kind: "string" },
  reference: { kind: "string", multiple: true }
} as const satisfies Record<string, OptionDefinition>;
