/*
 * Synced TypeScript runtime; repository maintenance edits tools/decision-records/src/cli-program-options.ts.
 * Installed skill copies may be edited directly; updates overwrite matching files.
 * Repository: https://github.com/zxyycom/skills
 * Source path: tools/decision-records/src/cli-program-options.ts
 * Maintained source: https://github.com/zxyycom/skills/blob/main/tools/decision-records/src/cli-program-options.ts
 * Skill source directory: https://github.com/zxyycom/skills/tree/main/skills/decision-records
 * Rebuild: bun run sync:decision-records-cli
 */
import {
  Command as CommanderCommand,
  InvalidArgumentError,
  Option
} from "commander";
import {
  parseDecisionRelation,
  parseDecisionRelationSummary
} from "./cli-option-parsers.ts";

export function createSubcommand(
  program: CommanderCommand,
  nameAndArgs: string,
  description: string
): CommanderCommand {
  return program
    .command(nameAndArgs)
    .description(description)
    .allowExcessArguments(false)
    .exitOverride();
}

export function createDecisionRelationOption(description: string): Option {
  return new Option(
    "--relation <type=decision-selector>",
    description
  ).argParser(parseDecisionRelation);
}

export function createDecisionRelationSummaryOption(): Option {
  return new Option(
    "--relation-summary <decision-selector=summary>",
    "Attach one optional short summary to a target in this command's complete relation set. Repeat for multiple targets."
  ).argParser(parseDecisionRelationSummary);
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

export function singleQueryOption(option: Option): Option {
  const parse = option.parseArg;
  return option.argParser((value, previous) => {
    if (previous !== undefined) {
      throw new InvalidArgumentError(`--${option.name()} must not be repeated`);
    }
    return parse === undefined ? value : parse(value, previous);
  });
}
