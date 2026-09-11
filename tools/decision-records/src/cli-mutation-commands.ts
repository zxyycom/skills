import {
  decisionFileSystemErrorText,
  type DecisionApplicationFailure
} from "./application-result.ts";
import type { CliArgs, CliArgsFor } from "./cli-args.ts";
import type { QueryCliArgs } from "./cli-query-commands.ts";
import { printDecisionAttention, printDecisionFailure } from "./cli-output.ts";
import type { DecisionRecordsCliIo } from "./cli-io.ts";
import { decisionLocation, decisionScanOptions } from "./cli-location.ts";
import { createDecisionCandidate } from "./decision-candidate-service.ts";
import {
  prepareDecisionLifecycle,
  type DecisionLifecyclePreparation
} from "./decision-lifecycle-service.ts";
import { renameDecisionRecord } from "./decision-rename.ts";
import { stageDecisionRecords } from "./decision-stage-service.ts";
import {
  runActivate,
  runArchive,
  runDiscard,
  runEvolve,
  runMarkAligned
} from "./cli-lifecycle-commands.ts";
import { loadDecisionValidationContext } from "./index.ts";
import type { DecisionScan } from "./types.ts";

export async function runNew(
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
  await printNewCandidateReadiness(
    { ...args, decisionId: created.decisionId },
    io
  );
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

export async function runStage(
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

export async function runRename(
  args: CliArgsFor<"rename">,
  io: DecisionRecordsCliIo
): Promise<number> {
  const result = await renameDecisionRecord({
    ...decisionLocation(args),
    preflight: args.preflight,
    renameRecordedDecision: args.renameRecordedDecision,
    source: args.source,
    target: args.target
  });
  if (result.status === "error") {
    printDecisionFailure(result, io);
    return result.exitCode;
  }
  if (result.status === "attention") {
    printDecisionAttention(result, io);
    return result.exitCode;
  }
  io.stdout("Decision rename " + result.outcome + ":\n");
  io.stdout("- old ID: " + result.plan.oldId + "\n");
  io.stdout("- new ID: " + result.plan.newId + "\n");
  io.stdout("- old name: " + result.plan.oldName + "\n");
  io.stdout("- new name: " + result.plan.newName + "\n");
  io.stdout("- old sourcePath: " + result.plan.oldSourcePath + "\n");
  io.stdout("- new sourcePath: " + result.plan.newSourcePath + "\n");
  io.stdout(
    "- affected relations: " +
      (result.plan.affectedCandidateRelationCount +
        result.plan.affectedEstablishedRelationCount) +
      " (candidate " +
      result.plan.affectedCandidateRelationCount +
      ", established " +
      result.plan.affectedEstablishedRelationCount +
      ")\n"
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

const mutationCommandHandlers = {
  activate: runActivate,
  archive: runArchive,
  discard: runDiscard,
  evolve: runEvolve,
  "mark-aligned": runMarkAligned,
  new: runNew,
  rename: runRename,
  stage: runStage
} as const;

export async function runMutationCommand(
  args: Exclude<CliArgs, QueryCliArgs>,
  io: DecisionRecordsCliIo
): Promise<number> {
  const handler = mutationCommandHandlers[args.command] as (
    value: typeof args,
    output: DecisionRecordsCliIo
  ) => Promise<number>;
  return await handler(args, io);
}
