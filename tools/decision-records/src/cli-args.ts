import process from "node:process";
import {
  Command as CommanderCommand,
  InvalidArgumentError,
  Option
} from "commander";
import {
  decisionAlignments,
  decisionRelationTypes,
  decisionStatuses,
  type DecisionListAlignment,
  type DecisionListStatus,
  type DecisionRelation,
  type DecisionTraceDirection
} from "./types.ts";
import {
  isDecisionDomainId,
  isDecisionRelativePath
} from "./decision-path.ts";

export type Command =
  | "activate"
  | "archive"
  | "check"
  | "discard"
  | "domains"
  | "evolve"
  | "list"
  | "mark-aligned"
  | "show"
  | "sync-index"
  | "trace";

export type CliArgs = {
  alignment: DecisionListAlignment;
  command: Command;
  decisionsDir: string;
  domain: string | null;
  fullTime: boolean;
  recordPaths: string[];
  relations: DecisionRelation[];
  status: DecisionListStatus;
  traceDepth: number | null;
  traceDirection: DecisionTraceDirection;
  workspaceRoot: string;
  write: boolean;
};

type ParsedOptions = {
  alignment?: DecisionListAlignment;
  decisionsDir?: string;
  domain?: string;
  depth?: number;
  direction?: DecisionTraceDirection;
  fullTime?: boolean;
  relation?: DecisionRelation[];
  root?: string;
  status?: DecisionListStatus;
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

function parseSingleDomainId(value: string, previous?: string): string {
  if (!isDecisionDomainId(value)) {
    throw new InvalidArgumentError("must be a kebab-case domain id");
  }
  if (previous !== undefined) {
    throw new InvalidArgumentError("must not be repeated");
  }
  return value;
}

function parseDecisionRelation(
  value: string,
  previous: DecisionRelation[] = []
): DecisionRelation[] {
  const separatorIndex = value.indexOf("=");
  if (separatorIndex <= 0 || separatorIndex === value.length - 1) {
    throw new InvalidArgumentError(
      "must use <type>=<decision-path>"
    );
  }

  const relationTypeValue = value.slice(0, separatorIndex);
  const relationType = decisionRelationTypes.find(
    (candidate) => candidate === relationTypeValue
  );
  if (relationType === undefined) {
    throw new InvalidArgumentError(
      "type must be " + decisionRelationTypes.join(", ")
    );
  }

  const target = value.slice(separatorIndex + 1);
  if (!isDecisionRelativePath(target)) {
    throw new InvalidArgumentError(
      "target must be a decision-root-relative POSIX path"
    );
  }
  if (previous.some((relation) => relation.target === target)) {
    throw new InvalidArgumentError(
      "must not repeat a direct predecessor target"
    );
  }

  return [...previous, { type: relationType, target }];
}

function commandArgs(
  command: Command,
  commanderCommand: CommanderCommand,
  recordPaths: string[] = []
): CliArgs {
  const options = commanderCommand.optsWithGlobals<ParsedOptions>();
  return {
    alignment: options.alignment ?? "all",
    command,
    decisionsDir: options.decisionsDir ?? "docs/decisions",
    domain: options.domain ?? null,
    fullTime: options.fullTime ?? false,
    recordPaths,
    relations: options.relation ?? [],
    status: options.status ?? "active",
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

function createDecisionRelationOption(required = false): Option {
  const option = new Option(
    "--relation <type=decision-path>",
    "Set one direct predecessor relation and archive its active target; "
      + "repeat to set the complete relation list."
  ).argParser(parseDecisionRelation);
  return required ? option.makeOptionMandatory() : option;
}

export function createCliProgram(
  run: RunCommand,
  setExitCode: SetExitCode
): CommanderCommand {
  const program = new CommanderCommand()
    .name("decision-records")
    .description("Validate and maintain decision records from Markdown lifecycle state.")
    .configureHelp({ showGlobalOptions: true })
    .option("--root <path>", "Workspace root.", process.cwd())
    .option(
      "--decisions-dir <path>",
      "Decision directory. Relative paths resolve from --root.",
      "docs/decisions"
    )
    .showHelpAfterError()
    .addHelpText(
      "afterAll",
      "\nDecision paths are relative to the decision directory, for example "
      + "domain-id/use-semantic-title.md.\n"
      + "Unactivated candidates remain outside the index and are reported as warnings.\n"
      + "Exit codes: 0 success (queries and scoped maintenance may report warnings), "
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
    "Strictly validate the domain catalog, Markdown metadata, alignment, relations, "
      + "activation candidates, and the JSON index.",
    { isDefault: true }
  );
  check.action(() => execute("check", check));

  const domains = createSubcommand(
    program,
    "domains",
    "List the complete decision domain catalog without reading the decision index."
  );
  domains.action(() => execute("domains", domains));

  const list = createSubcommand(
    program,
    "list",
    "List active decisions by default, or filter by domain, lifecycle, and alignment."
  )
    .addOption(
      new Option("--alignment <value>", "Alignment filter for active decisions.")
        .choices([...decisionAlignments, "all"])
        .default("all")
    )
    .addOption(
      new Option("--status <value>", "Lifecycle status filter.")
        .choices([...decisionStatuses, "all"])
        .default("active")
    )
    .addOption(
      new Option(
        "--domain <domain-id>",
        "Filter by one catalog domain id."
      )
        .argParser(parseSingleDomainId)
    )
    .option("--full-time", "Show the full createdAt timestamp instead of its date.");
  list.action(() => execute("list", list));

  const show = createSubcommand(
    program,
    "show <decision-path>",
    "Show decision metadata followed by the original Markdown body."
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
    "Rebuild the complete JSON index from established decision Markdown files."
  )
    .option("--write", "Write the index rebuilt from established decisions.");
  syncIndex.action(() => execute("sync-index", syncIndex));

  const activate = createSubcommand(
    program,
    "activate <decision-path>",
    "Establish one new decision candidate or reactivate one archived decision; "
      + "new candidates may record direct evolution relations and archive their "
      + "predecessors in the same transaction."
  )
    .addOption(
      new Option("--alignment <value>", "Alignment state for the active decision.")
        .choices(decisionAlignments)
        .makeOptionMandatory()
    )
    .addOption(createDecisionRelationOption());
  activate.action((recordPath: string) => execute("activate", activate, [recordPath]));

  const evolve = createSubcommand(
    program,
    "evolve <decision-path>",
    "Activate one new decision and archive every explicitly related direct "
      + "predecessor in one recoverable transaction."
  )
    .addOption(
      new Option("--alignment <value>", "Alignment state for the active decision.")
        .choices(decisionAlignments)
        .makeOptionMandatory()
    )
    .addOption(createDecisionRelationOption(true));
  evolve.action((recordPath: string) => execute("evolve", evolve, [recordPath]));

  const markAligned = createSubcommand(
    program,
    "mark-aligned <decision-path>",
    "Mark an active unaligned decision as aligned after verifying it against "
      + "current fact sources, establishing it as the current baseline."
  );
  markAligned.action((recordPath: string) => (
    execute("mark-aligned", markAligned, [recordPath])
  ));

  const archive = createSubcommand(
    program,
    "archive <decision-path...>",
    "Set active decisions to archived with null alignment without changing relations."
  );
  archive.action((recordPaths: string[]) => execute("archive", archive, recordPaths));

  const discard = createSubcommand(
    program,
    "discard <decision-path>",
    "Delete a complete unactivated decision candidate and rebuild the index."
  );
  discard.action((recordPath: string) => execute("discard", discard, [recordPath]));

  return program;
}
