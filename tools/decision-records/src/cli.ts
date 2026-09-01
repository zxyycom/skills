#!/usr/bin/env node

import process from "node:process";
import { CommanderError } from "commander";
import { isMainModule } from "../../shared/src/node/main-module.ts";
import { decisionFailure } from "./application-result.ts";
import { createCliProgram, type CliArgs, type CliArgsFor } from "./cli-args.ts";
import {
  printCandidateWarnings,
  printDecisionAttention,
  printDecisionFailure,
  printDecisionQuerySuccess
} from "./cli-output.ts";
import {
  processDecisionRecordsCliIo,
  type DecisionRecordsCliIo
} from "./cli-io.ts";
import {
  loadDecisionHistoryBaseline,
  type DecisionHistoryBaseline
} from "./decision-history-baseline.ts";
import {
  requiresDecisionHistoryBaseline,
  prepareDecisionLifecycle,
  type DecisionLifecycleRequest
} from "./decision-lifecycle-service.ts";
import {
  executeDecisionQuery,
  type DecisionLocation,
  type DecisionQueryRequest
} from "./decision-query-service.ts";
import { applyDecisionChanges } from "./decision-transaction.ts";
import { stageDecisionRecords } from "./decision-stage-service.ts";
import {
  loadDecisionValidationContext,
  validateDecisionRecords,
  type DecisionValidationOptions
} from "./index.ts";
import { scanDecisionRecords } from "./scan.ts";
import {
  compareDecisionRecords,
  type DecisionScan,
  type DecisionScanOptions
} from "./types.ts";

type DecisionLocationArgs = {
  decisionsDir: string;
  workspaceRoot: string;
};

async function runQuery(
  request: DecisionQueryRequest,
  io: DecisionRecordsCliIo
): Promise<number> {
  const result = await executeDecisionQuery(request);
  if (result.status === "error") {
    printDecisionFailure(result, io);
    return result.exitCode;
  }
  printDecisionQuerySuccess(result, io);
  return 0;
}

async function runCheck(
  args: CliArgsFor<"check">,
  io: DecisionRecordsCliIo
): Promise<number> {
  return await runQuery(
    {
      command: "check",
      location: decisionLocation(args)
    },
    io
  );
}

async function runCandidates(
  args: CliArgsFor<"candidates">,
  io: DecisionRecordsCliIo
): Promise<number> {
  return await runQuery(
    {
      command: "candidates",
      location: decisionLocation(args)
    },
    io
  );
}

async function runList(
  args: CliArgsFor<"list">,
  io: DecisionRecordsCliIo
): Promise<number> {
  return await runQuery(
    {
      alignment: args.alignment,
      command: "list",
      fullTime: args.fullTime,
      location: decisionLocation(args),
      status: args.status,
      tags: args.tags
    },
    io
  );
}

async function runShow(
  args: CliArgsFor<"show">,
  io: DecisionRecordsCliIo
): Promise<number> {
  return await runQuery(
    {
      command: "show",
      location: decisionLocation(args),
      decisionId: args.decisionId
    },
    io
  );
}

async function runShowCandidate(
  args: CliArgsFor<"show-candidate">,
  io: DecisionRecordsCliIo
): Promise<number> {
  return await runQuery(
    {
      command: "show-candidate",
      location: decisionLocation(args),
      decisionId: args.decisionId
    },
    io
  );
}

async function runTrace(
  args: CliArgsFor<"trace">,
  io: DecisionRecordsCliIo
): Promise<number> {
  return await runQuery(
    {
      command: "trace",
      direction: args.traceDirection,
      location: decisionLocation(args),
      maxDepth: args.traceDepth,
      decisionId: args.decisionId
    },
    io
  );
}

async function runSyncIndex(
  args: CliArgsFor<"sync-index">,
  io: DecisionRecordsCliIo
): Promise<number> {
  return await runQuery(
    {
      command: "sync-index",
      location: decisionLocation(args)
    },
    io
  );
}

async function runStage(
  args: CliArgsFor<"stage">,
  io: DecisionRecordsCliIo
): Promise<number> {
  const result = await stageDecisionRecords({
    location: decisionLocation(args),
    decisionIds: args.decisionIds
  });
  if (result.status === "error") {
    printDecisionFailure(result, io);
    return result.exitCode;
  }
  io.stdout(
    "Staged a complete pending decision snapshot for " +
      result.selectedIds.length +
      " selected Decision ID(s), including " +
      result.indexRelativePath +
      " (" +
      result.pendingFileCount +
      " files in the pending decision scope).\n"
  );
  return 0;
}

async function runActivate(
  args: CliArgsFor<"activate">,
  io: DecisionRecordsCliIo
): Promise<number> {
  const scan = await loadLifecycleScan(
    args,
    {
      allowEmptyDecisionSet: true
    },
    io
  );
  return scan === null
    ? 1
    : await applyLifecycle(
        args,
        scan,
        {
          action: "activate",
          alignment: args.alignment,
          keepUnrecordedHistory: args.keepUnrecordedHistory,
          decisionId: args.decisionId,
          relationOverride: args.relationOverride
        },
        io
      );
}

async function runEvolve(
  args: CliArgsFor<"evolve">,
  io: DecisionRecordsCliIo
): Promise<number> {
  const scan = await loadLifecycleScan(
    args,
    {
      allowEmptyDecisionSet: true
    },
    io
  );
  return scan === null
    ? 1
    : await applyLifecycle(
        args,
        scan,
        {
          action: "evolve",
          discardId: args.discardId,
          deleteRecordedDecision: args.deleteRecordedDecision,
          keepUnrecordedHistory: args.keepUnrecordedHistory,
          relationOverride: args.relationOverride,
          successors: args.successors
        },
        io
      );
}

async function runMarkAligned(
  args: CliArgsFor<"mark-aligned">,
  io: DecisionRecordsCliIo
): Promise<number> {
  return await runValidatedMaintenance(
    args,
    {
      action: "mark-aligned",
      decisionId: args.decisionId
    },
    io
  );
}

async function runArchive(
  args: CliArgsFor<"archive">,
  io: DecisionRecordsCliIo
): Promise<number> {
  return await runValidatedMaintenance(
    args,
    {
      action: "archive",
      keepUnrecordedHistory: args.keepUnrecordedHistory,
      decisionIds: args.decisionIds
    },
    io
  );
}

async function runValidatedMaintenance(
  args: DecisionLocationArgs,
  request: DecisionLifecycleRequest,
  io: DecisionRecordsCliIo
): Promise<number> {
  const scan = await loadLifecycleScan(
    args,
    {
      checkIndexText: false,
      scanErrorPolicy: "source-only"
    },
    io
  );
  return scan === null ? 1 : await applyLifecycle(args, scan, request, io);
}

async function runDiscard(
  args: CliArgsFor<"discard">,
  io: DecisionRecordsCliIo
): Promise<number> {
  const { result } = await loadDecisionValidationContext(
    decisionScanOptions(args),
    { checkIndexText: false }
  );
  return await applyLifecycle(
    args,
    result.scan,
    {
      action: "discard",
      decisionId: args.decisionId,
      deleteRecordedDecision: args.deleteRecordedDecision
    },
    io
  );
}

async function loadLifecycleScan(
  args: DecisionLocationArgs,
  validationOptions: DecisionValidationOptions,
  io: DecisionRecordsCliIo
): Promise<DecisionScan | null> {
  const { result } = await loadDecisionValidationContext(
    decisionScanOptions(args),
    validationOptions
  );
  if (result.errors.length > 0) {
    printDecisionFailure(decisionFailure(result.errors), io);
    return null;
  }
  return result.scan;
}

async function applyLifecycle(
  args: DecisionLocationArgs,
  scan: DecisionScan,
  request: DecisionLifecycleRequest,
  io: DecisionRecordsCliIo
): Promise<number> {
  let historyBaseline: DecisionHistoryBaseline | null = null;
  if (requiresDecisionHistoryBaseline(scan, request)) {
    const loadedBaseline = await loadDecisionHistoryBaseline(scan);
    if (loadedBaseline.status === "error") {
      printDecisionFailure(loadedBaseline, io);
      return loadedBaseline.exitCode;
    }
    historyBaseline = loadedBaseline.baseline;
  }
  const prepared = prepareDecisionLifecycle(scan, request, {
    historyBaseline
  });
  if (prepared.status === "attention") {
    printDecisionAttention(prepared, io);
    return prepared.exitCode;
  }
  if (prepared.status === "error") {
    printDecisionFailure(prepared, io);
    return prepared.exitCode;
  }
  const errors = await applyDecisionChanges({
    changes: prepared.changes,
    originalScan: scan,
    scanOptions: decisionScanOptions(args)
  });
  if (errors.length > 0) {
    printDecisionFailure(decisionFailure(errors), io);
    return 1;
  }
  io.stdout(`${prepared.message}\n`);
  const updatedScan = await scanDecisionRecords(decisionScanOptions(args));
  printCandidateWarnings(
    updatedScan.records
      .filter((record) => record.activationCandidate)
      .sort(compareDecisionRecords)
      .map((record) => record.sourcePath),
    io
  );
  return 0;
}

function decisionLocation(args: DecisionLocationArgs): DecisionLocation {
  return {
    decisionsDir: args.decisionsDir,
    workspaceRoot: args.workspaceRoot
  };
}

function decisionScanOptions(args: DecisionLocationArgs): DecisionScanOptions {
  return decisionLocation(args);
}

async function runCommand(
  args: CliArgs,
  io: DecisionRecordsCliIo
): Promise<number> {
  switch (args.command) {
    case "activate":
      return await runActivate(args, io);
    case "archive":
      return await runArchive(args, io);
    case "candidates":
      return await runCandidates(args, io);
    case "check":
      return await runCheck(args, io);
    case "discard":
      return await runDiscard(args, io);
    case "evolve":
      return await runEvolve(args, io);
    case "list":
      return await runList(args, io);
    case "mark-aligned":
      return await runMarkAligned(args, io);
    case "show":
      return await runShow(args, io);
    case "show-candidate":
      return await runShowCandidate(args, io);
    case "stage":
      return await runStage(args, io);
    case "sync-index":
      return await runSyncIndex(args, io);
    case "trace":
      return await runTrace(args, io);
  }
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
  return error instanceof Error ? error.message : String(error);
}

export { scanDecisionRecords, validateDecisionRecords };
export type {
  DecisionAlignment,
  DecisionCandidateDocument,
  DecisionDocument,
  DecisionId,
  DecisionIndex,
  DecisionIndexEntry,
  DecisionIndexMetadata,
  DecisionIndexStoredEntry,
  DecisionIndexState,
  DecisionListAlignment,
  DecisionListStatus,
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

if (isMainModule(import.meta.url)) {
  process.exitCode = await runDecisionRecordsCli();
}
