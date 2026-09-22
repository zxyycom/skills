import { InvalidArgumentError } from "commander";
import type { CliArgsFor } from "./cli-args.ts";
import type { ParsedOptions } from "./cli-command-options.ts";
import {
  defaultOption,
  requiredDecisionId,
  requiredOption
} from "./cli-option-parsers.ts";
import type { DecisionId } from "./types.ts";

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
