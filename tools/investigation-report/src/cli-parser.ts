import { normalizeInvestigationIdInput } from "./report-path.ts";
import type {
  CliParseResult,
  InvestigationCommand,
  ParsedCli,
  RelationCliEvent
} from "./cli-contract.ts";

type CliTokenContext = { positionals: string[]; values: Map<string, string[]> };
const valueOptions = new Set([
  "root",
  "investigations-dir",
  "title",
  "formed-at",
  "question",
  "id",
  "tag",
  "formed-from",
  "formed-to",
  "related-to",
  "relation-type",
  "match",
  "in",
  "limit",
  "offset",
  "direction",
  "depth",
  "max-records",
  "source",
  "relation",
  "relation-summary",
  "select"
]);
const booleanOptions = new Set([
  "clear-relations",
  "delete-owned-resources",
  "delete-recorded-report",
  "delete-recorded-candidate",
  "write",
  "preflight",
  "rename-recorded-candidate",
  "rename-recorded-report",
  "detail",
  "help"
]);

export function parseCli(argv: readonly string[]): CliParseResult {
  const help = parseCliHelp(argv);
  if (help !== null) return help;
  const [first] = argv;
  const command =
    first === undefined || first.startsWith("-") ? "check" : first;
  if (!isCommand(command))
    return { error: `unknown command: ${command}`, status: "invalid" };
  return parseCommandTokens(command, first === command ? argv.slice(1) : argv);
}

function parseCliHelp(argv: readonly string[]): CliParseResult | null {
  const [first] = argv;
  if (first === "-h" || first === "--help") return { status: "help" };
  if (first !== "help") return null;
  const requested = argv[1];
  if (requested === undefined) return { status: "help" };
  return !isCommand(requested) || argv.length !== 2
    ? { error: `unknown command: ${requested}`, status: "invalid" }
    : { command: requested, status: "help" };
}

function parseCommandTokens(
  command: InvestigationCommand,
  tokens: readonly string[]
): CliParseResult {
  const context: CliTokenContext = { positionals: [], values: new Map() };
  for (let index = 0; index < tokens.length; index += 1) {
    const parsed = parseCommandToken(
      command,
      tokens[index]!,
      tokens[index + 1],
      context
    );
    if (parsed.error !== null)
      return { error: parsed.error, status: "invalid" };
    if (parsed.consumedNext) index += 1;
  }
  if (context.values.has("help")) return { command, status: "help" };
  normalizeIdentitySelectorsAtCliBoundary(command, context);
  return { status: "command", value: { command, ...context } };
}

function parseCommandToken(
  command: InvestigationCommand,
  token: string,
  next: string | undefined,
  context: CliTokenContext
): { consumedNext: boolean; error: string | null } {
  if (token === "-h" || token === "--help")
    return addValue("help", "true", false, context);
  if (!token.startsWith("--")) return addPositionalToken(token, context);
  return parseOptionToken(command, token, next, context);
}

function addPositionalToken(
  token: string,
  context: CliTokenContext
): { consumedNext: boolean; error: null } {
  context.positionals.push(token);
  return { consumedNext: false, error: null };
}

function parseOptionToken(
  command: InvestigationCommand,
  token: string,
  next: string | undefined,
  context: CliTokenContext
): { consumedNext: boolean; error: string | null } {
  const option = splitOptionToken(token);
  if (!isKnownOption(command, option.name))
    return { consumedNext: false, error: `unknown option: ${token}` };
  if (booleanOptions.has(option.name) || option.name === "json")
    return parseBooleanOption(option, context);
  return parseValueOption(option, next, context);
}

type ParsedOptionToken = Readonly<{
  inlineValue?: string;
  name: string;
  token: string;
}>;

function splitOptionToken(token: string): ParsedOptionToken {
  const option = token.slice(2);
  const separator = option.indexOf("=");
  return separator < 0
    ? { name: option, token }
    : {
        inlineValue: option.slice(separator + 1),
        name: option.slice(0, separator),
        token
      };
}

function isKnownOption(command: InvestigationCommand, name: string): boolean {
  return (
    valueOptions.has(name) ||
    booleanOptions.has(name) ||
    (command === "trace" && name === "json")
  );
}

function parseBooleanOption(
  option: ParsedOptionToken,
  context: CliTokenContext
): { consumedNext: boolean; error: string | null } {
  return option.inlineValue === undefined
    ? addValue(option.name, "true", false, context)
    : { consumedNext: false, error: `${option.token} does not accept a value` };
}

function parseValueOption(
  option: ParsedOptionToken,
  next: string | undefined,
  context: CliTokenContext
): { consumedNext: boolean; error: string | null } {
  const value = option.inlineValue ?? next;
  if (value === undefined || value.startsWith("--"))
    return { consumedNext: false, error: `${option.token} requires a value` };
  return addValue(
    option.name,
    value,
    option.inlineValue === undefined,
    context
  );
}

function addValue(
  name: string,
  value: string,
  consumedNext: boolean,
  context: CliTokenContext
): { consumedNext: boolean; error: null } {
  context.values.set(name, [...(context.values.get(name) ?? []), value]);
  return { consumedNext, error: null };
}

function normalizeIdentitySelectorsAtCliBoundary(
  command: InvestigationCommand,
  context: CliTokenContext
): void {
  if (
    [
      "new",
      "discard",
      "discard-candidate",
      "show",
      "show-candidate",
      "publish",
      "rename",
      "stage-index",
      "trace"
    ].includes(command)
  ) {
    context.positionals.splice(
      0,
      context.positionals.length,
      ...context.positionals.map(normalizeCompatibleInvestigationId)
    );
  }
  normalizeOptionValues(context, "id", normalizeCompatibleInvestigationId);
  normalizeOptionValues(context, "source", normalizeCompatibleInvestigationId);
  normalizeOptionValues(context, "relation", normalizeCompatibleRelationTarget);
  normalizeOptionValues(
    context,
    "relation-summary",
    normalizeCompatibleRelationSummaryTarget
  );
}

function normalizeOptionValues(
  context: CliTokenContext,
  name: string,
  normalizer: (value: string) => string
): void {
  const values = context.values.get(name);
  if (values !== undefined) context.values.set(name, values.map(normalizer));
}
function normalizeCompatibleInvestigationId(value: string): string {
  return normalizeInvestigationIdInput(value) ?? value;
}
function normalizeCompatibleRelationTarget(value: string): string {
  const separator = value.indexOf("=");
  const target =
    separator < 0
      ? null
      : normalizeInvestigationIdInput(value.slice(separator + 1));
  return target === null || separator < 0
    ? value
    : value.slice(0, separator + 1) + target;
}
function normalizeCompatibleRelationSummaryTarget(value: string): string {
  const separator = value.indexOf("=");
  const target =
    separator < 0
      ? null
      : normalizeInvestigationIdInput(value.slice(0, separator));
  return target === null || separator < 0
    ? value
    : target + value.slice(separator);
}

export function parseCliWithRelationEvents(
  argv: readonly string[]
): CliParseResult {
  const parsed = parseCli(argv);
  if (parsed.status !== "command" || parsed.value.command !== "set-relations")
    return parsed;
  const start = argv[0] === "set-relations" ? 1 : 0;
  const events = readRelationEvents(argv.slice(start));
  return {
    status: "command",
    value: { ...parsed.value, relationEvents: events }
  };
}

function readRelationEvents(tokens: readonly string[]): RelationCliEvent[] {
  const events: RelationCliEvent[] = [];
  for (let index = 0; index < tokens.length; index += 1) {
    const event = relationEvent(tokens[index]!, tokens[index + 1]);
    if (event !== undefined) events.push(event.value);
    if (event?.consumedNext) index += 1;
  }
  return events;
}
function relationEvent(
  token: string,
  next: string | undefined
): { consumedNext: boolean; value: RelationCliEvent } | undefined {
  if (token === "--clear-relations")
    return { consumedNext: false, value: { kind: "clear" } };
  for (const kind of ["source", "relation", "relation-summary"] as const) {
    const prefix = `--${kind}=`;
    if (token === `--${kind}` && next !== undefined)
      return { consumedNext: true, value: { kind, value: next } };
    if (token.startsWith(prefix))
      return {
        consumedNext: false,
        value: { kind, value: token.slice(prefix.length) }
      };
  }
  return undefined;
}

export function isCommand(value: string): value is InvestigationCommand {
  return [
    "new",
    "candidates",
    "check",
    "discard",
    "discard-candidate",
    "sync-index",
    "list",
    "search",
    "show",
    "show-candidate",
    "publish",
    "rename",
    "trace",
    "stage-index",
    "set-relations"
  ].includes(value);
}

export function valueOf(
  values: ReadonlyMap<string, string[]>,
  key: string
): string | undefined {
  const selected = values.get(key);
  return selected?.length === 1 ? selected[0] : undefined;
}
export function valuesOf(
  values: ReadonlyMap<string, string[]>,
  key: string
): string[] | undefined {
  const selected = values.get(key);
  return selected === undefined ? undefined : [...selected];
}
export function has(
  values: ReadonlyMap<string, string[]>,
  key: string
): boolean {
  return values.has(key);
}
export function location(values: ReadonlyMap<string, string[]>): {
  investigationsDir?: string;
  workspaceRoot: string;
} {
  const investigationsDir = valueOf(values, "investigations-dir");
  const workspaceRoot = valueOf(values, "root") ?? ".";
  return investigationsDir === undefined
    ? { workspaceRoot }
    : { investigationsDir, workspaceRoot };
}
export function numberValue(
  values: ReadonlyMap<string, string[]>,
  key: string
): number | undefined {
  const value = valueOf(values, key);
  return value === undefined ? undefined : Number(value);
}
export function assertNoPositionals(input: ParsedCli): string | null {
  return input.positionals.length === 0
    ? null
    : `${input.command} does not accept positional arguments`;
}
export function assertAllowedOptions(
  input: ParsedCli,
  allowed: readonly string[]
): string | null {
  const invalid = [...input.values.keys()].find(
    (key) => !key.startsWith("__") && !allowed.includes(key)
  );
  return invalid === undefined
    ? null
    : `${input.command} does not accept --${invalid}`;
}
export function assertSingleOptions(
  input: ParsedCli,
  options: readonly string[]
): string | null {
  const repeated = options.find(
    (option) => (input.values.get(option)?.length ?? 0) > 1
  );
  return repeated === undefined
    ? null
    : `${input.command} accepts --${repeated} only once`;
}
