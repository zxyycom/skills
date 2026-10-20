/*
 * Synced TypeScript runtime; repository maintenance edits tools/decision-records/src/cli-mutation-commands.ts.
 * Installed skill copies may be edited directly; updates overwrite matching files.
 * Repository: https://github.com/zxyycom/skills
 * Source path: tools/decision-records/src/cli-mutation-commands.ts
 * Maintained source: https://github.com/zxyycom/skills/blob/main/tools/decision-records/src/cli-mutation-commands.ts
 * Skill source directory: https://github.com/zxyycom/skills/tree/main/skills/decision-records
 * Rebuild: bun run sync:decision-records-cli
 */
import path from "node:path";
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
  runArchive,
  runDiscard,
  runEvolve,
  runMarkAligned,
  runPublish,
  runReactivate,
  runSetRelations
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
        "Created decision candidate scaffold: " +
          path.resolve(
            args.workspaceRoot,
            args.decisionsDir,
            created.sourcePath
          ) +
          "\n"
      );
      io.stdout("No lifecycle state or derived decision index was changed.\n");
    }
    printDecisionFailure(created, io);
    return created.exitCode;
  }
  io.stdout(
    "Created decision candidate scaffold: " +
      path.resolve(args.workspaceRoot, args.decisionsDir, created.sourcePath) +
      "\n"
  );
  io.stdout("Decision ID: " + created.decisionId + "\n");
  io.stdout("title: " + args.title + "\n");
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
  io.stdout("Decision candidate readiness after creation:\n");
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
    io.stdout("- scaffoldValid: unavailable\n");
    io.stdout("- bodyReady: unavailable\n");
    io.stderr(
      "- preflight: unavailable (" + decisionFileSystemErrorText(error) + ")\n"
    );
    printNewCandidateAlignment(args, io);
  }
}

function printNewCandidateReadinessResult(
  args: CliArgsFor<"new">,
  candidate: DecisionScan["records"][number] | undefined,
  errors: readonly string[],
  scan: DecisionScan,
  io: DecisionRecordsCliIo
): void {
  if (candidate === undefined) {
    io.stdout("- scaffoldValid: unavailable\n- bodyReady: unavailable\n");
    io.stderr(
      "- preflight: unavailable (created candidate could not be re-read)\n"
    );
  } else {
    io.stdout("- scaffoldValid: " + candidate.scaffoldValid + "\n");
    io.stdout("- bodyReady: " + candidate.bodyReady + "\n");
    if (errors.length > 0)
      io.stderr("- preflight: unavailable (" + errors[0] + ")\n");
    else printNewCandidatePublishPreflight(args, scan, io);
  }
  printNewCandidateAlignment(args, io);
}

function printNewCandidatePublishPreflight(
  args: CliArgsFor<"new">,
  scan: DecisionScan,
  io: DecisionRecordsCliIo
): void {
  const preparation = prepareDecisionLifecycle(
    scan,
    {
      action: "publish",
      alignment: args.preflightAlignment ?? "unaligned",
      decisionId: args.decisionId,
      keepUnrecordedHistory: false
    },
    { historyBaseline: null }
  );
  io.stdout("- preflight: selection-incomplete (candidate remains created)\n");
  io.stderr("- " + readinessReason(preparation) + "\n");
}

function printNewCandidateAlignment(
  args: CliArgsFor<"new">,
  io: DecisionRecordsCliIo
): void {
  io.stdout(
    args.preflightAlignment === null
      ? "- alignment: unresolved (no alignment projection was prepared)\n"
      : "- alignment preview: " +
          args.preflightAlignment +
          " (provided to auxiliary preparation; full projection waits for body readiness and is not written)\n"
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
    decisionIds: args.decisionIds,
    scope: args.scope
  });
  if (result.status === "error") {
    printDecisionFailure(withStageNoChange(result), io);
    return result.exitCode;
  }
  io.stdout(
    "Staged a pending decision snapshot (scope: " +
      result.scope +
      ") for " +
      result.selectedIds.length +
      " selected Decision ID(s): " +
      result.pendingFileCount +
      " files in the pending decision scope, including " +
      result.indexRelativePath +
      ".\n"
  );
  io.stdout(
    "Written paths: " + (result.writtenPaths.join(", ") || "none") + ".\n"
  );
  io.stdout(
    "Preserved unrelated pending paths: " +
      (result.preservedPendingPaths.join(", ") || "none") +
      "; caller-owned paths: " +
      (result.callerOwnedPaths.join(", ") || "none") +
      ".\n"
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
  publish: runPublish,
  reactivate: runReactivate,
  archive: runArchive,
  discard: runDiscard,
  evolve: runEvolve,
  "set-relations": runSetRelations,
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
