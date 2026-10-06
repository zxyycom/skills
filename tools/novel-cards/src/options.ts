import path from "node:path";
import { parseArgs } from "node:util";
import * as v from "valibot";
import { idSchema } from "./card.ts";
import type { ExpansionLimits } from "./query.ts";

const commandSchema = v.picklist(["check", "sync-index", "show", "expand"]);
type Command = v.InferOutput<typeof commandSchema>;
type QueryOptions = Readonly<{
  root: string;
  id: string;
  includeReference: boolean;
}>;
export type Options =
  | Readonly<{ command: "check"; root: string }>
  | Readonly<{ command: "sync-index"; root: string }>
  | (QueryOptions & Readonly<{ command: "show" }>)
  | (QueryOptions & ExpansionLimits & Readonly<{ command: "expand" }>);
const optionDefinitions = {
  root: { type: "string" },
  write: { type: "boolean" },
  "include-reference": { type: "boolean" },
  depth: { type: "string" },
  "max-cards": { type: "string" },
  help: { type: "boolean" }
} as const;
type RawCommandValues = Readonly<{
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
      "show/expand 必须有精确稳定 ID，check/sync-index 不接受 ID"
    );
  }
}

function parseCommandOptions(
  command: Command,
  root: string,
  values: RawCommandValues,
  rawId: string | undefined
): Options {
  if (command === "check") return { command, root };
  if (command === "sync-index") {
    if (!values.write) throw new Error("sync-index 要求 --write");
    return { command, root };
  }
  const parsedId = v.safeParse(idSchema, rawId);
  if (!parsedId.success) throw new Error("目标必须为精确稳定 ID，不接受路径");
  const id = parsedId.output;
  const includeReference = Boolean(values["include-reference"]);
  if (command === "show") return { command, root, id, includeReference };
  return {
    command,
    root,
    id,
    includeReference,
    depth: boundedInteger(values.depth, 1, 0, 20),
    maxCards: boundedInteger(values["max-cards"], 100, 1, 1000)
  };
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
    throw new Error("命令必须为 check、sync-index、show 或 expand");
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
