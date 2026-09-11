import path from "node:path";
import {
  Command as CommanderCommand,
  InvalidArgumentError,
  Option
} from "commander";
import type { CliArgs, CliArgsFor, Command } from "./cli-args.ts";
import type { DecisionRecordsCliIo } from "./cli-io.ts";
import type { ParsedOptions } from "./cli-command-options.ts";
import type { DecisionId } from "./types.ts";
import {
  decisionRelationOverride,
  requiredDecisionAlignment
} from "./cli-option-parsers.ts";

const decisionListDefaultLimit = 10;

type CommandLocation = Pick<CliArgs, "decisionsDir" | "workspaceRoot">;
type LifecycleCommand = Extract<
  Command,
  "activate" | "archive" | "discard" | "evolve"
>;
type SimpleCommand = Extract<Command, "candidates" | "check">;

export type CreateCliProgramOptions = {
  cwd?: string;
  io?: DecisionRecordsCliIo;
};

type CommandArgumentInput = {
  command: Command;
  commanderCommand: CommanderCommand;
  decisionIds: DecisionId[];
  location: CommandLocation;
  options: ParsedOptions;
};
type CommandArgumentFactory = (input: CommandArgumentInput) => CliArgs;

export function commandArgs(
  command: Command,
  commanderCommand: CommanderCommand,
  decisionIds: DecisionId[] = [],
  cwd: string
): CliArgs {
  const options = commanderCommand.optsWithGlobals<ParsedOptions>();
  const location = commandLocation(options, cwd);
  return commandArgumentFactories[command]({
    command,
    commanderCommand,
    decisionIds,
    location,
    options
  });
}

function commandLocation(options: ParsedOptions, cwd: string): CommandLocation {
  return {
    decisionsDir: options.decisionsDir ?? "docs/decisions",
    workspaceRoot: path.resolve(cwd, options.root ?? ".")
  };
}

const commandArgumentFactories: Readonly<
  Record<Command, CommandArgumentFactory>
> = {
  activate: lifecycleArguments,
  archive: lifecycleArguments,
  candidates: simpleArguments,
  check: simpleArguments,
  discard: lifecycleArguments,
  evolve: lifecycleArguments,
  list: ({ location, options }) => listCommandArgs(location, options),
  "mark-aligned": singleDecisionArguments,
  new: ({ decisionIds, location, options }) =>
    newCommandArgs(decisionIds, location, options),
  rename: renameArguments,
  search: ({ commanderCommand, location, options }) =>
    searchCommandArgs(location, options, commanderCommand.args[0]),
  show: singleDecisionArguments,
  "show-candidate": singleDecisionArguments,
  stage: ({ decisionIds, location }) => ({
    ...location,
    command: "stage",
    decisionIds
  }),
  "sync-index": syncIndexArguments,
  trace: ({ decisionIds, location, options }) =>
    traceCommandArgs(decisionIds, location, options)
};

function lifecycleArguments(input: CommandArgumentInput): CliArgs {
  return lifecycleCommandArgs(
    input.command as LifecycleCommand,
    input.commanderCommand,
    input.decisionIds,
    input.location,
    input.options
  );
}

function simpleArguments(input: CommandArgumentInput): CliArgs {
  return simpleCommandArgs(input.command as SimpleCommand, input.location);
}

function singleDecisionArguments(input: CommandArgumentInput): CliArgs {
  return {
    ...input.location,
    command: input.command as "mark-aligned" | "show" | "show-candidate",
    decisionId: requiredDecisionId(input.decisionIds)
  } as CliArgs;
}

function renameArguments(input: CommandArgumentInput): CliArgsFor<"rename"> {
  return {
    ...input.location,
    command: "rename",
    preflight: defaultOption(input.options.preflight, false),
    renameRecordedDecision: defaultOption(
      input.options.renameRecordedDecision,
      false
    ),
    source: requiredDecisionId(input.decisionIds) as string,
    target: secondDecisionSelector(input.decisionIds)
  };
}

function syncIndexArguments(
  input: CommandArgumentInput
): CliArgsFor<"sync-index"> {
  const args: CliArgsFor<"sync-index"> = {
    ...input.location,
    command: "sync-index",
    write: input.options.write ?? false
  };
  if (input.options.select !== undefined && input.options.select.length > 0) {
    args.selectors = input.options.select;
  }
  return args;
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
  validateNewRelationOptions(options);
  return {
    ...location,
    background: requiredProjectionOption(options.background, "--background"),
    command: "new",
    decision: requiredProjectionOption(options.decision, "--decision"),
    decisionId: requiredDecisionId(decisionIds),
    preflightAlignment: defaultOption(options.preflightAlignment, null),
    purpose: requiredProjectionOption(options.purpose, "--purpose"),
    relations: defaultOption(options.relation, []),
    relationSummaries: defaultOption(options.relationSummary, []),
    tags: defaultOption(options.tag, []),
    title: requiredProjectionOption(options.title, "--title")
  };
}

function validateNewRelationOptions(options: ParsedOptions): void {
  if (options.relation !== undefined || options.relationSummary === undefined)
    return;
  throw new InvalidArgumentError(
    "--relation-summary requires at least one --relation"
  );
}

function listCommandArgs(
  location: CommandLocation,
  options: ParsedOptions
): CliArgsFor<"list"> {
  validateRelatedDirection(options);
  const args: CliArgsFor<"list"> = {
    ...location,
    alignment: defaultOption(options.alignment, "all"),
    command: "list",
    detail: defaultOption(options.detail, false),
    fullTime: defaultOption(options.fullTime, false),
    limit: defaultOption(options.limit, decisionListDefaultLimit),
    offset: defaultOption(options.offset, 0),
    status: defaultOption(options.status, "active"),
    tags: defaultOption(options.tag, [])
  };
  assignListFilters(args, options);
  return args;
}

function assignListFilters(
  args: CliArgsFor<"list">,
  options: ParsedOptions
): void {
  if (options.createdFrom !== undefined)
    args.createdAtFrom = options.createdFrom;
  if (options.createdTo !== undefined) args.createdAtTo = options.createdTo;
  if (options.direction !== undefined) args.direction = options.direction;
  if (options.relatedTo !== undefined) args.relatedTo = options.relatedTo;
  if (options.relationType !== undefined)
    args.relationType = options.relationType;
}

function searchCommandArgs(
  location: CommandLocation,
  options: ParsedOptions,
  text: unknown
): CliArgsFor<"search"> {
  if (typeof text !== "string")
    throw new InvalidArgumentError("Search text is required");
  validateRelatedDirection(options);
  const args: CliArgsFor<"search"> = {
    ...location,
    alignment: defaultOption(options.alignment, "all"),
    command: "search",
    in: defaultOption(options.in, "content"),
    match: defaultOption(options.match, "all"),
    status: defaultOption(options.status, "active"),
    tags: defaultOption(options.tag, []),
    text
  };
  assignSearchFilters(args, options);
  return args;
}

function assignSearchFilters(
  args: CliArgsFor<"search">,
  options: ParsedOptions
): void {
  if (options.direction !== undefined) args.direction = options.direction;
  if (options.relatedTo !== undefined) args.relatedTo = options.relatedTo;
  if (options.relationType !== undefined)
    args.relationType = options.relationType;
}

function validateRelatedDirection(options: ParsedOptions): void {
  if (options.direction !== undefined && options.relatedTo === undefined) {
    throw new InvalidArgumentError(
      "--direction requires --related-to <selector>"
    );
  }
}

function defaultOption<T>(value: T | undefined, fallback: T): T {
  return value === undefined ? fallback : value;
}

function secondDecisionSelector(decisionIds: readonly DecisionId[]): string {
  return decisionIds[1] === undefined ? "" : decisionIds[1];
}

export function singleQueryOption(option: Option): Option {
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
    ...(options.depth === undefined
      ? {}
      : { traceDepth: options.depth === "all" ? null : options.depth }),
    ...(options.direction === undefined
      ? {}
      : { traceDirection: options.direction }),
    ...(options.maxRecords === undefined
      ? {}
      : { traceMaxRecords: options.maxRecords })
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
