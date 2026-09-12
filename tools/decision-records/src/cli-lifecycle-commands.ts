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
  applyPreparedLifecycle,
  lifecyclePreflightFailure,
  prepareLifecycleWithCurrentHistory,
  printLifecyclePreflight
} from "./cli-lifecycle-execution.ts";
import {
  decisionScanOptions,
  type DecisionLocationArgs
} from "./cli-location.ts";
import { resolveDecisionLifecycleRequest } from "./cli-lifecycle-selection.ts";

export async function runActivate(
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

export async function runEvolve(
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
          relationOverrideGroups: args.relationOverrideGroups,
          successors: args.successors
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

export async function runDiscard(
  args: CliArgsFor<"discard">,
  io: DecisionRecordsCliIo
): Promise<number> {
  const scan = await loadLifecycleScan(
    args,
    {
      allowEmptyDecisionSet: true,
      checkIndexText: false,
      scanErrorPolicy: "source-only"
    },
    io
  );
  if (scan === null) return 1;
  return await applyLifecycle(
    args,
    scan,
    {
      action: "discard",
      decisionId: args.decisionId,
      deleteRecordedDecision: args.deleteRecordedDecision
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
  return (
    await applyPreparedLifecycle({
      args,
      io,
      lockHeld: false,
      prepared,
      scan
    })
  ).exitCode;
}
