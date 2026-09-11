import { Command as CommanderCommand, Option } from "commander";
import type { Command } from "./cli-args.ts";
import { stateIndexQueryMaximumLimit } from "../../index-runtime/src/index.ts";
import {
  decisionAlignments,
  decisionRelationTypes,
  establishedDecisionStatuses,
  type DecisionId
} from "./types.ts";
import {
  parseDecisionListTimestamp,
  parseDecisionTag,
  parseListLimit,
  parseListOffset,
  parseSingleDecisionId,
  parseTraceDepth,
  parseTraceMaxRecords
} from "./cli-option-parsers.ts";
import { singleQueryOption } from "./cli-command-arguments.ts";
import { createSubcommand } from "./cli-program-options.ts";

const decisionListDefaultLimit = 10;

export type CliProgramExecute = (
  command: Command,
  commanderCommand: CommanderCommand,
  decisionIds?: DecisionId[]
) => Promise<void>;

export function registerQueryCommands(
  program: CommanderCommand,
  execute: CliProgramExecute
): void {
  registerCheckCommand(program, execute);
  registerCandidatesCommand(program, execute);
  registerListCommand(program, execute);
  registerSearchCommand(program, execute);
  registerShowCommand(program, execute);
  registerShowCandidateCommand(program, execute);
  registerTraceCommand(program, execute);
  registerSyncIndexCommand(program, execute);
}

function registerCheckCommand(
  program: CommanderCommand,
  execute: CliProgramExecute
): void {
  const check = createSubcommand(
    program,
    "check",
    "Strictly validate Markdown metadata, tags, source locations, alignment, relations, " +
      "candidate scaffold/body readiness, and the JSON index. This is the default command.",
    { isDefault: true }
  );
  check.action(() => execute("check", check));
}

function registerCandidatesCommand(
  program: CommanderCommand,
  execute: CliProgramExecute
): void {
  const candidates = createSubcommand(
    program,
    "candidates",
    "Discover candidate scaffolds directly from decision Markdown " +
      "without adding them to the persisted decision index."
  );
  candidates.action(() => execute("candidates", candidates));
}

function registerListCommand(
  program: CommanderCommand,
  execute: CliProgramExecute
): void {
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
      singleQueryOption(
        new Option(
          "--related-to <selector>",
          "Require a directly related Decision by standard ID or unique semantic name."
        )
      )
    )
    .addOption(
      singleQueryOption(
        new Option(
          "--direction <value>",
          "Direction relative to --related-to."
        ).choices(["both", "predecessors", "successors"])
      )
    )
    .addOption(
      singleQueryOption(
        new Option(
          "--relation-type <type>",
          "Require one direct relation type."
        ).choices(decisionRelationTypes)
      )
    )
    .option(
      "--full-time",
      "Show the full createdAt timestamp instead of its date."
    )
    .option("--detail", "Show full facets and the existing multi-line records.")
    .addOption(
      singleQueryOption(
        new Option(
          "--created-from <timestamp>",
          "Inclusive createdAt lower bound."
        ).argParser(parseDecisionListTimestamp)
      )
    )
    .addOption(
      singleQueryOption(
        new Option(
          "--created-to <timestamp>",
          "Inclusive createdAt upper bound."
        ).argParser(parseDecisionListTimestamp)
      )
    )
    .addOption(
      singleQueryOption(
        new Option(
          "--limit <count>",
          `Page size (default: ${decisionListDefaultLimit}, maximum: ${stateIndexQueryMaximumLimit}).`
        ).argParser(parseListLimit)
      )
    )
    .addOption(
      singleQueryOption(
        new Option("--offset <count>", "Page offset (default: 0).").argParser(
          parseListOffset
        )
      )
    );
  list.action(() => execute("list", list));
}

function registerSearchCommand(
  program: CommanderCommand,
  execute: CliProgramExecute
): void {
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
      singleQueryOption(
        new Option(
          "--related-to <selector>",
          "Require a directly related Decision by standard ID or unique semantic name."
        )
      )
    )
    .addOption(
      singleQueryOption(
        new Option(
          "--direction <value>",
          "Direction relative to --related-to."
        ).choices(["both", "predecessors", "successors"])
      )
    )
    .addOption(
      singleQueryOption(
        new Option(
          "--relation-type <type>",
          "Require one direct relation type."
        ).choices(decisionRelationTypes)
      )
    );
  search.action(() => execute("search", search));
}

function registerShowCommand(
  program: CommanderCommand,
  execute: CliProgramExecute
): void {
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
}

function registerShowCandidateCommand(
  program: CommanderCommand,
  execute: CliProgramExecute
): void {
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
}

function registerTraceCommand(
  program: CommanderCommand,
  execute: CliProgramExecute
): void {
  const trace = createSubcommand(
    program,
    "trace",
    "Return a bounded JSON relation slice for one Decision."
  )
    .argument(
      "<selector>",
      "Standard Decision ID or unique semantic name.",
      parseSingleDecisionId
    )
    .addOption(
      singleQueryOption(
        new Option(
          "--direction <value>",
          "Relation direction; defaults to both."
        ).choices(["both", "predecessors", "successors"])
      )
    )
    .addOption(
      singleQueryOption(
        new Option(
          "--depth <n|all>",
          "Maximum relation hops; defaults to 5, or use all."
        ).argParser(parseTraceDepth)
      )
    )
    .addOption(
      singleQueryOption(
        new Option(
          "--max-records <n>",
          "Maximum unique records; defaults to 50."
        ).argParser(parseTraceMaxRecords)
      )
    );
  trace.action((decisionId: DecisionId) =>
    execute("trace", trace, [decisionId])
  );
}

function registerSyncIndexCommand(
  program: CommanderCommand,
  execute: CliProgramExecute
): void {
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
}
