#!/usr/bin/env node

import process from "node:process";
import { CommanderError } from "commander";
import { isMainModule } from "../../shared/src/node/main-module.ts";
import {
  decisionFailure
} from "./application-result.ts";
import {
  createCliProgram,
  type CliArgs,
  type CliArgsFor
} from "./cli-args.ts";
import {
  printActivationCandidateWarnings,
  printDecisionAttention,
  printDecisionFailure,
  printDecisionQuerySuccess
} from "./cli-output.ts";
import {
  loadDecisionHistoryBaseline,
  type DecisionHistoryBaseline
} from "./decision-history-baseline.ts";
import {
  decisionHistoryBaselineRequirement,
  prepareDecisionLifecycle,
  type DecisionLifecycleRequest
} from "./decision-lifecycle-service.ts";
import {
  executeDecisionQuery,
  type DecisionLocation,
  type DecisionQueryRequest
} from "./decision-query-service.ts";
import {
  applyDecisionChanges
} from "./decision-transaction.ts";
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

async function runQuery(request: DecisionQueryRequest): Promise<number> {
  const result = await executeDecisionQuery(request);
  if (result.status === "error") {
    printDecisionFailure(result);
    return result.exitCode;
  }
  printDecisionQuerySuccess(result);
  return 0;
}

async function runDomains(args: CliArgsFor<"domains">): Promise<number> {
  return await runQuery({
    command: "domains",
    location: decisionLocation(args)
  });
}

async function runCheck(args: CliArgsFor<"check">): Promise<number> {
  return await runQuery({
    command: "check",
    location: decisionLocation(args)
  });
}

async function runList(args: CliArgsFor<"list">): Promise<number> {
  return await runQuery({
    alignment: args.alignment,
    command: "list",
    domain: args.domain,
    fullTime: args.fullTime,
    location: decisionLocation(args),
    status: args.status
  });
}

async function runShow(args: CliArgsFor<"show">): Promise<number> {
  return await runQuery({
    command: "show",
    location: decisionLocation(args),
    recordPath: args.recordPath
  });
}

async function runTrace(args: CliArgsFor<"trace">): Promise<number> {
  return await runQuery({
    command: "trace",
    direction: args.traceDirection,
    location: decisionLocation(args),
    maxDepth: args.traceDepth,
    recordPath: args.recordPath
  });
}

async function runSyncIndex(
  args: CliArgsFor<"sync-index">
): Promise<number> {
  return await runQuery({
    command: "sync-index",
    location: decisionLocation(args),
    write: args.write
  });
}

async function runStage(args: CliArgsFor<"stage">): Promise<number> {
  const result = await stageDecisionRecords({
    location: decisionLocation(args),
    recordPaths: args.recordPaths
  });
  if (result.status === "error") {
    printDecisionFailure(result);
    return result.exitCode;
  }
  console.log(
    "Staged a complete pending decision snapshot for "
      + result.selectedPaths.length
      + " selected decision path(s), including "
      + result.indexRelativePath
      + " ("
      + result.pendingFileCount
      + " files in the pending decision scope)."
  );
  return 0;
}

async function runActivate(args: CliArgsFor<"activate">): Promise<number> {
  return await runActivation(args);
}

async function runEvolve(args: CliArgsFor<"evolve">): Promise<number> {
  return await runActivation(args);
}

async function runSplit(args: CliArgsFor<"split">): Promise<number> {
  const scan = await loadLifecycleScan(args, {
    allowEmptyDecisionSet: true,
    scanErrorPolicy: "allow-activation-candidates"
  });
  return scan === null
    ? 1
    : await applyLifecycle(args, scan, {
        action: "split",
        keepUnrecordedHistory: args.keepUnrecordedHistory,
        predecessorPath: args.predecessorPath,
        successors: args.successors
      });
}

async function runActivation(
  args: CliArgsFor<"activate" | "evolve">
): Promise<number> {
  const scan = await loadLifecycleScan(args, {
    allowEmptyDecisionSet: true,
    scanErrorPolicy: "allow-activation-candidates"
  });
  if (scan === null) {
    return 1;
  }
  const commonRequest = {
    alignment: args.alignment,
    keepUnrecordedHistory: args.keepUnrecordedHistory,
    recordPath: args.recordPath,
    relations: args.relations
  };
  return args.command === "evolve"
    ? await applyLifecycle(args, scan, {
        ...commonRequest,
        action: args.command,
        collapseUnrecordedPath: args.collapseUnrecordedPath
      })
    : await applyLifecycle(args, scan, {
        ...commonRequest,
        action: args.command
      });
}

async function runMarkAligned(
  args: CliArgsFor<"mark-aligned">
): Promise<number> {
  return await runValidatedMaintenance(args, {
    action: "mark-aligned",
    recordPath: args.recordPath
  });
}

async function runArchive(args: CliArgsFor<"archive">): Promise<number> {
  return await runValidatedMaintenance(args, {
    action: "archive",
    keepUnrecordedHistory: args.keepUnrecordedHistory,
    recordPaths: args.recordPaths
  });
}

async function runValidatedMaintenance(
  args: DecisionLocationArgs,
  request: DecisionLifecycleRequest
): Promise<number> {
  const scan = await loadLifecycleScan(args, {
    checkIndexText: false,
    scanErrorPolicy: "source-only"
  });
  return scan === null ? 1 : await applyLifecycle(args, scan, request);
}

async function runDiscard(args: CliArgsFor<"discard">): Promise<number> {
  const { result } = await loadDecisionValidationContext(
    decisionScanOptions(args),
    { checkIndexText: false }
  );
  return await applyLifecycle(args, result.scan, {
    action: "discard",
    recordPath: args.recordPath
  });
}

async function loadLifecycleScan(
  args: DecisionLocationArgs,
  validationOptions: DecisionValidationOptions
): Promise<DecisionScan | null> {
  const { result } = await loadDecisionValidationContext(
    decisionScanOptions(args),
    validationOptions
  );
  if (result.errors.length > 0) {
    printDecisionFailure(decisionFailure(result.errors));
    return null;
  }
  return result.scan;
}

async function applyLifecycle(
  args: DecisionLocationArgs,
  scan: DecisionScan,
  request: DecisionLifecycleRequest
): Promise<number> {
  let historyBaseline: DecisionHistoryBaseline | null = null;
  if (decisionHistoryBaselineRequirement(request) !== "none") {
    const loadedBaseline = await loadDecisionHistoryBaseline(scan);
    if (loadedBaseline.status === "error") {
      printDecisionFailure(loadedBaseline);
      return loadedBaseline.exitCode;
    }
    historyBaseline = loadedBaseline.baseline;
  }
  const prepared = await prepareDecisionLifecycle(scan, request, {
    historyBaseline
  });
  if (prepared.status === "attention") {
    printDecisionAttention(prepared);
    return prepared.exitCode;
  }
  if (prepared.status === "error") {
    printDecisionFailure(prepared);
    return prepared.exitCode;
  }
  const errors = await applyDecisionChanges({
    changes: prepared.changes,
    originalScan: scan,
    scanOptions: decisionScanOptions(args)
  });
  if (errors.length > 0) {
    printDecisionFailure(decisionFailure(errors));
    return 1;
  }
  console.log(prepared.message);
  const updatedScan = await scanDecisionRecords(decisionScanOptions(args));
  printActivationCandidateWarnings(
    updatedScan.records
      .filter((record) => record.activationCandidate)
      .sort(compareDecisionRecords)
      .map((record) => record.relativePath)
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

async function runCommand(args: CliArgs): Promise<number> {
  switch (args.command) {
    case "activate":
      return await runActivate(args);
    case "archive":
      return await runArchive(args);
    case "check":
      return await runCheck(args);
    case "discard":
      return await runDiscard(args);
    case "domains":
      return await runDomains(args);
    case "evolve":
      return await runEvolve(args);
    case "list":
      return await runList(args);
    case "mark-aligned":
      return await runMarkAligned(args);
    case "show":
      return await runShow(args);
    case "split":
      return await runSplit(args);
    case "stage":
      return await runStage(args);
    case "sync-index":
      return await runSyncIndex(args);
    case "trace":
      return await runTrace(args);
  }
}

export async function runDecisionRecordsCli(
  argv: readonly string[] = process.argv.slice(2)
): Promise<number> {
  let exitCode = 0;
  const program = createCliProgram(
    runCommand,
    (value) => {
      exitCode = value;
    }
  );

  try {
    await program.parseAsync(["node", "decision-records.mjs", ...argv]);
  } catch (error) {
    if (error instanceof CommanderError) {
      return error.exitCode === 0 ? 0 : 2;
    }
    printDecisionFailure(decisionFailure([
      "Unexpected decision records command failure: " + errorText(error)
    ]));
    return 1;
  }
  return exitCode;
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export { scanDecisionRecords, validateDecisionRecords };
export type { DecisionDomainDefinition } from "./decision-domain-catalog.ts";
export type {
  DecisionAlignment,
  DecisionDocument,
  DecisionIndex,
  DecisionIndexEntry,
  DecisionIndexMetadata,
  DecisionIndexState,
  DecisionListAlignment,
  DecisionListStatus,
  DecisionMetadata,
  DecisionProjection,
  DecisionRecord,
  DecisionRelation,
  DecisionRelationType,
  DecisionScan,
  DecisionScanOptions,
  DecisionStatus,
  DecisionValidationResult
} from "./types.ts";

if (isMainModule(import.meta.url)) {
  process.exitCode = await runDecisionRecordsCli();
}
