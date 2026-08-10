import path from "node:path";
import {
  Command,
  CommanderError,
  InvalidArgumentError,
  Option
} from "commander";
import { isMainModule } from "../../../shared/src/node/main-module.ts";
import { showTestEvidenceCase } from "./case-show.ts";
import {
  formatLedgerCaseQuery,
  formatLedgerCaseShow,
  formatLedgerReport,
  formatLedgerSync,
  formatLedgerTestQuery,
  type TestEvidenceLedgerCliOutput
} from "./cli-output.ts";
import { hasBlockingTestEvidenceDiagnostics } from "./diagnostics.ts";
import {
  queryTestEntities,
  queryTestEvidenceCases,
  testEvidenceLedgerQueryDefaultLimit
} from "./query.ts";
import {
  stateIndexQueryMaximumLimit,
  testEntityIdSchema,
  testEvidenceCaseIdSchema,
  testEvidenceTagSchema
} from "./schemas.ts";
import { syncTestEvidenceLedgerIndex } from "./state-index.ts";
import { validateTestEvidenceLedger } from "./validation.ts";
import * as v from "valibot";

type LedgerCommand = "check" | "sync-index" | "list" | "show" | "tests";

type ParsedOptions = {
  json?: boolean;
  limit?: number;
  offset?: number;
  query?: string;
  root?: string;
  tag?: string;
  test?: string;
  write?: boolean;
};

type LedgerCliArgs = {
  caseId: string | null;
  command: LedgerCommand;
  json: boolean;
  limit: number;
  offset: number;
  query?: string;
  tag?: string;
  testId?: string;
  workspaceRoot: string;
  write: boolean;
};

const repeatCheckedOptions = [
  "--root",
  "--json",
  "--write",
  "--test",
  "--tag",
  "--query",
  "--limit",
  "--offset"
] as const;

export async function runTestEvidenceLedgerCli(
  argv: readonly string[] = process.argv.slice(2)
): Promise<number> {
  const repeated = repeatedOption(argv);
  if (repeated !== null) {
    process.stderr.write(`error: option '${repeated}' may only be specified once\n`);
    return 2;
  }

  let exitCode = 0;
  const program = new Command()
    .name("test-evidence-ledger.mjs")
    .description("Validate and query the Test–Case evidence ledger.")
    .allowExcessArguments(false)
    .exitOverride()
    .addOption(new Option(
      "--root <workspace-root>",
      "Workspace root containing docs/test-evidence."
    ).makeOptionMandatory().argParser(parseNonEmptyText))
    .option("--json", "Write the command result as JSON.")
    .configureOutput({
      writeErr: (text) => process.stderr.write(text),
      writeOut: (text) => process.stdout.write(text)
    });

  const execute = async (
    command: LedgerCommand,
    node: Command,
    caseId: string | null = null
  ): Promise<void> => {
    const args = commandArgs(command, node, caseId);
    exitCode = await runLedgerCommand(args);
  };

  const check = subcommand(
    program,
    "check",
    "Strictly validate the ledger sources and derived index."
  );
  check.action(() => execute("check", check));

  const syncIndex = subcommand(
    program,
    "sync-index",
    "Check or atomically rebuild the derived Case index."
  ).option("--write", "Atomically rebuild the index from current sources.");
  syncIndex.action(() => execute("sync-index", syncIndex));

  const list = addQueryOptions(subcommand(
    program,
    "list",
    "List compact Case summaries."
  ))
    .addOption(new Option(
      "--test <test-id>",
      "Filter Cases by one known Test ID."
    ).argParser(parseTestId))
    .addOption(new Option(
      "--tag <tag>",
      "Filter Cases by one Tag."
    ).argParser(parseTag));
  list.action(() => execute("list", list));

  const show = subcommand(
    program,
    "show",
    "Show one authoritative Case and its current Test details."
  ).argument(
    "<case-id>",
    "Case ID to show.",
    parseCaseId
  );
  show.action((caseId: string) => execute(
    "show",
    show,
    caseId
  ));

  const tests = addQueryOptions(subcommand(
    program,
    "tests",
    "List Test entities and derived Case memberships."
  ));
  tests.action(() => execute("tests", tests));

  try {
    await program.parseAsync(["node", "test-evidence-ledger.mjs", ...argv]);
  } catch (error) {
    if (error instanceof CommanderError) {
      return error.exitCode === 0 ? 0 : 2;
    }
    process.stderr.write(
      `${error instanceof Error ? error.message : String(error)}\n`
    );
    return 1;
  }
  return exitCode;
}

async function runLedgerCommand(args: LedgerCliArgs): Promise<number> {
  if (args.command === "check") {
    const result = await validateTestEvidenceLedger({
      workspaceRoot: args.workspaceRoot
    });
    writeOutput(formatLedgerReport(result, args.json));
    return hasBlockingTestEvidenceDiagnostics(result.diagnostics) ? 1 : 0;
  }
  if (args.command === "sync-index") {
    const result = await syncTestEvidenceLedgerIndex({
      workspaceRoot: args.workspaceRoot,
      mode: args.write ? "write" : "check"
    });
    writeOutput(formatLedgerSync(result, args.json));
    return result.status === "ok" ? 0 : 1;
  }
  if (args.command === "show") {
    const result = await showTestEvidenceCase({
      workspaceRoot: args.workspaceRoot,
      caseId: args.caseId ?? ""
    });
    writeOutput(formatLedgerCaseShow(result, args.json));
    return hasBlockingTestEvidenceDiagnostics(result.diagnostics) ? 1 : 0;
  }
  if (args.command === "tests") {
    const result = await queryTestEntities({
      workspaceRoot: args.workspaceRoot,
      query: args.query,
      limit: args.limit,
      offset: args.offset
    });
    writeOutput(formatLedgerTestQuery(result, args.json));
    return hasBlockingTestEvidenceDiagnostics(result.diagnostics) ? 1 : 0;
  }

  const result = await queryTestEvidenceCases({
    workspaceRoot: args.workspaceRoot,
    testId: args.testId,
    tag: args.tag,
    query: args.query,
    limit: args.limit,
    offset: args.offset
  });
  writeOutput(formatLedgerCaseQuery(result, args.json));
  if (!hasBlockingTestEvidenceDiagnostics(result.diagnostics)) {
    return 0;
  }
  return result.diagnostics.some(
    (diagnostic) => diagnostic.code === "query.test-unknown"
  ) ? 2 : 1;
}

function commandArgs(
  command: LedgerCommand,
  commandNode: Command,
  caseId: string | null
): LedgerCliArgs {
  const options = commandNode.optsWithGlobals<ParsedOptions>();
  return {
    caseId,
    command,
    json: options.json ?? false,
    limit: options.limit ?? testEvidenceLedgerQueryDefaultLimit,
    offset: options.offset ?? 0,
    query: options.query,
    tag: options.tag,
    testId: options.test,
    workspaceRoot: path.resolve(options.root ?? ""),
    write: options.write ?? false
  };
}

function subcommand(
  program: Command,
  nameAndArgs: string,
  description: string
): Command {
  return program
    .command(nameAndArgs)
    .description(description)
    .allowExcessArguments(false)
    .exitOverride();
}

function addQueryOptions(command: Command): Command {
  return command
    .addOption(new Option(
      "--limit <count>",
      "Maximum items to return."
    ).argParser(parsePositiveInteger).default(testEvidenceLedgerQueryDefaultLimit))
    .addOption(new Option(
      "--offset <count>",
      "Items to skip before returning results."
    ).argParser(parseNonNegativeInteger).default(0))
    .addOption(new Option(
      "--query <text>",
      "Require every search term to match."
    ).argParser(parseNonEmptyText));
}

function parsePositiveInteger(value: string): number {
  const parsed = parseCliInteger(value);
  if (parsed < 1 || parsed > stateIndexQueryMaximumLimit) {
    throw new InvalidArgumentError(
      `must be between 1 and ${stateIndexQueryMaximumLimit}`
    );
  }
  return parsed;
}

function parseNonNegativeInteger(value: string): number {
  const parsed = parseCliInteger(value);
  if (parsed < 0) {
    throw new InvalidArgumentError("must be a non-negative integer");
  }
  return parsed;
}

function parseCliInteger(value: string): number {
  if (!/^\d+$/u.test(value)) {
    throw new InvalidArgumentError("must be an integer");
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) {
    throw new InvalidArgumentError("must be a safe integer");
  }
  return parsed;
}

function parseNonEmptyText(value: string): string {
  const parsed = value.trim();
  if (parsed.length === 0) {
    throw new InvalidArgumentError(
      "must contain a non-whitespace character"
    );
  }
  return parsed;
}

function parseTestId(value: string): string {
  return parseSchemaValue(testEntityIdSchema, value, "Test ID");
}

function parseTag(value: string): string {
  return parseSchemaValue(testEvidenceTagSchema, value, "Tag");
}

function parseCaseId(value: string): string {
  return parseSchemaValue(testEvidenceCaseIdSchema, value, "Case ID");
}

function parseSchemaValue(
  schema: typeof testEntityIdSchema
    | typeof testEvidenceTagSchema
    | typeof testEvidenceCaseIdSchema,
  value: string,
  label: string
): string {
  const parsed = v.safeParse(schema, value);
  if (!parsed.success) {
    throw new InvalidArgumentError(
      `${label} ${parsed.issues.map((issue) => issue.message).join("; ")}`
    );
  }
  return parsed.output;
}

function repeatedOption(argv: readonly string[]): string | null {
  for (const option of repeatCheckedOptions) {
    const occurrences = argv.filter((argument) => (
      argument === option || argument.startsWith(`${option}=`)
    )).length;
    if (occurrences > 1) {
      return option;
    }
  }
  return null;
}

function writeOutput(output: TestEvidenceLedgerCliOutput): void {
  if (output.stderr.length > 0) {
    process.stderr.write(output.stderr);
  }
  if (output.stdout.length > 0) {
    process.stdout.write(output.stdout);
  }
}

if (isMainModule(import.meta.url)) {
  process.exitCode = await runTestEvidenceLedgerCli();
}
