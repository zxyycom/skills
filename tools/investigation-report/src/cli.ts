#!/usr/bin/env node

import process from "node:process";
import { isMainModule } from "../../shared/src/node/main-module.ts";
import {
  executeInvestigationIndexQuery,
  queryInvestigationIndex,
  showInvestigationReport,
  traceInvestigationReports
} from "./query.ts";
import { setInvestigationRelations } from "./relation-transaction.ts";
import {
  executeInvestigationIndexStage,
  stageInvestigationIndex
} from "./staging.ts";
import {
  executeInvestigationIndexSync,
  executeInvestigationReportCheck,
  synchronizeInvestigationIndex,
  validateInvestigationReports
} from "./validation.ts";
import type {
  InvestigationIndexStageResult,
  InvestigationRelation,
  InvestigationRelationReplacement,
  InvestigationRelationSetResult,
  InvestigationTraceDirection
} from "./types.ts";

type InvestigationCommand =
  | "check"
  | "list"
  | "show"
  | "stage-index"
  | "sync-index"
  | "trace"
  | "set-relations";
type ParsedCli = Readonly<{
  command: InvestigationCommand;
  positionals: string[];
  values: Map<string, string[]>;
}>;

const valueOptions = new Set([
  "root",
  "investigations-dir",
  "id",
  "tag",
  "formed-from",
  "formed-to",
  "relation-type",
  "text",
  "limit",
  "offset",
  "direction",
  "max-depth",
  "source",
  "relation"
]);
const booleanOptions = new Set(["json", "clear-relations", "help"]);

function printHelp(): void {
  console.log(
    [
      "Usage: check-investigations.mjs [check] [--id <investigation-id> ...] [options]",
      "       check-investigations.mjs sync-index [options]",
      "       check-investigations.mjs list [--tag <tag> ...] [options]",
      "       check-investigations.mjs show <investigation-id> [options]",
      "       check-investigations.mjs trace <investigation-id> [options]",
      "       check-investigations.mjs stage-index <investigation-id...> [options]",
      "       check-investigations.mjs set-relations --source <investigation-id> (--relation <type=target-id>... | --clear-relations) [--source ...] [options]",
      "",
      "Check and query flat Investigation Report records and their derived index.",
      "Full check verifies the complete relation graph, resource ownership, and index freshness.",
      "Scoped --id check validates selected reports and their declared resources only; it does not prove graph or index completeness.",
      "sync-index rebuilds the full derived index from valid report Markdown.",
      "stage-index changes only pending index entries for selected Investigation IDs.",
      "set-relations atomically replaces every selected source relation set and the workspace index; it does not stage files.",
      "",
      "Options:",
      "  --root <workspace-root>       Workspace root (default: current directory)",
      "  --investigations-dir <path>  Investigation root relative to workspace",
      "  --id <investigation-id>       Scoped check ID; repeatable",
      "  --tag <tag>                   List tag; repeatable and combined with AND",
      "  --formed-from <timestamp>     List formedAt lower bound, inclusive",
      "  --formed-to <timestamp>       List formedAt upper bound, inclusive",
      "  --relation-type <type>        List direct relation type",
      "  --text <terms>                List title and question text containing all terms",
      "  --limit <count>               List page size (default: 50, maximum: 1000)",
      "  --offset <count>              List page offset (default: 0)",
      "  --direction <direction>       trace: predecessors, successors, or both (default: both)",
      "  --max-depth <count>           trace maximum non-negative depth",
      "  --source <investigation-id>   Start one complete set-relations source group",
      "  --relation <type=target-id>   Add one complete-replacement relation to the active group",
      "  --clear-relations             Explicitly clear the active source group",
      "  --json                        Emit set-relations or stage-index result as JSON",
      "  -h, --help                    Show this help"
    ].join("\n")
  );
}

function parseCli(
  argv: readonly string[]
):
  | { status: "help" }
  | { status: "invalid"; error: string }
  | { status: "command"; value: ParsedCli } {
  const [first] = argv;
  const commandToken =
    first === undefined || first.startsWith("-") ? "check" : first;
  if (!isCommand(commandToken)) {
    return { error: `unknown command: ${commandToken}`, status: "invalid" };
  }
  const tokens = first === commandToken ? argv.slice(1) : argv;
  const values = new Map<string, string[]>();
  const positionals: string[] = [];
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index]!;
    if (token === "-h" || token === "--help") {
      values.set("help", ["true"]);
      continue;
    }
    if (!token.startsWith("--")) {
      positionals.push(token);
      continue;
    }
    const [rawName, inlineValue] = token.slice(2).split("=", 2);
    if (
      rawName === undefined ||
      (!valueOptions.has(rawName) && !booleanOptions.has(rawName))
    ) {
      return { error: `unknown option: ${token}`, status: "invalid" };
    }
    if (booleanOptions.has(rawName)) {
      if (inlineValue !== undefined)
        return { error: `${token} does not accept a value`, status: "invalid" };
      values.set(rawName, [...(values.get(rawName) ?? []), "true"]);
      continue;
    }
    const value = inlineValue ?? tokens[index + 1];
    if (value === undefined || value.startsWith("--")) {
      return { error: `${token} requires a value`, status: "invalid" };
    }
    if (inlineValue === undefined) index += 1;
    values.set(rawName, [...(values.get(rawName) ?? []), value]);
  }
  return values.has("help")
    ? { status: "help" }
    : {
        status: "command",
        value: { command: commandToken, positionals, values }
      };
}

function isCommand(value: string): value is InvestigationCommand {
  return [
    "check",
    "sync-index",
    "list",
    "show",
    "trace",
    "stage-index",
    "set-relations"
  ].includes(value);
}

function valueOf(
  values: ReadonlyMap<string, string[]>,
  key: string
): string | undefined {
  const valuesForKey = values.get(key);
  return valuesForKey?.length === 1 ? valuesForKey[0] : undefined;
}
function valuesOf(
  values: ReadonlyMap<string, string[]>,
  key: string
): string[] | undefined {
  const valuesForKey = values.get(key);
  return valuesForKey === undefined ? undefined : [...valuesForKey];
}
function has(values: ReadonlyMap<string, string[]>, key: string): boolean {
  return values.has(key);
}
function location(values: ReadonlyMap<string, string[]>): {
  investigationsDir?: string;
  workspaceRoot: string;
} {
  const investigationsDir = valueOf(values, "investigations-dir");
  const workspaceRoot = valueOf(values, "root") ?? ".";
  return investigationsDir === undefined
    ? { workspaceRoot }
    : { investigationsDir, workspaceRoot };
}
function numberValue(
  values: ReadonlyMap<string, string[]>,
  key: string
): number | undefined {
  const value = valueOf(values, key);
  return value === undefined ? undefined : Number(value);
}
function assertNoPositionals(input: ParsedCli): string | null {
  return input.positionals.length === 0
    ? null
    : `${input.command} does not accept positional arguments`;
}
function assertAllowedOptions(
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

async function runCheck(input: ParsedCli): Promise<number> {
  const problem =
    assertNoPositionals(input) ??
    assertAllowedOptions(input, ["root", "investigations-dir", "id"]);
  if (problem !== null) return cliInvalid(problem);
  const execution = await executeInvestigationReportCheck({
    ...location(input.values),
    ...(valuesOf(input.values, "id") === undefined
      ? {}
      : { ids: valuesOf(input.values, "id") })
  });
  if (execution.isErr())
    return printResultErrors(
      execution.error.kind === "invalid-options"
        ? "Invalid investigation report check options:"
        : "Investigation report check failed:",
      execution.error.result.errors,
      execution.error.kind === "invalid-options" ? 2 : 1,
      execution.error.result.warnings
    );
  const result = execution.value;
  printWarnings(result.warnings);
  console.log(
    `Investigation report check passed (${result.selectedReportCount} of ${result.availableReportCount} reports checked${result.indexChecked ? "; full index current" : "; index not checked"}).`
  );
  return 0;
}

async function runSync(input: ParsedCli): Promise<number> {
  const problem =
    assertNoPositionals(input) ??
    assertAllowedOptions(input, ["root", "investigations-dir"]);
  if (problem !== null) return cliInvalid(problem);
  const execution = await executeInvestigationIndexSync(location(input.values));
  if (execution.isErr())
    return printResultErrors(
      execution.error.kind === "invalid-options"
        ? "Invalid investigation index synchronization options:"
        : "Investigation index synchronization failed:",
      execution.error.result.errors,
      execution.error.kind === "invalid-options" ? 2 : 1,
      execution.error.result.warnings
    );
  const result = execution.value;
  printWarnings(result.warnings);
  console.log(
    result.changed
      ? `Investigation index synchronized (${result.reportCount} reports).`
      : `Investigation index is already current (${result.reportCount} reports).`
  );
  return 0;
}

async function runList(input: ParsedCli): Promise<number> {
  const problem =
    assertNoPositionals(input) ??
    assertAllowedOptions(input, [
      "root",
      "investigations-dir",
      "tag",
      "formed-from",
      "formed-to",
      "relation-type",
      "text",
      "limit",
      "offset"
    ]);
  if (problem !== null) return cliInvalid(problem);
  const execution = await executeInvestigationIndexQuery({
    ...location(input.values),
    ...(valuesOf(input.values, "tag") === undefined
      ? {}
      : { tags: valuesOf(input.values, "tag") }),
    ...(valueOf(input.values, "formed-from") === undefined
      ? {}
      : { formedAtFrom: valueOf(input.values, "formed-from") }),
    ...(valueOf(input.values, "formed-to") === undefined
      ? {}
      : { formedAtTo: valueOf(input.values, "formed-to") }),
    ...(valueOf(input.values, "relation-type") === undefined
      ? {}
      : {
          relationType: valueOf(
            input.values,
            "relation-type"
          ) as InvestigationRelation["type"]
        }),
    ...(valueOf(input.values, "text") === undefined
      ? {}
      : { text: valueOf(input.values, "text") }),
    ...(numberValue(input.values, "limit") === undefined
      ? {}
      : { limit: numberValue(input.values, "limit") }),
    ...(numberValue(input.values, "offset") === undefined
      ? {}
      : { offset: numberValue(input.values, "offset") })
  });
  if (execution.isErr())
    return printResultErrors(
      execution.error.kind === "invalid-options"
        ? "Invalid investigation report query options:"
        : "Investigation index query failed:",
      execution.error.result.errors,
      execution.error.kind === "invalid-options" ? 2 : 1
    );
  const result = execution.value;
  if (result.entries.length === 0) {
    console.log("No investigation reports matched.");
    return 0;
  }
  console.log(
    `Investigation reports (${result.entries.length} of ${result.total}, offset ${result.offset}):`
  );
  for (const entry of result.entries) {
    console.log(`${entry.id} ${entry.state.formedAt}`);
    console.log(`  title: ${entry.state.title}`);
    console.log(`  question: ${entry.state.question}`);
    console.log(`  tags: ${entry.state.tags.join(", ")}`);
  }
  return 0;
}

async function runShow(input: ParsedCli): Promise<number> {
  const problem = assertAllowedOptions(input, ["root", "investigations-dir"]);
  if (problem !== null || input.positionals.length !== 1)
    return cliInvalid(problem ?? "show requires exactly one Investigation ID");
  const result = await showInvestigationReport({
    ...location(input.values),
    id: input.positionals[0]!
  });
  if (result.status === "error")
    return printResultErrors(
      "Investigation report show failed:",
      result.errors,
      1
    );
  process.stdout.write(result.markdown);
  return 0;
}

async function runTrace(input: ParsedCli): Promise<number> {
  const problem = assertAllowedOptions(input, [
    "root",
    "investigations-dir",
    "direction",
    "max-depth"
  ]);
  if (problem !== null || input.positionals.length !== 1)
    return cliInvalid(problem ?? "trace requires exactly one Investigation ID");
  const result = await traceInvestigationReports({
    ...location(input.values),
    id: input.positionals[0]!,
    ...(valueOf(input.values, "direction") === undefined
      ? {}
      : {
          direction: valueOf(
            input.values,
            "direction"
          ) as InvestigationTraceDirection
        }),
    ...(numberValue(input.values, "max-depth") === undefined
      ? {}
      : { maxDepth: numberValue(input.values, "max-depth") })
  });
  if (result.status === "error")
    return printResultErrors(
      "Investigation report trace failed:",
      result.errors,
      1
    );
  console.log(`Reports: ${result.reportIds.join(", ")}`);
  for (const edge of result.edges)
    console.log(`${edge.source} --${edge.type}--> ${edge.target}`);
  return 0;
}

async function runStage(input: ParsedCli): Promise<number> {
  const problem = assertAllowedOptions(input, [
    "root",
    "investigations-dir",
    "json"
  ]);
  if (problem !== null) return cliInvalid(problem);
  const execution = await executeInvestigationIndexStage({
    ...location(input.values),
    reportIds: input.positionals
  });
  if (execution.isErr()) {
    if (has(input.values, "json"))
      console.log(JSON.stringify(execution.error.result));
    else printStageErrors(execution.error.result);
    return execution.error.kind === "invalid-options" ? 2 : 1;
  }
  if (has(input.values, "json")) console.log(JSON.stringify(execution.value));
  else printStageSuccess(execution.value);
  return 0;
}

async function runSetRelations(input: ParsedCli): Promise<number> {
  const problem =
    assertNoPositionals(input) ??
    assertAllowedOptions(input, [
      "root",
      "investigations-dir",
      "source",
      "relation",
      "clear-relations",
      "json"
    ]);
  if (problem !== null) return cliInvalid(problem);
  const parsed = parseRelationGroups(input.values);
  if (parsed.status === "error") return cliInvalid(parsed.error);
  const result = await setInvestigationRelations({
    ...location(input.values),
    replacements: parsed.replacements
  });
  if (has(input.values, "json")) console.log(JSON.stringify(result));
  else printRelationResult(result);
  return result.errors.length === 0 ? 0 : 1;
}

function parseRelationGroups(
  values: ReadonlyMap<string, string[]>
):
  | { status: "ok"; replacements: InvestigationRelationReplacement[] }
  | { status: "error"; error: string } {
  const events: Array<{
    kind: "source" | "relation" | "clear";
    value?: string;
  }> = [];
  // Map does not retain interleaving across option names; CLI parsing records order below only for set-relations.
  // The hand parser uses this private marker when it sees relation options.
  const raw = values.get("__relation-events");
  if (raw === undefined)
    return { error: "set-relations requires --source groups", status: "error" };
  for (const token of raw) {
    const separator = token.indexOf(":");
    const kind = token.slice(0, separator);
    const value = token.slice(separator + 1);
    if (kind === "source" || kind === "relation") events.push({ kind, value });
    else if (kind === "clear") events.push({ kind: "clear" });
  }
  const replacements: InvestigationRelationReplacement[] = [];
  let current: {
    mode: "clear" | "relations" | null;
    relations: InvestigationRelation[];
    source: string;
  } | null = null;
  function finish(): string | null {
    if (current === null) return null;
    if (current.mode === null)
      return `source ${current.source} must use --relation or --clear-relations`;
    replacements.push({ relations: current.relations, source: current.source });
    return null;
  }
  for (const event of events) {
    if (event.kind === "source") {
      const error = finish();
      if (error !== null) return { error, status: "error" };
      current = { mode: null, relations: [], source: event.value! };
    } else if (current === null)
      return { error: `--${event.kind} must follow --source`, status: "error" };
    else if (event.kind === "clear") {
      if (current.mode !== null)
        return {
          error: `source ${current.source} must choose either --relation or --clear-relations`,
          status: "error"
        };
      current.mode = "clear";
    } else {
      if (current.mode === "clear")
        return {
          error: `source ${current.source} must choose either --relation or --clear-relations`,
          status: "error"
        };
      const separator = event.value!.indexOf("=");
      if (separator <= 0 || separator === event.value!.length - 1)
        return {
          error: `relation ${JSON.stringify(event.value)} must use <type=target-id>`,
          status: "error"
        };
      current.mode = "relations";
      current.relations.push({
        type: event.value!.slice(0, separator) as InvestigationRelation["type"],
        target: event.value!.slice(separator + 1)
      });
    }
  }
  const error = finish();
  return error === null
    ? { replacements, status: "ok" }
    : { error, status: "error" };
}

function printStageSuccess(
  result: Extract<InvestigationIndexStageResult, { status: "ok" }>
): void {
  console.log(
    result.changed
      ? `Investigation index entries staged for ${result.selectedIds.length} selected report(s) in ${result.indexPath}.`
      : `Investigation index entries are unchanged for ${result.selectedIds.length} selected report(s) in ${result.indexPath}.`
  );
  console.log(`state: ${result.state}; changed: ${result.changed}`);
  console.log(`selected IDs: ${result.selectedIds.join(", ")}`);
  console.log(
    "Report Markdown and attached resources remain outside this operation."
  );
}
function printStageErrors(
  result: Extract<InvestigationIndexStageResult, { status: "error" }>
): void {
  printResultErrors(
    `Investigation index entry staging failed (state: ${result.state}; changed: ${result.changed}):`,
    [
      `selected IDs: ${result.selectedIds.join(", ") || "none"}`,
      ...result.diagnostics.map((diagnostic) =>
        [
          diagnostic.code,
          diagnostic.path ?? result.indexPath,
          diagnostic.stateId === null ? "" : `[${diagnostic.stateId}]`,
          diagnostic.message
        ]
          .filter((part) => part.length > 0)
          .join(" ")
      )
    ],
    1
  );
}
function printRelationResult(result: InvestigationRelationSetResult): void {
  if (result.errors.length > 0) {
    printResultErrors(
      "Investigation relation update failed:",
      result.errors,
      1
    );
    return;
  }
  console.log(
    `Investigation relations ${result.changed ? "updated" : "already current"} for: ${result.sourceIds.join(", ")}`
  );
}
function printResultErrors(
  title: string,
  errors: readonly string[],
  exitCode: number,
  warnings: readonly string[] = []
): number {
  printWarnings(warnings);
  console.error(title);
  for (const error of errors) console.error(`- ${error}`);
  return exitCode;
}
function printWarnings(warnings: readonly string[]): void {
  if (warnings.length === 0) return;
  console.error("Investigation report warnings:");
  for (const warning of warnings) console.error(`- ${warning}`);
}
function cliInvalid(error: string): number {
  console.error(error);
  return 2;
}

export async function runInvestigationReportCheckCli(
  argv: readonly string[] = process.argv.slice(2)
): Promise<number> {
  const parsed = parseCliWithRelationEvents(argv);
  if (parsed.status === "help") {
    printHelp();
    return 0;
  }
  if (parsed.status === "invalid") return cliInvalid(parsed.error);
  const input = parsed.value;
  switch (input.command) {
    case "check":
      return await runCheck(input);
    case "sync-index":
      return await runSync(input);
    case "list":
      return await runList(input);
    case "show":
      return await runShow(input);
    case "trace":
      return await runTrace(input);
    case "stage-index":
      return await runStage(input);
    case "set-relations":
      return await runSetRelations(input);
  }
}

function parseCliWithRelationEvents(
  argv: readonly string[]
): ReturnType<typeof parseCli> {
  const parsed = parseCli(argv);
  if (parsed.status !== "command" || parsed.value.command !== "set-relations")
    return parsed;
  const first = argv[0] === "set-relations" ? 1 : 0;
  const events: string[] = [];
  for (let index = first; index < argv.length; index += 1) {
    const token = argv[index]!;
    if (token === "--source" || token === "--relation") {
      const value = argv[index + 1];
      if (value !== undefined) events.push(`${token.slice(2)}:${value}`);
      index += 1;
    } else if (token === "--clear-relations") events.push("clear:");
    else if (token.startsWith("--source="))
      events.push(`source:${token.slice("--source=".length)}`);
    else if (token.startsWith("--relation="))
      events.push(`relation:${token.slice("--relation=".length)}`);
  }
  parsed.value.values.set("__relation-events", events);
  return parsed;
}

export {
  queryInvestigationIndex,
  setInvestigationRelations,
  showInvestigationReport,
  stageInvestigationIndex,
  synchronizeInvestigationIndex,
  traceInvestigationReports,
  validateInvestigationReports
};
export type {
  InvestigationIndexQueryOptions,
  InvestigationIndexQueryResult,
  InvestigationIndexStageDiagnostic,
  InvestigationIndexStageOptions,
  InvestigationIndexStageResult,
  InvestigationIndexState,
  InvestigationIndexSyncOptions,
  InvestigationIndexSyncResult,
  InvestigationRelation,
  InvestigationRelationSetOptions,
  InvestigationRelationSetResult,
  InvestigationRelationType,
  InvestigationReportCheckOptions,
  InvestigationReportCheckResult,
  InvestigationReportShowOptions,
  InvestigationReportShowResult,
  InvestigationReportTraceOptions,
  InvestigationReportTraceResult
} from "./types.ts";

if (isMainModule(import.meta.url)) {
  try {
    process.exitCode = await runInvestigationReportCheckCli();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
