import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { Command, CommanderError, Option } from "commander";
import { isMainModule } from "../../shared/src/node/main-module.ts";
import {
  formatTestEvidenceCaseListOutput,
  formatTestEvidenceCaseShowOutput,
  formatTestEvidenceCliOutput,
  formatTestEvidenceQueryFailureOutput,
  type TestEvidenceCliOutput
} from "./cli-output.ts";
import { createDiagnostic, hasBlockingDiagnostics } from "./diagnostics.ts";
import { parseTestEntryInventory } from "./inventory.ts";
import {
  createQueryFailureResult,
  createQueryResult,
  querySourceAvailable
} from "./query.ts";
import {
  testEntryInventorySchema,
  testEvidenceInspectionSchema,
  testEvidenceLedgerConfigSchema,
  testEvidenceQueryResultSchema,
  testEvidenceReportSchema
} from "./schemas.ts";
import type {
  CaseStatus,
  TestEvidenceDiagnostic,
  VerificationMode
} from "./types.ts";
import {
  createTestEvidenceReport,
  inspectTestEvidenceLedger,
  validateTestEvidenceLedger,
  type ValidateTestEvidenceLedgerOptions
} from "./validation.ts";

type LedgerCommand = "check" | "list" | "show";
type ParsedOptions = {
  config?: string;
  inventory: string;
  json?: boolean;
  root?: string;
  status?: CaseStatus | "all";
  triggered?: boolean;
  verification?: VerificationMode | "all";
};
type LedgerCliArgs = {
  caseId: string | null;
  command: LedgerCommand;
  configPath?: string;
  inventoryPath: string;
  json: boolean;
  status: CaseStatus | "all";
  triggered: boolean;
  verification: VerificationMode | "all";
  workspaceRoot: string;
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
    .description("Validate and query a test-evidence ledger from a standard inventory.")
    .option(
      "--root <path>",
      "Target workspace root (default: current directory)."
    )
    .option(
      "--config <path>",
      "Workspace-relative ledger config (default: .test-evidence.json)."
    )
    .requiredOption(
      "--inventory <path>",
      "Inventory JSON file, or - to read it from stdin."
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
  const check = subcommand(
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
    "List recoverable ledger cases and inventory mappings."
  )
    .addOption(new Option("--status <value>", "Case status filter.")
      .choices(["active", "planned", "all"])
      .default("all"))
    .addOption(new Option("--verification <value>", "Verification mode filter.")
      .choices(["automated", "review", "exempt", "all"])
      .default("all"))
    .option("--triggered", "Only list cases with an active review trigger.");
  list.action(() => execute("list", list));
  const show = subcommand(
    program,
    "show <case-id>",
    "Show one ledger case and its inventory mappings."
  );
  show.action((caseId: string) => execute("show", show, caseId));

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
  const inventoryInput = await readInventory(args.inventoryPath);
  if (inventoryInput.kind === "failure") {
    if (args.command === "check") {
      writeOutput(formatTestEvidenceCliOutput(
        createTestEvidenceReport([inventoryInput.diagnostic]),
        args.json
      ));
      return 1;
    }
    return writeQueryFailure([inventoryInput.diagnostic], args.json);
  }
  const options: ValidateTestEvidenceLedgerOptions = {
    configPath: args.configPath,
    inventory: inventoryInput.value,
    inventorySource: args.inventoryPath === "-" ? "stdin" : args.inventoryPath,
    workspaceRoot: path.resolve(args.workspaceRoot)
  };
  if (args.command === "check") {
    const report = await validateTestEvidenceLedger(options);
    writeOutput(formatTestEvidenceCliOutput(report, args.json));
    return hasBlockingDiagnostics(report.diagnostics) ? 1 : 0;
  }

  const inspection = await inspectTestEvidenceLedger(options);
  if (!querySourceAvailable(inspection)) {
    return writeQueryFailure(inspection.report.diagnostics, args.json);
  }
  if (args.command === "list") {
    const cases = inspection.cases.filter((entry) =>
      (args.status === "all" || entry.status === args.status)
      && (args.verification === "all" || entry.verification === args.verification)
      && (!args.triggered || entry.trigger !== null)
    );
    writeOutput(formatTestEvidenceCaseListOutput(
      createQueryResult(inspection, cases),
      args.json,
      inspection.catalogPath
    ));
    return 0;
  }

  const matches = inspection.cases.filter((entry) => entry.id === args.caseId);
  if (matches.length !== 1) {
    const message = matches.length === 0
      ? `Test evidence case does not exist: ${args.caseId}`
      : `Test evidence case ID is ambiguous: ${args.caseId}`;
    const result = createQueryResult(inspection, [], [createDiagnostic({
      caseId: args.caseId ?? undefined,
      category: "catalog",
      code: matches.length === 0 ? "catalog.case-missing" : "catalog.case-ambiguous",
      message,
      severity: "error"
    })]);
    writeOutput(formatTestEvidenceQueryFailureOutput(result, args.json));
    return 1;
  }
  writeOutput(formatTestEvidenceCaseShowOutput(
    createQueryResult(inspection, matches),
    args.json,
    inspection.catalogPath
  ));
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
    inventoryPath: options.inventory,
    json: options.json ?? false,
    status: options.status ?? "all",
    triggered: options.triggered ?? false,
    verification: options.verification ?? "all",
    workspaceRoot: options.root ?? process.cwd()
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

function writeQueryFailure(
  diagnostics: readonly TestEvidenceDiagnostic[],
  json: boolean
): number {
  const result = createQueryFailureResult(diagnostics);
  writeOutput(formatTestEvidenceQueryFailureOutput(result, json));
  return 1;
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
  testEntryInventorySchema,
  testEvidenceInspectionSchema,
  testEvidenceLedgerConfigSchema,
  testEvidenceQueryResultSchema,
  testEvidenceReportSchema,
  validateTestEvidenceLedger
};
export type { ValidateTestEvidenceLedgerOptions };
export type {
  TestEntryInventory,
  TestEvidenceInspection,
  TestEvidenceLedgerConfig,
  TestEvidenceQueryResult,
  TestEvidenceReport
} from "./types.ts";

if (isMainModule(import.meta.url)) {
  process.exitCode = await runTestEvidenceLedgerCli();
}
