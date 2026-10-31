/*
 * Synced TypeScript runtime; repository maintenance edits tools/investigation-report/src/discard/discard-publication.ts.
 * Installed skill copies may be edited directly; updates overwrite matching files.
 * Repository: https://github.com/zxyycom/skills
 * Source path: tools/investigation-report/src/discard/discard-publication.ts
 * Maintained source: https://github.com/zxyycom/skills/blob/main/tools/investigation-report/src/discard/discard-publication.ts
 * Skill source directory: https://github.com/zxyycom/skills/tree/main/skills/investigation-report
 * Rebuild: bun run sync:investigation-report-check
 */
import type { RecordVerificationPhase } from "../../../record-operations/src/transactions/transaction-verification.ts";
import { InvestigationPreparation } from "../transactions/strict-preparation.ts";
import fs from "node:fs/promises";
import path from "node:path";
import { isPathWithinDirectory } from "../../../shared/src/node/filesystem.ts";
import { runRecordTransaction } from "../../../record-operations/src/transactions/transaction.ts";
import { verifyRecordFile } from "../../../record-operations/src/transactions/transaction-files.ts";
import {
  diagnosticFromError,
  type InvestigationDiagnostic,
  type InvestigationMutationDiagnostic
} from "../diagnostics.ts";
import {
  discardMutation,
  errorText,
  type AfterDiscardResourceTombstone,
  type InvestigationDiscardWriter
} from "./discard.ts";
import {
  scanResourceOwner,
  sameResourceOwnerSnapshot
} from "../rename/resources/rename-resource-snapshot.ts";
import {
  moveResourceOwner,
  restoreResourceOwnerMove,
  removeResourceOwnerCopy,
  verifyResourceOwnerCopy,
  verifyResourceSourceProof
} from "../rename/resources/rename-resource-move.ts";
import type { ResourceMoveProgress } from "../rename/rename-contract.ts";
import type { InvestigationSource } from "../types.ts";
import type { ResourceTreeScan } from "./discard-history.ts";
import { verifyInvestigationMembers } from "../transactions/transaction-files.ts";
import { readLocalPublication } from "../publication/local-publication.ts";

import {
  createDiscardPublicationContext,
  prepareDiscardTransaction,
  type DiscardPublicationContext
} from "./discard-transaction-plan.ts";
import type { RecordWrittenFile } from "../../../record-operations/src/transactions/transaction-files.ts";
import type { RecordTransactionResult } from "../../../record-operations/src/transactions/transaction.ts";
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
    fresh: async (_value, phase) => {
      await verifyResourceSourceProof(
        context.transactionRoot,
        options.resourceOwnerPath,
        progress,
        phase
      );
      await validateDiscardFormalCollection(context, phase);
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
  context: DiscardPublicationContext,
  phase?: RecordVerificationPhase
): Promise<void> {
  if (context.options.indexText === null) return;
  const preparation = new InvestigationPreparation(
    context.transactionRoot,
    context.options.root,
    phase
  );
  const ids =
    phase === undefined
      ? []
      : context.options.originalSources.map((source) => source.id);
  await readLocalPublication(context.options.root, ids, preparation);
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
  const errors = await restoreResourceOwnerMove(resourceMove, owner, progress);
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
  const operationFailures = transaction.errors.flatMap((error) =>
    discardFailureCauses(error)
  );
  const cleanupFailures = transaction.cleanupErrors.flatMap((error) =>
    discardFailureCauses(error)
  );
  const failures = [...operationFailures, ...cleanupFailures];
  return {
    changed: transaction.changed,
    errors: [
      ...operationFailures.map(
        (error) =>
          (transaction.committed
            ? "discard verification failed after commit: "
            : "discard transaction publish failed: ") + errorText(error)
      ),
      ...cleanupFailures.map(
        (error) =>
          "discard committed but tombstone cleanup is pending at " +
          context.trash +
          ": " +
          errorText(error)
      )
    ],
    mutation,
    diagnostics: failures.map((error) => ({
      ...diagnosticFromError({
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
      }),
      ...discardFailureLocation(error, context.options.root)
    }))
  };
}

/** Compound publication failures must not hide either cause or a retained temporary path. */
function discardFailureCauses(
  error: unknown,
  ancestors: ReadonlySet<AggregateError> = new Set()
): unknown[] {
  if (!(error instanceof AggregateError) || ancestors.has(error))
    return [error];
  const causes: unknown = error.errors;
  if (!Array.isArray(causes) || causes.length === 0) return [error];
  const nextAncestors = new Set(ancestors).add(error);
  return causes.flatMap((cause: unknown) =>
    discardFailureCauses(cause, nextAncestors)
  );
}

function discardFailureLocation(
  error: unknown,
  collectionRoot: string
): Readonly<{ operation?: string; target?: string }> {
  if (!(error instanceof Error)) return {};
  const code: unknown = Reflect.get(error, "code");
  if (typeof code !== "string") return {};
  const location: { operation?: string; target?: string } = {};
  const target: unknown = Reflect.get(error, "path");
  if (typeof target === "string" && target.length > 0) {
    let label = target;
    if (
      path.isAbsolute(target) &&
      isPathWithinDirectory(target, collectionRoot)
    ) {
      const relative =
        path.relative(collectionRoot, target).split(path.sep).join("/") || ".";
      label = "collection-relative: " + relative;
    }
    location.target = errorText(label);
  }
  const operation: unknown = Reflect.get(error, "syscall");
  if (typeof operation === "string" && operation.length > 0)
    location.operation = errorText(operation);
  return location;
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
