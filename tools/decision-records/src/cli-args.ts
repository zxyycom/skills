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
  type DecisionId,
  type DecisionListAlignment,
  type DecisionListStatus,
  type DecisionRelation,
  type DecisionRelationOverride,
  type DecisionSuccessor,
  type DecisionTag,
  type DecisionTraceDirection
} from "./types.ts";
import { isDecisionId, isDecisionTag } from "./decision-path.ts";

export type Command =
  | "activate"
  | "archive"
  | "candidates"
  | "check"
  | "discard"
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
  | LocatedCommand<
      "activate",
      {
        alignment: DecisionAlignment;
        decisionId: DecisionId;
        keepUnrecordedHistory: boolean;
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
        relationOverride: DecisionRelationOverride;
        successors: DecisionSuccessor[];
      }
    >
  | LocatedCommand<
      "list",
      {
        alignment: DecisionListAlignment;
        fullTime: boolean;
        status: DecisionListStatus;
        tags: DecisionTag[];
      }
    >
  | LocatedCommand<"mark-aligned", { decisionId: DecisionId }>
  | LocatedCommand<"show", { decisionId: DecisionId }>
  | LocatedCommand<"show-candidate", { decisionId: DecisionId }>
  | LocatedCommand<"stage", { decisionIds: DecisionId[] }>
  | LocatedCommand<"sync-index", { write: boolean }>
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
  clearRelations?: boolean;
  discard?: DecisionId;
  deleteRecordedDecision?: boolean;
  decisionsDir?: string;
  depth?: number;
  direction?: DecisionTraceDirection;
  fullTime?: boolean;
  keepUnrecordedHistory?: boolean;
  relation?: DecisionRelation[];
  root?: string;
  status?: DecisionListStatus;
  successor?: DecisionSuccessor[];
  tag?: DecisionTag[];
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

function parseSingleDecisionId(
  value: string,
  previous?: DecisionId
): DecisionId {
  if (!isDecisionId(value)) {
    throw new InvalidArgumentError(
      "Decision ID is invalid; must be a basename ending in .md"
    );
  }
  if (previous !== undefined) {
    throw new InvalidArgumentError("must not be repeated");
  }
  return value;
}

function parseDecisionIdList(
  value: string,
  previous: DecisionId[] = []
): DecisionId[] {
  if (!isDecisionId(value)) {
    throw new InvalidArgumentError(
      "Decision ID is invalid; must be a basename ending in .md"
    );
  }
  if (previous.includes(value)) {
    throw new InvalidArgumentError("must not repeat a Decision ID");
  }
  return [...previous, value];
}

function parseDecisionRelation(
  value: string,
  previous: DecisionRelation[] = []
): DecisionRelation[] {
  const separatorIndex = value.indexOf("=");
  if (separatorIndex <= 0 || separatorIndex === value.length - 1) {
    throw new InvalidArgumentError("must use <type>=<decision-id>");
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
  if (!isDecisionId(target)) {
    throw new InvalidArgumentError(
      "target must be a Decision ID basename ending in .md"
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
    throw new InvalidArgumentError("must use <alignment>=<decision-id>");
  }
  const alignmentValue = value.slice(0, separatorIndex);
  if (alignmentValue !== "aligned" && alignmentValue !== "unaligned") {
    throw new InvalidArgumentError("alignment must be aligned or unaligned");
  }
  const decisionId = value.slice(separatorIndex + 1);
  if (!isDecisionId(decisionId)) {
    throw new InvalidArgumentError(
      "decision ID must be a basename ending in .md"
    );
  }
  if (previous.some((successor) => successor.decisionId === decisionId)) {
    throw new InvalidArgumentError("must not repeat a successor Decision ID");
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
  decisionIds: DecisionId[] = []
): CliArgs {
  const options = commanderCommand.optsWithGlobals<ParsedOptions>();
  const location = {
    decisionsDir: options.decisionsDir ?? "docs/decisions",
    workspaceRoot: options.root ?? process.cwd()
  };
  switch (command) {
    case "activate":
      return {
        ...location,
        alignment: requiredDecisionAlignment(options.alignment),
        command,
        decisionId: requiredDecisionId(decisionIds),
        keepUnrecordedHistory: options.keepUnrecordedHistory ?? false,
        relationOverride: decisionRelationOverride(options)
      };
    case "archive":
      return {
        ...location,
        command,
        decisionIds,
        keepUnrecordedHistory: options.keepUnrecordedHistory ?? false
      };
    case "candidates":
    case "check":
      return { ...location, command };
    case "discard":
      return {
        ...location,
        command,
        decisionId: requiredDecisionId(decisionIds),
        deleteRecordedDecision: options.deleteRecordedDecision ?? false
      };
    case "mark-aligned":
    case "show":
    case "show-candidate":
      return {
        ...location,
        command,
        decisionId: requiredDecisionId(decisionIds)
      };
    case "stage":
      return { ...location, command, decisionIds };
    case "evolve":
      if (
        options.deleteRecordedDecision === true &&
        options.discard === undefined
      ) {
        commanderCommand.error(
          "--delete-recorded-decision requires --discard <decision-id>",
          { exitCode: 2, code: "decision-records.missing-discard" }
        );
      }
      return {
        ...location,
        discardId: options.discard ?? null,
        command,
        deleteRecordedDecision: options.deleteRecordedDecision ?? false,
        keepUnrecordedHistory: options.keepUnrecordedHistory ?? false,
        relationOverride: decisionRelationOverride(options),
        successors: options.successor ?? []
      };
    case "list":
      return {
        ...location,
        alignment: options.alignment ?? "all",
        command,
        fullTime: options.fullTime ?? false,
        status: options.status ?? "active",
        tags: options.tag ?? []
      };
    case "sync-index":
      return { ...location, command, write: options.write ?? false };
    case "trace":
      return {
        ...location,
        command,
        decisionId: requiredDecisionId(decisionIds),
        traceDepth: options.depth ?? null,
        traceDirection: options.direction ?? "both"
      };
  }
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

function createDecisionRelationOption(): Option {
  return new Option(
    "--relation <type=decision-id>",
    "Replace every selected successor's complete relation list with one final " +
      "direct predecessor relation. Repeat for the complete replacement."
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
    .description(
      "Query and maintain agent-oriented decision records and their lifecycle state."
    )
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
      "\nDecision IDs are stable Markdown basenames, for example use-semantic-title.md.\n" +
        "Reviewable candidates remain outside the index and are queried from source.\n" +
        "Exit codes: 0 success (queries and scoped maintenance may report warnings), " +
        "1 paused lifecycle choice, blocking validation, or index failure, " +
        "2 invalid arguments."
    )
    .exitOverride();

  async function execute(
    command: Command,
    commanderCommand: CommanderCommand,
    decisionIds: DecisionId[] = []
  ): Promise<void> {
    setExitCode(await run(commandArgs(command, commanderCommand, decisionIds)));
  }

  const check = createSubcommand(
    program,
    "check",
    "Strictly validate Markdown metadata, tags, source locations, alignment, relations, " +
      "reviewable candidates, and the JSON index. This is the default command.",
    { isDefault: true }
  );
  check.action(() => execute("check", check));

  const candidates = createSubcommand(
    program,
    "candidates",
    "Discover complete reviewable candidates directly from decision Markdown " +
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
    .option(
      "--full-time",
      "Show the full createdAt timestamp instead of its date."
    );
  list.action(() => execute("list", list));

  const show = createSubcommand(
    program,
    "show",
    "Show decision metadata followed by the original Markdown body."
  ).argument(
    "<decision-id>",
    "Stable Decision ID basename.",
    parseSingleDecisionId
  );
  show.action((decisionId: DecisionId) => execute("show", show, [decisionId]));

  const showCandidate = createSubcommand(
    program,
    "show-candidate",
    "Show one source-discovered candidate for semantic review before activation."
  ).argument(
    "<decision-id>",
    "Stable Decision ID basename.",
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
      "<decision-id>",
      "Stable Decision ID basename.",
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
    "Check the JSON index against established Markdown; use --write to rebuild it."
  ).option("--write", "Write the index rebuilt from established decisions.");
  syncIndex.action(() => execute("sync-index", syncIndex));

  const stage = createSubcommand(
    program,
    "stage",
    "Build a complete pending decision snapshot from the current revision and " +
      "the explicitly selected filesystem Decision IDs."
  ).argument(
    "<decision-id...>",
    "Stable Decision ID basenames.",
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
      "<decision-id>",
      "Stable Decision ID basename.",
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
    .addOption(createDecisionRelationOption())
    .addOption(createClearRelationsOption())
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
        "--successor <alignment=decision-id>",
        "Select one successor and confirm its whole-decision alignment. " +
          "Repeat for the complete successor set."
      )
        .argParser(parseDecisionSuccessor)
        .makeOptionMandatory()
    )
    .addOption(createDecisionRelationOption())
    .addOption(createClearRelationsOption())
    .addOption(createKeepUnrecordedHistoryOption())
    .addOption(
      new Option(
        "--discard <decision-id>",
        "Discard one Decision ID in the same recoverable relation transaction."
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
    "<decision-id>",
    "Stable Decision ID basename.",
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
      "<decision-id...>",
      "Stable Decision ID basenames.",
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
      "<decision-id>",
      "Stable Decision ID basename.",
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
