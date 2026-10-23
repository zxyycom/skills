/*
 * Synced TypeScript runtime; repository maintenance edits tools/decision-records/src/cli-lifecycle-execution.ts.
 * Installed skill copies may be edited directly; updates overwrite matching files.
 * Repository: https://github.com/zxyycom/skills
 * Source path: tools/decision-records/src/cli-lifecycle-execution.ts
 * Maintained source: https://github.com/zxyycom/skills/blob/main/tools/decision-records/src/cli-lifecycle-execution.ts
 * Skill source directory: https://github.com/zxyycom/skills/tree/main/skills/decision-records
 * Rebuild: bun run sync:decision-records-cli
 */
import type { DecisionSourceCapture } from "./decision-strict-preparation.ts";
import { loadDecisionTransactionValidationContext } from "./scan-snapshot.ts";
import { createDecisionRecordLookup } from "./decision-record-lookup.ts";
import {
  decisionDiagnosticFromReason,
  decisionFailure,
  type DecisionApplicationFailure,
  type DecisionMutationOutcome
} from "./application-result.ts";
import {
  DecisionCollectionLockError,
  withDecisionCollectionMutationLock
} from "./decision-collection-mutation-lock.ts";
import {
  loadDecisionHistoryBaseline,
  type DecisionHistoryBaseline
} from "./decision-history-baseline.ts";
import {
  prepareDecisionLifecycle,
  requiresDecisionHistoryBaseline,
  type DecisionLifecyclePreparation,
  type DecisionLifecycleRequest
} from "./decision-lifecycle-service.ts";
import {
  applyDecisionChanges,
  applyLockedDecisionChanges,
  decisionTransactionLockFailure
} from "./decision-transaction.ts";
import {
  compareDecisionRecords,
  type DecisionScan,
  type DecisionPreparationContext
} from "./types.ts";
import {
  printCandidateWarnings,
  printDecisionAttention,
  printDecisionFailure
} from "./cli-output.ts";
import { printDecisionRelationReview } from "./cli-output-relation-review.ts";
import type { DecisionRecordsCliIo } from "./cli-io.ts";
import {
  decisionScanOptions,
  type DecisionLocationArgs
} from "./cli-location.ts";
import { resolveDecisionLifecycleRequest } from "./cli-lifecycle-selection.ts";

type LockedLifecycleOperationResult = {
  committed: boolean;
  exitCode: number;
  outcome: DecisionMutationOutcome;
};

export async function applyLockedCandidateLifecycle(
  args: DecisionLocationArgs,
  initialScan: DecisionScan,
  request: DecisionLifecycleRequest,
  io: DecisionRecordsCliIo
): Promise<number> {
  let completed: Extract<
    DecisionLifecyclePreparation,
    { status: "ok" }
  > | null = null;
  let remainingCandidates: string[] = [];
  try {
    const result = await withDecisionCollectionMutationLock(
      initialScan.indexPath,
      async () => {
        const locked = await loadLockedLifecycleScan(args, io);
        if (locked === null) return noChangeLifecycleResult();
        const lockedScan = locked.scan;
        const resolved = resolveDecisionLifecycleRequest(lockedScan, request);
        if (resolved.status === "error") {
          printDecisionFailure(resolved.failure, io);
          return noChangeLifecycleResult();
        }
        const prepared = await prepareLifecycleWithCurrentHistory(
          lockedScan,
          resolved.request,
          io
        );
        if (prepared === null) return noChangeLifecycleResult();
        completed = prepared;
        const changed = new Set(
          prepared.changes.map((change) => change.decisionPath)
        );
        remainingCandidates = lockedScan.records
          .filter(
            (record) =>
              record.activationCandidate && !changed.has(record.decisionPath)
          )
          .sort(compareDecisionRecords)
          .map((record) => record.sourcePath);
        return await applyPreparedLifecycle({
          deferSuccessOutput: true,
          io,
          lockHeld: true,
          prepared,
          scan: lockedScan,
          sourceCapture: locked.sourceCapture
        });
      }
    );
    if (result.exitCode === 0 && completed !== null) {
      printLifecycleCompletion(completed, io);
      printCandidateWarnings(remainingCandidates, io);
    }
    return result.exitCode;
  } catch (error) {
    const transaction = lifecycleLockFailure(error);
    printDecisionFailure(decisionFailure(transaction.diagnostics), io);
    return 1;
  }
}

async function loadLockedLifecycleScan(
  args: DecisionLocationArgs,
  io: DecisionRecordsCliIo
): Promise<{
  scan: DecisionScan;
  sourceCapture?: DecisionSourceCapture;
} | null> {
  const { result, sourceCapture } =
    await loadDecisionTransactionValidationContext(decisionScanOptions(args), {
      allowEmptyDecisionSet: true
    });
  if (result.errors.length > 0) {
    printDecisionFailure(lifecyclePreflightFailure(result.errors), io);
    return null;
  }
  return { scan: result.scan, sourceCapture };
}

export async function prepareLifecycleWithCurrentHistory(
  scan: DecisionPreparationContext,
  request: DecisionLifecycleRequest,
  io: DecisionRecordsCliIo
): Promise<Extract<DecisionLifecyclePreparation, { status: "ok" }> | null> {
  const records = createDecisionRecordLookup(scan.records);
  let historyBaseline: DecisionHistoryBaseline | null = null;
  if (requiresDecisionHistoryBaseline(scan, request, records)) {
    const loadedBaseline = await loadDecisionHistoryBaseline(scan);
    if (loadedBaseline.status === "error") {
      printDecisionFailure(withLifecycleNoChange(loadedBaseline), io);
      return null;
    }
    historyBaseline = loadedBaseline.baseline;
  }
  const prepared = prepareDecisionLifecycle(scan, request, {
    historyBaseline,
    records
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

export function printLifecyclePreflight(
  action: "evolve" | "publish" | "reactivate" | "set-relations",
  prepared: Extract<DecisionLifecyclePreparation, { status: "ok" }>,
  io: DecisionRecordsCliIo
): number {
  io.stdout(
    "Decision " + action + " preflight passed: " + prepared.message + "\n"
  );
  if (prepared.relationReview !== undefined)
    printDecisionRelationReview(prepared.relationReview, io);
  io.stdout(
    "No Decision Markdown, derived index, or pending state was changed. Re-run the lifecycle command with the complete current parameters to establish it.\n"
  );
  return 0;
}

export async function applyPreparedLifecycle(options: {
  deferSuccessOutput?: boolean;
  io: DecisionRecordsCliIo;
  lockHeld: boolean;
  prepared: Extract<DecisionLifecyclePreparation, { status: "ok" }>;
  scan: DecisionScan;
  sourceCapture?: DecisionSourceCapture;
}): Promise<LockedLifecycleOperationResult> {
  const { io, lockHeld, prepared, scan } = options;
  const transaction = await applyLifecycleTransaction(
    scan,
    prepared,
    lockHeld,
    options.sourceCapture
  );
  if (transaction.status === "error") {
    printDecisionFailure(decisionFailure(transaction.diagnostics), io);
    return {
      committed: transaction.committed === true,
      exitCode: 1,
      outcome: transaction.outcome
    };
  }
  if (options.deferSuccessOutput !== true)
    printLifecycleCompletion(prepared, io);
  return { committed: transaction.changed, exitCode: 0, outcome: "no-change" };
}

function applyLifecycleTransaction(
  scan: DecisionScan,
  prepared: Extract<DecisionLifecyclePreparation, { status: "ok" }>,
  lockHeld: boolean,
  sourceCapture?: DecisionSourceCapture
) {
  const options = {
    changes: prepared.changes,
    originalScan: scan
  };
  return lockHeld
    ? applyLockedDecisionChanges({ ...options, sourceCapture })
    : applyDecisionChanges(options);
}

export function printLifecycleCompletion(
  prepared: Extract<DecisionLifecyclePreparation, { status: "ok" }>,
  io: DecisionRecordsCliIo
): void {
  io.stdout(prepared.message + "\n");
  if (prepared.relationReview !== undefined)
    printDecisionRelationReview(
      { ...prepared.relationReview, phase: "committed" },
      io
    );
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
    const outcome =
      operation.committed && operation.outcome === "no-change"
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

export function lifecyclePreflightFailure(
  errors: readonly string[]
): DecisionApplicationFailure {
  return decisionFailure(
    errors.map((reason) =>
      decisionDiagnosticFromReason(
        {
          code: "decision-records.lifecycle-preflight-failed",
          outcome: "no-change",
          recovery:
            "Correct the reported decision collection problem. For an established alignment, restore the trusted historical alignment, run sync-index, then retry the command.",
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
