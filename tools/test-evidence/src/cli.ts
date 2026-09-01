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
  formatTestEvidenceIndexStage,
  formatTestEvidenceIndexSync,
  formatTestEvidenceQueryFailure,
  formatTestEvidenceReport,
  formatTestEvidenceTopics,
  type TestEvidenceCliOutput
} from "./cli-output.ts";
import { hasBlockingDiagnostics } from "./diagnostics.ts";
import { queryTestEvidence, testEvidenceQueryDefaultLimit } from "./query.ts";
import {
  testEvidenceCaseShowResultSchema,
  testEvidenceIndexStageResultSchema,
  testEvidenceIndexSyncResultSchema,
  testEvidenceQueryResultSchema,
  testEvidenceReportSchema,
  testEvidenceStateIndexSchema,
  testEvidenceTopicCatalogSchema,
  testEvidenceTopicsResultSchema
} from "./schemas.ts";
import { syncTestEvidenceIndex } from "./state-index.ts";
import {
  executeTestEvidenceIndexStage,
  stageTestEvidenceIndex
} from "./staging.ts";
import {
  validateTestEvidence,
  type ValidateTestEvidenceOptions
} from "./validation.ts";
import {
  listTestEvidenceTopics,
  type ListTestEvidenceTopicsOptions
} from "./topics.ts";

type ParsedOptions = {
  json?: boolean;
  limit?: number;
  offset?: number;
  query?: string;
  root?: string;
  topic?: string;
  write?: boolean;
};
type CatalogCliBase = Readonly<{
  json: boolean;
  workspaceRoot: string;
}>;
type CatalogCliArgs = CatalogCliBase &
  (
    | Readonly<{ command: "check" }>
    | Readonly<{
        command: "list";
        limit: number;
        offset: number;
        query?: string;
        topic?: string;
      }>
    | Readonly<{
        caseId: string;
        command: "show";
      }>
    | Readonly<{
        caseIds: readonly string[];
        command: "stage-index";
      }>
    | Readonly<{
        command: "sync-index";
        write: boolean;
      }>
    | Readonly<{ command: "topics" }>
  );

type CatalogCliIo = Readonly<{
  stderr: (text: string) => void;
  stdout: (text: string) => void;
}>;

export type TestEvidenceCatalogCliOptions = Readonly<{
  cwd?: string;
  io?: CatalogCliIo;
}>;

export async function runTestEvidenceCatalogCli(
  argv: readonly string[] = process.argv.slice(2),
  options: TestEvidenceCatalogCliOptions = {}
): Promise<number> {
  const cwd = options.cwd ?? process.cwd();
  const io = options.io ?? {
    stderr: (text: string) => process.stderr.write(text),
    stdout: (text: string) => process.stdout.write(text)
  };
  let exitCode = 0;
  const program = new Command()
    .name("test-evidence-catalog")
    .description(
      "Validate, query, and selectively stage indexed test evidence."
    )
    .option(
      "--root <path>",
      "Target workspace root (default: current directory)."
    )
    .option("--json", "Write one machine-readable result to stdout.")
    .configureHelp({ showGlobalOptions: true })
    .configureOutput({
      writeErr: io.stderr,
      writeOut: io.stdout
    })
    .showHelpAfterError()
    .addHelpText(
      "afterAll",
      "\nExit codes:\n" +
        "  0  Success.\n" +
        "  1  Validation, query, or operation failure.\n" +
        "  2  Invalid arguments."
    )
    .exitOverride();

  const execute = async (args: CatalogCliArgs): Promise<void> => {
    exitCode = await runCatalogCommand(args, io);
  };

  const check = subcommand(
    program,
    "check",
    "Strictly validate the catalog and derived index.",
    true
  );
  check.action(() =>
    execute({
      ...commandBase(check, cwd),
      command: "check"
    })
  );

  const list = subcommand(
    program,
    "list",
    "List compact case summaries from the current catalog."
  )
    .addOption(
      new Option("--limit <count>", "Maximum cases to return.")
        .argParser(parsePositiveInteger)
        .default(testEvidenceQueryDefaultLimit)
    )
    .addOption(
      new Option("--offset <count>", "Cases to skip before returning results.")
        .argParser(parseNonNegativeInteger)
        .default(0)
    )
    .addOption(
      new Option(
        "--query <text>",
        "Search case ID, title, Contract, Proves, or Entry text."
      ).argParser(parseNonEmptyText)
    )
    .addOption(
      new Option(
        "--topic <topic-id>",
        "Filter cases by one defined test-evidence topic."
      ).argParser(parseSingleTopic)
    );
  list.action(() => execute(listCommandArgs(list, cwd)));

  const topics = subcommand(
    program,
    "topics",
    "List the authoritative test-evidence topic definitions."
  );
  topics.action(() =>
    execute({
      ...commandBase(topics, cwd),
      command: "topics"
    })
  );

  const show = subcommand(
    program,
    "show <case-id>",
    "Show one case and its original Markdown body."
  );
  show.action((caseId: string) =>
    execute({
      ...commandBase(show, cwd),
      caseId,
      command: "show"
    })
  );

  const stageIndex = subcommand(
    program,
    "stage-index <case-ids...>",
    "Stage only the selected case entries from the current workspace index."
  );
  stageIndex.addHelpText(
    "after",
    "\nTopic definitions, case Markdown, test code, and product code are not staged."
  );
  stageIndex.action((caseIds: string[]) =>
    execute({
      ...commandBase(stageIndex, cwd),
      caseIds,
      command: "stage-index"
    })
  );

  const syncIndex = subcommand(
    program,
    "sync-index",
    "Check or rebuild the derived test-evidence index."
  ).option("--write", "Atomically rebuild the index from the current catalog.");
  syncIndex.action(() => execute(syncCommandArgs(syncIndex, cwd)));

  try {
    await program.parseAsync(["node", "test-evidence-catalog.mjs", ...argv]);
  } catch (error) {
    if (error instanceof CommanderError) {
      return error.exitCode === 0 ? 0 : 2;
    }
    io.stderr(`${error instanceof Error ? error.message : String(error)}\n`);
    return 1;
  }
  return exitCode;
}

async function runCatalogCommand(
  args: CatalogCliArgs,
  io: CatalogCliIo
): Promise<number> {
  if (args.command === "stage-index") {
    const execution = await executeTestEvidenceIndexStage({
      caseIds: args.caseIds,
      workspaceRoot: args.workspaceRoot
    });
    return execution.match(
      (result) => {
        writeOutput(io, formatTestEvidenceIndexStage(result, args.json));
        return 0;
      },
      (failure) => {
        writeOutput(
          io,
          formatTestEvidenceIndexStage(failure.result, args.json)
        );
        return failure.kind === "invalid-arguments" ? 2 : 1;
      }
    );
  }

  if (args.command === "sync-index") {
    const result = await syncTestEvidenceIndex({
      mode: args.write ? "write" : "check",
      workspaceRoot: args.workspaceRoot
    });
    writeOutput(io, formatTestEvidenceIndexSync(result, args.json));
    return result.status === "ok" ? 0 : 1;
  }

  if (args.command === "check") {
    const report = await validateTestEvidence({
      workspaceRoot: args.workspaceRoot
    });
    writeOutput(io, formatTestEvidenceReport(report, args.json));
    return hasBlockingDiagnostics(report.diagnostics) ? 1 : 0;
  }

  if (args.command === "topics") {
    const result = await listTestEvidenceTopics({
      workspaceRoot: args.workspaceRoot
    });
    writeOutput(io, formatTestEvidenceTopics(result, args.json));
    return hasBlockingDiagnostics(result.diagnostics) ? 1 : 0;
  }

  if (args.command === "show") {
    const result = await showTestEvidenceCase({
      caseId: args.caseId,
      workspaceRoot: args.workspaceRoot
    });
    writeOutput(io, formatTestEvidenceCaseShow(result, args.json));
    return hasBlockingDiagnostics(result.diagnostics) ? 1 : 0;
  }

  const result = await queryTestEvidence({
    limit: args.limit,
    offset: args.offset,
    query: args.query,
    topic: args.topic,
    workspaceRoot: args.workspaceRoot
  });
  if (hasBlockingDiagnostics(result.diagnostics)) {
    writeOutput(io, formatTestEvidenceQueryFailure(result, args.json));
    return result.diagnostics.some(
      (entry) => entry.code === "query.topic-unknown"
    )
      ? 2
      : 1;
  }
  writeOutput(io, formatTestEvidenceCaseList(result, args.json));
  return 0;
}

function commandBase(commandNode: Command, cwd: string): CatalogCliBase {
  const options = commandNode.optsWithGlobals<ParsedOptions>();
  return {
    json: options.json ?? false,
    workspaceRoot: path.resolve(cwd, options.root ?? ".")
  };
}

function listCommandArgs(
  commandNode: Command,
  cwd: string
): Extract<CatalogCliArgs, { command: "list" }> {
  const options = commandNode.optsWithGlobals<ParsedOptions>();
  return {
    ...commandBase(commandNode, cwd),
    command: "list",
    limit: options.limit ?? testEvidenceQueryDefaultLimit,
    offset: options.offset ?? 0,
    query: options.query,
    topic: options.topic
  };
}

function syncCommandArgs(
  commandNode: Command,
  cwd: string
): Extract<CatalogCliArgs, { command: "sync-index" }> {
  const options = commandNode.optsWithGlobals<ParsedOptions>();
  return {
    ...commandBase(commandNode, cwd),
    command: "sync-index",
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
    throw new InvalidArgumentError("must contain a non-whitespace character");
  }
  return parsed;
}

function parseSingleTopic(value: string, previous: string | undefined): string {
  if (previous !== undefined) {
    throw new InvalidArgumentError("may only be specified once");
  }
  return parseNonEmptyText(value);
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

function writeOutput(io: CatalogCliIo, output: TestEvidenceCliOutput): void {
  if (output.stderr.length > 0) {
    io.stderr(output.stderr);
  }
  if (output.stdout.length > 0) {
    io.stdout(output.stdout);
  }
}

export {
  listTestEvidenceTopics,
  queryTestEvidence,
  showTestEvidenceCase,
  stageTestEvidenceIndex,
  syncTestEvidenceIndex,
  validateTestEvidence,
  testEvidenceCaseShowResultSchema,
  testEvidenceIndexStageResultSchema,
  testEvidenceIndexSyncResultSchema,
  testEvidenceQueryResultSchema,
  testEvidenceReportSchema,
  testEvidenceStateIndexSchema,
  testEvidenceTopicCatalogSchema,
  testEvidenceTopicsResultSchema
};
export type { ListTestEvidenceTopicsOptions, ValidateTestEvidenceOptions };
export type {
  TestEvidenceCaseShowResult,
  TestEvidenceCaseState,
  TestEvidenceIndexStageDiagnostic,
  TestEvidenceIndexStageResult,
  TestEvidenceIndexSyncResult,
  TestEvidenceReport,
  TestEvidenceStateIndex,
  TestEvidenceTopicCatalog,
  TestEvidenceTopicsResult
} from "./types.ts";
export type { QueryTestEvidenceOptions } from "./query.ts";
export type { ShowTestEvidenceCaseOptions } from "./case-show.ts";
export type { StageTestEvidenceIndexOptions } from "./staging.ts";
export type { SyncTestEvidenceIndexOptions } from "./state-index.ts";

if (isMainModule(import.meta.url)) {
  process.exitCode = await runTestEvidenceCatalogCli();
}
