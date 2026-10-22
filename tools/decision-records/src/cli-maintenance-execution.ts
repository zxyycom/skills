import fs from "node:fs/promises";
import path from "node:path";
import { isFileSystemError } from "../../shared/src/node/filesystem.ts";
import { decisionFailure } from "./application-result.ts";
import {
  DecisionCollectionLockError,
  withDecisionCollectionMutationLock
} from "./decision-collection-mutation-lock.ts";
import {
  loadDecisionMaintenanceContext,
  ordinaryDecisionRequest
} from "./decision-maintenance-context.ts";
import { applyDecisionMaintenanceChanges } from "./decision-maintenance-transaction.ts";
import { decisionIndexFileName } from "./decision-state-index.ts";
import { resolveDecisionLifecycleRequest } from "./cli-lifecycle-selection.ts";
import {
  prepareLifecycleWithCurrentHistory,
  printLifecycleCompletion,
  printLifecyclePreflight,
  lifecyclePreflightFailure
} from "./cli-lifecycle-execution.ts";
import { printDecisionFailure } from "./cli-output.ts";
import type { DecisionLocationArgs } from "./cli-location.ts";
import {
  decisionTransactionLockFailure,
  type DecisionTransactionResult
} from "./decision-transaction.ts";
import type {
  DecisionLifecyclePreparation,
  DecisionLifecycleRequest
} from "./decision-lifecycle-service.ts";
import type { DecisionRecordsCliIo } from "./cli-io.ts";

type CompletedLifecycle = Extract<
  DecisionLifecyclePreparation,
  { status: "ok" }
>;
type PublishedLifecycleExecution = DecisionTransactionResult & {
  exitCode: number;
  completed: CompletedLifecycle | null;
};
const noChanges: Extract<DecisionTransactionResult, { status: "ok" }> = {
  status: "ok",
  changed: false,
  diagnostics: [],
  errors: []
};
type MaintenanceArgs = DecisionLocationArgs & { preflight?: boolean };

/** null delegates only a high-risk operation or the first-publication bootstrap. */
export async function runPublishedDecisionLifecycle(
  args: MaintenanceArgs,
  request: DecisionLifecycleRequest,
  io: DecisionRecordsCliIo
): Promise<number | null> {
  if (!ordinaryDecisionRequest(request)) return null;
  const indexPath = path.resolve(
    args.workspaceRoot,
    args.decisionsDir,
    decisionIndexFileName
  );
  try {
    if (!(await publishedIndexAvailable(indexPath, request.action)))
      return null;
    const result = await withDecisionCollectionMutationLock(indexPath, () =>
      executePublishedLifecycle(args, request, io)
    );
    if (result.exitCode === 0 && result.completed !== null)
      printLifecycleCompletion(result.completed, io);
    return result.exitCode;
  } catch (error) {
    printPublishedLifecycleFailure(error, io);
    return 1;
  }
}

async function publishedIndexAvailable(
  indexPath: string,
  action: DecisionLifecycleRequest["action"]
): Promise<boolean> {
  try {
    await fs.lstat(indexPath);
    return true;
  } catch (error) {
    if (!isFileSystemError(error, "ENOENT")) throw error;
    if (action === "publish") return false;
    throw new Error(
      "decision-index.json is required; restore the sources and run sync-index explicitly."
    );
  }
}

async function executePublishedLifecycle(
  args: MaintenanceArgs,
  request: DecisionLifecycleRequest,
  io: DecisionRecordsCliIo
): Promise<PublishedLifecycleExecution> {
  const context = await loadDecisionMaintenanceContext(args, request);
  const resolved = resolveDecisionLifecycleRequest(context, request);
  if (resolved.status === "error") {
    printDecisionFailure(resolved.failure, io);
    return { ...noChanges, exitCode: 1, completed: null };
  }
  const prepared = await prepareLifecycleWithCurrentHistory(
    context,
    resolved.request,
    io
  );
  if (prepared === null) return { ...noChanges, exitCode: 1, completed: null };
  if (
    args.preflight === true &&
    (request.action === "publish" ||
      request.action === "evolve" ||
      request.action === "reactivate" ||
      request.action === "set-relations")
  ) {
    return {
      ...noChanges,
      exitCode: printLifecyclePreflight(request.action, prepared, io),
      completed: null
    };
  }
  const applied = await applyDecisionMaintenanceChanges({
    context,
    changes: prepared.changes,
    lockHeld: true
  });
  if (applied.status === "error") {
    printDecisionFailure(decisionFailure(applied.diagnostics), io);
    return { ...applied, exitCode: 1, completed: null };
  }
  return { ...applied, exitCode: 0, completed: prepared };
}

function printPublishedLifecycleFailure(
  error: unknown,
  io: DecisionRecordsCliIo
): void {
  if (error instanceof DecisionCollectionLockError) {
    const failure = decisionTransactionLockFailure(error);
    if (failure.status === "error")
      printDecisionFailure(decisionFailure(failure.diagnostics), io);
    return;
  }
  printDecisionFailure(
    lifecyclePreflightFailure([
      "Decision published-baseline maintenance failed: " +
        String(error) +
        "; inspect the selected sources and run check / sync-index for explicit recovery."
    ]),
    io
  );
}
