import type { InvestigationPreparation } from "./strict-preparation.ts";
import fs from "node:fs/promises";
import path from "node:path";
import { runRecordTransaction } from "../../record-operations/src/transaction.ts";
import { verifyRecordFile } from "../../record-operations/src/transaction-files.ts";
import {
  diagnosticFromError,
  type InvestigationDiagnostic,
  type InvestigationMutationDiagnostic
} from "./diagnostics.ts";
import {
  discardMutation,
  errorText,
  type AfterDiscardResourceTombstone,
  type InvestigationDiscardWriter
} from "./discard.ts";
import {
  scanResourceOwner,
  sameResourceOwnerSnapshot
} from "./rename-resource-snapshot.ts";
import {
  moveResourceOwner,
  restoreResourceOwnerMove,
  removeResourceOwnerCopy,
  verifyResourceOwnerCopy,
  verifyResourceSourceProof
} from "./rename-resource-move.ts";
import type { ResourceMoveProgress } from "./rename-contract.ts";
import type { InvestigationSource } from "./types.ts";
import type { ResourceTreeScan } from "./discard-history.ts";
import { verifyInvestigationMembers } from "./transaction-files.ts";
import { collectValidatedInvestigationCollection } from "./validation-collection.ts";

import {
  createDiscardPublicationContext,
  prepareDiscardTransaction,
  type DiscardPublicationContext
} from "./discard-transaction-plan.ts";
import type { RecordWrittenFile } from "../../record-operations/src/transaction-files.ts";
import type { RecordTransactionResult } from "../../record-operations/src/transaction.ts";
export type DiscardPublicationOptions = Readonly<{
  preparation?: InvestigationPreparation;
  afterResourceTombstone: AfterDiscardResourceTombstone;
  indexPath: string;
  indexText: string | null;
  originalIndexText: string | null;
  originalSources: readonly InvestigationSource[];
  reportPath: string;
  resourceOwnerPath: string;
  resourceSnapshot: ResourceTreeScan;
  resourceProgress?: ResourceMoveProgress;
  root: string;
  write: InvestigationDiscardWriter;
}>;
export type DiscardPublicationResult = Readonly<{
  changed: boolean;
  diagnostics: InvestigationDiagnostic[];
  errors: string[];
  mutation?: InvestigationMutationDiagnostic;
}>;

/** Actual file plan and domain resource lifecycle feed the common transaction owner. */
export async function publishDiscard(
  options: DiscardPublicationOptions
): Promise<DiscardPublicationResult> {
  const context = await createDiscardPublicationContext(options);
  const { progress, members } = context;
  const transaction = await runRecordTransaction({
    prepare: () => prepareDiscardTransaction(context),
    fresh: async () => {
      await verifyResourceSourceProof(
        context.transactionRoot,
        options.resourceOwnerPath,
        progress
      );
      await validateDiscardFormalCollection(context);
      await verifyInvestigationMembers(options.root, members);
    },
    resources: {
      changed: () => progress.targetClaimed,
      apply: () => applyDiscardResources(context),
      recover: () => recoverDiscardResources(context)
    },
    verify: async () => {
      await verifyInvestigationMembers(options.root, members, [
        options.reportPath
      ]);
      await validateDiscardFormalCollection(context);
      if (context.resourceMove !== null)
        await verifyResourceOwnerCopy(context.resourceMove, progress);
    },
    verifyRecovered: async () =>
      verifyInvestigationMembers(options.root, members, [options.reportPath]),
    cleanup: (_value, writes) => cleanupDiscardTombstone(context, writes)
  });
  return discardPublicationResult(context, transaction);
}
async function validateDiscardFormalCollection(
  context: DiscardPublicationContext
): Promise<void> {
  if (context.options.indexText === null) return;
  const collection = await collectValidatedInvestigationCollection(
    context.options.root,
    { allowEmptyCollection: true }
  );
  if (collection.errors.length > 0)
    throw new Error(collection.errors.join("; "));
}
async function applyDiscardResources(
  context: DiscardPublicationContext
): Promise<void> {
  const { resourceMove, options, progress } = context;
  if (resourceMove === null) return;
  const owner = path.basename(options.resourceOwnerPath);
  await moveResourceOwner(resourceMove, owner, owner, progress);
  await options.afterResourceTombstone();
  const current = await scanResourceOwner(resourceMove.to, owner);
  if (
    current.errors.length > 0 ||
    !sameResourceOwnerSnapshot(current.value, resourceMove.snapshot)
  )
    throw new Error(
      "tombstoned owner resources changed before index publication"
    );
}
async function recoverDiscardResources(
  context: DiscardPublicationContext
): Promise<void> {
  const { resourceMove, options, progress } = context;
  if (resourceMove === null) return;
  const owner = path.basename(options.resourceOwnerPath);
  const errors = await restoreResourceOwnerMove(
    resourceMove,
    owner,
    owner,
    progress
  );
  if (errors.length > 0) throw new Error(errors.join("; "));
}
async function cleanupDiscardTombstone(
  context: DiscardPublicationContext,
  writes: readonly RecordWrittenFile[]
): Promise<void> {
  const { transactionRoot, trashReport, trash, resourceMove, progress } =
    context;
  const report = writes.find(
    (written) => written.change.path === trashReport
  )?.written;
  if (report === undefined || report === null)
    throw new Error("Discard tombstone ownership is unknown: " + trash);
  await verifyRecordFile(transactionRoot, trashReport, report);
  if (resourceMove !== null)
    await removeResourceOwnerCopy(resourceMove, progress);
  await fs.unlink(trashReport);
  await fs.rmdir(trash);
}
function discardPublicationResult(
  context: DiscardPublicationContext,
  transaction: RecordTransactionResult<DiscardPublicationOptions>
): DiscardPublicationResult {
  if (transaction.status === "ok")
    return { changed: transaction.changed, diagnostics: [], errors: [] };
  const mutation = discardMutation(transaction.outcome);
  const failures = [...transaction.errors, ...transaction.cleanupErrors];
  return {
    changed: transaction.changed,
    errors: [
      ...transaction.errors.map(
        (error) =>
          (transaction.committed
            ? "discard verification failed after commit: "
            : "discard transaction publish failed: ") + errorText(error)
      ),
      ...transaction.cleanupErrors.map(
        (error) =>
          "discard committed but tombstone cleanup is pending at " +
          context.trash +
          ": " +
          errorText(error)
      )
    ],
    mutation,
    diagnostics: failures.map((error) =>
      diagnosticFromError({
        code:
          transaction.verification === "passed"
            ? "investigation-report.discard-cleanup-pending"
            : "investigation-report.discard-publish-failed",
        error,
        mutation,
        reason: discardFailureReason(transaction),
        recovery:
          "stop mutations and reconcile report, resource, index and the exact tombstone before any retry",
        target: transaction.committed
          ? context.trash
          : context.options.reportPath
      })
    )
  };
}
function discardFailureReason(
  transaction: RecordTransactionResult<DiscardPublicationOptions>
): string {
  return transaction.committed
    ? transaction.verification === "passed"
      ? "discard committed, but exact tombstone cleanup is incomplete"
      : "discard committed, but verification failed or is unknown"
    : transaction.verification === "failed-or-unknown"
      ? "the discard commit state is unknown; preserve and reconcile actual writes"
      : "discard failed before its derived index commit point";
}
