import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import {
  Command,
  CommanderError,
  InvalidArgumentError,
  Option
} from "commander";
import { isMainModule } from "../../shared/src/node/main-module.ts";
import {
  formatTestEvidenceCaseListOutput,
  formatTestEvidenceCaseShowOutput,
  formatTestEvidenceCliOutput,
  formatTestEvidenceIndexSyncOutput,
  formatTestEvidenceQueryFailureOutput,
  type TestEvidenceCliOutput
} from "./cli-output.ts";
import { createDiagnostic, hasBlockingDiagnostics } from "./diagnostics.ts";
import { parseTestEntryInventory } from "./inventory.ts";
import { showTestEvidenceCase } from "./case-show.ts";
import {
  queryTestEvidenceLedger,
  testEvidenceQueryDefaultLimit
} from "./query.ts";
import {
  testEntryInventorySchema,
  testEvidenceCaseShowResultSchema,
  testEvidenceIndexSyncResultSchema,
  testEvidenceInspectionSchema,
  testEvidenceLedgerConfigSchema,
  testEvidenceQueryResultSchema,
  testEvidenceReportSchema,
  testEvidenceStateIndexSchema
} from "./schemas.ts";
import type {
  CaseStatus,
  TestEvidenceDiagnostic,
  VerificationMode
} from "./types.ts";
import { syncTestEvidenceIndex } from "./state-index.ts";
import {
  createTestEvidenceReport,
  inspectTestEvidenceLedger,
  validateTestEvidenceLedger,
  type ValidateTestEvidenceLedgerOptions
} from "./validation.ts";

type LedgerCommand = "check" | "list" | "show" | "sync-index";
type ParsedOptions = {
  config?: string;
  inventory?: string;
  json?: boolean;
  limit?: number;
  offset?: number;
  query?: string;
  root?: string;
  status?: CaseStatus | "all";
  triggered?: boolean;
  verification?: VerificationMode | "all";
  write?: boolean;
};
type LedgerCliArgs = {
  caseId: string | null;
  command: LedgerCommand;
  configPath?: string;
  inventoryPath: string | null;
  json: boolean;
  limit: number;
  offset: number;
  query?: string;
  status: CaseStatus | "all";
  triggered: boolean;
  verification: VerificationMode | "all";
  workspaceRoot: string;
  write: boolean;
};
type InventoryReadResult =
  | { kind: "success"; value: unknown }
  | { diagnostic: TestEvidenceDiagnostic; kind: "failure" };

export async function runTestEvidenceLedgerCli(
  argv: readonly string[] = process.argv.slice(2)
): Promise<number> {
  let exitCode = 0;
  const program = new Command()
    .name("test-evidence-ledger")
    .description("Validate and query an indexed test-evidence ledger.")
    .option(
      "--root <path>",
      "Target workspace root (default: current directory)."
    )
    .option(
      "--config <path>",
      "Workspace-relative ledger config (default: .test-evidence.json)."
    )
    .option("--json", "Write one machine-readable result to stdout.")
    .configureHelp({ showGlobalOptions: true })
    .showHelpAfterError()
    .addHelpText(
      "afterAll",
      "\nExit codes:\n"
        + "  0  Success; queries may include non-blocking diagnostics.\n"
        + "  1  Blocking validation diagnostic, query failure, or execution failure.\n"
        + "  2  Invalid arguments."
    )
    .exitOverride();

  const execute = async (
    command: LedgerCommand,
    commandNode: Command,
    caseId: string | null = null
  ): Promise<void> => {
    exitCode = await runLedgerCommand(commandArgs(
      command,
      commandNode,
      caseId
    ));
  };
  const check = inventorySubcommand(
    program,
    "check",
    "Strictly validate the ledger against the supplied inventory "
      + "(default when omitted).",
    true
  );
  check.action(() => execute("check", check));
  const list = subcommand(
    program,
    "list",
    "List compact case summaries from the current derived index."
  )
    .addOption(new Option("--status <value>", "Case status filter.")
      .choices(["active", "planned", "all"])
      .default("all"))
    .addOption(new Option("--verification <value>", "Verification mode filter.")
      .choices(["automated", "review", "exempt", "all"])
      .default("all"))
    .addOption(new Option("--limit <count>", "Maximum cases to return.")
      .argParser(parsePositiveInteger)
      .default(testEvidenceQueryDefaultLimit))
    .addOption(new Option("--offset <count>", "Cases to skip before returning results.")
      .argParser(parseNonNegativeInteger)
      .default(0))
    .addOption(new Option(
      "--query <text>",
      "Search case ID, title, summary, Code, or Scope text."
    ).argParser(parseNonEmptyText))
    .option("--triggered", "Only list cases with an active review trigger.");
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
    "Check or rebuild the derived test-evidence state index."
  ).option("--write", "Atomically rebuild the index from the current catalog.");
  syncIndex.action(() => execute("sync-index", syncIndex));

  try {
    await program.parseAsync(["node", "test-evidence-ledger.mjs", ...argv]);
  } catch (error) {
    if (error instanceof CommanderError) {
      return error.exitCode === 0 ? 0 : 2;
    }
    console.error(error instanceof Error ? error.message : String(error));
    return 1;
  }
  return exitCode;
}

async function runLedgerCommand(args: LedgerCliArgs): Promise<number> {
  if (args.command === "sync-index") {
    const result = await syncTestEvidenceIndex({
      configPath: args.configPath,
      mode: args.write ? "write" : "check",
      workspaceRoot: path.resolve(args.workspaceRoot)
    });
    writeOutput(formatTestEvidenceIndexSyncOutput(result, args.json));
    return result.status === "ok" ? 0 : 1;
  }
  if (args.command === "check") {
    if (args.inventoryPath === null) {
      throw new TypeError("check requires --inventory");
    }
    const inventoryInput = await readInventory(args.inventoryPath);
    if (inventoryInput.kind === "failure") {
      writeOutput(formatTestEvidenceCliOutput(
        createTestEvidenceReport([inventoryInput.diagnostic]),
        args.json
      ));
      return 1;
    }
    const options: ValidateTestEvidenceLedgerOptions = {
      configPath: args.configPath,
      inventory: inventoryInput.value,
      inventorySource: args.inventoryPath === "-" ? "stdin" : args.inventoryPath,
      workspaceRoot: path.resolve(args.workspaceRoot)
    };
    const report = await validateTestEvidenceLedger(options);
    writeOutput(formatTestEvidenceCliOutput(report, args.json));
    return hasBlockingDiagnostics(report.diagnostics) ? 1 : 0;
  }

  if (args.command === "show") {
    const result = await showTestEvidenceCase({
      caseId: args.caseId ?? "",
      configPath: args.configPath,
      workspaceRoot: path.resolve(args.workspaceRoot)
    });
    writeOutput(formatTestEvidenceCaseShowOutput(result, args.json));
    return hasBlockingDiagnostics(result.diagnostics) ? 1 : 0;
  }

  const result = await queryTestEvidenceLedger({
    configPath: args.configPath,
    limit: args.limit,
    offset: args.offset,
    query: args.query,
    status: args.status,
    triggered: args.triggered,
    verification: args.verification,
    workspaceRoot: path.resolve(args.workspaceRoot)
  });
  if (hasBlockingDiagnostics(result.diagnostics)) {
    writeOutput(formatTestEvidenceQueryFailureOutput(result, args.json));
    return 1;
  }
  writeOutput(formatTestEvidenceCaseListOutput(result, args.json));
  return 0;
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
    configPath: options.config,
    inventoryPath: options.inventory ?? null,
    json: options.json ?? false,
    limit: options.limit ?? testEvidenceQueryDefaultLimit,
    offset: options.offset ?? 0,
    query: options.query,
    status: options.status ?? "all",
    triggered: options.triggered ?? false,
    verification: options.verification ?? "all",
    workspaceRoot: options.root ?? process.cwd(),
    write: options.write ?? false
  };
}

function inventorySubcommand(
  program: Command,
  nameAndArgs: string,
  description: string,
  isDefault = false
): Command {
  return subcommand(program, nameAndArgs, description, isDefault)
    .requiredOption(
      "--inventory <path>",
      "Inventory JSON file, or - to read it from stdin."
    );
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
    throw new InvalidArgumentError("must contain a non-whitespace character");
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

async function readInventory(inventoryPath: string): Promise<InventoryReadResult> {
  const source = inventoryPath === "-" ? "stdin" : inventoryPath;
  let text: string;
  try {
    text = inventoryPath === "-"
      ? await readStdin()
      : await fs.readFile(path.resolve(inventoryPath), "utf8");
  } catch (error) {
    return inventoryReadFailure({
      code: isMissingFileError(error) ? "inventory.not-found" : "inventory.read-failed",
      error,
      message: `${source} could not be read`,
      source: inventoryPath === "-" ? undefined : inventoryPath
    });
  }
  try {
    return { kind: "success", value: JSON.parse(text) as unknown };
  } catch (error) {
    return inventoryReadFailure({
      code: "inventory.json-invalid",
      error,
      message: `${source} must contain valid JSON`,
      source: inventoryPath === "-" ? undefined : inventoryPath
    });
  }
}

function inventoryReadFailure(options: {
  code: string;
  error: unknown;
  message: string;
  source?: string;
}): InventoryReadResult {
  return {
    diagnostic: createDiagnostic({
      category: "inventory",
      code: options.code,
      message: `${options.message}: ${errorMessage(options.error)}`,
      path: options.source,
      severity: "error"
    }),
    kind: "failure"
  };
}

async function readStdin(): Promise<string> {
  process.stdin.setEncoding("utf8");
  let text = "";
  for await (const chunk of process.stdin) {
    text += chunk;
  }
  return text;
}

function isMissingFileError(error: unknown): boolean {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
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
  inspectTestEvidenceLedger,
  parseTestEntryInventory,
  queryTestEvidenceLedger,
  showTestEvidenceCase,
  syncTestEvidenceIndex,
  testEntryInventorySchema,
  testEvidenceCaseShowResultSchema,
  testEvidenceIndexSyncResultSchema,
  testEvidenceInspectionSchema,
  testEvidenceLedgerConfigSchema,
  testEvidenceQueryResultSchema,
  testEvidenceReportSchema,
  testEvidenceStateIndexSchema,
  validateTestEvidenceLedger
};
export type { ValidateTestEvidenceLedgerOptions };
export type {
  TestEntryInventory,
  TestEvidenceCaseShowResult,
  TestEvidenceInspection,
  TestEvidenceIndexSyncResult,
  TestEvidenceLedgerConfig,
  TestEvidenceQueryResult,
  TestEvidenceReport,
  TestEvidenceStateIndex
} from "./types.ts";
export type {
  QueryTestEvidenceLedgerOptions
} from "./query.ts";
export type { ShowTestEvidenceCaseOptions } from "./case-show.ts";
export type { SyncTestEvidenceIndexOptions } from "./state-index.ts";

if (isMainModule(import.meta.url)) {
  process.exitCode = await runTestEvidenceLedgerCli();
}
