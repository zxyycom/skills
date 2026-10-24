/*
 * Synced TypeScript runtime; repository maintenance edits tools/decision-records/src/cli-lifecycle-commands.ts.
 * Installed skill copies may be edited directly; updates overwrite matching files.
 * Repository: https://github.com/zxyycom/skills
 * Source path: tools/decision-records/src/cli-lifecycle-commands.ts
 * Maintained source: https://github.com/zxyycom/skills/blob/main/tools/decision-records/src/cli-lifecycle-commands.ts
 * Skill source directory: https://github.com/zxyycom/skills/tree/main/skills/decision-records
 * Rebuild: bun run sync:decision-records-cli
 */
import { runPublishedDecisionLifecycle } from "./cli-maintenance-execution.ts";
import { applyPreparedDecisionTransaction } from "./decision-transaction.ts";
import { decisionFailure } from "./application-result.ts";
import { printDecisionFailure } from "./cli-output.ts";
import type { CliArgsFor } from "./cli-args.ts";
import type { DecisionRecordsCliIo } from "./cli-io.ts";
import { type DecisionLifecycleRequest } from "./decision-lifecycle-service.ts";
import {
  loadDecisionValidationContext,
  type DecisionValidationOptions
} from "./index.ts";
import type { DecisionScan } from "./types.ts";
import {
  applyLockedCandidateLifecycle,
  lifecyclePreflightFailure,
  prepareLifecycleWithCurrentHistory,
  printLifecyclePreflight
} from "./cli-lifecycle-execution.ts";
import {
  decisionScanOptions,
  type DecisionLocationArgs
} from "./cli-location.ts";
import { resolveDecisionLifecycleRequest } from "./cli-lifecycle-selection.ts";

export async function runPublish(
  args: CliArgsFor<"publish">,
  io: DecisionRecordsCliIo
): Promise<number> {
  const local = await runPublishedDecisionLifecycle(
    args,
    {
      action: "publish",
      alignment: args.alignment,
      keepUnrecordedHistory: args.keepUnrecordedHistory,
      decisionId: args.decisionId
    },
    io
  );
  if (local !== null) return local;
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
  return await runValidatedMaintenance(
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
  const local = await runPublishedDecisionLifecycle(
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
  if (local !== null) return local;
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
  const local = await runPublishedDecisionLifecycle(
    args,
    {
      action: "set-relations",
      preflight: args.preflight,
      relationOverrideGroups: args.relationOverrideGroups
    },
    io
  );
  if (local !== null) return local;
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
  return await runValidatedMaintenance(
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

export async function runValidatedMaintenance(
  args: DecisionLocationArgs,
  request: DecisionLifecycleRequest,
  io: DecisionRecordsCliIo
): Promise<number> {
  const local = await runPublishedDecisionLifecycle(args, request, io);
  if (local !== null) return local;
  const scan = await loadLifecycleScan(
    args,
    { allowEmptyDecisionSet: true },
    io
  );
  return scan === null ? 1 : await applyLifecycle(args, scan, request, io);
}

export async function runDiscard(
  args: CliArgsFor<"discard">,
  io: DecisionRecordsCliIo
): Promise<number> {
  const scan = await loadLifecycleScan(
    args,
    { allowEmptyDecisionSet: true },
    io
  );
  if (scan === null) return 1;
  return await applyLifecycle(
    args,
    scan,
    {
      action: "discard",
      decisionId: args.decisionId,
      deleteRecorded: args.deleteRecorded
    },
    io
  );
}

export async function loadLifecycleScan(
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

export async function applyLifecycle(
  args: DecisionLocationArgs & { preflight?: boolean },
  scan: DecisionScan,
  request: DecisionLifecycleRequest,
  io: DecisionRecordsCliIo
): Promise<number> {
  const resolved = resolveDecisionLifecycleRequest(scan, request);
  if (resolved.status === "error") {
    printDecisionFailure(resolved.failure, io);
    return 1;
  }
  request = resolved.request;
  if (
    args.preflight === true &&
    (request.action === "publish" ||
      request.action === "evolve" ||
      request.action === "reactivate" ||
      request.action === "set-relations")
  ) {
    const prepared = await prepareLifecycleWithCurrentHistory(
      scan,
      request,
      io
    );
    if (prepared === null) return 1;
    const checked = await applyPreparedDecisionTransaction({
      context: scan,
      changes: prepared.changes,
      preflight: true
    });
    if (checked.status === "error") {
      printDecisionFailure(decisionFailure(checked.diagnostics), io);
      return 1;
    }
    return printLifecyclePreflight(request.action, prepared, io);
  }
  return await applyLockedCandidateLifecycle(args, scan, request, io);
}
