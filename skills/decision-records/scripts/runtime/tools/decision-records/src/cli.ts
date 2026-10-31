/*
 * Synced TypeScript runtime; repository maintenance edits tools/decision-records/src/cli.ts.
 * Installed skill copies may be edited directly; updates overwrite matching files.
 * Repository: https://github.com/zxyycom/skills
 * Source path: tools/decision-records/src/cli.ts
 * Maintained source: https://github.com/zxyycom/skills/blob/main/tools/decision-records/src/cli.ts
 * Skill source directory: https://github.com/zxyycom/skills/tree/main/skills/decision-records
 * Rebuild: bun run sync:decision-records-cli
 */
///usr/bin/env node

import process from "node:process";
import { CommanderError } from "commander";
import { isMainModule } from "../../shared/src/node/main-module.ts";
import {
  decisionFailure,
  decisionFileSystemErrorText
} from "./application-result.ts";
import { createCliProgram } from "./cli/arguments/cli-args.ts";
import { printDecisionFailure } from "./cli/output/cli-output.ts";
import {
  processDecisionRecordsCliIo,
  type DecisionRecordsCliIo
} from "./cli/cli-io.ts";
import {
  isQueryCliArgs,
  runQueryCommand
} from "./cli/commands/cli-query-commands.ts";
import { runMutationCommand } from "./cli/commands/cli-mutation-commands.ts";
import type { CliArgs } from "./cli/arguments/cli-args.ts";
import { renameDecisionRecord } from "./rename/decision-rename.ts";
import { scanDecisionRecords } from "./scan/scan.ts";
import { validateDecisionRecords } from "./index.ts";

async function runCommand(
  args: CliArgs,
  io: DecisionRecordsCliIo
): Promise<number> {
  return await (isQueryCliArgs(args)
    ? runQueryCommand(args, io)
    : runMutationCommand(args, io));
}

export type DecisionRecordsCliOptions = {
  cwd?: string;
  io?: DecisionRecordsCliIo;
};

export async function runDecisionRecordsCli(
  argv: readonly string[] = process.argv.slice(2),
  options: DecisionRecordsCliOptions = {}
): Promise<number> {
  const cwd = options.cwd ?? process.cwd();
  const io = options.io ?? processDecisionRecordsCliIo;
  let exitCode = 0;
  const program = createCliProgram(
    (args) => runCommand(args, io),
    (value) => {
      exitCode = value;
    },
    { cwd, io }
  );

  try {
    await program.parseAsync(["node", "decision-records.ts", ...argv]);
  } catch (error) {
    if (error instanceof CommanderError) {
      return error.exitCode === 0 ? 0 : 2;
    }
    printDecisionFailure(
      decisionFailure([
        "Unexpected decision records command failure: " + errorText(error)
      ]),
      io
    );
    return 1;
  }
  return exitCode;
}

function errorText(error: unknown): string {
  return decisionFileSystemErrorText(error);
}

export { renameDecisionRecord, scanDecisionRecords, validateDecisionRecords };
export type {
  DecisionAlignment,
  DecisionCandidateDocument,
  DecisionDocument,
  DecisionId,
  DecisionIndex,
  DecisionIndexEntry,
  DecisionIndexMetadata,
  DecisionIndexState,
  DecisionListAlignment,
  DecisionListFacets,
  DecisionListMonthFacet,
  DecisionListStatus,
  DecisionListTagFacet,
  DecisionListTimeFacets,
  DecisionMetadata,
  DecisionProjection,
  DecisionRecord,
  DecisionRecordSource,
  DecisionRelation,
  DecisionRelationOverride,
  DecisionRelationType,
  DecisionScan,
  DecisionScanOptions,
  DecisionSuccessor,
  DecisionTags,
  DecisionStatus,
  DecisionSourceRevision,
  DecisionSourcePath,
  DecisionTag,
  EstablishedDecisionStatus,
  DecisionValidationResult
} from "./types.ts";
export type {
  DecisionRenameOptions,
  DecisionRenamePlan,
  DecisionRenameResult
} from "./rename/decision-rename.ts";

if (isMainModule(import.meta.url)) {
  process.exitCode = await runDecisionRecordsCli();
}
