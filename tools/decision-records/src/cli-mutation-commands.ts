import path from "node:path";
import {
  decisionFileSystemErrorText,
  type DecisionApplicationFailure
} from "./application-result.ts";
import type { CliArgs, CliArgsFor } from "./cli-args.ts";
import type { QueryCliArgs } from "./cli-query-commands.ts";
import { printDecisionAttention, printDecisionFailure } from "./cli-output.ts";
import type { DecisionRecordsCliIo } from "./cli-io.ts";
import { decisionLocation } from "./cli-location.ts";
import { createDecisionCandidate } from "./decision-candidate-service.ts";
import { readCandidateSelection } from "./decision-candidate-context.ts";
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
  try {
    const selected = await readCandidateSelection(args, args.decisionId);
    const candidate = selected.records[0];
    io.stdout("Decision candidate readiness after creation:\n");
    io.stdout(
      "- scaffoldValid: " + (candidate?.scaffoldValid ?? "unavailable") + "\n"
    );
    io.stdout("- bodyReady: " + (candidate?.bodyReady ?? "unavailable") + "\n");
    if (args.preflightAlignment !== null)
      io.stdout(
        "- alignment preview: " +
          args.preflightAlignment +
          " (not written; publish validates the final projection)\n"
      );
  } catch (error) {
    io.stderr(
      "Candidate readiness unavailable: " +
        decisionFileSystemErrorText(error) +
        "\n"
    );
  }
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
