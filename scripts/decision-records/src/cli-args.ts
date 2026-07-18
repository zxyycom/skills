import process from "node:process";
import {
  Command as CommanderCommand,
  InvalidArgumentError,
  Option
} from "commander";
import type { DecisionTraceDirection } from "./types.ts";

export type Command = "activate" | "archive" | "check" | "list" | "sync-index" | "trace";

export type CliArgs = {
  all: boolean;
  archived: boolean;
  byPath: string | null;
  command: Command;
  decisionsDir: string;
  recordPaths: string[];
  traceDepth: number | null;
  traceDirection: DecisionTraceDirection;
  workspaceRoot: string;
  write: boolean;
};

type ParsedOptions = {
  all?: boolean;
  archived?: boolean;
  by?: string;
  decisionsDir?: string;
  depth?: number;
  direction?: DecisionTraceDirection;
  root?: string;
  write?: boolean;
};

type RunCommand = (args: CliArgs) => Promise<number>;

function parseTraceDepth(value: string): number {
  if (!/^(0|[1-9]\d*)$/.test(value)) {
    throw new InvalidArgumentError("must be a non-negative integer");
  }

  const depth = Number(value);
  if (!Number.isSafeInteger(depth)) {
    throw new InvalidArgumentError("must be a safe non-negative integer");
  }

  return depth;
}

function commandArgs(
  command: Command,
  commanderCommand: CommanderCommand,
  recordPaths: string[] = []
): CliArgs {
  const options = commanderCommand.optsWithGlobals<ParsedOptions>();
  return {
    all: options.all ?? false,
    archived: options.archived ?? false,
    byPath: options.by ?? null,
    command,
    decisionsDir: options.decisionsDir ?? "docs/decisions",
    recordPaths,
    traceDepth: options.depth ?? null,
    traceDirection: options.direction ?? "both",
    workspaceRoot: options.root ?? process.cwd(),
    write: options.write ?? false
  };
}

function createSubcommand(
  program: CommanderCommand,
  nameAndArgs: string,
  description: string,
  options: { isDefault?: boolean } = {}
): CommanderCommand {
  return program
    .command(nameAndArgs, options)
    .description(description)
    .allowExcessArguments(false)
    .exitOverride();
}

export function createCliProgram(run: RunCommand): CommanderCommand {
  const program = new CommanderCommand()
    .name("decision-records")
    .description("Validate and maintain repository decision records.")
    .configureHelp({ showGlobalOptions: true })
    .option("--root <path>", "Workspace root.", process.cwd())
    .option(
      "--decisions-dir <path>",
      "Decision directory under --root.",
      "docs/decisions"
    )
    .showHelpAfterError()
    .addHelpText(
      "afterAll",
      "\nDecision paths are relative to the decision directory, for example "
      + "topic/260713-title.md.\n"
      + "Exit codes: 0 success, 1 validation or index drift, 2 invalid arguments."
    )
    .exitOverride();

  async function execute(
    command: Command,
    commanderCommand: CommanderCommand,
    recordPaths: string[] = []
  ): Promise<void> {
    process.exitCode = await run(commandArgs(command, commanderCommand, recordPaths));
  }

  const check = createSubcommand(
    program,
    "check",
    "Validate paths, Markdown records, relations, and the JSON index.",
    { isDefault: true }
  );
  check.action(() => execute("check", check));

  const list = createSubcommand(
    program,
    "list",
    "List current decisions by default, or select archived history."
  )
    .addOption(
      new Option("--archived", "List only logically archived decisions.")
        .conflicts("all")
    )
    .option("--all", "List current and logically archived decisions.");
  list.action(() => execute("list", list));

  const trace = createSubcommand(
    program,
    "trace <decision-path>",
    "Trace predecessors, successors, or both."
  )
    .addOption(
      new Option("--direction <value>", "Relation direction.")
        .choices(["both", "predecessors", "successors"])
        .default("both")
    )
    .addOption(
      new Option("--depth <n>", "Maximum relation hops.")
        .argParser(parseTraceDepth)
    );
  trace.action((recordPath: string) => execute("trace", trace, [recordPath]));

  const syncIndex = createSubcommand(
    program,
    "sync-index",
    "Refresh generated index metadata without changing membership."
  )
    .option("--write", "Apply index metadata changes.");
  syncIndex.action(() => execute("sync-index", syncIndex));

  const activate = createSubcommand(
    program,
    "activate <decision-path>",
    "Add an existing decision file to the current index."
  );
  activate.action((recordPath: string) => execute("activate", activate, [recordPath]));

  const archive = createSubcommand(
    program,
    "archive <decision-path...>",
    "Remove decisions from the current index."
  )
    .option(
      "--by <decision-path>",
      "Validate and activate a successor that relates to every archived decision."
    );
  archive.action((recordPaths: string[]) => execute("archive", archive, recordPaths));

  return program;
}
