import { writeIndexAtomically } from "./publish-index-writer.ts";
import path from "node:path";

import { type RecordTransactionPlan } from "../../record-operations/src/transaction.ts";
import {
  readRecordFileSnapshot,
  type RecordFileWrite
} from "../../record-operations/src/transaction-files.ts";
import {
  investigationFileWrite,
  investigationMembers,
  verifyInvestigationMembers,
  type InvestigationMember
} from "./transaction-files.ts";
import { type PublishWithinLockOptions } from "./publish-contract.ts";
import { resolvePublishCandidateSelectors } from "./publish-selector.ts";

import {
  result,
  sameResourceSnapshots,
  sameSources
} from "./publish-support.ts";
import {
  prepareInvestigationPublish,
  resourceSnapshotStillCurrent,
  type InvestigationPublishPreparation
} from "./publish-preparation.ts";
import type { InvestigationCandidatePublishResult } from "./types.ts";

export type PreparedPublication = Readonly<{
  preparation: InvestigationPublishPreparation;
  members: readonly InvestigationMember[];
  changedPaths: readonly string[];
}>;
export type PublishTransactionContext = {
  readonly options: PublishWithinLockOptions;
  rejected: InvestigationCandidatePublishResult | null;
  readonly cleanupWarnings: string[];
};
export async function preparePublishTransaction(
  context: PublishTransactionContext
): Promise<RecordTransactionPlan<PreparedPublication>> {
  const { options } = context;
  const preparation = await loadPublicationPreparation(context);
  const { writes, guards } = await publicationSourceWrites(
    options.root,
    preparation
  );
  const members = await investigationMembers(options.root);
  const changedPaths = writes.map((change) => change.path);
  const index = await publicationIndex(context, preparation);
  return {
    value: { preparation, members, changedPaths },
    root: options.root,
    writes,
    guards,
    index
  };
}
async function loadPublicationPreparation(
  context: PublishTransactionContext
): Promise<InvestigationPublishPreparation> {
  const { options } = context;
  const selected = await resolvePublishCandidateSelectors(
    options.root,
    options.ids
  );
  if (selected.status === "error") {
    context.rejected = result(
      { ids: options.ids, workspaceRoot: options.root },
      false,
      selected.errors,
      { indexPath: options.indexPath }
    );
    throw new Error(selected.errors.join("; "));
  }
  const prepared = await prepareInvestigationPublish(
    options.root,
    selected.ids
  );
  if (prepared.status === "error") {
    context.rejected = result(
      { ids: selected.ids, workspaceRoot: options.root },
      false,
      prepared.errors,
      {
        diagnostics: prepared.diagnostics,
        indexPath: options.indexPath,
        warnings: prepared.warnings
      }
    );
    throw new Error(prepared.errors.join("; "));
  }
  return prepared.value;
}
async function publicationSourceWrites(
  root: string,
  preparation: InvestigationPublishPreparation
) {
  const writes: RecordFileWrite[] = [];
  const guards = [];
  for (const source of preparation.formalSources) {
    const file = await investigationFileWrite(
      root,
      path.join(root, source.sourcePath),
      source.text,
      source.text
    );
    guards.push({ path: file.path, before: file.before });
  }
  for (const source of preparation.candidateSources) {
    const candidatePath = preparation.candidatePaths.get(source.id)!;
    const original = await investigationFileWrite(
      root,
      candidatePath,
      source.text,
      null
    );
    writes.push(
      await investigationFileWrite(
        root,
        path.join(root, source.sourcePath),
        null,
        source.text,
        { writer: undefined, mode: original.before!.mode }
      ),
      original
    );
  }
  return { writes, guards };
}
async function publicationIndex(
  context: PublishTransactionContext,
  preparation: InvestigationPublishPreparation
): Promise<RecordFileWrite> {
  const { options } = context;
  const indexBefore = await readRecordFileSnapshot(
    options.root,
    options.indexPath
  );
  if (preparation.indexExisted !== (indexBefore !== null))
    throw new Error(
      "Investigation index changed during publication preparation"
    );
  const index: RecordFileWrite = {
    path: options.indexPath,
    before: indexBefore,
    next: Buffer.from(preparation.nextIndexText),
    ...(indexBefore === null && options.write === writeIndexAtomically
      ? { creationMode: 0o600 }
      : { mode: indexBefore?.mode ?? 0o600 }),
    write: async (target, bytes) => {
      const written = await options.write(
        target,
        Buffer.from(bytes).toString("utf8"),
        preparation.indexExisted
      );
      context.cleanupWarnings.push(...(written?.warnings ?? []));
      return written?.identity;
    }
  };
  return index;
}
export async function freshPublishTransaction(
  options: PublishWithinLockOptions,
  value: PreparedPublication
): Promise<void> {
  const { preparation, members } = value;
  await options.beforePublish();
  const fresh = await prepareInvestigationPublish(
    options.root,
    preparation.candidateSources.map((source) => source.id)
  );
  if (fresh.status === "error") throw new Error(fresh.errors.join("; "));
  if (!sameSources(preparation.formalSources, fresh.value.formalSources))
    throw new Error(
      "formal investigation sources changed after publish preparation; no files were written"
    );
  if (!sameSources(preparation.candidateSources, fresh.value.candidateSources))
    throw new Error(
      "selected investigation candidates changed after publish preparation; no files were written"
    );
  if (
    !sameResourceSnapshots(
      preparation.resourceSnapshot,
      fresh.value.resourceSnapshot
    )
  )
    throw new Error(
      "selected candidate resources changed identity after publish preparation; no files were written"
    );
  if (preparation.nextIndexText !== fresh.value.nextIndexText)
    throw new Error(
      "Investigation index projection changed after publish preparation; no files were written"
    );
  await verifyInvestigationMembers(options.root, members);
  const resources = await resourceSnapshotStillCurrent(
    options.root,
    preparation.resourceSnapshot
  );
  if (resources.length > 0) throw new Error(resources.join("; "));
}
export async function verifyPublishTransaction(
  options: PublishWithinLockOptions,
  value: PreparedPublication
): Promise<void> {
  const { preparation, members, changedPaths } = value;
  await verifyInvestigationMembers(options.root, members, changedPaths);
  const resources = await resourceSnapshotStillCurrent(
    options.root,
    preparation.resourceSnapshot
  );
  if (resources.length > 0) throw new Error(resources.join("; "));
}
