import path from "node:path";
import process from "node:process";
import {
  Command,
  CommanderError,
  InvalidArgumentError,
  Option
} from "commander";
import { isMainModule } from "../../shared/src/node/main-module.ts";
import { showTestEvidenceCase } from "./case-show.ts";
import {
  formatTestEvidenceCaseList,
  formatTestEvidenceCaseShow,
  formatTestEvidenceIndexSync,
  formatTestEvidenceQueryFailure,
  formatTestEvidenceReport,
  type TestEvidenceCliOutput
} from "./cli-output.ts";
import { hasBlockingDiagnostics } from "./diagnostics.ts";
import {
  queryTestEvidence,
  testEvidenceQueryDefaultLimit
} from "./query.ts";
import {
  testEvidenceCaseShowResultSchema,
  testEvidenceConfigSchema,
  testEvidenceIndexSyncResultSchema,
  testEvidenceQueryResultSchema,
  testEvidenceReportSchema,
  testEvidenceStateIndexSchema
} from "./schemas.ts";
import { syncTestEvidenceIndex } from "./state-index.ts";
import {
  validateTestEvidence,
  type ValidateTestEvidenceOptions
} from "./validation.ts";

type CatalogCommand = "check" | "list" | "show" | "sync-index";
type ParsedOptions = {
  config?: string;
  json?: boolean;
  limit?: number;
  offset?: number;
  query?: string;
  root?: string;
  write?: boolean;
};
type CatalogCliArgs = {
  caseId: string | null;
  command: CatalogCommand;
  configPath?: string;
  json: boolean;
  limit: number;
  offset: number;
  query?: string;
  workspaceRoot: string;
  write: boolean;
};

export async function runTestEvidenceCatalogCli(
  argv: readonly string[] = process.argv.slice(2)
): Promise<number> {
  let exitCode = 0;
  const program = new Command()
    .name("test-evidence-catalog")
    .description(
      "Validate and query indexed test evidence."
    )
    .option(
      "--root <path>",
      "Target workspace root (default: current directory)."
    )
    .option(
      "--config <path>",
      "Workspace-relative config (default: .test-evidence.json)."
    )
    .option("--json", "Write one machine-readable result to stdout.")
    .configureHelp({ showGlobalOptions: true })
    .showHelpAfterError()
    .addHelpText(
      "afterAll",
      "\nExit codes:\n"
        + "  0  Success.\n"
        + "  1  Blocking validation diagnostic or query failure.\n"
        + "  2  Invalid arguments."
    )
    .exitOverride();

  const execute = async (
    command: CatalogCommand,
    commandNode: Command,
    caseId: string | null = null
  ): Promise<void> => {
    exitCode = await runCatalogCommand(commandArgs(
      command,
      commandNode,
      caseId
    ));
  };

  const check = subcommand(
    program,
    "check",
    "Strictly validate the catalog and derived index.",
    true
  );
  check.action(() => execute("check", check));

  const list = subcommand(
    program,
    "list",
    "List compact case summaries from the current catalog."
  )
    .addOption(new Option(
      "--limit <count>",
      "Maximum cases to return."
    ).argParser(parsePositiveInteger).default(testEvidenceQueryDefaultLimit))
    .addOption(new Option(
      "--offset <count>",
      "Cases to skip before returning results."
    ).argParser(parseNonNegativeInteger).default(0))
    .addOption(new Option(
      "--query <text>",
      "Search case ID, title, Contract, Proves, or Entry text."
    ).argParser(parseNonEmptyText));
  list.action(() => execute("list", list));

  const show = subcommand(
    program,
    "show <case-id>",
    "Show one case and its original Markdown body."
  );
  show.action((caseId: string) => execute("show", show, caseId));

  const syncIndex = subcommand(
    program,
    "sync-index",
    "Check or rebuild the derived test-evidence index."
  ).option("--write", "Atomically rebuild the index from the current catalog.");
  syncIndex.action(() => execute("sync-index", syncIndex));

  try {
    await program.parseAsync(["node", "test-evidence-catalog.mjs", ...argv]);
  } catch (error) {
    if (error instanceof CommanderError) {
      return error.exitCode === 0 ? 0 : 2;
    }
    console.error(error instanceof Error ? error.message : String(error));
    return 1;
  }
  return exitCode;
}

async function runCatalogCommand(args: CatalogCliArgs): Promise<number> {
  if (args.command === "sync-index") {
    const result = await syncTestEvidenceIndex({
      configPath: args.configPath,
      mode: args.write ? "write" : "check",
      workspaceRoot: path.resolve(args.workspaceRoot)
    });
    writeOutput(formatTestEvidenceIndexSync(result, args.json));
    return result.status === "ok" ? 0 : 1;
  }

  if (args.command === "check") {
    const report = await validateTestEvidence({
      configPath: args.configPath,
      workspaceRoot: path.resolve(args.workspaceRoot)
    });
    writeOutput(formatTestEvidenceReport(report, args.json));
    return hasBlockingDiagnostics(report.diagnostics) ? 1 : 0;
  }

  if (args.command === "show") {
    const result = await showTestEvidenceCase({
      caseId: args.caseId ?? "",
      configPath: args.configPath,
      workspaceRoot: path.resolve(args.workspaceRoot)
    });
    writeOutput(formatTestEvidenceCaseShow(result, args.json));
    return hasBlockingDiagnostics(result.diagnostics) ? 1 : 0;
  }

  const result = await queryTestEvidence({
    configPath: args.configPath,
    limit: args.limit,
    offset: args.offset,
    query: args.query,
    workspaceRoot: path.resolve(args.workspaceRoot)
  });
  if (hasBlockingDiagnostics(result.diagnostics)) {
    writeOutput(formatTestEvidenceQueryFailure(result, args.json));
    return 1;
  }
  writeOutput(formatTestEvidenceCaseList(result, args.json));
  return 0;
}

function commandArgs(
  command: CatalogCommand,
  commandNode: Command,
  caseId: string | null
): CatalogCliArgs {
  const options = commandNode.optsWithGlobals<ParsedOptions>();
  return {
    caseId,
    command,
    configPath: options.config,
    json: options.json ?? false,
    limit: options.limit ?? testEvidenceQueryDefaultLimit,
    offset: options.offset ?? 0,
    query: options.query,
    workspaceRoot: options.root ?? process.cwd(),
    write: options.write ?? false
  };
}

function subcommand(
  program: Command,
  nameAndArgs: string,
  description: string,
  isDefault = false
): Command {
  return program
    .command(nameAndArgs, { isDefault })
    .description(description)
    .allowExcessArguments(false)
    .exitOverride();
}

function parsePositiveInteger(value: string): number {
  const parsed = parseCliInteger(value);
  if (parsed < 1) {
    throw new InvalidArgumentError("must be a positive integer");
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

function parseNonEmptyText(value: string): string {
  const parsed = value.trim();
  if (parsed.length === 0) {
    throw new InvalidArgumentError(
      "must contain a non-whitespace character"
    );
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

function writeOutput(output: TestEvidenceCliOutput): void {
  if (output.stderr.length > 0) {
    process.stderr.write(output.stderr);
  }
  if (output.stdout.length > 0) {
    process.stdout.write(output.stdout);
  }
}

export {
  queryTestEvidence,
  showTestEvidenceCase,
  syncTestEvidenceIndex,
  validateTestEvidence,
  testEvidenceCaseShowResultSchema,
  testEvidenceConfigSchema,
  testEvidenceIndexSyncResultSchema,
  testEvidenceQueryResultSchema,
  testEvidenceReportSchema,
  testEvidenceStateIndexSchema
};
export type { ValidateTestEvidenceOptions };
export type {
  TestEvidenceCaseShowResult,
  TestEvidenceCaseState,
  TestEvidenceConfig,
  TestEvidenceIndexSyncResult,
  TestEvidenceReport,
  TestEvidenceStateIndex
} from "./types.ts";
export type { QueryTestEvidenceOptions } from "./query.ts";
export type { ShowTestEvidenceCaseOptions } from "./case-show.ts";
export type {
  SyncTestEvidenceIndexOptions
} from "./state-index.ts";

if (isMainModule(import.meta.url)) {
  process.exitCode = await runTestEvidenceCatalogCli();
}
