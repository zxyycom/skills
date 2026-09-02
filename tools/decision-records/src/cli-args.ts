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
  type DecisionRelationOverride,
  type DecisionSuccessor,
  type DecisionTag,
  type DecisionTraceDirection
} from "./types.ts";
import { isDecisionId, isDecisionTag } from "./decision-path.ts";
import { projectionTextIssue } from "./projection.ts";
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
        fullTime: boolean;
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
        tags: DecisionTag[];
        title: string;
      }
    >
  | LocatedCommand<"show", { decisionId: DecisionId }>
  | LocatedCommand<"show-candidate", { decisionId: DecisionId }>
  | LocatedCommand<"stage", { decisionIds: DecisionId[] }>
  | LocatedCommand<"sync-index">
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
  keepUnrecordedHistory?: boolean;
  preflight?: boolean;
  preflightAlignment?: DecisionAlignment;
  purpose?: string;
  relation?: DecisionRelation[];
  root?: string;
  status?: DecisionListStatus;
  successor?: DecisionSuccessor[];
  tag?: DecisionTag[];
  title?: string;
};

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

function parseProjectionText(value: string): string {
  const normalized = value.trim();
  const issue = projectionTextIssue(normalized);
  if (issue !== null) {
    throw new InvalidArgumentError(issue);
  }
  return normalized;
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
  decisionIds: DecisionId[] = [],
  cwd: string
): CliArgs {
  const options = commanderCommand.optsWithGlobals<ParsedOptions>();
  const location = {
    decisionsDir: options.decisionsDir ?? "docs/decisions",
    workspaceRoot: path.resolve(cwd, options.root ?? ".")
  };
  switch (command) {
    case "activate":
      return {
        ...location,
        alignment: requiredDecisionAlignment(options.alignment),
        command,
        decisionId: requiredDecisionId(decisionIds),
        keepUnrecordedHistory: options.keepUnrecordedHistory ?? false,
        preflight: options.preflight ?? false,
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
    case "new":
      return {
        ...location,
        background: requiredProjectionOption(
          options.background,
          "--background"
        ),
        command,
        decision: requiredProjectionOption(options.decision, "--decision"),
        decisionId: requiredDecisionId(decisionIds),
        preflightAlignment: options.preflightAlignment ?? null,
        purpose: requiredProjectionOption(options.purpose, "--purpose"),
        relations: options.relation ?? [],
        tags: options.tag ?? [],
        title: requiredProjectionOption(options.title, "--title")
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
        preflight: options.preflight ?? false,
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
      return { ...location, command };
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
  return new Option("--relation <type=decision-id>", description)
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
      "\nDecision IDs are stable Markdown basenames, for example use-semantic-title.md.\n" +
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
    "Show one source-discovered candidate and its mechanical readiness before activation."
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
    "Rebuild the JSON index from established Markdown."
  );
  syncIndex.action(() => execute("sync-index", syncIndex));

  const create = createSubcommand(
    program,
    "new",
    "Create one non-overwriting candidate scaffold. Edit its body and complete semantic review before lifecycle establishment."
  )
    .argument(
      "<decision-id>",
      "Stable Decision ID basename.",
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
    .addOption(
      new Option(
        "--preflight-alignment <value>",
        "Optionally provide one alignment only for auxiliary readiness; it is not written to the candidate."
      ).choices(decisionAlignments)
    );
  create.action((decisionId: DecisionId) =>
    execute("new", create, [decisionId])
  );

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
    .addOption(
      createDecisionRelationOption(
        "Replace every selected successor's complete relation list with one final direct predecessor relation. Repeat for the complete replacement."
      )
    )
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
        "--successor <alignment=decision-id>",
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
    .addOption(createClearRelationsOption())
    .addOption(createKeepUnrecordedHistoryOption())
    .addOption(createPreflightOption())
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
