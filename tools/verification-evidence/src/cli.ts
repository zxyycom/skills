import path from "node:path";
import process from "node:process";
import {
  Command,
  CommanderError,
  InvalidArgumentError,
  Option
} from "commander";
import { isMainModule } from "../../shared/src/node/main-module.ts";
import { showVerificationCase } from "./case-show.ts";
import {
  formatVerificationCaseList,
  formatVerificationCaseShow,
  formatVerificationEvidenceIndexSync,
  formatVerificationEvidenceReport,
  formatVerificationQueryFailure,
  type VerificationEvidenceCliOutput
} from "./cli-output.ts";
import { hasBlockingDiagnostics } from "./diagnostics.ts";
import {
  queryVerificationEvidence,
  verificationEvidenceQueryDefaultLimit
} from "./query.ts";
import {
  verificationCaseShowResultSchema,
  verificationEvidenceConfigSchema,
  verificationEvidenceIndexSyncResultSchema,
  verificationEvidenceQueryResultSchema,
  verificationEvidenceReportSchema,
  verificationEvidenceStateIndexSchema
} from "./schemas.ts";
import { syncVerificationEvidenceIndex } from "./state-index.ts";
import type { VerificationKind } from "./types.ts";
import {
  validateVerificationEvidence,
  type ValidateVerificationEvidenceOptions
} from "./validation.ts";

type CatalogCommand = "check" | "list" | "show" | "sync-index";
type ParsedOptions = {
  config?: string;
  json?: boolean;
  limit?: number;
  offset?: number;
  query?: string;
  root?: string;
  verification?: VerificationKind | "all";
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
  verification: VerificationKind | "all";
  workspaceRoot: string;
  write: boolean;
};

export async function runVerificationCatalogCli(
  argv: readonly string[] = process.argv.slice(2)
): Promise<number> {
  let exitCode = 0;
  const program = new Command()
    .name("verification-catalog")
    .description(
      "Validate and query indexed test and engineering-check evidence."
    )
    .option(
      "--root <path>",
      "Target workspace root (default: current directory)."
    )
    .option(
      "--config <path>",
      "Workspace-relative config (default: .verification-evidence.json)."
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
    "List compact case summaries from the current derived index."
  )
    .addOption(new Option(
      "--verification <value>",
      "Verification implementation filter."
    ).choices(["test", "check", "all"]).default("all"))
    .addOption(new Option(
      "--limit <count>",
      "Maximum cases to return."
    ).argParser(parsePositiveInteger).default(verificationEvidenceQueryDefaultLimit))
    .addOption(new Option(
      "--offset <count>",
      "Cases to skip before returning results."
    ).argParser(parseNonNegativeInteger).default(0))
    .addOption(new Option(
      "--query <text>",
      "Search case ID, title, contract summary, or Entry text."
    ).argParser(parseNonEmptyText));
  list.action(() => execute("list", list));

  const show = subcommand(
    program,
    "show <case-id>",
    "Show one indexed case and its original Markdown body."
  );
  show.action((caseId: string) => execute("show", show, caseId));

  const syncIndex = subcommand(
    program,
    "sync-index",
    "Check or rebuild the derived verification-evidence index."
  ).option("--write", "Atomically rebuild the index from the current catalog.");
  syncIndex.action(() => execute("sync-index", syncIndex));

  try {
    await program.parseAsync(["node", "verification-catalog.mjs", ...argv]);
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
    const result = await syncVerificationEvidenceIndex({
      configPath: args.configPath,
      mode: args.write ? "write" : "check",
      workspaceRoot: path.resolve(args.workspaceRoot)
    });
    writeOutput(formatVerificationEvidenceIndexSync(result, args.json));
    return result.status === "ok" ? 0 : 1;
  }

  if (args.command === "check") {
    const report = await validateVerificationEvidence({
      configPath: args.configPath,
      workspaceRoot: path.resolve(args.workspaceRoot)
    });
    writeOutput(formatVerificationEvidenceReport(report, args.json));
    return hasBlockingDiagnostics(report.diagnostics) ? 1 : 0;
  }

  if (args.command === "show") {
    const result = await showVerificationCase({
      caseId: args.caseId ?? "",
      configPath: args.configPath,
      workspaceRoot: path.resolve(args.workspaceRoot)
    });
    writeOutput(formatVerificationCaseShow(result, args.json));
    return hasBlockingDiagnostics(result.diagnostics) ? 1 : 0;
  }

  const result = await queryVerificationEvidence({
    configPath: args.configPath,
    limit: args.limit,
    offset: args.offset,
    query: args.query,
    verification: args.verification,
    workspaceRoot: path.resolve(args.workspaceRoot)
  });
  if (hasBlockingDiagnostics(result.diagnostics)) {
    writeOutput(formatVerificationQueryFailure(result, args.json));
    return 1;
  }
  writeOutput(formatVerificationCaseList(result, args.json));
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
    limit: options.limit ?? verificationEvidenceQueryDefaultLimit,
    offset: options.offset ?? 0,
    query: options.query,
    verification: options.verification ?? "all",
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

function writeOutput(output: VerificationEvidenceCliOutput): void {
  if (output.stderr.length > 0) {
    process.stderr.write(output.stderr);
  }
  if (output.stdout.length > 0) {
    process.stdout.write(output.stdout);
  }
}

export {
  queryVerificationEvidence,
  showVerificationCase,
  syncVerificationEvidenceIndex,
  validateVerificationEvidence,
  verificationCaseShowResultSchema,
  verificationEvidenceConfigSchema,
  verificationEvidenceIndexSyncResultSchema,
  verificationEvidenceQueryResultSchema,
  verificationEvidenceReportSchema,
  verificationEvidenceStateIndexSchema
};
export type { ValidateVerificationEvidenceOptions };
export type {
  VerificationCaseShowResult,
  VerificationCaseState,
  VerificationEvidenceConfig,
  VerificationEvidenceIndexSyncResult,
  VerificationEvidenceReport,
  VerificationEvidenceStateIndex
} from "./types.ts";
export type { QueryVerificationEvidenceOptions } from "./query.ts";
export type { ShowVerificationCaseOptions } from "./case-show.ts";
export type {
  SyncVerificationEvidenceIndexOptions
} from "./state-index.ts";

if (isMainModule(import.meta.url)) {
  process.exitCode = await runVerificationCatalogCli();
}
