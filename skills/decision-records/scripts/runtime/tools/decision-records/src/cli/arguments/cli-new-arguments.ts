/*
 * Synced TypeScript runtime; repository maintenance edits tools/decision-records/src/cli/arguments/cli-new-arguments.ts.
 * Installed skill copies may be edited directly; updates overwrite matching files.
 * Repository: https://github.com/zxyycom/skills
 * Source path: tools/decision-records/src/cli/arguments/cli-new-arguments.ts
 * Maintained source: https://github.com/zxyycom/skills/blob/main/tools/decision-records/src/cli/arguments/cli-new-arguments.ts
 * Skill source directory: https://github.com/zxyycom/skills/tree/main/skills/decision-records
 * Rebuild: bun run sync:decision-records-cli
 */
import { InvalidArgumentError } from "commander";
import type { CliArgsFor } from "./cli-args.ts";
import type { ParsedOptions } from "./cli-command-options.ts";
import {
  defaultOption,
  requiredDecisionId,
  requiredOption
} from "./cli-option-parsers.ts";
import type { DecisionId } from "../../types.ts";

type CommandLocation = Pick<
  CliArgsFor<"new">,
  "decisionsDir" | "workspaceRoot"
>;

type NewCommandInput = {
  decisionIds: DecisionId[];
  location: CommandLocation;
  options: ParsedOptions;
};

/** Assembles the `new` candidate-scaffold arguments at the CLI boundary. */
export function newCommandArgs(input: NewCommandInput): CliArgsFor<"new"> {
  validateNewRelationOptions(input.options);
  return {
    ...input.location,
    background: requiredOption(input.options.background, "--background"),
    command: "new",
    decision: requiredOption(input.options.decision, "--decision"),
    decisionId: requiredDecisionId(input.decisionIds),
    preflightAlignment: defaultOption(input.options.preflightAlignment, null),
    purpose: requiredOption(input.options.purpose, "--purpose"),
    relations: defaultOption(input.options.relation, []),
    relationSummaries: defaultOption(input.options.relationSummary, []),
    tags: defaultOption(input.options.tag, []),
    title: requiredOption(input.options.title, "--title")
  };
}

function validateNewRelationOptions(options: ParsedOptions): void {
  if (options.relation !== undefined || options.relationSummary === undefined)
    return;
  throw new InvalidArgumentError(
    "--relation-summary requires at least one --relation"
  );
}
