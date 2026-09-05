import process from "node:process";
import path from "node:path";
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
  type DecisionId,
  type DecisionListAlignment,
  type DecisionListStatus,
  type DecisionRelation,
  type DecisionRelationType,
  type DecisionRelationOverride,
  type DecisionRelationSummary,
  type DecisionSuccessor,
  type DecisionTag,
  type DecisionTraceDirection
} from "./types.ts";
import { isDecisionTag, normalizeDecisionIdInput } from "./decision-path.ts";
import { projectionTextIssue } from "./projection.ts";
import { normalizeRelationSummary } from "./relation-summary.ts";
import {
  processDecisionRecordsCliIo,
  type DecisionRecordsCliIo
} from "./cli-io.ts";

export type Command =
  | "activate"
  | "archive"
  | "candidates"
  | "check"
  | "discard"
  | "evolve"
  | "list"
  | "mark-aligned"
  | "new"
  | "rename"
  | "search"
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
  | LocatedCommand<
      "activate",
      {
        alignment: DecisionAlignment;
        decisionId: DecisionId;
        keepUnrecordedHistory: boolean;
        preflight: boolean;
        relationOverride: DecisionRelationOverride;
      }
    >
  | LocatedCommand<
      "archive",
      {
        decisionIds: DecisionId[];
        keepUnrecordedHistory: boolean;
      }
    >
  | LocatedCommand<"candidates">
  | LocatedCommand<"check">
  | LocatedCommand<
      "discard",
      { decisionId: DecisionId; deleteRecordedDecision: boolean }
    >
  | LocatedCommand<
      "evolve",
      {
        discardId: DecisionId | null;
        deleteRecordedDecision: boolean;
        keepUnrecordedHistory: boolean;
        preflight: boolean;
        relationOverride: DecisionRelationOverride;
        successors: DecisionSuccessor[];
      }
    >
  | LocatedCommand<
      "list",
      {
        alignment: DecisionListAlignment;
        direction?: DecisionTraceDirection;
        fullTime: boolean;
        relatedTo?: string;
        relationType?: DecisionRelationType;
        status: DecisionListStatus;
        tags: DecisionTag[];
      }
    >
  | LocatedCommand<"mark-aligned", { decisionId: DecisionId }>
  | LocatedCommand<
      "new",
      {
        background: string;
        decision: string;
        decisionId: DecisionId;
        preflightAlignment: DecisionAlignment | null;
        purpose: string;
        relations: DecisionRelation[];
        relationSummaries: DecisionRelationSummary[];
        tags: DecisionTag[];
        title: string;
      }
    >
  | LocatedCommand<
      "rename",
      {
        preflight: boolean;
        renameRecordedDecision: boolean;
        source: string;
        target: string;
      }
    >
  | LocatedCommand<
      "search",
      {
        alignment: DecisionListAlignment;
        direction?: DecisionTraceDirection;
        in: "content" | "metadata";
        match: "all" | "any" | "phrase";
        relatedTo?: string;
        relationType?: DecisionRelationType;
        status: DecisionListStatus;
        tags: DecisionTag[];
        text: string;
      }
    >
  | LocatedCommand<"show", { decisionId: DecisionId }>
  | LocatedCommand<"show-candidate", { decisionId: DecisionId }>
  | LocatedCommand<"stage", { decisionIds: DecisionId[] }>
  | LocatedCommand<
      "sync-index",
      { selectors?: readonly string[]; write: boolean }
    >
  | LocatedCommand<
      "trace",
      {
        decisionId: DecisionId;
        traceDepth: number | null;
        traceDirection: DecisionTraceDirection;
      }
    >;

export type CliArgsFor<TCommand extends Command> = Extract<
  CliArgs,
  { command: TCommand }
>;

type ParsedOptions = {
  alignment?: DecisionListAlignment;
  background?: string;
  clearRelations?: boolean;
  discard?: DecisionId;
  deleteRecordedDecision?: boolean;
  decisionsDir?: string;
  depth?: number;
  decision?: string;
  direction?: DecisionTraceDirection;
  fullTime?: boolean;
  in?: "content" | "metadata";
  keepUnrecordedHistory?: boolean;
  preflight?: boolean;
  renameRecordedDecision?: boolean;
  preflightAlignment?: DecisionAlignment;
  match?: "all" | "any" | "phrase";
  purpose?: string;
  relation?: DecisionRelation[];
  relatedTo?: string;
  relationType?: DecisionRelationType;
  relationSummary?: DecisionRelationSummary[];
  root?: string;
  status?: DecisionListStatus;
  successor?: DecisionSuccessor[];
  select?: string[];
  tag?: DecisionTag[];
  title?: string;
  write?: boolean;
};

type CommandLocation = Pick<CliArgs, "decisionsDir" | "workspaceRoot">;
type LifecycleCommand = Extract<
  Command,
  "activate" | "archive" | "discard" | "evolve"
>;
type SimpleCommand = Extract<Command, "candidates" | "check">;

type RunCommand = (args: CliArgs) => Promise<number>;
type SetExitCode = (exitCode: number) => void;

export type CreateCliProgramOptions = {
  cwd?: string;
  io?: DecisionRecordsCliIo;
};

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

function parseSingleDecisionId(
  value: string,
  previous?: DecisionId
): DecisionId {
  const decisionId = normalizeDecisionIdInput(value);
  if (decisionId === null) {
    throw new InvalidArgumentError(
      "Decision selector is invalid; must be extensionless kebab-case text"
    );
  }
  if (previous !== undefined) {
    throw new InvalidArgumentError("must not be repeated");
  }
  return decisionId;
}

function parseDecisionIdList(
  value: string,
  previous: DecisionId[] = []
): DecisionId[] {
  const decisionId = normalizeDecisionIdInput(value);
  if (decisionId === null) {
    throw new InvalidArgumentError(
      "Decision selector is invalid; must be extensionless kebab-case text"
    );
  }
  if (previous.includes(decisionId)) {
    throw new InvalidArgumentError("must not repeat a Decision selector");
  }
  return [...previous, decisionId];
}

function parseDecisionRelation(
  value: string,
  previous: DecisionRelation[] = []
): DecisionRelation[] {
  const separatorIndex = value.indexOf("=");
  if (separatorIndex <= 0 || separatorIndex === value.length - 1) {
    throw new InvalidArgumentError("must use <type>=<decision-selector>");
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
  const target = normalizeDecisionIdInput(value.slice(separatorIndex + 1));
  if (target === null) {
    throw new InvalidArgumentError(
      "target must be an extensionless Decision selector"
    );
  }
  if (previous.some((relation) => relation.target === target)) {
    throw new InvalidArgumentError(
      "must not repeat a direct predecessor target"
    );
  }
  return [...previous, { type: relationType, target }];
}

function parseDecisionRelationSummary(
  value: string,
  previous: DecisionRelationSummary[] = []
): DecisionRelationSummary[] {
  const separatorIndex = value.indexOf("=");
  if (separatorIndex <= 0) {
    throw new InvalidArgumentError("must use <decision-selector>=<summary>");
  }
  const target = normalizeDecisionIdInput(value.slice(0, separatorIndex));
  if (target === null) {
    throw new InvalidArgumentError(
      "target must be an extensionless Decision selector"
    );
  }
  if (previous.some((relation) => relation.target === target)) {
    throw new InvalidArgumentError("must not repeat a relation-summary target");
  }
  const normalized = normalizeRelationSummary(value.slice(separatorIndex + 1));
  if ("issue" in normalized) {
    throw new InvalidArgumentError(normalized.issue);
  }
  return [...previous, { target, ...normalized }];
}

function parseDecisionSuccessor(
  value: string,
  previous: DecisionSuccessor[] = []
): DecisionSuccessor[] {
  const separatorIndex = value.indexOf("=");
  if (separatorIndex <= 0 || separatorIndex === value.length - 1) {
    throw new InvalidArgumentError("must use <alignment>=<decision-selector>");
  }
  const alignmentValue = value.slice(0, separatorIndex);
  if (alignmentValue !== "aligned" && alignmentValue !== "unaligned") {
    throw new InvalidArgumentError("alignment must be aligned or unaligned");
  }
  const decisionId = normalizeDecisionIdInput(value.slice(separatorIndex + 1));
  if (decisionId === null) {
    throw new InvalidArgumentError(
      "decision ID must be extensionless kebab-case text"
    );
  }
  if (previous.some((successor) => successor.decisionId === decisionId)) {
    throw new InvalidArgumentError(
      "must not repeat a successor Decision selector"
    );
  }
  return [...previous, { alignment: alignmentValue, decisionId }];
}

function parseDecisionTag(
  value: string,
  previous: DecisionTag[] = []
): DecisionTag[] {
  if (!isDecisionTag(value)) {
    throw new InvalidArgumentError("must be a kebab-case tag");
  }
  if (previous.includes(value)) {
    throw new InvalidArgumentError("must not repeat a tag");
  }
  return [...previous, value];
}

function parseProjectionText(value: string): string {
  const normalized = value.trim();
  const issue = projectionTextIssue(normalized);
  if (issue !== null) {
    throw new InvalidArgumentError(issue);
  }
  return normalized;
}

function decisionRelationOverride(
  options: Pick<
    ParsedOptions,
    "clearRelations" | "relation" | "relationSummary"
  >
): DecisionRelationOverride {
  if (options.clearRelations === true) {
    if (options.relationSummary !== undefined) {
      throw new InvalidArgumentError(
        "--relation-summary cannot be used with --clear-relations"
      );
    }
    return { kind: "replace", relations: [] };
  }
  if (options.relation === undefined) {
    if (options.relationSummary !== undefined) {
      throw new InvalidArgumentError(
        "--relation-summary requires at least one --relation"
      );
    }
    return { kind: "source" };
  }
  return {
    kind: "replace",
    relations: options.relation,
    ...(options.relationSummary === undefined
      ? {}
      : { relationSummaries: options.relationSummary })
  };
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
  decisionIds: DecisionId[] = [],
  cwd: string
): CliArgs {
  const options = commanderCommand.optsWithGlobals<ParsedOptions>();
  const { decisionsDir = "docs/decisions", root = "." } = options;
  const location = {
    decisionsDir,
    workspaceRoot: path.resolve(cwd, root)
  };
  switch (command) {
    case "activate":
    case "archive":
    case "discard":
    case "evolve":
      return lifecycleCommandArgs(
        command,
        commanderCommand,
        decisionIds,
        location,
        options
      );
    case "new":
      return newCommandArgs(decisionIds, location, options);
    case "rename":
      return {
        ...location,
        command,
        preflight: options.preflight ?? false,
        renameRecordedDecision: options.renameRecordedDecision ?? false,
        source: requiredDecisionId(decisionIds) as string,
        target: decisionIds[1] ?? ""
      };
    case "list":
      return listCommandArgs(location, options);
    case "search":
      return searchCommandArgs(location, options, commanderCommand.args[0]);
    case "trace":
      return traceCommandArgs(decisionIds, location, options);
    case "stage":
      return { ...location, command, decisionIds };
    case "mark-aligned":
    case "show":
    case "show-candidate":
      return {
        ...location,
        command,
        decisionId: requiredDecisionId(decisionIds)
      };
    case "candidates":
    case "check":
      return simpleCommandArgs(command, location);
    case "sync-index":
      return {
        ...location,
        command,
        ...(options.select === undefined || options.select.length === 0
          ? {}
          : { selectors: options.select }),
        write: options.write ?? false
      };
  }
}

function simpleCommandArgs(
  command: SimpleCommand,
  location: CommandLocation
): CliArgs {
  switch (command) {
    case "candidates":
      return { ...location, command: "candidates" };
    case "check":
      return { ...location, command: "check" };
  }
}

function lifecycleCommandArgs(
  command: LifecycleCommand,
  commanderCommand: CommanderCommand,
  decisionIds: DecisionId[],
  location: CommandLocation,
  options: ParsedOptions
): CliArgs {
  const {
    deleteRecordedDecision = false,
    keepUnrecordedHistory = false,
    preflight = false
  } = options;
  switch (command) {
    case "activate":
      return {
        ...location,
        alignment: requiredDecisionAlignment(options.alignment),
        command,
        decisionId: requiredDecisionId(decisionIds),
        keepUnrecordedHistory,
        preflight,
        relationOverride: decisionRelationOverride(options)
      };
    case "archive":
      return {
        ...location,
        command,
        decisionIds,
        keepUnrecordedHistory
      };
    case "discard":
      return {
        ...location,
        command,
        decisionId: requiredDecisionId(decisionIds),
        deleteRecordedDecision
      };
    case "evolve":
      return evolveCommandArgs(commanderCommand, location, options);
  }
}

function evolveCommandArgs(
  command: CommanderCommand,
  location: CommandLocation,
  options: ParsedOptions
): CliArgsFor<"evolve"> {
  const {
    deleteRecordedDecision = false,
    discard: discardId,
    keepUnrecordedHistory = false,
    preflight = false,
    successor: successors = []
  } = options;
  if (deleteRecordedDecision && discardId === undefined) {
    command.error(
      "--delete-recorded-decision requires --discard <decision-id>",
      {
        exitCode: 2,
        code: "decision-records.missing-discard"
      }
    );
  }
  return {
    ...location,
    discardId: discardId ?? null,
    command: "evolve",
    deleteRecordedDecision,
    keepUnrecordedHistory,
    preflight,
    relationOverride: decisionRelationOverride(options),
    successors
  };
}

function newCommandArgs(
  decisionIds: DecisionId[],
  location: CommandLocation,
  options: ParsedOptions
): CliArgsFor<"new"> {
  if (options.relation === undefined && options.relationSummary !== undefined) {
    throw new InvalidArgumentError(
      "--relation-summary requires at least one --relation"
    );
  }
  return {
    ...location,
    background: requiredProjectionOption(options.background, "--background"),
    command: "new",
    decision: requiredProjectionOption(options.decision, "--decision"),
    decisionId: requiredDecisionId(decisionIds),
    preflightAlignment: options.preflightAlignment ?? null,
    purpose: requiredProjectionOption(options.purpose, "--purpose"),
    relations: options.relation ?? [],
    relationSummaries: options.relationSummary ?? [],
    tags: options.tag ?? [],
    title: requiredProjectionOption(options.title, "--title")
  };
}

function listCommandArgs(
  location: CommandLocation,
  options: ParsedOptions
): CliArgsFor<"list"> {
  validateRelatedDirection(options);
  return {
    ...location,
    alignment: options.alignment ?? "all",
    command: "list",
    ...(options.direction === undefined
      ? {}
      : { direction: options.direction }),
    fullTime: options.fullTime ?? false,
    ...(options.relatedTo === undefined
      ? {}
      : { relatedTo: options.relatedTo }),
    ...(options.relationType === undefined
      ? {}
      : { relationType: options.relationType }),
    status: options.status ?? "active",
    tags: options.tag ?? []
  };
}

function searchCommandArgs(
  location: CommandLocation,
  options: ParsedOptions,
  text: unknown
): CliArgsFor<"search"> {
  if (typeof text !== "string") {
    throw new InvalidArgumentError("Search text is required");
  }
  validateRelatedDirection(options);
  return {
    ...location,
    alignment: options.alignment ?? "all",
    command: "search",
    ...(options.direction === undefined
      ? {}
      : { direction: options.direction }),
    in: options.in ?? "content",
    match: options.match ?? "all",
    ...(options.relatedTo === undefined
      ? {}
      : { relatedTo: options.relatedTo }),
    ...(options.relationType === undefined
      ? {}
      : { relationType: options.relationType }),
    status: options.status ?? "active",
    tags: options.tag ?? [],
    text
  };
}

function validateRelatedDirection(options: ParsedOptions): void {
  if (options.direction !== undefined && options.relatedTo === undefined) {
    throw new InvalidArgumentError(
      "--direction requires --related-to <selector>"
    );
  }
}

function singleRelationQueryOption(option: Option): Option {
  const parse = option.parseArg;
  return option.argParser((value, previous) => {
    if (previous !== undefined) {
      throw new InvalidArgumentError(`--${option.name()} must not be repeated`);
    }
    return parse === undefined ? value : parse(value, previous);
  });
}

function traceCommandArgs(
  decisionIds: DecisionId[],
  location: CommandLocation,
  options: ParsedOptions
): CliArgsFor<"trace"> {
  return {
    ...location,
    command: "trace",
    decisionId: requiredDecisionId(decisionIds),
    traceDepth: options.depth ?? null,
    traceDirection: options.direction ?? "both"
  };
}

function requiredProjectionOption(
  value: string | undefined,
  name: string
): string {
  if (value === undefined) {
    throw new InvalidArgumentError(name + " is required");
  }
  return value;
}

function requiredDecisionId(decisionIds: readonly DecisionId[]): DecisionId {
  const decisionId = decisionIds[0];
  if (decisionId === undefined) {
    throw new InvalidArgumentError("Decision ID is required");
  }
  return decisionId;
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

function createDecisionRelationOption(description: string): Option {
  return new Option("--relation <type=decision-selector>", description)
    .argParser(parseDecisionRelation)
    .conflicts("clearRelations");
}

function createDecisionRelationSummaryOption(): Option {
  return new Option(
    "--relation-summary <decision-selector=summary>",
    "Attach one optional short summary to a target in this command's complete relation set. Repeat for multiple targets."
  )
    .argParser(parseDecisionRelationSummary)
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

function createPreflightOption(): Option {
  return new Option(
    "--preflight",
    "Read and validate the current lifecycle selection without writing Decision Markdown, the derived index, or pending state."
  );
}

export function createCliProgram(
  run: RunCommand,
  setExitCode: SetExitCode,
  options: CreateCliProgramOptions = {}
): CommanderCommand {
  const cwd = options.cwd ?? process.cwd();
  const io = options.io ?? processDecisionRecordsCliIo;
  const program = new CommanderCommand()
    .name("decision-records")
    .description(
      "Query and maintain agent-oriented decision records and their lifecycle state."
    )
    .configureHelp({ showGlobalOptions: true })
    .configureOutput({ writeErr: io.stderr, writeOut: io.stdout })
    .option("--root <path>", "Workspace root.", cwd)
    .option(
      "--decisions-dir <path>",
      "Decision directory. Relative paths resolve from --root.",
      "docs/decisions"
    )
    .showHelpAfterError()
    .addHelpText(
      "afterAll",
      "\nDecision selectors remove one terminal .md suffix, then resolve a calendar-valid YYMMDD-name ID exactly or a unique semantic name. Stable identities remain extensionless IDs.\n" +
        "Candidates remain outside the index, are queried from source, and report scaffold and body readiness separately.\n" +
        "Scaffold readiness validates candidate structure; body readiness validates required nonempty sections and the 采用 field. Neither grants semantic review or lifecycle establishment.\n" +
        "Exit codes: 0 success (including a created scaffold with readiness findings), " +
        "1 paused lifecycle choice, blocking validation, or index failure, " +
        "2 invalid arguments."
    )
    .exitOverride();

  async function execute(
    command: Command,
    commanderCommand: CommanderCommand,
    decisionIds: DecisionId[] = []
  ): Promise<void> {
    setExitCode(
      await run(commandArgs(command, commanderCommand, decisionIds, cwd))
    );
  }

  const check = createSubcommand(
    program,
    "check",
    "Strictly validate Markdown metadata, tags, source locations, alignment, relations, " +
      "candidate scaffold/body readiness, and the JSON index. This is the default command.",
    { isDefault: true }
  );
  check.action(() => execute("check", check));

  const candidates = createSubcommand(
    program,
    "candidates",
    "Discover candidate scaffolds directly from decision Markdown " +
      "without adding them to the persisted decision index."
  );
  candidates.action(() => execute("candidates", candidates));

  const list = createSubcommand(
    program,
    "list",
    "List the persisted active decision snapshot by default, or filter its indexed state."
  )
    .addOption(
      new Option(
        "--alignment <value>",
        "Alignment filter for indexed decisions."
      )
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
        "--tag <tag>",
        "Require one tag. Repeat for AND filtering."
      ).argParser(parseDecisionTag)
    )
    .addOption(
      singleRelationQueryOption(
        new Option(
          "--related-to <selector>",
          "Require a directly related Decision by standard ID or unique semantic name."
        )
      )
    )
    .addOption(
      singleRelationQueryOption(
        new Option(
          "--direction <value>",
          "Direction relative to --related-to."
        ).choices(["both", "predecessors", "successors"])
      )
    )
    .addOption(
      singleRelationQueryOption(
        new Option(
          "--relation-type <type>",
          "Require one direct relation type."
        ).choices(decisionRelationTypes)
      )
    )
    .option(
      "--full-time",
      "Show the full createdAt timestamp instead of its date."
    );
  list.action(() => execute("list", list));

  const search = createSubcommand(
    program,
    "search",
    "Search established Decision content by default, or the published index metadata."
  )
    .argument(
      "<text>",
      "Text to find in selected Decision content or published metadata."
    )
    .addOption(
      new Option("--match <mode>", "Text matching mode.")
        .choices(["all", "any", "phrase"])
        .default("all")
    )
    .addOption(
      new Option(
        "--in <scope>",
        "Search scope: content reads established Markdown; metadata reads only the published index."
      )
        .choices(["content", "metadata"])
        .default("content")
    )
    .addOption(
      new Option(
        "--alignment <value>",
        "Alignment filter for indexed decisions."
      )
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
        "--tag <tag>",
        "Require one tag. Repeat for AND filtering."
      ).argParser(parseDecisionTag)
    )
    .addOption(
      singleRelationQueryOption(
        new Option(
          "--related-to <selector>",
          "Require a directly related Decision by standard ID or unique semantic name."
        )
      )
    )
    .addOption(
      singleRelationQueryOption(
        new Option(
          "--direction <value>",
          "Direction relative to --related-to."
        ).choices(["both", "predecessors", "successors"])
      )
    )
    .addOption(
      singleRelationQueryOption(
        new Option(
          "--relation-type <type>",
          "Require one direct relation type."
        ).choices(decisionRelationTypes)
      )
    );
  search.action(() => execute("search", search));

  const show = createSubcommand(
    program,
    "show",
    "Show decision metadata followed by the original Markdown body."
  ).argument(
    "<selector>",
    "Standard Decision ID or unique semantic name.",
    parseSingleDecisionId
  );
  show.action((decisionId: DecisionId) => execute("show", show, [decisionId]));

  const showCandidate = createSubcommand(
    program,
    "show-candidate",
    "Show one source-discovered candidate and its mechanical readiness before activation."
  ).argument(
    "<selector>",
    "Standard Decision ID or unique semantic name.",
    parseSingleDecisionId
  );
  showCandidate.action((decisionId: DecisionId) =>
    execute("show-candidate", showCandidate, [decisionId])
  );

  const trace = createSubcommand(
    program,
    "trace",
    "Trace available predecessors, successors, or both."
  )
    .argument(
      "<selector>",
      "Standard Decision ID or unique semantic name.",
      parseSingleDecisionId
    )
    .addOption(
      new Option("--direction <value>", "Relation direction.")
        .choices(["both", "predecessors", "successors"])
        .default("both")
    )
    .addOption(
      new Option("--depth <n>", "Maximum relation hops.").argParser(
        parseTraceDepth
      )
    );
  trace.action((decisionId: DecisionId) =>
    execute("trace", trace, [decisionId])
  );

  const syncIndex = createSubcommand(
    program,
    "sync-index",
    "Check or rebuild the JSON index from established Markdown."
  )
    .option(
      "--select <name-or-id>",
      "Allow only this Decision's source change; repeat for multiple Decisions.",
      (value: string, previous: string[]) => [...previous, value],
      []
    )
    .option("--write", "Publish the complete validated index projection.");
  syncIndex.action(() => execute("sync-index", syncIndex));

  const create = createSubcommand(
    program,
    "new",
    "Create one non-overwriting candidate scaffold. Edit its body and complete semantic review before lifecycle establishment."
  )
    .argument(
      "<selector>",
      "Standard Decision ID or semantic name for a new candidate.",
      parseSingleDecisionId
    )
    .addOption(
      new Option("--title <text>", "Candidate title.")
        .argParser(parseProjectionText)
        .makeOptionMandatory()
    )
    .addOption(
      new Option("--purpose <text>", "Candidate purpose summary.")
        .argParser(parseProjectionText)
        .makeOptionMandatory()
    )
    .addOption(
      new Option("--background <text>", "Candidate background summary.")
        .argParser(parseProjectionText)
        .makeOptionMandatory()
    )
    .addOption(
      new Option("--decision <text>", "Candidate decision summary.")
        .argParser(parseProjectionText)
        .makeOptionMandatory()
    )
    .addOption(
      new Option("--tag <tag>", "Candidate tag. Repeat for each tag.")
        .argParser(parseDecisionTag)
        .makeOptionMandatory()
    )
    .addOption(
      createDecisionRelationOption(
        "Declare one direct predecessor relation for this candidate. Repeat for its complete relation list."
      )
    )
    .addOption(createDecisionRelationSummaryOption())
    .addOption(
      new Option(
        "--preflight-alignment <value>",
        "Optionally provide one alignment only for auxiliary readiness; it is not written to the candidate."
      ).choices(decisionAlignments)
    );
  create.action((decisionId: DecisionId) =>
    execute("new", create, [decisionId])
  );

  const rename = createSubcommand(
    program,
    "rename",
    "Rename one Decision ID and semantic name, then update all managed relation targets and the complete derived index."
  )
    .argument(
      "<source-selector>",
      "Standard Decision ID or unique semantic name.",
      (value: string) => value
    )
    .argument(
      "<target-name-or-id>",
      "Semantic name or complete calendar-valid YYMMDD-name Decision ID.",
      (value: string) => value
    )
    .addOption(
      new Option(
        "--preflight",
        "Read and validate the complete rename plan without writing Decision Markdown or the derived index."
      )
    )
    .option(
      "--rename-recorded-decision",
      "Confirm renaming a Decision identity that has entered Git HEAD; Git history is not rewritten."
    );
  rename.action((source: string, target: string) =>
    execute("rename", rename, [source as DecisionId, target as DecisionId])
  );

  const stage = createSubcommand(
    program,
    "stage",
    "Build a complete pending decision snapshot from the current revision and " +
      "the explicitly selected Decision selectors."
  ).argument(
    "<selector...>",
    "Standard Decision IDs or unique semantic names.",
    parseDecisionIdList
  );
  stage.action((decisionIds: DecisionId[]) =>
    execute("stage", stage, decisionIds)
  );

  const activate = createSubcommand(
    program,
    "activate",
    "Establish one new decision candidate or reactivate one archived decision; " +
      "new candidates may record direct evolution relations and archive their " +
      "predecessors in the same transaction."
  )
    .argument(
      "<selector>",
      "Standard Decision ID or unique semantic name.",
      parseSingleDecisionId
    )
    .addOption(
      new Option(
        "--alignment <value>",
        "Alignment state for the active decision."
      )
        .choices(decisionAlignments)
        .makeOptionMandatory()
    )
    .addOption(
      createDecisionRelationOption(
        "Replace every selected successor's complete relation list with one final direct predecessor relation. Repeat for the complete replacement."
      )
    )
    .addOption(createDecisionRelationSummaryOption())
    .addOption(createClearRelationsOption())
    .addOption(createPreflightOption())
    .addOption(createKeepUnrecordedHistoryOption());
  activate.action((decisionId: DecisionId) =>
    execute("activate", activate, [decisionId])
  );

  const evolve = createSubcommand(
    program,
    "evolve",
    "Replace complete successor relations, establish selected candidates, " +
      "archive new active predecessors, and optionally discard one decision " +
      "in the same recoverable transaction."
  )
    .addOption(
      new Option(
        "--successor <alignment=decision-selector>",
        "Select one successor and confirm its whole-decision alignment. " +
          "Repeat for the complete successor set."
      )
        .argParser(parseDecisionSuccessor)
        .makeOptionMandatory()
    )
    .addOption(
      createDecisionRelationOption(
        "Replace every selected successor's complete relation list with one final direct predecessor relation. Repeat for the complete replacement."
      )
    )
    .addOption(createDecisionRelationSummaryOption())
    .addOption(createClearRelationsOption())
    .addOption(createKeepUnrecordedHistoryOption())
    .addOption(createPreflightOption())
    .addOption(
      new Option(
        "--discard <selector>",
        "Discard one Decision selected by standard ID or unique name in the same recoverable relation transaction."
      ).argParser(parseSingleDecisionId)
    )
    .option(
      "--delete-recorded-decision",
      "Confirm deletion when the discarded Decision ID has entered Git HEAD."
    );
  evolve.action(() => execute("evolve", evolve));

  const markAligned = createSubcommand(
    program,
    "mark-aligned",
    "Mark an active unaligned decision as aligned only after its complete " +
      "direction has become current fact and been verified against the relevant " +
      "fact sources."
  ).argument(
    "<selector>",
    "Standard Decision ID or unique semantic name.",
    parseSingleDecisionId
  );
  markAligned.action((decisionId: DecisionId) =>
    execute("mark-aligned", markAligned, [decisionId])
  );

  const archive = createSubcommand(
    program,
    "archive",
    "Archive active decisions while preserving their last alignment and relations."
  )
    .argument(
      "<selector...>",
      "Standard Decision IDs or unique semantic names.",
      parseDecisionIdList
    )
    .addOption(createKeepUnrecordedHistoryOption());
  archive.action((decisionIds: DecisionId[]) =>
    execute("archive", archive, decisionIds)
  );

  const discard = createSubcommand(
    program,
    "discard",
    "Delete one complete, unreferenced candidate or established decision. IDs already " +
      "recorded in Git HEAD require --delete-recorded-decision."
  )
    .argument(
      "<selector>",
      "Standard Decision ID or unique semantic name.",
      parseSingleDecisionId
    )
    .option(
      "--delete-recorded-decision",
      "Confirm deletion of a Decision ID that has entered Git HEAD."
    );
  discard.action((decisionId: DecisionId) =>
    execute("discard", discard, [decisionId])
  );

  return program;
}
