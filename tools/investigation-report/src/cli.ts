#!/usr/bin/env node

import process from "node:process";
import { parseArgs } from "node:util";
import { isMainModule } from "../../shared/src/node/main-module.ts";
import {
  executeInvestigationIndexQuery,
  queryInvestigationIndex
} from "./query.ts";
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
  InvestigationIndexQueryOptions,
  InvestigationIndexStageResult,
  InvestigationReportCheckOptions
} from "./types.ts";

type InvestigationCommand = "check" | "list" | "stage-index" | "sync-index";
type ParsedArguments = ReturnType<typeof parseArgs>;
type CliLocationOptions = {
  investigationsDir?: string;
  workspaceRoot: string;
};
type CliInput =
  | { status: "help" }
  | { status: "invalid"; error: string }
  | {
      status: "command";
      commandArguments: string[];
      command: InvestigationCommand;
      values: ParsedArguments["values"];
    };

function printHelp(): void {
  console.log([
    "Usage: check-investigations.mjs [check] [options]",
    "       check-investigations.mjs sync-index [options]",
    "       check-investigations.mjs list [options]",
    "       check-investigations.mjs stage-index <topic-id...> [options]",
    "",
    "Check investigation topics, optional attached resources, timestamps, and the generated index.",
    "Without filters, every topic, the resource pool, and full-index freshness are checked.",
    "With --category or --path, matching topics and their referenced resources are checked.",
    "sync-index validates every topic and resource, then writes the derived JSON index.",
    "list checks topic and resource freshness, then queries without parsing report bodies.",
    "stage-index stages only selected topic entries from the current workspace index.",
    "It does not read or stage topic Markdown or attached resources.",
    "",
    "Options:",
    "  --root <workspace-root>       Workspace root (default: current directory)",
    "  --investigations-dir <path>  Investigation root relative to workspace",
    "                               (default: docs/investigations)",
    "  --category <category-id>     Filter one topic category in check or list; repeatable",
    "  --path <relative-path>       Filter one topic path in check or list; repeatable",
    "  --status <status>            List one status; repeatable",
    "  --text <terms>               List topic titles, questions, or report titles containing all terms",
    "  --latest-from <timestamp>    List topics whose latest report is at or after this timestamp",
    "  --latest-to <timestamp>      List topics whose latest report is at or before this timestamp",
    "  --limit <count>              List page size (default: 50, maximum: 1000)",
    "  --offset <count>             List page offset (default: 0)",
    "  --json                       Emit the stage-index result as JSON",
    "  -h, --help                   Show this help"
  ].join("\n"));
}

function parseCliInput(argv: readonly string[]): CliInput {
  let parsed: ParsedArguments;
  try {
    parsed = parseArgs({
      allowPositionals: true,
      args: [...argv],
      options: {
        category: { multiple: true, type: "string" },
        help: { short: "h", type: "boolean" },
        "investigations-dir": { type: "string" },
        json: { type: "boolean" },
        "latest-from": { type: "string" },
        "latest-to": { type: "string" },
        limit: { type: "string" },
        offset: { type: "string" },
        path: { multiple: true, type: "string" },
        root: { type: "string" },
        status: { multiple: true, type: "string" },
        text: { type: "string" }
      },
      strict: true
    });
  } catch (error) {
    return { error: errorText(error), status: "invalid" };
  }

  if (parsed.values.help === true) {
    return { status: "help" };
  }
  const [command = "check", ...commandArguments] = parsed.positionals;
  if (!isInvestigationCommand(command)) {
    return { error: `unknown command: ${command}`, status: "invalid" };
  }
  if (command !== "stage-index" && commandArguments.length > 0) {
    return {
      error: `${command} does not accept positional arguments`,
      status: "invalid"
    };
  }
  return {
    command,
    commandArguments,
    status: "command",
    values: parsed.values
  };
}

function isInvestigationCommand(value: string): value is InvestigationCommand {
  return value === "check"
    || value === "list"
    || value === "stage-index"
    || value === "sync-index";
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function optionalStrings(value: unknown): string[] | undefined {
  return Array.isArray(value) && value.every((item) => typeof item === "string")
    ? value
    : undefined;
}

function optionalNumber(value: unknown): number | undefined {
  return typeof value === "string" ? Number(value) : undefined;
}

function locationOptions(
  values: ParsedArguments["values"]
): CliLocationOptions {
  const investigationsDir = optionalString(values["investigations-dir"]);
  const workspaceRoot = optionalString(values.root) ?? ".";
  return investigationsDir === undefined
    ? { workspaceRoot }
    : { investigationsDir, workspaceRoot };
}

type CliQueryOptions = Omit<InvestigationIndexQueryOptions, "statuses"> & {
  statuses?: readonly string[];
};

function queryOptions(values: ParsedArguments["values"]): CliQueryOptions {
  const categories = optionalStrings(values.category);
  const latestReportAtFrom = optionalString(values["latest-from"]);
  const latestReportAtTo = optionalString(values["latest-to"]);
  const limit = optionalNumber(values.limit);
  const offset = optionalNumber(values.offset);
  const paths = optionalStrings(values.path);
  const statuses = optionalStrings(values.status);
  const text = optionalString(values.text);
  return {
    ...locationOptions(values),
    ...(categories === undefined ? {} : { categories }),
    ...(latestReportAtFrom === undefined ? {} : { latestReportAtFrom }),
    ...(latestReportAtTo === undefined ? {} : { latestReportAtTo }),
    ...(limit === undefined ? {} : { limit }),
    ...(offset === undefined ? {} : { offset }),
    ...(paths === undefined ? {} : { paths }),
    ...(statuses === undefined ? {} : { statuses }),
    ...(text === undefined ? {} : { text })
  };
}

function checkOptions(
  values: ParsedArguments["values"]
): InvestigationReportCheckOptions {
  const categories = optionalStrings(values.category);
  const paths = optionalStrings(values.path);
  return {
    ...locationOptions(values),
    ...(categories === undefined ? {} : { categories }),
    ...(paths === undefined ? {} : { paths })
  };
}

function hasListOnlyOptions(values: ParsedArguments["values"]): boolean {
  return [
    values["latest-from"],
    values["latest-to"],
    values.limit,
    values.offset,
    values.status,
    values.text
  ].some((value) => value !== undefined);
}

function hasQueryOptions(values: ParsedArguments["values"]): boolean {
  return optionalStrings(values.category) !== undefined
    || optionalStrings(values.path) !== undefined
    || hasListOnlyOptions(values);
}

function hasJsonOutput(values: ParsedArguments["values"]): boolean {
  return values.json === true;
}

async function runSyncCommand(
  values: ParsedArguments["values"]
): Promise<number> {
  if (hasQueryOptions(values)) {
    console.error("sync-index does not accept query filters or pagination");
    return 2;
  }
  const execution = await executeInvestigationIndexSync(
    locationOptions(values)
  );
  if (execution.isErr()) {
    printErrors(
      execution.error.kind === "invalid-options"
        ? "Invalid investigation index synchronization options:"
        : "Investigation index synchronization failed:",
      execution.error.result.errors
    );
    return execution.error.kind === "invalid-options" ? 2 : 1;
  }
  const synchronized = execution.value;
  console.log(
    synchronized.changed
      ? "Investigation index synchronized "
        + `(${synchronized.topicCount} topics across `
        + `${synchronized.categoryCount} categories).`
      : "Investigation index is already current "
        + `(${synchronized.topicCount} topics across `
        + `${synchronized.categoryCount} categories).`
  );
  return 0;
}

async function runStageCommand(
  values: ParsedArguments["values"],
  topicIds: readonly string[]
): Promise<number> {
  if (hasQueryOptions(values)) {
    console.error("stage-index does not accept query filters or pagination");
    return 2;
  }
  const execution = await executeInvestigationIndexStage({
    ...locationOptions(values),
    topicIds
  });
  if (execution.isErr()) {
    if (hasJsonOutput(values)) {
      console.log(JSON.stringify(execution.error.result));
    } else {
      printStageErrors(execution.error.result);
    }
    return execution.error.kind === "invalid-options" ? 2 : 1;
  }
  if (hasJsonOutput(values)) {
    console.log(JSON.stringify(execution.value));
  } else {
    printStageSuccess(execution.value);
  }
  return 0;
}

function printStageSuccess(
  result: Extract<InvestigationIndexStageResult, { status: "ok" }>
): void {
  console.log(
    result.changed
      ? "Investigation index entries staged for "
        + `${result.selectedIds.length} selected topic(s) in ${result.indexPath}.`
      : "Investigation index entries are unchanged for "
        + `${result.selectedIds.length} selected topic(s) in ${result.indexPath}.`
  );
  console.log(`state: ${result.state}; changed: ${result.changed}`);
  console.log(`selected IDs: ${result.selectedIds.join(", ")}`);
  console.log("Topic Markdown and attached resources remain outside this operation.");
}

function printStageErrors(
  result: Extract<InvestigationIndexStageResult, { status: "error" }>
): void {
  printErrors(
    "Investigation index entry staging failed "
      + `(state: ${result.state}; changed: ${result.changed}):`,
    [
      `selected IDs: ${result.selectedIds.join(", ") || "none"}`,
      ...result.diagnostics.map((diagnostic) => [
        diagnostic.code,
        diagnostic.path ?? result.indexPath,
        diagnostic.stateId === null ? "" : `[${diagnostic.stateId}]`,
        diagnostic.message
      ].filter((part) => part.length > 0).join(" "))
    ]
  );
}

async function runListCommand(
  values: ParsedArguments["values"]
): Promise<number> {
  const execution = await executeInvestigationIndexQuery(queryOptions(values));
  if (execution.isErr()) {
    printErrors(
      execution.error.kind === "invalid-options"
        ? "Invalid investigation topic query options:"
        : "Investigation index query failed:",
      execution.error.result.errors
    );
    return execution.error.kind === "invalid-options" ? 2 : 1;
  }
  const queried = execution.value;
  if (queried.entries.length === 0) {
    console.log("No investigation topics matched.");
    return 0;
  }
  console.log(
    `Investigation topics (${queried.entries.length} of ${queried.total}, `
    + `offset ${queried.offset}):`
  );
  for (const entry of queried.entries) {
    console.log(`${entry.status} ${entry.latestReportAt} ${entry.path}`);
    console.log(`  title: ${entry.title}`);
    console.log(`  question: ${entry.question}`);
    console.log(
      `  reports: ${entry.reportCount}; latest: ${entry.reportTitles.at(-1)}`
    );
  }
  return 0;
}

async function runCheckCommand(
  values: ParsedArguments["values"]
): Promise<number> {
  if (hasListOnlyOptions(values)) {
    console.error(
      "check only accepts --category and --path filters; "
      + "use list for indexed queries"
    );
    return 2;
  }
  const execution = await executeInvestigationReportCheck(checkOptions(values));
  if (execution.isErr()) {
    printErrors(
      execution.error.kind === "invalid-options"
        ? "Invalid investigation topic check options:"
        : "Investigation report check failed:",
      execution.error.result.errors
    );
    return execution.error.kind === "invalid-options" ? 2 : 1;
  }
  const result = execution.value;
  console.log(
    "Investigation report check passed ("
    + result.selectedTopicCount
    + " of "
    + result.availableTopicCount
    + " topics checked across "
    + result.categoryCount
    + " categories"
    + (result.indexChecked ? "; full index current" : "; index not checked")
    + ")."
  );
  return 0;
}

async function dispatchCommand(input: Extract<
  CliInput,
  { status: "command" }
>): Promise<number> {
  if (input.command !== "stage-index" && hasJsonOutput(input.values)) {
    console.error("--json is only supported by stage-index");
    return 2;
  }
  switch (input.command) {
    case "check":
      return await runCheckCommand(input.values);
    case "list":
      return await runListCommand(input.values);
    case "stage-index":
      return await runStageCommand(input.values, input.commandArguments);
    case "sync-index":
      return await runSyncCommand(input.values);
  }
}

function printErrors(title: string, errors: readonly string[]): void {
  console.error(title);
  for (const error of errors) {
    console.error(`- ${error}`);
  }
}

export async function runInvestigationReportCheckCli(
  argv: readonly string[] = process.argv.slice(2)
): Promise<number> {
  const input = parseCliInput(argv);
  if (input.status === "help") {
    printHelp();
    return 0;
  }
  if (input.status === "invalid") {
    console.error(input.error);
    return 2;
  }
  return await dispatchCommand(input);
}

export {
  queryInvestigationIndex,
  stageInvestigationIndex,
  synchronizeInvestigationIndex,
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
  InvestigationReportCheckOptions,
  InvestigationReportCheckResult,
  InvestigationReportStatus,
  InvestigationResourceReference
} from "./types.ts";

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

if (isMainModule(import.meta.url)) {
  try {
    process.exitCode = await runInvestigationReportCheckCli();
  } catch (error) {
    console.error(errorText(error));
    process.exitCode = 1;
  }
}
