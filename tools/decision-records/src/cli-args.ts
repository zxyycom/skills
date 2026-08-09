import process from "node:process";
import {
  Command as CommanderCommand,
  InvalidArgumentError,
  Option
} from "commander";
import {
  decisionAlignments,
  decisionRelationTypes,
  establishedDecisionStatuses,
  type DecisionAlignment,
  type DecisionListAlignment,
  type DecisionListStatus,
  type DecisionRelation,
  type DecisionRelationOverride,
  type DecisionSuccessor,
  type DecisionTraceDirection
} from "./types.ts";
import {
  isDecisionDomainId,
  isDecisionRelativePath
} from "./decision-path.ts";

export type Command =
  | "activate"
  | "archive"
  | "candidates"
  | "check"
  | "discard"
  | "domains"
  | "evolve"
  | "list"
  | "mark-aligned"
  | "show"
  | "show-candidate"
  | "stage"
  | "sync-index"
  | "trace";

type LocatedCommand<
  TCommand extends Command,
  TOptions extends object = Record<never, never>
> = TOptions & {
  command: TCommand;
  decisionsDir: string;
  workspaceRoot: string;
};

export type CliArgs =
  | LocatedCommand<"activate", {
      alignment: DecisionAlignment;
      keepUnrecordedHistory: boolean;
      recordPath: string;
      relationOverride: DecisionRelationOverride;
    }>
  | LocatedCommand<"archive", {
      keepUnrecordedHistory: boolean;
      recordPaths: string[];
    }>
  | LocatedCommand<"candidates">
  | LocatedCommand<"check">
  | LocatedCommand<"discard", { recordPath: string }>
  | LocatedCommand<"domains">
  | LocatedCommand<"evolve", {
      collapseUnrecordedPath: string | null;
      keepUnrecordedHistory: boolean;
      relationOverride: DecisionRelationOverride;
      successors: DecisionSuccessor[];
    }>
  | LocatedCommand<"list", {
      alignment: DecisionListAlignment;
      domain: string | null;
      fullTime: boolean;
      status: DecisionListStatus;
    }>
  | LocatedCommand<"mark-aligned", { recordPath: string }>
  | LocatedCommand<"show", { recordPath: string }>
  | LocatedCommand<"show-candidate", { recordPath: string }>
  | LocatedCommand<"stage", { recordPaths: string[] }>
  | LocatedCommand<"sync-index", { write: boolean }>
  | LocatedCommand<"trace", {
      recordPath: string;
      traceDepth: number | null;
      traceDirection: DecisionTraceDirection;
    }>;

export type CliArgsFor<TCommand extends Command> = Extract<
  CliArgs,
  { command: TCommand }
>;

type ParsedOptions = {
  alignment?: DecisionListAlignment;
  clearRelations?: boolean;
  collapseUnrecorded?: string;
  decisionsDir?: string;
  domain?: string;
  depth?: number;
  direction?: DecisionTraceDirection;
  fullTime?: boolean;
  keepUnrecordedHistory?: boolean;
  relation?: DecisionRelation[];
  root?: string;
  status?: DecisionListStatus;
  successor?: DecisionSuccessor[];
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

function parseSingleDecisionPath(value: string, previous?: string): string {
  if (!isDecisionRelativePath(value)) {
    throw new InvalidArgumentError(
      "must be a decision-root-relative POSIX path"
    );
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

function parseDecisionSuccessor(
  value: string,
  previous: DecisionSuccessor[] = []
): DecisionSuccessor[] {
  const separatorIndex = value.indexOf("=");
  if (separatorIndex <= 0 || separatorIndex === value.length - 1) {
    throw new InvalidArgumentError(
      "must use <alignment>=<decision-path>"
    );
  }

  const alignmentValue = value.slice(0, separatorIndex);
  if (alignmentValue !== "aligned" && alignmentValue !== "unaligned") {
    throw new InvalidArgumentError("alignment must be aligned or unaligned");
  }
  const recordPath = value.slice(separatorIndex + 1);
  if (!isDecisionRelativePath(recordPath)) {
    throw new InvalidArgumentError(
      "decision path must be a decision-root-relative POSIX path"
    );
  }
  if (previous.some((successor) => successor.recordPath === recordPath)) {
    throw new InvalidArgumentError("must not repeat a successor decision path");
  }
  return [...previous, { alignment: alignmentValue, recordPath }];
}

function decisionRelationOverride(
  options: Pick<ParsedOptions, "clearRelations" | "relation">
): DecisionRelationOverride {
  if (options.clearRelations === true) {
    return { kind: "replace", relations: [] };
  }
  return options.relation === undefined
    ? { kind: "source" }
    : { kind: "replace", relations: options.relation };
}

function requiredDecisionAlignment(
  value: DecisionListAlignment | undefined
): DecisionAlignment {
  if (value === "aligned" || value === "unaligned") {
    return value;
  }
  throw new InvalidArgumentError("must be aligned or unaligned");
}

function commandArgs(
  command: Command,
  commanderCommand: CommanderCommand,
  recordPaths: string[] = []
): CliArgs {
  const options = commanderCommand.optsWithGlobals<ParsedOptions>();
  const location = {
    decisionsDir: options.decisionsDir ?? "docs/decisions",
    workspaceRoot: options.root ?? process.cwd()
  };
  const recordPath = recordPaths[0] ?? "";
  switch (command) {
    case "activate":
      return {
        ...location,
        alignment: requiredDecisionAlignment(options.alignment),
        command,
        keepUnrecordedHistory: options.keepUnrecordedHistory ?? false,
        recordPath,
        relationOverride: decisionRelationOverride(options)
      };
    case "archive":
      return {
        ...location,
        command,
        keepUnrecordedHistory: options.keepUnrecordedHistory ?? false,
        recordPaths
      };
    case "candidates":
    case "check":
    case "domains":
      return { ...location, command };
    case "discard":
    case "mark-aligned":
    case "show":
    case "show-candidate":
      return { ...location, command, recordPath };
    case "stage":
      return { ...location, command, recordPaths };
    case "evolve":
      return {
        ...location,
        collapseUnrecordedPath: options.collapseUnrecorded ?? null,
        command,
        keepUnrecordedHistory: options.keepUnrecordedHistory ?? false,
        relationOverride: decisionRelationOverride(options),
        successors: options.successor ?? []
      };
    case "list":
      return {
        ...location,
        alignment: options.alignment ?? "all",
        command,
        domain: options.domain ?? null,
        fullTime: options.fullTime ?? false,
        status: options.status ?? "active"
      };
    case "sync-index":
      return { ...location, command, write: options.write ?? false };
    case "trace":
      return {
        ...location,
        command,
        recordPath,
        traceDepth: options.depth ?? null,
        traceDirection: options.direction ?? "both"
      };
  }
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

function createDecisionRelationOption(): Option {
  return new Option(
    "--relation <type=decision-path>",
    "Replace every selected successor's complete relation list with one final "
      + "direct predecessor relation. Repeat for the complete replacement."
  )
    .argParser(parseDecisionRelation)
    .conflicts("clearRelations");
}

function createClearRelationsOption(): Option {
  return new Option(
    "--clear-relations",
    "Replace the complete relation list with an explicit empty set."
  ).conflicts("relation");
}

function createKeepUnrecordedHistoryOption(): Option {
  return new Option(
    "--keep-unrecorded-history",
    "Explicitly preserve decisions that have not entered Git HEAD."
  );
}

export function createCliProgram(
  run: RunCommand,
  setExitCode: SetExitCode
): CommanderCommand {
  const program = new CommanderCommand()
    .name("decision-records")
    .description("Query and maintain agent-oriented decision records and their lifecycle state.")
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
      + "Reviewable candidates remain outside the index and are queried from source.\n"
      + "Exit codes: 0 success (queries and scoped maintenance may report warnings), "
      + "1 paused lifecycle choice, blocking validation, or index failure, "
      + "2 invalid arguments."
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
      + "reviewable candidates, and the JSON index. This is the default command.",
    { isDefault: true }
  );
  check.action(() => execute("check", check));

  const domains = createSubcommand(
    program,
    "domains",
    "List the complete decision domain catalog without reading the decision index."
  );
  domains.action(() => execute("domains", domains));

  const candidates = createSubcommand(
    program,
    "candidates",
    "Discover complete reviewable candidates directly from decision Markdown "
      + "without adding them to the persisted decision index."
  );
  candidates.action(() => execute("candidates", candidates));

  const list = createSubcommand(
    program,
    "list",
    "List the persisted active decision snapshot by default, or filter its indexed state."
  )
    .addOption(
      new Option("--alignment <value>", "Alignment filter for indexed decisions.")
        .choices([...decisionAlignments, "all"])
        .default("all")
    )
    .addOption(
      new Option("--status <value>", "Lifecycle status filter.")
        .choices([...establishedDecisionStatuses, "all"])
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

  const showCandidate = createSubcommand(
    program,
    "show-candidate <decision-path>",
    "Show one source-discovered candidate for semantic review before activation."
  );
  showCandidate.action((recordPath: string) => (
    execute("show-candidate", showCandidate, [recordPath])
  ));

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
    "Check the JSON index against established Markdown; use --write to rebuild it."
  )
    .option("--write", "Write the index rebuilt from established decisions.");
  syncIndex.action(() => execute("sync-index", syncIndex));

  const stage = createSubcommand(
    program,
    "stage <decision-path...>",
    "Build a complete pending decision snapshot from the current revision and "
      + "the explicitly selected filesystem decision paths."
  );
  stage.action((recordPaths: string[]) => execute("stage", stage, recordPaths));

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
    .addOption(createDecisionRelationOption())
    .addOption(createClearRelationsOption())
    .addOption(createKeepUnrecordedHistoryOption());
  activate.action((recordPath: string) => execute("activate", activate, [recordPath]));

  const evolve = createSubcommand(
    program,
    "evolve",
    "Replace complete successor relations, establish selected candidates, "
      + "archive new active predecessors, and optionally collapse one "
      + "unrecorded intermediate predecessor in one recoverable transaction."
  )
    .addOption(
      new Option(
        "--successor <alignment=decision-path>",
        "Select one successor and confirm its whole-decision alignment. "
          + "Repeat for the complete successor set."
      )
        .argParser(parseDecisionSuccessor)
        .makeOptionMandatory()
    )
    .addOption(createDecisionRelationOption())
    .addOption(createClearRelationsOption())
    .addOption(createKeepUnrecordedHistoryOption())
    .addOption(
      new Option(
        "--collapse-unrecorded <decision-path>",
        "Delete one active predecessor absent from Git HEAD for one new "
          + "candidate; resolved source relations or --relation define the "
          + "complete final set, and --clear-relations selects an explicitly "
          + "empty set."
      ).argParser(parseSingleDecisionPath)
    );
  evolve.action(() => execute("evolve", evolve));

  const markAligned = createSubcommand(
    program,
    "mark-aligned <decision-path>",
    "Mark an active unaligned decision as aligned only after its complete "
      + "direction has become current fact and been verified against the relevant "
      + "fact sources."
  );
  markAligned.action((recordPath: string) => (
    execute("mark-aligned", markAligned, [recordPath])
  ));

  const archive = createSubcommand(
    program,
    "archive <decision-path...>",
    "Archive active decisions while preserving their last alignment and relations."
  ).addOption(createKeepUnrecordedHistoryOption());
  archive.action((recordPaths: string[]) => execute("archive", archive, recordPaths));

  const discard = createSubcommand(
    program,
    "discard <decision-path>",
    "Delete a complete reviewable decision candidate and rebuild the index."
  );
  discard.action((recordPath: string) => execute("discard", discard, [recordPath]));

  return program;
}
