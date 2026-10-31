import path from "node:path";
import { type DecisionApplicationFailure } from "../../application-result.ts";
import type { CliArgs, CliArgsFor } from "../arguments/cli-args.ts";
import type { QueryCliArgs } from "./cli-query-commands.ts";
import {
  printDecisionAttention,
  printDecisionFailure
} from "../output/cli-output.ts";
import type { DecisionRecordsCliIo } from "../cli-io.ts";
import { decisionLocation } from "../cli-location.ts";
import {
  createDecisionCandidate,
  type NewDecisionCandidateResult
} from "../../candidates/decision-candidate-service.ts";
import {
  renameDecisionRecord,
  type DecisionRenameResult
} from "../../rename/decision-rename.ts";
import { stageDecisionRecords } from "../../staging/decision-stage-service.ts";
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
        (created.verification === "failed-or-unknown"
          ? "Decision candidate mutation observed (verification incomplete): "
          : "Created decision candidate scaffold: ") +
          path.resolve(
            args.workspaceRoot,
            args.decisionsDir,
            created.sourcePath
          ) +
          "\n"
      );
      if ("decisionId" in created)
        io.stdout("Decision ID: " + created.decisionId + "\n");
      io.stdout("No lifecycle state or derived decision index was changed.\n");
    }
    printDecisionFailure(created, io);
    return created.exitCode;
  }
  printCandidateCreated(args, created, io);
  return 0;
}

/** 成功创建的集中输出；失败写入事实不走 readiness 成功 renderer。 */
function printCandidateCreated(
  args: CliArgsFor<"new">,
  created: Extract<NewDecisionCandidateResult, { status: "ok" }>,
  io: DecisionRecordsCliIo
): void {
  io.stdout(
    "Created decision candidate scaffold: " +
      path.resolve(args.workspaceRoot, args.decisionsDir, created.sourcePath) +
      "\n"
  );
  io.stdout("Decision ID: " + created.decisionId + "\n");
  io.stdout("title: " + args.title + "\n");
  io.stdout("No lifecycle state or derived decision index was changed.\n");
  for (const warning of created.warnings ?? [])
    io.stderr("Candidate warning: " + warning + "\n");
  io.stdout(
    "Decision candidate readiness after creation:\n- scaffoldValid: true\n- bodyReady: false\n"
  );
  if (args.preflightAlignment !== null)
    io.stdout(
      "- alignment preview: " +
        args.preflightAlignment +
        " (not written; publish validates the final projection)\n"
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
    if (result.changed === true && result.plan !== null)
      io.stderr(
        "Decision rename mutation observed; inspect old sourcePath: " +
          result.plan.oldSourcePath +
          "; new sourcePath: " +
          result.plan.newSourcePath +
          ".\n"
      );
    return result.exitCode;
  }
  if (result.status === "attention") {
    printDecisionAttention(result, io);
    return result.exitCode;
  }
  printRenameCompleted(result, io);
  return 0;
}

function printRenameCompleted(
  result: Extract<DecisionRenameResult, { status: "ok" }>,
  io: DecisionRecordsCliIo
): void {
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
