import { parseArgs } from "node:util";
import { fail } from "./failure.ts";

export type Options = Readonly<{
  command: "doctor" | "json" | "ask";
  values: Readonly<Partial<Record<SingleValueFlag, string>>>;
  options: readonly string[];
  levels: readonly string[];
  stdin: boolean;
  dryRun: boolean;
}>;

const common = ["config", "model", "endpoint", "timeout-ms"] as const;

const jsonFlags = ["file", "json"] as const;

const askFlags = [
  "type",
  "question",
  "id",
  "text",
  "text-file",
  "state-json",
  "state-file",
  "option",
  "level"
] as const;

const valueFlags = [...common, ...jsonFlags, ...askFlags];

type ValueFlag = (typeof valueFlags)[number];

type SingleValueFlag = Exclude<ValueFlag, "option" | "level">;

function rejectDuplicates(
  tokens: readonly (
    | { kind: "option"; name: string }
    | { kind: "positional" | "option-terminator" }
  )[]
): void {
  const seen = new Set<string>();
  for (const token of tokens) {
    if (token.kind !== "option") {
      continue;
    }
    const name = token.name;
    if (["option", "level"].includes(name)) {
      continue;
    }
    if (seen.has(name)) {
      fail("input", "arguments", "重复参数");
    }
    seen.add(name);
  }
}

function validateCompatibility(input: Options): void {
  const { command, values, options, levels, stdin, dryRun } = input;
  const specific = { doctor: [], json: jsonFlags, ask: askFlags }[command];
  const allowed = new Set<string>([...common, ...specific]);
  if (Object.keys(values).some((key) => !allowed.has(key))) {
    fail("input", "arguments", "参数与命令不兼容");
  }
  if (command !== "ask" && options.length + levels.length > 0) {
    fail("input", "arguments", "criteria 参数仅用于 ask");
  }
  if (command !== "json" && stdin) {
    fail("input", "arguments", "stdin 仅用于 json");
  }
  if (command === "doctor" && dryRun) {
    fail("input", "arguments", "doctor 不接受 dry-run");
  }
}

function argumentDefinitions(): Record<
  string,
  { type: "string" | "boolean"; multiple?: boolean }
> {
  const definitions: Record<
    string,
    { type: "string" | "boolean"; multiple?: boolean }
  > = { "dry-run": { type: "boolean" } };
  for (const name of valueFlags) {
    definitions[name] = {
      type: "string",
      multiple: ["option", "level"].includes(name)
    };
  }
  return definitions;
}

function commandPositionals(
  positionals: readonly string[]
): Readonly<{ command: Options["command"]; stdin: boolean }> {
  const [command, ...extra] = positionals;
  if (command !== "doctor" && command !== "json" && command !== "ask") {
    fail("input", "arguments", "需要 doctor、json 或 ask");
  }
  if (extra.length > 1 || extra.some((value) => value !== "-")) {
    fail("input", "arguments", "未知或重复位置参数");
  }
  return { command, stdin: extra.length === 1 };
}

export function parseOptions(argv: readonly string[]): Options {
  let parsed;
  try {
    parsed = parseArgs({
      args: [...argv],
      allowPositionals: true,
      strict: true,
      tokens: true,
      options: argumentDefinitions()
    });
  } catch {
    return fail("input", "arguments", "未知参数或参数缺值");
  }
  rejectDuplicates(parsed.tokens);
  const { command, stdin } = commandPositionals(parsed.positionals);
  const values: Partial<Record<SingleValueFlag, string>> = {};
  for (const key of valueFlags) {
    if (key === "option" || key === "level") {
      continue;
    }
    const value = parsed.values[key];
    if (typeof value === "string") {
      values[key] = value;
    }
  }
  const options = repeatedValues(parsed.values.option, "--option");
  const levels = repeatedValues(parsed.values.level, "--level");
  const dryRun = parsed.values["dry-run"] === true;
  const result = { command, values, options, levels, stdin, dryRun };
  validateCompatibility(result);
  return result;
}

function repeatedValues(value: unknown, field: string): readonly string[] {
  if (value === undefined) {
    return [];
  }
  if (
    !Array.isArray(value) ||
    !value.every((item) => typeof item === "string")
  ) {
    fail("input", field, "需要重复字符串参数");
  }
  return value;
}
