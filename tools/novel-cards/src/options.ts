import path from "node:path";
import { parseArgs } from "node:util";
import * as v from "valibot";
import { idSchema, referenceSchema } from "./card.ts";
import type { CardSelector, ExpansionLimits } from "./query.ts";

const commandSchema = v.picklist([
  "check",
  "sync-index",
  "show",
  "expand",
  "find",
  "new-id",
  "history",
  "apply-transition",
  "recover"
]);
type Command = v.InferOutput<typeof commandSchema>;
type QueryOptions = Readonly<{
  root: string;
  id: string;
  includeReference: boolean;
}>;
export type Options =
  | Readonly<{ command: "check"; root: string }>
  | Readonly<{ command: "sync-index"; root: string }>
  | Readonly<{ command: "new-id"; root: string }>
  | Readonly<{ command: "recover"; root: string }>
  | Readonly<{ command: "apply-transition"; root: string; input: string }>
  | (CardSelector & Readonly<{ command: "find"; root: string }>)
  | (QueryOptions & Readonly<{ command: "history" }>)
  | (QueryOptions & Readonly<{ command: "show" }>)
  | (QueryOptions & ExpansionLimits & Readonly<{ command: "expand" }>);
const optionDefinitions = {
  root: { type: "string" },
  write: { type: "boolean" },
  "include-reference": { type: "boolean" },
  depth: { type: "string" },
  "max-cards": { type: "string" },
  title: { type: "string" },
  chapter: { type: "string" },
  scope: { type: "string" },
  input: { type: "string" },
  help: { type: "boolean" }
} as const;
type RawCommandValues = Readonly<{
  title?: string;
  chapter?: string;
  scope?: string;
  input?: string;
  write?: boolean;
  "include-reference"?: boolean;
  depth?: string;
  "max-cards"?: string;
}>;

function boundedInteger(
  value: string | undefined,
  fallback: number,
  minimum: number,
  maximum: number
): number {
  if (value === undefined) return fallback;
  if (!/^\d+$/u.test(value)) throw new Error("预算必须是十进制整数");
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < minimum || number > maximum)
    throw new Error(`预算必须在 ${minimum}..${maximum}`);
  return number;
}

function validateCommandShape(
  command: Command,
  names: readonly string[],
  positionals: readonly string[]
): void {
  const shapes: Readonly<
    Record<
      Command,
      Readonly<{
        allowedOptions: readonly string[];
        positionalCount: number;
      }>
    >
  > = {
    check: { allowedOptions: ["root"], positionalCount: 1 },
    "new-id": { allowedOptions: ["root"], positionalCount: 1 },
    recover: { allowedOptions: ["root", "write"], positionalCount: 1 },
    "apply-transition": {
      allowedOptions: ["root", "write", "input"],
      positionalCount: 1
    },
    find: {
      allowedOptions: [
        "root",
        "title",
        "chapter",
        "scope",
        "include-reference"
      ],
      positionalCount: 1
    },
    history: {
      allowedOptions: ["root", "include-reference"],
      positionalCount: 2
    },
    "sync-index": { allowedOptions: ["root", "write"], positionalCount: 1 },
    show: { allowedOptions: ["root", "include-reference"], positionalCount: 2 },
    expand: {
      allowedOptions: ["root", "include-reference", "depth", "max-cards"],
      positionalCount: 2
    }
  };
  const shape = shapes[command];
  if (new Set(names).size !== names.length) {
    throw new Error("参数不能重复");
  }
  const invalid = names.find((name) => !shape.allowedOptions.includes(name));
  if (invalid !== undefined) {
    throw new Error(`${command} 不接受 --${invalid}`);
  }
  if (positionals.length !== shape.positionalCount) {
    throw new Error(
      `${command} 要求 ${shape.positionalCount - 1} 个位置参数（不含命令本身）`
    );
  }
}

function validateChapterScope(values: RawCommandValues): void {
  if (values.scope === undefined) return;
  if (values.chapter === undefined) throw new Error("scope只用于章号");
  if (!v.safeParse(idSchema, values.scope).success)
    throw new Error("scope必须稳定ID");
}

function parseFindOptions(
  root: string,
  values: RawCommandValues
): Extract<Options, { command: "find" }> {
  if ((values.title === undefined) === (values.chapter === undefined))
    throw new Error("find恰好选择--title或--chapter");
  validateChapterScope(values);
  const includeReference = Boolean(values["include-reference"]);
  if (values.title !== undefined) {
    if (!values.title.trim()) throw new Error("title不能为空");
    return { command: "find", root, title: values.title, includeReference };
  }
  return {
    command: "find",
    root,
    chapter: boundedInteger(values.chapter, 1, 1, Number.MAX_SAFE_INTEGER),
    scope: values.scope,
    includeReference
  };
}

function parseMutationOptions(
  command: "recover" | "apply-transition",
  root: string,
  values: RawCommandValues
): Options {
  if (!values.write) throw new Error(`${command} 要求 --write`);
  if (command === "recover") return { command, root };
  if (!values.input?.trim())
    throw new Error("apply-transition 要求 --input FILE");
  return { command, root, input: path.resolve(values.input) };
}

function parseQueryOptions(
  command: "show" | "history" | "expand",
  root: string,
  values: RawCommandValues,
  rawId: string | undefined
): Options {
  const parsedId = v.safeParse(referenceSchema, rawId);
  if (!parsedId.success) throw new Error("目标必须为精确稳定 ID，不接受路径");
  const id = parsedId.output;
  const includeReference = Boolean(values["include-reference"]);
  if (command === "show" || command === "history")
    return { command, root, id, includeReference };
  return {
    command,
    root,
    id,
    includeReference,
    depth: boundedInteger(values.depth, 1, 0, 20),
    maxCards: boundedInteger(values["max-cards"], 100, 1, 1000)
  };
}
function parseCommandOptions(
  command: Command,
  root: string,
  values: RawCommandValues,
  rawId: string | undefined
): Options {
  switch (command) {
    case "check":
    case "new-id":
      return { command, root };
    case "recover":
    case "apply-transition":
      return parseMutationOptions(command, root, values);
    case "find":
      return parseFindOptions(root, values);
    case "sync-index":
      if (!values.write) throw new Error("sync-index 要求 --write");
      return { command, root };
    default:
      return parseQueryOptions(command, root, values, rawId);
  }
}

export function parseOptions(argv: readonly string[]): Options | null {
  const { values, positionals, tokens } = parseArgs({
    args: [...argv],
    allowPositionals: true,
    strict: true,
    options: optionDefinitions,
    tokens: true
  });
  if (values.help && argv.length === 1) {
    return null;
  }
  const command = v.safeParse(commandSchema, positionals[0]);
  if (!command.success) {
    throw new Error(
      "命令必须为 check、sync-index、show、expand、find、new-id、history、apply-transition 或 recover"
    );
  }
  const names = tokens
    .filter((token) => token.kind === "option")
    .map((token) => token.name);
  validateCommandShape(command.output, names, positionals);
  if (values.root !== undefined && !values.root.trim()) {
    throw new Error("root 不能为空");
  }
  const root = path.resolve(values.root ?? ".");
  return parseCommandOptions(command.output, root, values, positionals[1]);
}
