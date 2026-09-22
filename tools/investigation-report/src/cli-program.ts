import process from "node:process";
import { Command as CommanderCommand } from "commander";
import type {
  InvestigationCommand,
  InvestigationReportCliIo,
  ParsedCli
} from "./cli-contract.ts";
import { normalizeIdentitySelectorsAtCliBoundary } from "./cli-parser.ts";
import { resolveInvestigationLocation } from "./investigation-location.ts";
import { defaultInvestigationsDirectory } from "./report-path.ts";
import { processInvestigationReportCliIo } from "./cli-io.ts";
import {
  collectedRelationEvents,
  registerInvestigationCommands
} from "./cli-program-commands.ts";

type RunCommand = (input: ParsedCli) => Promise<number>;
type SetExitCode = (exitCode: number) => void;

export type CreateInvestigationProgramOptions = Readonly<{
  cwd?: string;
  io?: InvestigationReportCliIo;
}>;

export function createInvestigationCliProgram(
  run: RunCommand,
  setExitCode: SetExitCode,
  options: CreateInvestigationProgramOptions = {}
): CommanderCommand {
  const cwd = options.cwd ?? process.cwd();
  const io = options.io ?? processInvestigationReportCliIo;
  const program = new CommanderCommand()
    .name("investigation-report")
    .description(
      "Check, query, and maintain flat Investigation Report records and their derived index."
    )
    .configureHelp({ showGlobalOptions: true })
    .configureOutput({ writeErr: io.stderr, writeOut: io.stdout })
    .option(
      "--root <path>",
      "Workspace root. Defaults to the current directory.",
      cwd
    )
    .option(
      "--investigations-dir <path>",
      "Investigation directory, relative to the workspace root.",
      defaultInvestigationsDirectory
    )
    .showHelpAfterError()
    .addHelpText(
      "afterAll",
      "\nExit status: 0 success; 1 check, operation, or deletion-confirmation failure; 2 invalid CLI arguments."
    )
    .exitOverride();

  async function execute(
    command: InvestigationCommand,
    commanderCommand: CommanderCommand
  ): Promise<void> {
    setExitCode(await run(parsedCli(command, commanderCommand, cwd)));
  }

  registerInvestigationCommands(program, execute);
  return program;
}

function parsedCli(
  command: InvestigationCommand,
  commanderCommand: CommanderCommand,
  cwd: string
): ParsedCli {
  const values = collectedValues(commanderCommand);
  resolveCommandLocation(commanderCommand, values, cwd);
  const input: ParsedCli = {
    command,
    positionals: [...commanderCommand.args],
    values
  };
  const relationEvents = collectedRelationEvents(commanderCommand);
  const normalized = {
    ...input,
    ...(relationEvents === undefined ? {} : { relationEvents })
  };
  normalizeIdentitySelectorsAtCliBoundary(command, normalized);
  return normalized;
}

function collectedValues(
  commanderCommand: CommanderCommand
): Map<string, string[]> {
  const values = new Map<string, string[]>();
  const options = commanderCommand.optsWithGlobals();
  for (const option of [
    ...(commanderCommand.parent?.options ?? []),
    ...commanderCommand.options
  ]) {
    const value = options[option.attributeName()];
    if (value === undefined) continue;
    values.set(
      option.name(),
      (Array.isArray(value) ? value : [value]).map(String)
    );
  }
  return values;
}

function resolveCommandLocation(
  commanderCommand: CommanderCommand,
  values: Map<string, string[]>,
  cwd: string
): void {
  const resolution = resolveInvestigationLocation({
    cwd,
    investigationsDir: values.get("investigations-dir")?.[0],
    root: values.get("root")?.[0]
  });
  if (resolution.error !== undefined) {
    commanderCommand.error(resolution.error.message, {
      code: resolution.error.code,
      exitCode: 2
    });
  }
  values.set("root", [resolution.location.workspaceRoot]);
  values.set("investigations-dir", [resolution.location.investigationsDir]);
}
