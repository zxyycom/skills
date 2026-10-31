import {
  InvalidArgumentError,
  type Command as CommanderCommand
} from "commander";
import type { CliArgsFor } from "./cli-args.ts";
import type { ParsedOptions } from "./cli-command-options.ts";
import {
  defaultOption,
  validateRelatedDirection
} from "./cli-option-parsers.ts";

type SearchCommandInput = Readonly<{
  commanderCommand: CommanderCommand;
  location: Readonly<
    Pick<CliArgsFor<"search">, "decisionsDir" | "workspaceRoot">
  >;
  options: Readonly<ParsedOptions>;
}>;

/** 在 CLI 边界归一化 search 参数，并拒绝不适用于所选范围的选项。 */
export function searchCommandArgs({
  commanderCommand,
  location,
  options
}: SearchCommandInput): CliArgsFor<"search"> {
  const text: unknown = commanderCommand.args[0];
  if (typeof text !== "string")
    throw new InvalidArgumentError("Search text is required");
  validateRelatedDirection(options);
  if (options.limit !== undefined && options.in !== "metadata") {
    commanderCommand.error("--limit requires --in metadata", {
      code: "decision-records.content-search-limit",
      exitCode: 2
    });
  }
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
  if (options.limit !== undefined) args.limit = options.limit;
  assignSearchFilters(args, options);
  return args;
}

function assignSearchFilters(
  args: CliArgsFor<"search">,
  options: Readonly<ParsedOptions>
): void {
  if (options.direction !== undefined) args.direction = options.direction;
  if (options.relatedTo !== undefined) args.relatedTo = options.relatedTo;
  if (options.relationType !== undefined)
    args.relationType = options.relationType;
}
