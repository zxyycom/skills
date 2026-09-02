#!/usr/bin/env node

import process from "node:process";
import { CommanderError } from "commander";
import { isMainModule } from "../../shared/src/node/main-module.ts";
import {
  decisionDiagnosticFromReason,
  decisionFailure,
  decisionFileSystemErrorText,
  type DecisionApplicationFailure,
  type DecisionMutationOutcome
} from "./application-result.ts";
import { createCliProgram, type CliArgs, type CliArgsFor } from "./cli-args.ts";
import { createDecisionCandidate } from "./decision-candidate-service.ts";
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
  type DecisionLifecyclePreparation,
  type DecisionLifecycleRequest
} from "./decision-lifecycle-service.ts";
import {
  executeDecisionQuery,
  type DecisionLocation,
  type DecisionQueryRequest
} from "./decision-query-service.ts";
import {
  applyDecisionChanges,
  applyLockedDecisionChanges,
  decisionTransactionLockFailure
} from "./decision-transaction.ts";
import {
  DecisionCollectionLockError,
  withDecisionCollectionMutationLock
} from "./decision-collection-mutation-lock.ts";
import { stageDecisionRecords } from "./decision-stage-service.ts";
import {
  loadDecisionValidationContext,
  validateDecisionScan,
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

type LockedLifecycleOperationResult = {
  committed: boolean;
  exitCode: number;
  outcome: DecisionMutationOutcome;
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

async function runNew(
  args: CliArgsFor<"new">,
  io: DecisionRecordsCliIo
): Promise<number> {
  const created = await createDecisionCandidate(args);
  if (created.status === "error") {
    if ("sourcePath" in created) {
      io.stdout(
        "Created decision candidate scaffold: " + created.sourcePath + "\n"
      );
      io.stdout("No lifecycle state or derived decision index was changed.\n");
    }
    printDecisionFailure(created, io);
    return created.exitCode;
  }
  io.stdout(
    "Created decision candidate scaffold: " + created.sourcePath + "\n"
  );
  io.stdout("No lifecycle state or derived decision index was changed.\n");
  await printNewCandidateReadiness(args, io);
  return 0;
}

async function printNewCandidateReadiness(
  args: CliArgsFor<"new">,
  io: DecisionRecordsCliIo
): Promise<void> {
  io.stderr("Decision candidate readiness after creation:\n");
  try {
    const { result } = await loadDecisionValidationContext(
      decisionScanOptions(args),
      { allowEmptyDecisionSet: true }
    );
    const candidate = result.scan.records.find(
      (record) => record.decisionId === args.decisionId
    );
    printNewCandidateReadinessResult(
      args,
      candidate,
      result.errors,
      result.scan,
      io
    );
  } catch (error) {
    io.stderr("- scaffoldValid: unavailable\n");
    io.stderr("- bodyReady: unavailable\n");
    io.stderr(
      "- preflight: unavailable (" + decisionFileSystemErrorText(error) + ")\n"
    );
    printNewCandidateNextStep(args, io);
  }
}

function printNewCandidateReadinessResult(
  args: CliArgsFor<"new">,
  candidate: DecisionScan["records"][number] | undefined,
  errors: readonly string[],
  scan: DecisionScan,
  io: DecisionRecordsCliIo
): void {
  io.stderr("- scaffoldValid: " + (candidate?.scaffoldValid === true) + "\n");
  io.stderr(
    "- bodyReady: " +
      (candidate?.bodyReady === true) +
      " (edit the fixed sections before lifecycle establishment)\n"
  );
  if (errors.length > 0 || candidate === undefined) {
    io.stderr(
      "- preflight: unavailable (" +
        (errors[0] ?? "created candidate could not be re-read") +
        ")\n"
    );
  } else {
    const preparation = prepareDecisionLifecycle(
      scan,
      {
        action: "activate",
        alignment: args.preflightAlignment ?? "unaligned",
        decisionId: args.decisionId,
        keepUnrecordedHistory: false,
        relationOverride: { kind: "source" }
      },
      { historyBaseline: null }
    );
    io.stderr(
      "- preflight: selection-incomplete (" +
        readinessReason(preparation) +
        ")\n"
    );
  }
  printNewCandidateNextStep(args, io);
}

function printNewCandidateNextStep(
  args: CliArgsFor<"new">,
  io: DecisionRecordsCliIo
): void {
  io.stderr(
    args.preflightAlignment === null
      ? "- alignment: unresolved (no alignment projection was prepared)\n"
      : "- alignment preview: " +
          args.preflightAlignment +
          " (provided to auxiliary preparation; full projection waits for body readiness and is not written)\n"
  );
  io.stderr(
    "- next: edit the candidate, review it semantically, then run activate --preflight or evolve --preflight with the complete current selection; do not rerun new for this ID.\n"
  );
}

function readinessReason(preparation: DecisionLifecyclePreparation): string {
  if (preparation.status === "ok") {
    return "the candidate body unexpectedly became ready during inspection";
  }
  return (
    preparation.diagnostics[0]?.reason ?? "lifecycle selection is incomplete"
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
    printDecisionFailure(withStageNoChange(result), io);
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

function withStageNoChange(
  failure: DecisionApplicationFailure
): DecisionApplicationFailure {
  return {
    ...failure,
    diagnostics: failure.diagnostics.map((diagnostic) =>
      diagnostic.scope === undefined
        ? {
            ...diagnostic,
            ...(diagnostic.code === "decision-records.command-failed"
              ? { code: "decision-records.stage-failed" }
              : {}),
            outcome: "no-change" as const,
            scope: "Pending decision snapshot"
          }
        : diagnostic
    )
  };
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
    printDecisionFailure(lifecyclePreflightFailure(result.errors), io);
    return null;
  }
  return result.scan;
}

async function applyLifecycle(
  args: DecisionLocationArgs & { preflight?: boolean },
  scan: DecisionScan,
  request: DecisionLifecycleRequest,
  io: DecisionRecordsCliIo
): Promise<number> {
  if (request.action === "activate" || request.action === "evolve") {
    if (args.preflight === true) {
      const prepared = await prepareLifecycleWithCurrentHistory(
        scan,
        request,
        io
      );
      if (prepared === null) return 1;
      return printLifecyclePreflight(prepared, io);
    }
    return await applyLockedCandidateLifecycle(args, scan, request, io);
  }
  const prepared = await prepareLifecycleWithCurrentHistory(scan, request, io);
  if (prepared === null) return 1;
  return (await applyPreparedLifecycle(args, scan, prepared, io, false))
    .exitCode;
}

async function applyLockedCandidateLifecycle(
  args: DecisionLocationArgs,
  initialScan: DecisionScan,
  request: Extract<DecisionLifecycleRequest, { action: "activate" | "evolve" }>,
  io: DecisionRecordsCliIo
): Promise<number> {
  let completedMessage: string | null = null;
  try {
    const result = await withDecisionCollectionMutationLock(
      initialScan.indexPath,
      async () => {
        const lockedScan = await loadLifecycleScan(
          args,
          { allowEmptyDecisionSet: true },
          io
        );
        if (lockedScan === null) return noChangeLifecycleResult();
        const prepared = await prepareLifecycleWithCurrentHistory(
          lockedScan,
          request,
          io
        );
        if (prepared === null) return noChangeLifecycleResult();
        completedMessage = prepared.message;
        return await applyPreparedLifecycle(
          args,
          lockedScan,
          prepared,
          io,
          true,
          true
        );
      }
    );
    if (result.exitCode === 0 && completedMessage !== null) {
      io.stdout(completedMessage + "\n");
      const updatedScan = await scanDecisionRecords(decisionScanOptions(args));
      printCandidateWarnings(
        updatedScan.records
          .filter((record) => record.activationCandidate)
          .sort(compareDecisionRecords)
          .map((record) => record.sourcePath),
        io
      );
    }
    return result.exitCode;
  } catch (error) {
    const transaction = lifecycleLockFailure(error);
    printDecisionFailure(decisionFailure(transaction.diagnostics), io);
    return 1;
  }
}

async function prepareLifecycleWithCurrentHistory(
  scan: DecisionScan,
  request: DecisionLifecycleRequest,
  io: DecisionRecordsCliIo
): Promise<Extract<DecisionLifecyclePreparation, { status: "ok" }> | null> {
  let historyBaseline: DecisionHistoryBaseline | null = null;
  if (requiresDecisionHistoryBaseline(scan, request)) {
    const loadedBaseline = await loadDecisionHistoryBaseline(scan);
    if (loadedBaseline.status === "error") {
      printDecisionFailure(withLifecycleNoChange(loadedBaseline), io);
      return null;
    }
    historyBaseline = loadedBaseline.baseline;
  }
  const prepared = prepareDecisionLifecycle(scan, request, {
    historyBaseline
  });
  if (prepared.status === "attention") {
    printDecisionAttention(prepared, io);
    return null;
  }
  if (prepared.status === "error") {
    printDecisionFailure(withLifecycleNoChange(prepared), io);
    return null;
  }
  return prepared;
}

function printLifecyclePreflight(
  prepared: Extract<DecisionLifecyclePreparation, { status: "ok" }>,
  io: DecisionRecordsCliIo
): number {
  io.stdout("Decision lifecycle preflight passed: " + prepared.message + "\n");
  io.stdout(
    "No Decision Markdown, derived index, or pending state was changed. Re-run the lifecycle command with the complete current parameters to establish it.\n"
  );
  return 0;
}

async function applyPreparedLifecycle(
  args: DecisionLocationArgs,
  scan: DecisionScan,
  prepared: Extract<DecisionLifecyclePreparation, { status: "ok" }>,
  io: DecisionRecordsCliIo,
  lockHeld: boolean,
  deferSuccessOutput = false
): Promise<LockedLifecycleOperationResult> {
  const transaction = await (lockHeld
    ? applyLockedDecisionChanges({
        changes: prepared.changes,
        originalScan: scan,
        scanOptions: decisionScanOptions(args)
      })
    : applyDecisionChanges({
        changes: prepared.changes,
        originalScan: scan,
        scanOptions: decisionScanOptions(args)
      }));
  if (transaction.status === "error") {
    printDecisionFailure(decisionFailure(transaction.diagnostics), io);
    return {
      committed: false,
      exitCode: 1,
      outcome: transaction.outcome
    };
  }
  const updatedScan = await scanDecisionRecords(decisionScanOptions(args));
  const updatedValidation = await validateDecisionScan(updatedScan, {
    allowEmptyDecisionSet: !updatedScan.records.some(
      (record) => record.source.kind === "established"
    )
  });
  if (updatedValidation.errors.length > 0) {
    printDecisionFailure(
      decisionFailure(
        updatedValidation.errors.map((reason) =>
          decisionDiagnosticFromReason(
            {
              code: "decision-records.post-mutation-scan-failed",
              outcome: "partial-or-unknown" as const,
              recovery:
                "Inspect and reconcile the decision files and derived index before retrying another mutation.",
              scope: "Decision Markdown files and derived decision index",
              target: "Post-mutation decision collection validation"
            },
            reason
          )
        )
      ),
      io
    );
    return {
      committed: transaction.changed,
      exitCode: 1,
      outcome: "partial-or-unknown"
    };
  }
  if (!deferSuccessOutput) {
    io.stdout(`${prepared.message}\n`);
    printCandidateWarnings(
      updatedScan.records
        .filter((record) => record.activationCandidate)
        .sort(compareDecisionRecords)
        .map((record) => record.sourcePath),
      io
    );
  }
  return {
    committed: transaction.changed,
    exitCode: 0,
    outcome: "no-change"
  };
}

function noChangeLifecycleResult(): LockedLifecycleOperationResult {
  return { committed: false, exitCode: 1, outcome: "no-change" };
}

function lifecycleLockFailure(error: unknown) {
  const transaction = decisionTransactionLockFailure(error);
  const operation = lockedLifecycleOperationResult(
    error instanceof DecisionCollectionLockError ? error.operationResult : null
  );
  if (
    error instanceof DecisionCollectionLockError &&
    error.kind === "release-failed" &&
    operation !== null
  ) {
    const outcome = operation.committed
      ? "committed-cleanup-pending"
      : operation.outcome;
    const diagnostics = transaction.diagnostics.map((diagnostic) => ({
      ...diagnostic,
      outcome
    }));
    return {
      ...transaction,
      diagnostics,
      errors: diagnostics.map((diagnostic) => diagnostic.reason),
      outcome
    };
  }
  return transaction;
}

function lockedLifecycleOperationResult(
  value: unknown
): LockedLifecycleOperationResult | null {
  if (value === null || typeof value !== "object") return null;
  const result = value as Partial<LockedLifecycleOperationResult>;
  if (
    typeof result.committed !== "boolean" ||
    typeof result.exitCode !== "number" ||
    (result.outcome !== "committed-cleanup-pending" &&
      result.outcome !== "no-change" &&
      result.outcome !== "partial-or-unknown" &&
      result.outcome !== "rolled-back")
  ) {
    return null;
  }
  return result as LockedLifecycleOperationResult;
}

function lifecyclePreflightFailure(
  errors: readonly string[]
): DecisionApplicationFailure {
  return decisionFailure(
    errors.map((reason) =>
      decisionDiagnosticFromReason(
        {
          code: "decision-records.lifecycle-preflight-failed",
          outcome: "no-change",
          recovery:
            "Correct the reported decision collection problem, then retry the command.",
          scope: "Decision Markdown files and derived decision index",
          target: "Decision lifecycle preflight"
        },
        reason
      )
    )
  );
}

function withLifecycleNoChange(
  failure: DecisionApplicationFailure
): DecisionApplicationFailure {
  return {
    ...failure,
    diagnostics: failure.diagnostics.map((diagnostic) => ({
      ...diagnostic,
      ...(diagnostic.code === "decision-records.command-failed"
        ? { code: "decision-records.lifecycle-preflight-failed" }
        : {}),
      outcome: "no-change" as const,
      scope: "Decision Markdown files and derived decision index"
    }))
  };
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
    case "new":
      return await runNew(args, io);
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
  return decisionFileSystemErrorText(error);
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
