import { normalizeRecordTransactionPlan } from "../../record-operations/src/transaction-plan.ts";
import type { RecordTransactionPlan } from "../../record-operations/src/transaction.ts";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { requireRecordTextSnapshot } from "../../record-operations/src/transaction-snapshot.ts";
import { readRecordFileSnapshot } from "../../record-operations/src/transaction-files.ts";

import { scanResourceOwner } from "./rename-resource-snapshot.ts";
import type { ResourceMove, ResourceMoveProgress } from "./rename-contract.ts";
import {
  investigationFileWrite,
  investigationMembers
} from "./transaction-files.ts";

import type { DiscardPublicationOptions } from "./discard-publication.ts";
import { lstatOrNull } from "./discard-files.ts";
import type { InvestigationMember } from "./transaction-files.ts";
export type DiscardPublicationContext = {
  readonly options: DiscardPublicationOptions;
  readonly transactionRoot: string;
  readonly trash: string;
  readonly trashReport: string;
  readonly progress: ResourceMoveProgress;
  readonly members: readonly InvestigationMember[];
  resourceMove: ResourceMove | null;
};
export async function createDiscardPublicationContext(
  options: DiscardPublicationOptions
): Promise<DiscardPublicationContext> {
  const transactionRoot = path.dirname(options.root);
  const trash = path.join(
    transactionRoot,
    (options.indexText === null
      ? ".investigation-candidate-discard-"
      : ".investigation-report-discard-") + randomUUID()
  );
  const trashReport = path.join(
    trash,
    options.indexText === null ? "candidate" : "report.md"
  );
  const progress: ResourceMoveProgress = options.resourceProgress ?? {
    sourceRemovalStarted: false,
    sourceRemoved: false,
    targetClaimed: false
  };
  const members = await investigationMembers(options.root);
  return {
    options,
    transactionRoot,
    trash,
    trashReport,
    progress,
    members,
    resourceMove: null
  };
}
export async function prepareDiscardTransaction(
  context: DiscardPublicationContext
): Promise<RecordTransactionPlan<DiscardPublicationOptions>> {
  const { options, transactionRoot, trashReport } = context;
  const guards = await discardOriginalSourceGuards(context);
  const originalReport = await discardReportSnapshot(context);
  context.resourceMove = await prepareDiscardResourceMove(context);
  if (options.indexText === null)
    guards.push({
      path: options.indexPath,
      before: await readRecordFileSnapshot(transactionRoot, options.indexPath)
    });
  return normalizeRecordTransactionPlan({
    value: options,
    root: transactionRoot,
    guards,
    writes: [
      {
        path: trashReport,
        before: null,
        next: originalReport.bytes,
        mode: originalReport.mode
      },
      { path: options.reportPath, before: originalReport, next: null }
    ],
    index:
      options.indexText === null
        ? null
        : await investigationFileWrite(
            transactionRoot,
            options.indexPath,
            options.originalIndexText,
            options.indexText,
            {
              writer: options.write,
              mode: 0o600,
              captured:
                options.originalIndexText === null
                  ? undefined
                  : options.preparation?.captured(
                      options.indexPath,
                      options.originalIndexText
                    )
            }
          )
  });
}
async function discardReportSnapshot(context: DiscardPublicationContext) {
  const { options, transactionRoot } = context;
  const source = options.originalSources.find(
    (value) => path.join(options.root, value.sourcePath) === options.reportPath
  );
  const originalReport =
    options.preparation === undefined
      ? await readRecordFileSnapshot(transactionRoot, options.reportPath)
      : source === undefined
        ? null
        : requireRecordTextSnapshot(
            options.preparation.captured(options.reportPath, source.text),
            transactionRoot,
            options.reportPath,
            source.text
          );
  if (originalReport === null) throw new Error("Discard source disappeared");
  return originalReport;
}

async function prepareDiscardResourceMove(
  context: DiscardPublicationContext
): Promise<ResourceMove | null> {
  const { options, transactionRoot, trash } = context;
  const resources = await scanResourceOwner(
    options.resourceOwnerPath,
    path.basename(options.resourceOwnerPath)
  );
  const owner = await lstatOrNull(options.resourceOwnerPath);

  if (owner === null) return null;

  if (resources.errors.length > 0) throw new Error(resources.errors.join("; "));
  const resourceIds = resources.value.files
    .map((file) => path.basename(options.resourceOwnerPath) + "/" + file.path)
    .sort();
  const directories = [
    "",
    ...resources.value.directories.map((directory) => directory.path)
  ].sort();
  if (
    JSON.stringify(resourceIds) !==
      JSON.stringify([...options.resourceSnapshot.resourceIds].sort()) ||
    JSON.stringify(directories) !==
      JSON.stringify([...options.resourceSnapshot.directories].sort())
  )
    throw new Error("owned resources changed before discard publication");
  return {
    from: options.resourceOwnerPath,
    to: path.join(trash, "resources"),
    snapshot: resources.value,
    root: transactionRoot
  };
}

async function discardOriginalSourceGuards(context: DiscardPublicationContext) {
  const { options, transactionRoot } = context;
  const guards = [];
  for (const source of options.originalSources) {
    const file = await investigationFileWrite(
      transactionRoot,
      path.join(options.root, source.sourcePath),
      source.text,
      source.text,
      {
        captured: options.preparation?.captured(
          path.join(options.root, source.sourcePath),
          source.text
        )
      }
    );
    guards.push({ path: file.path, before: file.before });
  }
  return guards;
}
