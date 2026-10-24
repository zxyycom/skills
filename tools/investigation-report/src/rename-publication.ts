import type { RecordVerificationPhase } from "../../record-operations/src/transaction-verification.ts";
import {
  prepareRenameTransaction,
  type RenameTransactionContext
} from "./rename-transaction-plan.ts";
import path from "node:path";
import {
  runRecordTransaction,
  type RecordTransactionResult
} from "../../record-operations/src/transaction.ts";
import {
  investigationMembers,
  verifyInvestigationMembers,
  type InvestigationMember
} from "./transaction-files.ts";
import type {
  InvestigationRenameHooks,
  InvestigationRenameResult,
  PreparedRename,
  ResourceMoveProgress
} from "./rename-contract.ts";
import {
  moveResourceOwner,
  restoreResourceOwnerMove
} from "./rename-resource.ts";
import { verifyResourceOwnerCopy } from "./rename-resource-move.ts";
import {
  errorText,
  renameFailure,
  renameMutation,
  renameSuccess
} from "./rename-support.ts";
import {
  verifyCommittedRename,
  verifyPreparedRename
} from "./rename-verification.ts";
import { prepareRename } from "./rename-preparation.ts";

/** Strict domain preparation hands its real write set to the one shared transaction. */
export async function publishRename(
  root: string,
  prepared: PreparedRename,
  hooks: InvestigationRenameHooks
): Promise<InvestigationRenameResult> {
  const progress: ResourceMoveProgress = {
    sourceRemovalStarted: false,
    sourceRemoved: false,
    targetClaimed: false
  };
  const members = await investigationMembers(root);
  const changedPaths: string[] = [];
  const context = { root, prepared, hooks, progress, changedPaths };
  const transaction = await runRecordTransaction({
    prepare: () => prepareRenameTransaction(context),
    fresh: (_value, phase) => verifyFreshRename(context, members, phase),
    verify: async () => {
      await verifyInvestigationMembers(root, members, changedPaths);
      if (!prepared.noChange) {
        const errors = await verifyCommittedRename(root, prepared);
        if (errors.length > 0) throw new Error(errors.join("; "));
        if (prepared.resourceMove !== null)
          await verifyResourceOwnerCopy(prepared.resourceMove, progress);
      }
    },
    verifyRecovered: async () =>
      verifyInvestigationMembers(root, members, changedPaths),
    resources: renameResourceLifecycle(context)
  });
  return renamePublicationResult(prepared, transaction);
}

function renamePublicationResult(
  prepared: PreparedRename,
  transaction: RecordTransactionResult<PreparedRename>
): InvestigationRenameResult {
  if (transaction.status === "ok")
    return renameSuccess(
      transaction.changed,
      prepared.indexPath,
      prepared.plan,
      transaction.changed ? "committed" : "no-change"
    );
  const errors = [...transaction.errors, ...transaction.cleanupErrors].map(
    errorText
  );
  return {
    ...renameFailure(
      prepared.indexPath,
      prepared.plan,
      [
        transaction.committed
          ? "Investigation rename committed, but verification failed or is unknown"
          : transaction.verification === "failed-or-unknown"
            ? "Investigation rename commit state is unknown; reconcile actual writes"
            : "Investigation rename publish failed",
        ...errors
      ],
      renameMutation(transaction.outcome)
    ),
    changed: transaction.changed
  };
}

function renameResourceLifecycle(context: RenameTransactionContext) {
  const { prepared, progress, hooks } = context;
  const move = prepared.resourceMove;
  if (move === null) return undefined;
  return {
    changed: () => progress.targetClaimed,
    apply: async () => {
      await hooks.beforeResourceMove?.();
      await moveResourceOwner(
        move,
        prepared.plan.oldId,
        prepared.plan.newId,
        progress,
        hooks.beforeSourceOwnerRemoval
      );
    },
    recover: async () => {
      const errors = await restoreResourceOwnerMove(
        move,
        prepared.plan.oldId,
        prepared.plan.newId,
        progress
      );
      if (errors.length > 0) throw new Error(errors.join("; "));
    }
  };
}

async function verifyFreshRename(
  context: RenameTransactionContext,
  members: readonly InvestigationMember[],
  phase: RecordVerificationPhase
): Promise<void> {
  const { root, prepared, progress, hooks } = context;

  if (!prepared.noChange) await hooks.beforePublish?.();
  const errors = await verifyPreparedRename(root, prepared, phase);
  if (errors.length > 0) throw new Error(errors.join("; "));
  if (prepared.resourceMove !== null) {
    phase.assertRoot(root);
    await phase.verifyMany(
      [...(progress.sourceFiles ?? [])].map(([relative, before]) => ({
        path: path.join(prepared.resourceMove!.from, relative),
        before
      }))
    );
  }
  if (prepared.noChange) {
    const fresh = await prepareRename(root, prepared.indexPath, {
      workspaceRoot: root,
      source: prepared.plan.oldId,
      target: prepared.plan.newId
    });
    if (
      "result" in fresh ||
      !fresh.value.noChange ||
      fresh.value.sourceBefore.text !== prepared.sourceBefore.text
    )
      throw new Error(
        "Investigation no-op identity or source changed during preparation"
      );
  }
  await verifyInvestigationMembers(root, members);
}
