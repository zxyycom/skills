#!/usr/bin/env node

import process from "node:process";
import { CommanderError } from "commander";
import { isMainModule } from "../../shared/src/node/main-module.ts";
import {
  decisionFailure,
  decisionFileSystemErrorText
} from "./application-result.ts";
import { createCliProgram } from "./cli-args.ts";
import { printDecisionFailure } from "./cli-output.ts";
import {
  processDecisionRecordsCliIo,
  type DecisionRecordsCliIo
} from "./cli-io.ts";
import { isQueryCliArgs, runQueryCommand } from "./cli-query-commands.ts";
import { runMutationCommand } from "./cli-mutation-commands.ts";
import type { CliArgs } from "./cli-args.ts";
import { renameDecisionRecord } from "./decision-rename.ts";
import { scanDecisionRecords } from "./scan.ts";
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
    await program.parseAsync(["node", "decision-records.mjs", ...argv]);
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
} from "./decision-rename.ts";

if (isMainModule(import.meta.url)) {
  process.exitCode = await runDecisionRecordsCli();
}
