/*
 * Synced TypeScript runtime; repository maintenance edits tools/decision-records/src/cli/program/cli-program.ts.
 * Installed skill copies may be edited directly; updates overwrite matching files.
 * Repository: https://github.com/zxyycom/skills
 * Source path: tools/decision-records/src/cli/program/cli-program.ts
 * Maintained source: https://github.com/zxyycom/skills/blob/main/tools/decision-records/src/cli/program/cli-program.ts
 * Skill source directory: https://github.com/zxyycom/skills/tree/main/skills/decision-records
 * Rebuild: bun run sync:decision-records-cli
 */
import process from "node:process";
import { Command as CommanderCommand } from "commander";
import { type DecisionId } from "../../types.ts";
import { processDecisionRecordsCliIo } from "../cli-io.ts";
import type { CliArgs, Command } from "../arguments/cli-args.ts";
import { commandArgs } from "../arguments/cli-command-arguments.ts";
import type { CreateCliProgramOptions } from "../arguments/cli-command-arguments.ts";
import { registerMutationCommands } from "./cli-program-mutations.ts";
import { registerQueryCommands } from "./cli-program-queries.ts";

export type { CreateCliProgramOptions } from "../arguments/cli-command-arguments.ts";

type RunCommand = (args: CliArgs) => Promise<number>;
type SetExitCode = (exitCode: number) => void;

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
    .option(
      "--root <path>",
      "Workspace root. Defaults to the current directory.",
      cwd
    )
    .option(
      "--decisions-dir <path>",
      "Decision directory, relative to the workspace root.",
      "docs/decisions"
    )
    .showHelpAfterError()
    .addHelpText(
      "afterAll",
      "\nDecision selectors remove one terminal .md suffix, then resolve a calendar-valid YYMMDD-name ID exactly or a unique semantic name. Stable identities remain extensionless IDs.\n" +
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

  registerQueryCommands(program, execute);
  registerMutationCommands(program, execute);
  return program;
}
