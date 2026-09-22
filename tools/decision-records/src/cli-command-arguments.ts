import { Command as CommanderCommand, InvalidArgumentError } from "commander";
import type { CliArgs, CliArgsFor, Command } from "./cli-args.ts";
import type { DecisionRecordsCliIo } from "./cli-io.ts";
import type { ParsedOptions } from "./cli-command-options.ts";
import type { DecisionId } from "./types.ts";
import {
  defaultOption,
  requiredDecisionAlignment,
  requiredDecisionId
} from "./cli-option-parsers.ts";
import { newCommandArgs } from "./cli-new-arguments.ts";
import { evolveRelationOverridesForCommand } from "./cli-evolve-relation-groups.ts";
import { resolveWorkspaceDecisionLocation } from "./decision-location.ts";

const decisionListDefaultLimit = 10;

type CommandLocation = Pick<CliArgs, "decisionsDir" | "workspaceRoot">;
type LifecycleCommand = Extract<
  Command,
  "archive" | "discard" | "evolve" | "publish" | "reactivate"
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
  const location = commandLocation(options, cwd, commanderCommand);
  return commandArgumentFactories[command]({
    command,
    commanderCommand,
    decisionIds,
    location,
    options
  });
}

function commandLocation(
  options: ParsedOptions,
  cwd: string,
  commanderCommand: CommanderCommand
): CommandLocation {
  const { error, location } = resolveWorkspaceDecisionLocation({
    cwd,
    decisionsDir: options.decisionsDir,
    root: options.root
  });
  if (error !== undefined) {
    commanderCommand.error(error.message, { code: error.code, exitCode: 2 });
  }
  return location;
}

const commandArgumentFactories: Readonly<
  Record<Command, CommandArgumentFactory>
> = {
  archive: lifecycleArguments,
  candidates: simpleArguments,
  check: simpleArguments,
  discard: lifecycleArguments,
  evolve: lifecycleArguments,
  list: ({ location, options }) => listCommandArgs(location, options),
  "mark-aligned": singleDecisionArguments,
  new: newCommandArgs,
  publish: lifecycleArguments,
  reactivate: lifecycleArguments,
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
    preflight: input.options.preflight ?? false
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
    deleteRecorded = false,
    keepUnrecordedHistory = false,
    preflight = false
  } = options;
  switch (command) {
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
        deleteRecorded
      };
    case "evolve":
      return evolveCommandArgs(commanderCommand, location, options);
    case "publish":
      return publishArguments(location, options, decisionIds, {
        keepUnrecordedHistory,
        preflight
      });
    case "reactivate":
      return reactivateArguments(location, options, decisionIds, preflight);
  }
}

function publishArguments(
  location: CommandLocation,
  options: ParsedOptions,
  decisionIds: DecisionId[],
  flags: { keepUnrecordedHistory: boolean; preflight: boolean }
): CliArgsFor<"publish"> {
  return {
    ...location,
    alignment: requiredDecisionAlignment(options.alignment),
    command: "publish",
    decisionId: requiredDecisionId(decisionIds),
    ...flags
  };
}

function reactivateArguments(
  location: CommandLocation,
  options: ParsedOptions,
  decisionIds: DecisionId[],
  preflight: boolean
): CliArgsFor<"reactivate"> {
  return {
    ...location,
    alignment: requiredDecisionAlignment(options.alignment),
    command: "reactivate",
    decisionId: requiredDecisionId(decisionIds),
    preflight
  };
}

function evolveCommandArgs(
  command: CommanderCommand,
  location: CommandLocation,
  options: ParsedOptions
): CliArgsFor<"evolve"> {
  const {
    deleteRecorded = false,
    discard: discardId,
    keepUnrecordedHistory = false,
    preflight = false,
    successor: successors = []
  } = options;
  if (deleteRecorded && discardId === undefined) {
    command.error("--delete-recorded requires --discard <decision-id>", {
      exitCode: 2,
      code: "decision-records.missing-discard"
    });
  }
  return {
    ...location,
    discardId: discardId ?? null,
    command: "evolve",
    deleteRecorded,
    keepUnrecordedHistory,
    preflight,
    ...evolveRelationOverridesForCommand(command),
    successors
  };
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

function secondDecisionSelector(decisionIds: readonly DecisionId[]): string {
  return decisionIds[1] === undefined ? "" : decisionIds[1];
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
    traceJson: options.json ?? false,
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
