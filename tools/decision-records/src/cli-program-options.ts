import { Command as CommanderCommand, Option } from "commander";
import {
  parseDecisionRelation,
  parseDecisionRelationSummary
} from "./cli-option-parsers.ts";

export function createSubcommand(
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

export function createDecisionRelationOption(description: string): Option {
  return new Option("--relation <type=decision-selector>", description)
    .argParser(parseDecisionRelation)
    .conflicts("clearRelations");
}

export function createDecisionRelationSummaryOption(): Option {
  return new Option(
    "--relation-summary <decision-selector=summary>",
    "Attach one optional short summary to a target in this command's complete relation set. Repeat for multiple targets."
  )
    .argParser(parseDecisionRelationSummary)
    .conflicts("clearRelations");
}

export function createClearRelationsOption(): Option {
  return new Option(
    "--clear-relations",
    "Replace the complete relation list with an explicit empty set."
  ).conflicts("relation");
}

export function createKeepUnrecordedHistoryOption(): Option {
  return new Option(
    "--keep-unrecorded-history",
    "Explicitly preserve decisions that have not entered Git HEAD."
  );
}

export function createPreflightOption(): Option {
  return new Option(
    "--preflight",
    "Read and validate the current lifecycle selection without writing Decision Markdown, the derived index, or pending state."
  );
}
