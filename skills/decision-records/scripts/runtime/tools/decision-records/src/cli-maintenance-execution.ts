/*
 * Synced TypeScript runtime; repository maintenance edits tools/decision-records/src/cli-maintenance-execution.ts.
 * Installed skill copies may be edited directly; updates overwrite matching files.
 * Repository: https://github.com/zxyycom/skills
 * Source path: tools/decision-records/src/cli-maintenance-execution.ts
 * Maintained source: https://github.com/zxyycom/skills/blob/main/tools/decision-records/src/cli-maintenance-execution.ts
 * Skill source directory: https://github.com/zxyycom/skills/tree/main/skills/decision-records
 * Rebuild: bun run sync:decision-records-cli
 */
import path from "node:path";
import { decisionFailure } from "./application-result.ts";
import {
  DecisionCollectionLockError,
  withDecisionCollectionMutationLock
} from "./decision-collection-mutation-lock.ts";
import { loadDecisionMaintenanceContext } from "./decision-maintenance-context.ts";
import { applyPreparedDecisionTransaction } from "./decision-transaction.ts";
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

export async function runPublishedDecisionLifecycle(
  args: MaintenanceArgs,
  request: DecisionLifecycleRequest,
  io: DecisionRecordsCliIo
): Promise<number> {
  const indexPath = path.resolve(
    args.workspaceRoot,
    args.decisionsDir,
    decisionIndexFileName
  );
  try {
    const result =
      args.preflight === true
        ? await executePublishedLifecycle(args, request, io)
        : await withDecisionCollectionMutationLock(indexPath, () =>
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
  const preflightAction =
    args.preflight === true &&
    (request.action === "publish" ||
      request.action === "evolve" ||
      request.action === "reactivate" ||
      request.action === "set-relations")
      ? request.action
      : null;
  const applied = await applyPreparedDecisionTransaction({
    context,
    changes: prepared.changes,
    preflight: preflightAction !== null,
    lockHeld: true
  });
  if (applied.status === "error") {
    printDecisionFailure(decisionFailure(applied.diagnostics), io);
    return { ...applied, exitCode: 1, completed: null };
  }
  if (preflightAction !== null)
    return {
      ...applied,
      exitCode: printLifecyclePreflight(preflightAction, prepared, io),
      completed: null
    };
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
