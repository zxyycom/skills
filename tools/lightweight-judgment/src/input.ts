import { fail } from "./failure.ts";
import { preserveKeyOrder, parseJson, type JsonValue } from "./json.ts";
import type { Options } from "./options.ts";

export type InputRuntime = Readonly<{
  readFile(path: string): Promise<string>;
  readStdin(): Promise<string>;
}>;

function onlyOne(values: readonly boolean[], field: string): void {
  if (values.filter(Boolean).length !== 1) {
    fail("input", field, "必须恰选一种输入来源");
  }
}

async function readInputFile(
  file: string,
  runtime: InputRuntime
): Promise<string> {
  try {
    return await runtime.readFile(file);
  } catch {
    return fail("input", "file", "输入文件不可读或不是有效 UTF-8");
  }
}

async function jsonInput(
  options: Options,
  runtime: InputRuntime
): Promise<JsonValue> {
  const flags = options.values;
  onlyOne(
    [flags.file !== undefined, flags.json !== undefined, options.stdin],
    "json"
  );
  if (flags.file !== undefined) {
    return parseJson(await readInputFile(flags.file, runtime));
  }
  if (flags.json !== undefined) {
    return parseJson(flags.json);
  }
  let source: string;
  try {
    source = await runtime.readStdin();
  } catch {
    return fail("input", "stdin", "stdin 不可读或不是有效 UTF-8");
  }
  return parseJson(source);
}

async function askState(
  flags: Options["values"],
  runtime: InputRuntime
): Promise<JsonValue> {
  onlyOne(
    [
      flags.text !== undefined,
      flags["text-file"] !== undefined,
      flags["state-json"] !== undefined,
      flags["state-file"] !== undefined
    ],
    "ask.state"
  );
  if (flags.text !== undefined) {
    return flags.text;
  }
  if (flags["text-file"] !== undefined) {
    return await readInputFile(flags["text-file"], runtime);
  }
  if (flags["state-json"] !== undefined) {
    return parseJson(flags["state-json"], "input", "$.state");
  }
  if (flags["state-file"] !== undefined) {
    return parseJson(
      await readInputFile(flags["state-file"], runtime),
      "input",
      "$.state"
    );
  }
  return fail("input", "ask.state", "必须选择输入来源");
}

function choiceOptions(options: readonly string[]): Record<string, JsonValue> {
  const mapping: Record<string, JsonValue> = Object.create(null);
  const keys: string[] = [];
  for (const option of options) {
    const equal = option.indexOf("=");
    if (equal < 1) {
      fail("input", "--option", "需要 key=description");
    }
    const key = option.slice(0, equal);
    if (Object.hasOwn(mapping, key)) {
      fail("input", "--option", "候选键重复");
    }
    mapping[key] = option.slice(equal + 1);
    keys.push(key);
  }
  preserveKeyOrder(mapping, keys);
  return mapping;
}

function askCriteria(options: Options): JsonValue | undefined {
  switch (options.values.type) {
    case "choice":
      if (options.levels.length) {
        fail("input", "ask.criteria", "Choice 不接受 --level");
      }
      return choiceOptions(options.options);
    case "score":
      if (options.options.length) {
        fail("input", "ask.criteria", "Score 不接受 --option");
      }
      return [...options.levels];
    default:
      if (options.options.length + options.levels.length) {
        fail("input", "ask.criteria", "该题型不接受 criteria 参数");
      }
      return undefined;
  }
}

async function askInput(
  options: Options,
  runtime: InputRuntime
): Promise<JsonValue> {
  const flags = options.values;
  if (flags.type === undefined || flags.question === undefined) {
    fail("input", "ask", "需要 --type 与 --question");
  }
  const state = await askState(flags, runtime);
  const criteria = askCriteria(options);
  const questions: Record<string, JsonValue> = Object.create(null);
  questions[flags.id ?? "answer"] = {
    type: flags.type,
    instructions: flags.question,
    ...(criteria === undefined ? {} : { criteria })
  };
  return { state, questions };
}

export async function loadInput(
  options: Options,
  runtime: InputRuntime
): Promise<JsonValue> {
  return options.command === "json"
    ? await jsonInput(options, runtime)
    : await askInput(options, runtime);
}
