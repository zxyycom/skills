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
import { compareDecisionRecords, type DecisionScan } from "./types.ts";
import { scanDecisionRecords } from "./scan.ts";
import { validateDecisionScan } from "./index.ts";
import {
  printCandidateWarnings,
  printDecisionAttention,
  printDecisionFailure
} from "./cli-output.ts";
import type { DecisionRecordsCliIo } from "./cli-io.ts";
import {
  decisionScanOptions,
  type DecisionLocationArgs
} from "./cli-location.ts";
import { loadLifecycleScan } from "./cli-lifecycle-commands.ts";

type LockedLifecycleOperationResult = {
  committed: boolean;
  exitCode: number;
  outcome: DecisionMutationOutcome;
};

export async function applyLockedCandidateLifecycle(
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
        return await applyPreparedLifecycle({
          args,
          deferSuccessOutput: true,
          io,
          lockHeld: true,
          prepared,
          scan: lockedScan
        });
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

export async function prepareLifecycleWithCurrentHistory(
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

export function printLifecyclePreflight(
  prepared: Extract<DecisionLifecyclePreparation, { status: "ok" }>,
  io: DecisionRecordsCliIo
): number {
  io.stdout("Decision lifecycle preflight passed: " + prepared.message + "\n");
  io.stdout(
    "No Decision Markdown, derived index, or pending state was changed. Re-run the lifecycle command with the complete current parameters to establish it.\n"
  );
  return 0;
}

export async function applyPreparedLifecycle(options: {
  args: DecisionLocationArgs;
  deferSuccessOutput?: boolean;
  io: DecisionRecordsCliIo;
  lockHeld: boolean;
  prepared: Extract<DecisionLifecyclePreparation, { status: "ok" }>;
  scan: DecisionScan;
}): Promise<LockedLifecycleOperationResult> {
  const { args, io, lockHeld, prepared, scan } = options;
  const transaction = await applyLifecycleTransaction(
    args,
    scan,
    prepared,
    lockHeld
  );
  if (transaction.status === "error") {
    printDecisionFailure(decisionFailure(transaction.diagnostics), io);
    return { committed: false, exitCode: 1, outcome: transaction.outcome };
  }
  const updatedScan = await scanDecisionRecords(decisionScanOptions(args));
  const validationFailure = await postMutationValidationFailure(
    updatedScan,
    transaction.changed,
    io
  );
  if (validationFailure !== null) return validationFailure;
  if (options.deferSuccessOutput !== true)
    printLifecycleSuccess(prepared.message, updatedScan, io);
  return { committed: transaction.changed, exitCode: 0, outcome: "no-change" };
}

function applyLifecycleTransaction(
  args: DecisionLocationArgs,
  scan: DecisionScan,
  prepared: Extract<DecisionLifecyclePreparation, { status: "ok" }>,
  lockHeld: boolean
) {
  const options = {
    changes: prepared.changes,
    originalScan: scan,
    scanOptions: decisionScanOptions(args)
  };
  return lockHeld
    ? applyLockedDecisionChanges(options)
    : applyDecisionChanges(options);
}

async function postMutationValidationFailure(
  updatedScan: DecisionScan,
  changed: boolean,
  io: DecisionRecordsCliIo
): Promise<LockedLifecycleOperationResult | null> {
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
      committed: changed,
      exitCode: 1,
      outcome: "partial-or-unknown"
    };
  }
  return null;
}

function printLifecycleSuccess(
  message: string,
  updatedScan: DecisionScan,
  io: DecisionRecordsCliIo
): void {
  io.stdout(`${message}\n`);
  printCandidateWarnings(
    updatedScan.records
      .filter((record) => record.activationCandidate)
      .sort(compareDecisionRecords)
      .map((record) => record.sourcePath),
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
