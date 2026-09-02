#!/usr/bin/env node

import process from "node:process";
import { isMainModule } from "../../shared/src/node/main-module.ts";
import {
  executeInvestigationIndexQuery,
  queryInvestigationIndex,
  showInvestigationReport,
  traceInvestigationReports
} from "./query.ts";
import { discardInvestigationReport } from "./discard.ts";
import {
  diagnosticFromError,
  diagnosticFromStateIndexDiagnostic,
  genericInvestigationDiagnostic,
  renderInvestigationDiagnostic,
  type InvestigationDiagnostic
} from "./diagnostics.ts";
import { isInvestigationId } from "./report-path.ts";
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
  InvestigationRelationSetResult
} from "./types.ts";

type InvestigationReportCliIo = Readonly<{
  stderr: (text: string) => void;
  stdout: (text: string) => void;
}>;

type InvestigationReportCliOptions = Readonly<{
  io?: InvestigationReportCliIo;
}>;

const processCliIo: InvestigationReportCliIo = {
  stderr: (text) => process.stderr.write(text),
  stdout: (text) => process.stdout.write(text)
};

function writeLine(writer: (text: string) => void, text: string): void {
  writer(`${text}\n`);
}

type InvestigationCommand =
  | "check"
  | "discard"
  | "list"
  | "show"
  | "stage-index"
  | "sync-index"
  | "trace"
  | "set-relations";
type ParsedCli = Readonly<{
  command: InvestigationCommand;
  positionals: string[];
  relationEvents?: readonly RelationCliEvent[];
  values: Map<string, string[]>;
}>;
type RelationCliEvent =
  | Readonly<{ kind: "source"; value: string }>
  | Readonly<{ kind: "relation"; value: string }>
  | Readonly<{ kind: "clear" }>;
type RawInvestigationRelationReplacement = Readonly<{
  relations: readonly Readonly<{ target: string; type: string }>[];
  source: string;
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
  "depth",
  "source",
  "relation"
]);
const booleanOptions = new Set([
  "clear-relations",
  "delete-owned-resources",
  "delete-recorded-report",
  "help"
]);

function printHelp(
  command: InvestigationCommand | undefined,
  io: InvestigationReportCliIo
): void {
  const commandHelp: Record<InvestigationCommand, readonly string[]> = {
    check: [
      "Usage: investigation-report [check] [--id <investigation-id> ...] [options]",
      "",
      "Validate reports, the complete relation graph, resource ownership, and the current index.",
      "Scoped --id checks validate only selected reports and their declared resources."
    ],
    discard: [
      "Usage: investigation-report discard <investigation-id> [--delete-owned-resources] [--delete-recorded-report] [options]",
      "",
      "Delete one established report after a full graph and resource preflight.",
      "Refuses remaining relation references and shared owner resources. Reports or owned resources in Git HEAD require --delete-recorded-report."
    ],
    list: [
      "Usage: investigation-report list [--tag <tag> ...] [options]",
      "",
      "List reports from the current derived index."
    ],
    show: [
      "Usage: investigation-report show <investigation-id> [options]",
      "",
      "Print one report Markdown document from the current derived index."
    ],
    "stage-index": [
      "Usage: investigation-report stage-index <investigation-id...> [options]",
      "",
      "Write only selected report entries to the pending index; report Markdown and resources remain outside this operation."
    ],
    "sync-index": [
      "Usage: investigation-report sync-index [options]",
      "",
      "Validate the full collection and rebuild its derived index in the working tree."
    ],
    trace: [
      "Usage: investigation-report trace <investigation-id> [options]",
      "",
      "Trace predecessor and successor report relationships from the current derived index."
    ],
    "set-relations": [
      "Usage: investigation-report set-relations --source <investigation-id> (--relation <type=target-id>... | --clear-relations) [--source ...] [options]",
      "",
      "Atomically replace every selected source relation set and rebuild the workspace index; does not stage files."
    ]
  };
  const sharedOptions = [
    "  --root <workspace-root>       Workspace root (default: current directory)",
    "  --investigations-dir <path>  Investigation root relative to workspace",
    "  -h, --help                    Show this help"
  ];
  const specificOptions: Partial<
    Record<InvestigationCommand, readonly string[]>
  > = {
    check: ["  --id <investigation-id>       Scoped check ID; repeatable"],
    discard: [
      "  --delete-owned-resources      Confirm deletion of the report's owner-prefix resources",
      "  --delete-recorded-report      Confirm deletion of report or owned resources already in Git HEAD"
    ],
    list: [
      "  --tag <tag>                   Repeatable AND tag filter",
      "  --formed-from <timestamp>     Inclusive formedAt lower bound",
      "  --formed-to <timestamp>       Inclusive formedAt upper bound",
      "  --relation-type <type>        Direct relation type",
      "  --text <terms>                Title and question terms",
      "  --limit <count>               Page size (default: 50, maximum: 1000)",
      "  --offset <count>              Page offset (default: 0)"
    ],
    trace: [
      "  --direction <direction>       predecessors, successors, or both (default: both)",
      "  --depth <count>               Maximum non-negative relation depth"
    ],
    "set-relations": [
      "  --source <investigation-id>   Start one complete replacement source group",
      "  --relation <type=target-id>   Add one relation to the active source group",
      "  --clear-relations             Explicitly clear the active source group"
    ]
  };
  const lines =
    command === undefined
      ? [
          "Usage: investigation-report <command> [options]",
          "       investigation-report [check] [options]",
          "       investigation-report help <command>",
          "",
          "Check, query, and maintain flat Investigation Report records and their derived index.",
          "",
          "Commands: check, sync-index, list, show, trace, set-relations, stage-index, discard",
          "Run investigation-report help <command> for command options.",
          "",
          "Exit status: 0 success; 1 check, operation, or deletion-confirmation failure; 2 invalid CLI arguments."
        ]
      : [
          ...commandHelp[command],
          "",
          "Options:",
          ...sharedOptions,
          ...(specificOptions[command] ?? []),
          "",
          "Exit status: 0 success; 1 check, operation, or deletion-confirmation failure; 2 invalid CLI arguments."
        ];
  writeLine(io.stdout, lines.join("\n"));
}

function parseCli(
  argv: readonly string[]
):
  | { command?: InvestigationCommand; status: "help" }
  | { status: "invalid"; error: string }
  | { status: "command"; value: ParsedCli } {
  const [first] = argv;
  if (first === "-h" || first === "--help") return { status: "help" };
  if (first === "help") {
    const requested = argv[1];
    if (requested === undefined) return { status: "help" };
    if (!isCommand(requested) || argv.length !== 2)
      return {
        error: `unknown command: ${requested ?? ""}`,
        status: "invalid"
      };
    return { command: requested, status: "help" };
  }
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
    ? { command: commandToken, status: "help" }
    : {
        status: "command",
        value: { command: commandToken, positionals, values }
      };
}

function isCommand(value: string): value is InvestigationCommand {
  return [
    "check",
    "discard",
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

async function runCheck(
  input: ParsedCli,
  io: InvestigationReportCliIo
): Promise<number> {
  const problem =
    assertNoPositionals(input) ??
    assertAllowedOptions(input, ["root", "investigations-dir", "id"]);
  if (problem !== null) return cliInvalid(problem, io);
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
      execution.error.result.warnings,
      io,
      execution.error.result.diagnostics
    );
  const result = execution.value;
  printWarnings(result.warnings, io);
  writeLine(
    io.stdout,
    `Investigation report check passed (${result.selectedReportCount} of ${result.availableReportCount} reports checked${result.indexChecked ? "; full index current" : "; index not checked"}).`
  );
  return 0;
}

async function runSync(
  input: ParsedCli,
  io: InvestigationReportCliIo
): Promise<number> {
  const problem =
    assertNoPositionals(input) ??
    assertAllowedOptions(input, ["root", "investigations-dir"]);
  if (problem !== null) return cliInvalid(problem, io);
  const execution = await executeInvestigationIndexSync(location(input.values));
  if (execution.isErr())
    return printResultErrors(
      execution.error.kind === "invalid-options"
        ? "Invalid investigation index synchronization options:"
        : "Investigation index synchronization failed:",
      execution.error.result.errors,
      execution.error.kind === "invalid-options" ? 2 : 1,
      execution.error.result.warnings,
      io,
      execution.error.result.diagnostics
    );
  const result = execution.value;
  printWarnings(result.warnings, io);
  writeLine(
    io.stdout,
    result.changed
      ? `Investigation index synchronized (${result.reportCount} reports).`
      : `Investigation index is already current (${result.reportCount} reports).`
  );
  return 0;
}

async function runDiscard(
  input: ParsedCli,
  io: InvestigationReportCliIo
): Promise<number> {
  const problem = assertAllowedOptions(input, [
    "root",
    "investigations-dir",
    "delete-owned-resources",
    "delete-recorded-report"
  ]);
  const [id] = input.positionals;
  if (problem !== null || id === undefined || input.positionals.length !== 1)
    return cliInvalid(
      problem ?? "discard requires exactly one Investigation ID",
      io
    );
  if (!isInvestigationId(id))
    return cliInvalid(
      `${id || "<empty>"} discard id must use an Investigation ID`,
      io
    );
  const result = await discardInvestigationReport({
    ...location(input.values),
    deleteOwnedResources: has(input.values, "delete-owned-resources"),
    deleteRecordedReport: has(input.values, "delete-recorded-report"),
    id
  });
  if (result.errors.length > 0) {
    printResultErrors(
      result.changed
        ? "Investigation report discard committed, but cleanup failed:"
        : "Investigation report discard failed:",
      result.errors,
      1,
      [],
      io,
      result.diagnostics
    );
    return 1;
  }
  writeLine(
    io.stdout,
    `Investigation report discarded: ${result.id}${result.deletedResourceIds.length === 0 ? "" : `; deleted ${result.deletedResourceIds.length} owned resource(s)`}.`
  );
  return 0;
}

async function runList(
  input: ParsedCli,
  io: InvestigationReportCliIo
): Promise<number> {
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
  if (problem !== null) return cliInvalid(problem, io);
  const relationType = valueOf(input.values, "relation-type");
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
    ...(relationType === undefined ? {} : { relationType }),
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
      execution.error.kind === "invalid-options" ? 2 : 1,
      [],
      io,
      execution.error.result.diagnostics
    );
  const result = execution.value;
  if (result.entries.length === 0) {
    writeLine(io.stdout, "No investigation reports matched.");
    return 0;
  }
  writeLine(
    io.stdout,
    `Investigation reports (${result.entries.length} of ${result.total}, offset ${result.offset}):`
  );
  for (const entry of result.entries) {
    writeLine(io.stdout, `${entry.id} ${entry.state.formedAt}`);
    writeLine(io.stdout, `  title: ${entry.state.title}`);
    writeLine(io.stdout, `  question: ${entry.state.question}`);
    writeLine(io.stdout, `  tags: ${entry.state.tags.join(", ")}`);
  }
  return 0;
}

async function runShow(
  input: ParsedCli,
  io: InvestigationReportCliIo
): Promise<number> {
  const problem = assertAllowedOptions(input, ["root", "investigations-dir"]);
  const [id] = input.positionals;
  if (problem !== null || id === undefined || input.positionals.length !== 1)
    return cliInvalid(
      problem ?? "show requires exactly one Investigation ID",
      io
    );
  const result = await showInvestigationReport({
    ...location(input.values),
    id
  });
  if (result.status === "error")
    return printResultErrors(
      "Investigation report show failed:",
      result.errors,
      1,
      [],
      io,
      result.diagnostics
    );
  io.stdout(result.markdown);
  return 0;
}

async function runTrace(
  input: ParsedCli,
  io: InvestigationReportCliIo
): Promise<number> {
  const problem = assertAllowedOptions(input, [
    "root",
    "investigations-dir",
    "direction",
    "depth"
  ]);
  const [id] = input.positionals;
  if (problem !== null || id === undefined || input.positionals.length !== 1)
    return cliInvalid(
      problem ?? "trace requires exactly one Investigation ID",
      io
    );
  const direction = valueOf(input.values, "direction");
  const result = await traceInvestigationReports({
    ...location(input.values),
    id,
    ...(direction === undefined ? {} : { direction }),
    ...(numberValue(input.values, "depth") === undefined
      ? {}
      : { maxDepth: numberValue(input.values, "depth") })
  });
  if (result.status === "error")
    return printResultErrors(
      "Investigation report trace failed:",
      result.errors,
      1,
      [],
      io,
      result.diagnostics
    );
  writeLine(io.stdout, `Reports: ${result.reportIds.join(", ")}`);
  for (const edge of result.edges)
    writeLine(io.stdout, `${edge.source} --${edge.type}--> ${edge.target}`);
  return 0;
}

async function runStage(
  input: ParsedCli,
  io: InvestigationReportCliIo
): Promise<number> {
  const problem = assertAllowedOptions(input, ["root", "investigations-dir"]);
  if (problem !== null) return cliInvalid(problem, io);
  const execution = await executeInvestigationIndexStage({
    ...location(input.values),
    reportIds: input.positionals
  });
  if (execution.isErr()) {
    printStageErrors(execution.error.result, io);
    return execution.error.kind === "invalid-options" ? 2 : 1;
  }
  printStageSuccess(execution.value, io);
  return 0;
}

async function runSetRelations(
  input: ParsedCli,
  io: InvestigationReportCliIo
): Promise<number> {
  const problem =
    assertNoPositionals(input) ??
    assertAllowedOptions(input, [
      "root",
      "investigations-dir",
      "source",
      "relation",
      "clear-relations"
    ]);
  if (problem !== null) return cliInvalid(problem, io);
  const parsed = parseRelationGroups(input.relationEvents);
  if (parsed.status === "error") return cliInvalid(parsed.error, io);
  const result = await setInvestigationRelations({
    ...location(input.values),
    replacements: parsed.replacements
  });
  printRelationResult(result, io);
  return result.errors.length === 0 ? 0 : 1;
}

function parseRelationGroups(
  events: readonly RelationCliEvent[] | undefined
):
  | { status: "ok"; replacements: RawInvestigationRelationReplacement[] }
  | { status: "error"; error: string } {
  if (events === undefined)
    return { error: "set-relations requires --source groups", status: "error" };
  const replacements: RawInvestigationRelationReplacement[] = [];
  let current: {
    mode: "clear" | "relations" | null;
    relations: Array<{ target: string; type: string }>;
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
    switch (event.kind) {
      case "source": {
        const error = finish();
        if (error !== null) return { error, status: "error" };
        current = { mode: null, relations: [], source: event.value };
        break;
      }
      case "clear": {
        if (current === null)
          return { error: "--clear must follow --source", status: "error" };
        if (current.mode !== null)
          return {
            error: `source ${current.source} must choose either --relation or --clear-relations`,
            status: "error"
          };
        current.mode = "clear";
        break;
      }
      case "relation": {
        if (current === null)
          return { error: "--relation must follow --source", status: "error" };
        if (current.mode === "clear")
          return {
            error: `source ${current.source} must choose either --relation or --clear-relations`,
            status: "error"
          };
        const separator = event.value.indexOf("=");
        if (separator <= 0 || separator === event.value.length - 1)
          return {
            error: `relation ${JSON.stringify(event.value)} must use <type=target-id>`,
            status: "error"
          };
        current.mode = "relations";
        current.relations.push({
          target: event.value.slice(separator + 1),
          type: event.value.slice(0, separator)
        });
        break;
      }
    }
  }
  const error = finish();
  return error === null
    ? { replacements, status: "ok" }
    : { error, status: "error" };
}

function printStageSuccess(
  result: Extract<InvestigationIndexStageResult, { status: "ok" }>,
  io: InvestigationReportCliIo
): void {
  writeLine(
    io.stdout,
    result.changed
      ? `Investigation index entries staged for ${result.selectedIds.length} selected report(s) in ${result.indexPath}.`
      : `Investigation index entries are unchanged for ${result.selectedIds.length} selected report(s) in ${result.indexPath}.`
  );
  writeLine(io.stdout, `state: ${result.state}; changed: ${result.changed}`);
  writeLine(io.stdout, `selected IDs: ${result.selectedIds.join(", ")}`);
  writeLine(
    io.stdout,
    "Report Markdown and attached resources remain outside this operation."
  );
}
function printStageErrors(
  result: Extract<InvestigationIndexStageResult, { status: "error" }>,
  io: InvestigationReportCliIo
): void {
  printResultErrors(
    `Investigation index entry staging failed (state: ${result.state}; changed: ${result.changed}):`,
    [`selected IDs: ${result.selectedIds.join(", ") || "none"}`],
    1,
    [],
    io,
    result.diagnostics.map((diagnostic) =>
      diagnosticFromStateIndexDiagnostic(diagnostic, {
        ...(result.pending === undefined
          ? {}
          : {
              mutation: {
                outcome: result.pending.outcome,
                scope: result.pending.scope
              }
            }),
        recovery:
          "correct the reported staging problem, then retry the selected index update",
        target: result.indexPath
      })
    )
  );
}
function printRelationResult(
  result: InvestigationRelationSetResult,
  io: InvestigationReportCliIo
): void {
  if (result.errors.length > 0) {
    printResultErrors(
      "Investigation relation update failed:",
      result.errors,
      1,
      [],
      io,
      result.diagnostics
    );
    return;
  }
  writeLine(
    io.stdout,
    `Investigation relations ${result.changed ? "updated" : "already current"} for: ${result.sourceIds.join(", ")}`
  );
}
function printResultErrors(
  title: string,
  errors: readonly string[],
  exitCode: number,
  warnings: readonly string[] = [],
  io: InvestigationReportCliIo,
  diagnostics: readonly InvestigationDiagnostic[] = []
): number {
  printWarnings(warnings, io);
  writeLine(io.stderr, title);
  const finalDiagnostics =
    diagnostics.length > 0
      ? diagnostics
      : errors.length === 0
        ? []
        : [
            genericInvestigationDiagnostic({
              code: "investigation-report.operation-failed",
              reason: errors.join("; "),
              recovery: "correct the reported problem, then rerun the command",
              target: title.slice(0, -1)
            })
          ];
  for (const diagnostic of finalDiagnostics) {
    for (const line of renderInvestigationDiagnostic(diagnostic)) {
      writeLine(io.stderr, `- ${line}`);
    }
  }
  return exitCode;
}
function printWarnings(
  warnings: readonly string[],
  io: InvestigationReportCliIo
): void {
  if (warnings.length === 0) return;
  writeLine(io.stderr, "Investigation report warnings:");
  for (const warning of warnings) {
    writeLine(
      io.stderr,
      "- [investigation-report.warning] investigation report collection"
    );
    writeLine(io.stderr, `  reason: ${warning}`);
    writeLine(
      io.stderr,
      "  next: resolve the warning before relying on the affected collection state"
    );
  }
}
function cliInvalid(error: string, io: InvestigationReportCliIo): number {
  for (const line of renderInvestigationDiagnostic(
    genericInvestigationDiagnostic({
      code: "investigation-report.cli-invalid-arguments",
      reason: error,
      recovery: "correct the command arguments and retry",
      target: "command line"
    })
  )) {
    writeLine(io.stderr, line);
  }
  return 2;
}

export async function runInvestigationReportCheckCli(
  argv: readonly string[] = process.argv.slice(2),
  options: InvestigationReportCliOptions = {}
): Promise<number> {
  const io = options.io ?? processCliIo;
  const parsed = parseCliWithRelationEvents(argv);
  if (parsed.status === "help") {
    printHelp(parsed.command, io);
    return 0;
  }
  if (parsed.status === "invalid") return cliInvalid(parsed.error, io);
  const input = parsed.value;
  switch (input.command) {
    case "check":
      return await runCheck(input, io);
    case "discard":
      return await runDiscard(input, io);
    case "sync-index":
      return await runSync(input, io);
    case "list":
      return await runList(input, io);
    case "show":
      return await runShow(input, io);
    case "trace":
      return await runTrace(input, io);
    case "stage-index":
      return await runStage(input, io);
    case "set-relations":
      return await runSetRelations(input, io);
  }
}

function parseCliWithRelationEvents(
  argv: readonly string[]
): ReturnType<typeof parseCli> {
  const parsed = parseCli(argv);
  if (parsed.status !== "command" || parsed.value.command !== "set-relations")
    return parsed;
  const first = argv[0] === "set-relations" ? 1 : 0;
  const events: RelationCliEvent[] = [];
  for (let index = first; index < argv.length; index += 1) {
    const token = argv[index]!;
    if (token === "--source") {
      const value = argv[index + 1];
      if (value !== undefined) events.push({ kind: "source", value });
      index += 1;
    } else if (token === "--relation") {
      const value = argv[index + 1];
      if (value !== undefined) events.push({ kind: "relation", value });
      index += 1;
    } else if (token === "--clear-relations") events.push({ kind: "clear" });
    else if (token.startsWith("--source="))
      events.push({ kind: "source", value: token.slice("--source=".length) });
    else if (token.startsWith("--relation="))
      events.push({
        kind: "relation",
        value: token.slice("--relation=".length)
      });
  }
  return {
    status: "command",
    value: { ...parsed.value, relationEvents: events }
  };
}

export {
  discardInvestigationReport,
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
  InvestigationReportDiscardOptions,
  InvestigationReportDiscardResult,
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
    for (const line of renderInvestigationDiagnostic(
      diagnosticFromError({
        code: "investigation-report.unhandled-failure",
        error,
        reason: "the command stopped unexpectedly",
        recovery: "inspect the reported failure and retry the command",
        target: "investigation-report command"
      })
    )) {
      console.error(line);
    }
    process.exitCode = 1;
  }
}
