import { Command as CommanderCommand, Option } from "commander";
import { decisionAlignments, type DecisionId } from "./types.ts";
import {
  parseDecisionIdList,
  parseDecisionSuccessor,
  parseDecisionTag,
  parseProjectionText,
  parseSingleDecisionId
} from "./cli-option-parsers.ts";
import { collectEvolveRelationEvents } from "./cli-evolve-relation-groups.ts";
import {
  createClearRelationsOption,
  createDecisionRelationOption,
  createDecisionRelationSummaryOption,
  createKeepUnrecordedHistoryOption,
  createPreflightOption,
  createSubcommand
} from "./cli-program-options.ts";
import type { CliProgramExecute } from "./cli-program-queries.ts";

export function registerMutationCommands(
  program: CommanderCommand,
  execute: CliProgramExecute
): void {
  registerNewCommand(program, execute);
  registerRenameCommand(program, execute);
  registerStageCommand(program, execute);
  registerActivateCommand(program, execute);
  registerEvolveCommand(program, execute);
  registerMarkAlignedCommand(program, execute);
  registerArchiveCommand(program, execute);
  registerDiscardCommand(program, execute);
}

function registerNewCommand(
  program: CommanderCommand,
  execute: CliProgramExecute
): void {
  const create = createSubcommand(
    program,
    "new",
    "Create one non-overwriting candidate scaffold. Edit its body and complete semantic review before lifecycle establishment."
  )
    .argument(
      "<selector>",
      "Standard Decision ID or semantic name for a new candidate.",
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
    .addOption(createDecisionRelationSummaryOption())
    .addOption(
      new Option(
        "--preflight-alignment <value>",
        "Optionally provide one alignment only for auxiliary readiness; it is not written to the candidate."
      ).choices(decisionAlignments)
    );
  create.action((decisionId: DecisionId) =>
    execute("new", create, [decisionId])
  );
}

function registerRenameCommand(
  program: CommanderCommand,
  execute: CliProgramExecute
): void {
  const rename = createSubcommand(
    program,
    "rename",
    "Rename one Decision ID and semantic name, then update all managed relation targets and the complete derived index."
  )
    .argument(
      "<source-selector>",
      "Standard Decision ID or unique semantic name.",
      (value: string) => value
    )
    .argument(
      "<target-name-or-id>",
      "Semantic name or complete calendar-valid YYMMDD-name Decision ID.",
      (value: string) => value
    )
    .addOption(
      new Option(
        "--preflight",
        "Read and validate the complete rename plan without writing Decision Markdown or the derived index."
      )
    )
    .option(
      "--rename-recorded-decision",
      "Confirm renaming a Decision identity that has entered Git HEAD; Git history is not rewritten."
    );
  rename.action((source: string, target: string) =>
    execute("rename", rename, [source as DecisionId, target as DecisionId])
  );
}

function registerStageCommand(
  program: CommanderCommand,
  execute: CliProgramExecute
): void {
  const stage = createSubcommand(
    program,
    "stage",
    "Build a complete pending decision snapshot from the current revision and " +
      "the explicitly selected Decision selectors."
  ).argument(
    "<selector...>",
    "Standard Decision IDs or unique semantic names.",
    parseDecisionIdList
  );
  stage.action((decisionIds: DecisionId[]) =>
    execute("stage", stage, decisionIds)
  );
}

function registerActivateCommand(
  program: CommanderCommand,
  execute: CliProgramExecute
): void {
  const activate = createSubcommand(
    program,
    "activate",
    "Establish one new decision candidate or reactivate one archived decision; " +
      "new candidates may record direct evolution relations and archive their " +
      "predecessors in the same transaction."
  )
    .argument(
      "<selector>",
      "Standard Decision ID or unique semantic name.",
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
    .addOption(createDecisionRelationSummaryOption())
    .addOption(createClearRelationsOption())
    .addOption(createPreflightOption())
    .addOption(createKeepUnrecordedHistoryOption());
  activate.action((decisionId: DecisionId) =>
    execute("activate", activate, [decisionId])
  );
}

function registerEvolveCommand(
  program: CommanderCommand,
  execute: CliProgramExecute
): void {
  const evolve = createSubcommand(
    program,
    "evolve",
    "Replace complete successor relations, establish selected candidates, " +
      "archive new active predecessors, and optionally discard one decision " +
      "in the same recoverable transaction."
  )
    .addOption(
      new Option(
        "--successor <alignment=decision-selector>",
        "Select one successor and confirm its whole-decision alignment. " +
          "Repeat for the complete successor set."
      )
        .argParser(parseDecisionSuccessor)
        .makeOptionMandatory()
    )
    .addOption(createKeepUnrecordedHistoryOption())
    .addOption(createPreflightOption())
    .addOption(
      new Option(
        "--discard <selector>",
        "Discard one Decision selected by standard ID or unique name in the same recoverable relation transaction."
      ).argParser(parseSingleDecisionId)
    )
    .option(
      "--delete-recorded-decision",
      "Confirm deletion when the discarded Decision ID has entered Git HEAD."
    );
  evolve
    .addOption(
      new Option(
        "--relations-for <successor-selector>",
        "Start one complete relation replacement for this selected successor; following relation options belong to this group until the next --relations-for."
      )
    )
    .addOption(
      new Option(
        "--relation <type=decision-selector>",
        "Declare one final direct predecessor relation in the current --relations-for group, or replace every selected successor when no group is used."
      )
    )
    .addOption(
      new Option(
        "--relation-summary <decision-selector=summary>",
        "Attach one optional summary to a relation in the current group or the ungrouped complete replacement."
      )
    )
    .addOption(
      new Option(
        "--clear-relations",
        "Replace the current group's complete relation list with an explicit empty set, or clear every selected successor when no group is used."
      )
    );
  collectEvolveRelationEvents(evolve);
  evolve.action(() => execute("evolve", evolve));
}

function registerMarkAlignedCommand(
  program: CommanderCommand,
  execute: CliProgramExecute
): void {
  const markAligned = createSubcommand(
    program,
    "mark-aligned",
    "Mark an active unaligned decision as aligned only after its complete " +
      "direction has become current fact and been verified against the relevant " +
      "fact sources."
  ).argument(
    "<selector>",
    "Standard Decision ID or unique semantic name.",
    parseSingleDecisionId
  );
  markAligned.action((decisionId: DecisionId) =>
    execute("mark-aligned", markAligned, [decisionId])
  );
}

function registerArchiveCommand(
  program: CommanderCommand,
  execute: CliProgramExecute
): void {
  const archive = createSubcommand(
    program,
    "archive",
    "Archive active decisions while preserving their last alignment and relations."
  )
    .argument(
      "<selector...>",
      "Standard Decision IDs or unique semantic names.",
      parseDecisionIdList
    )
    .addOption(createKeepUnrecordedHistoryOption());
  archive.action((decisionIds: DecisionId[]) =>
    execute("archive", archive, decisionIds)
  );
}

function registerDiscardCommand(
  program: CommanderCommand,
  execute: CliProgramExecute
): void {
  const discard = createSubcommand(
    program,
    "discard",
    "Delete one complete, unreferenced candidate or established decision. IDs already " +
      "recorded in Git HEAD require --delete-recorded-decision."
  )
    .argument(
      "<selector>",
      "Standard Decision ID or unique semantic name.",
      parseSingleDecisionId
    )
    .option(
      "--delete-recorded-decision",
      "Confirm deletion of a Decision ID that has entered Git HEAD."
    );
  discard.action((decisionId: DecisionId) =>
    execute("discard", discard, [decisionId])
  );
}
