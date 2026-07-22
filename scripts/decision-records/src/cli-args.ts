import process from "node:process";
import {
  Command as CommanderCommand,
  InvalidArgumentError,
  Option
} from "commander";
import {
  decisionStatuses,
  type DecisionListStatus,
  type DecisionTraceDirection
} from "./types.ts";
import { isDecisionTopicId } from "./decision-path.ts";

export type Command =
  | "activate"
  | "archive"
  | "check"
  | "discard"
  | "list"
  | "show"
  | "sync-index"
  | "trace";

export type CliArgs = {
  command: Command;
  decisionsDir: string;
  fullTime: boolean;
  recordPaths: string[];
  status: DecisionListStatus;
  topic: string | null;
  traceDepth: number | null;
  traceDirection: DecisionTraceDirection;
  workspaceRoot: string;
  write: boolean;
};

type ParsedOptions = {
  decisionsDir?: string;
  depth?: number;
  direction?: DecisionTraceDirection;
  fullTime?: boolean;
  root?: string;
  status?: DecisionListStatus;
  topic?: string;
  write?: boolean;
};

type RunCommand = (args: CliArgs) => Promise<number>;
type SetExitCode = (exitCode: number) => void;

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

function parseTopicId(value: string): string {
  if (!isDecisionTopicId(value)) {
    throw new InvalidArgumentError("must be a kebab-case topic id");
  }

  return value;
}

function commandArgs(
  command: Command,
  commanderCommand: CommanderCommand,
  recordPaths: string[] = []
): CliArgs {
  const options = commanderCommand.optsWithGlobals<ParsedOptions>();
  return {
    command,
    decisionsDir: options.decisionsDir ?? "docs/decisions",
    fullTime: options.fullTime ?? false,
    recordPaths,
    status: options.status ?? "active",
    topic: options.topic ?? null,
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

export function createCliProgram(
  run: RunCommand,
  setExitCode: SetExitCode
): CommanderCommand {
  const program = new CommanderCommand()
    .name("decision-records")
    .description("Validate and maintain decision records in a Git worktree.")
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
      + "topic/use-semantic-title.md.\n"
      + "Pending is derived from Markdown path absence in Git HEAD and is never stored.\n"
      + "Exit codes: 0 success (queries may report warnings), "
      + "1 blocking validation or index failure, 2 invalid arguments."
    )
    .exitOverride();

  async function execute(
    command: Command,
    commanderCommand: CommanderCommand,
    recordPaths: string[] = []
  ): Promise<void> {
    setExitCode(await run(commandArgs(command, commanderCommand, recordPaths)));
  }

  const check = createSubcommand(
    program,
    "check",
    "Validate paths, Markdown records, relations, the JSON index, and Git HEAD membership.",
    { isDefault: true }
  );
  check.action(() => execute("check", check));

  const list = createSubcommand(
    program,
    "list",
    "List active decisions by default, or filter by topic and lifecycle status."
  )
    .addOption(
      new Option("--status <value>", "Lifecycle status filter.")
        .choices([...decisionStatuses, "all"])
        .default("active")
    )
    .addOption(
      new Option("--topic <topic-id>", "Filter by a kebab-case topic id.")
        .argParser(parseTopicId)
    )
    .option("--full-time", "Show the full createdAt timestamp instead of its date.");
  list.action(() => execute("list", list));

  const show = createSubcommand(
    program,
    "show <decision-path>",
    "Show index-owned metadata followed by the original Markdown body."
  );
  show.action((recordPath: string) => execute("show", show, [recordPath]));

  const trace = createSubcommand(
    program,
    "trace <decision-path>",
    "Trace available predecessors, successors, or both."
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
    "Refresh generated projections and relations without changing status or createdAt."
  )
    .option("--write", "Apply index metadata changes.");
  syncIndex.action(() => execute("sync-index", syncIndex));

  const activate = createSubcommand(
    program,
    "activate <decision-path>",
    "Register an existing decision when needed and set its status to active."
  );
  activate.action((recordPath: string) => execute("activate", activate, [recordPath]));

  const archive = createSubcommand(
    program,
    "archive <decision-path...>",
    "Set active decisions to archived without changing related decisions."
  );
  archive.action((recordPaths: string[]) => execute("archive", archive, recordPaths));

  const discard = createSubcommand(
    program,
    "discard <decision-path>",
    "Delete a decision file that is not yet present in Git HEAD and remove its index entry."
  );
  discard.action((recordPath: string) => execute("discard", discard, [recordPath]));

  return program;
}
