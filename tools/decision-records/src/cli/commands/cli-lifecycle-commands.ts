import { runPublishedDecisionLifecycle } from "./cli-maintenance-execution.ts";
import type { CliArgsFor } from "../arguments/cli-args.ts";
import type { DecisionRecordsCliIo } from "../cli-io.ts";

export async function runPublish(
  args: CliArgsFor<"publish">,
  io: DecisionRecordsCliIo
): Promise<number> {
  return await runPublishedDecisionLifecycle(
    args,
    {
      action: "publish",
      alignment: args.alignment,
      keepUnrecordedHistory: args.keepUnrecordedHistory,
      decisionId: args.decisionId
    },
    io
  );
}

export async function runReactivate(
  args: CliArgsFor<"reactivate">,
  io: DecisionRecordsCliIo
): Promise<number> {
  return await runPublishedDecisionLifecycle(
    args,
    {
      action: "reactivate",
      alignment: args.alignment,
      decisionId: args.decisionId
    },
    io
  );
}

export async function runEvolve(
  args: CliArgsFor<"evolve">,
  io: DecisionRecordsCliIo
): Promise<number> {
  return await runPublishedDecisionLifecycle(
    args,
    {
      action: "evolve",
      discardId: args.discardId,
      deleteRecorded: args.deleteRecorded,
      keepUnrecordedHistory: args.keepUnrecordedHistory,
      relationOverride: args.relationOverride,
      relationOverrideGroups: args.relationOverrideGroups,
      successors: args.successors
    },
    io
  );
}

export async function runSetRelations(
  args: CliArgsFor<"set-relations">,
  io: DecisionRecordsCliIo
): Promise<number> {
  return await runPublishedDecisionLifecycle(
    args,
    {
      action: "set-relations",
      preflight: args.preflight,
      relationOverrideGroups: args.relationOverrideGroups
    },
    io
  );
}

export async function runMarkAligned(
  args: CliArgsFor<"mark-aligned">,
  io: DecisionRecordsCliIo
): Promise<number> {
  return await runPublishedDecisionLifecycle(
    args,
    {
      action: "mark-aligned",
      decisionId: args.decisionId
    },
    io
  );
}

export async function runArchive(
  args: CliArgsFor<"archive">,
  io: DecisionRecordsCliIo
): Promise<number> {
  return await runPublishedDecisionLifecycle(
    args,
    {
      action: "archive",
      keepUnrecordedHistory: args.keepUnrecordedHistory,
      decisionIds: args.decisionIds
    },
    io
  );
}

export async function runDiscard(
  args: CliArgsFor<"discard">,
  io: DecisionRecordsCliIo
): Promise<number> {
  return await runPublishedDecisionLifecycle(
    args,
    {
      action: "discard",
      decisionId: args.decisionId,
      deleteRecorded: args.deleteRecorded
    },
    io
  );
}
