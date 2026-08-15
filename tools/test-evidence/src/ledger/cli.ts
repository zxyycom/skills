import path from "node:path";
import {
  Command,
  CommanderError,
  InvalidArgumentError,
  Option
} from "commander";
import { match } from "ts-pattern";
import * as v from "valibot";
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
  testEvidenceLedgerPath,
  testEvidenceTagSchema
} from "./schemas.ts";
import { syncTestEvidenceLedgerIndex } from "./state-index.ts";
import { validateTestEvidenceLedger } from "./validation.ts";

type ParsedOptions = {
  json?: boolean;
  limit?: number;
  offset?: number;
  query?: string;
  root: string;
  tag?: string;
  test?: string;
  write?: boolean;
};

type LedgerCliCommonArgs = {
  json: boolean;
  workspaceRoot: string;
};

type LedgerCliQueryArgs = LedgerCliCommonArgs & {
  limit: number;
  offset: number;
  query?: string;
};

type LedgerCliArgs =
  | (LedgerCliCommonArgs & { command: "check" })
  | (LedgerCliCommonArgs & {
      command: "sync-index";
      write: boolean;
    })
  | (LedgerCliCommonArgs & {
      caseId: string;
      command: "show";
    })
  | (LedgerCliQueryArgs & { command: "tests" })
  | (LedgerCliQueryArgs & {
      command: "list";
      tag?: string;
      testId?: string;
    });

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
    process.stderr.write(
      `error: option '${repeated}' may only be specified once\n`
    );
    return 2;
  }

  let exitCode = 0;
  const program = new Command()
    .name("test-evidence-ledger.mjs")
    .description("Validate and query the Test–Case evidence ledger.")
    .allowExcessArguments(false)
    .exitOverride()
    .addOption(
      new Option(
        "--root <workspace-root>",
        `Workspace root containing ${testEvidenceLedgerPath}.`
      )
        .makeOptionMandatory()
        .argParser(parseNonEmptyText)
    )
    .option("--json", "Write the command result as JSON.")
    .configureOutput({
      writeErr: (text) => process.stderr.write(text),
      writeOut: (text) => process.stdout.write(text)
    });

  const execute = async (args: LedgerCliArgs): Promise<void> => {
    exitCode = await runLedgerCommand(args);
  };

  const check = subcommand(
    program,
    "check",
    "Strictly validate the ledger sources and derived index."
  );
  check.action(() =>
    execute({
      ...commonCommandArgs(commandOptions(check)),
      command: "check"
    })
  );

  const syncIndex = subcommand(
    program,
    "sync-index",
    "Check or atomically rebuild the derived Case index."
  ).option("--write", "Atomically rebuild the index from current sources.");
  syncIndex.action(() => {
    const options = commandOptions(syncIndex);
    return execute({
      ...commonCommandArgs(options),
      command: "sync-index",
      write: options.write ?? false
    });
  });

  const list = addQueryOptions(
    subcommand(program, "list", "List compact Case summaries.")
  )
    .addOption(
      new Option(
        "--test <test-id>",
        "Filter Cases by one known Test ID."
      ).argParser(parseTestId)
    )
    .addOption(
      new Option("--tag <tag>", "Filter Cases by one Tag.").argParser(parseTag)
    );
  list.action(() => {
    const options = commandOptions(list);
    return execute({
      ...commonCommandArgs(options),
      ...queryCommandArgs(options),
      command: "list",
      tag: options.tag,
      testId: options.test
    });
  });

  const show = subcommand(
    program,
    "show",
    "Show one authoritative Case and its current Test details."
  ).argument("<case-id>", "Case ID to show.", parseCaseId);
  show.action((caseId: string) =>
    execute({
      ...commonCommandArgs(commandOptions(show)),
      caseId,
      command: "show"
    })
  );

  const tests = addQueryOptions(
    subcommand(
      program,
      "tests",
      "List Test entities and derived Case memberships."
    )
  );
  tests.action(() => {
    const options = commandOptions(tests);
    return execute({
      ...commonCommandArgs(options),
      ...queryCommandArgs(options),
      command: "tests"
    });
  });

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
  return match(args)
    .with({ command: "check" }, runCheckCommand)
    .with({ command: "sync-index" }, runSyncIndexCommand)
    .with({ command: "show" }, runShowCommand)
    .with({ command: "tests" }, runTestsCommand)
    .with({ command: "list" }, runListCommand)
    .exhaustive();
}

async function runCheckCommand(
  args: Extract<LedgerCliArgs, { command: "check" }>
): Promise<number> {
  const result = await validateTestEvidenceLedger({
    workspaceRoot: args.workspaceRoot
  });
  writeOutput(formatLedgerReport(result, args.json));
  return hasBlockingTestEvidenceDiagnostics(result.diagnostics) ? 1 : 0;
}

async function runSyncIndexCommand(
  args: Extract<LedgerCliArgs, { command: "sync-index" }>
): Promise<number> {
  const result = await syncTestEvidenceLedgerIndex({
    workspaceRoot: args.workspaceRoot,
    mode: args.write ? "write" : "check"
  });
  writeOutput(formatLedgerSync(result, args.json));
  return result.status === "ok" ? 0 : 1;
}

async function runShowCommand(
  args: Extract<LedgerCliArgs, { command: "show" }>
): Promise<number> {
  const result = await showTestEvidenceCase({
    workspaceRoot: args.workspaceRoot,
    caseId: args.caseId
  });
  writeOutput(formatLedgerCaseShow(result, args.json));
  return hasBlockingTestEvidenceDiagnostics(result.diagnostics) ? 1 : 0;
}

async function runTestsCommand(
  args: Extract<LedgerCliArgs, { command: "tests" }>
): Promise<number> {
  const result = await queryTestEntities({
    workspaceRoot: args.workspaceRoot,
    query: args.query,
    limit: args.limit,
    offset: args.offset
  });
  writeOutput(formatLedgerTestQuery(result, args.json));
  return hasBlockingTestEvidenceDiagnostics(result.diagnostics) ? 1 : 0;
}

async function runListCommand(
  args: Extract<LedgerCliArgs, { command: "list" }>
): Promise<number> {
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
  )
    ? 2
    : 1;
}

function commandOptions(commandNode: Command): ParsedOptions {
  return commandNode.optsWithGlobals<ParsedOptions>();
}

function commonCommandArgs(options: ParsedOptions): LedgerCliCommonArgs {
  return {
    json: options.json ?? false,
    workspaceRoot: path.resolve(options.root)
  };
}

function queryCommandArgs(
  options: ParsedOptions
): Omit<LedgerCliQueryArgs, keyof LedgerCliCommonArgs> {
  return {
    limit: options.limit ?? testEvidenceLedgerQueryDefaultLimit,
    offset: options.offset ?? 0,
    query: options.query
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
    .addOption(
      new Option("--limit <count>", "Maximum items to return.")
        .argParser(parsePositiveInteger)
        .default(testEvidenceLedgerQueryDefaultLimit)
    )
    .addOption(
      new Option("--offset <count>", "Items to skip before returning results.")
        .argParser(parseNonNegativeInteger)
        .default(0)
    )
    .addOption(
      new Option(
        "--query <text>",
        "Require every search term to match."
      ).argParser(parseNonEmptyText)
    );
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
    throw new InvalidArgumentError("must contain a non-whitespace character");
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
  schema:
    | typeof testEntityIdSchema
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
    const occurrences = argv.filter(
      (argument) => argument === option || argument.startsWith(`${option}=`)
    ).length;
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
