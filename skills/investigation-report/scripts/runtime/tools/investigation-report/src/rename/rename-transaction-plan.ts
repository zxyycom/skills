/*
 * Synced TypeScript runtime; repository maintenance edits tools/investigation-report/src/rename/rename-transaction-plan.ts.
 * Installed skill copies may be edited directly; updates overwrite matching files.
 * Repository: https://github.com/zxyycom/skills
 * Source path: tools/investigation-report/src/rename/rename-transaction-plan.ts
 * Maintained source: https://github.com/zxyycom/skills/blob/main/tools/investigation-report/src/rename/rename-transaction-plan.ts
 * Skill source directory: https://github.com/zxyycom/skills/tree/main/skills/investigation-report
 * Rebuild: bun run sync:investigation-report-check
 */
import { normalizeRecordTransactionPlan } from "../../../record-operations/src/transactions/transaction-plan.ts";
import type { RecordTransactionPlan } from "../../../record-operations/src/transactions/transaction.ts";
import { prepareResourceSourceProof } from "./resources/rename-resource-proof.ts";
import path from "node:path";

import {
  readRecordFileSnapshot,
  type RecordFileWrite
} from "../../../record-operations/src/transactions/transaction-files.ts";
import { investigationFileWrite } from "../transactions/transaction-files.ts";
import type {
  InvestigationRenameHooks,
  PreparedRename,
  ResourceMoveProgress
} from "./rename-contract.ts";

export type RenameTransactionContext = Readonly<{
  root: string;
  prepared: PreparedRename;
  hooks: InvestigationRenameHooks;
  progress: ResourceMoveProgress;
  changedPaths: string[];
}>;
export async function prepareRenameTransaction(
  context: RenameTransactionContext
): Promise<RecordTransactionPlan<PreparedRename>> {
  const { root, prepared, progress, changedPaths, hooks } = context;
  if (prepared.resourceMove !== null)
    Object.assign(
      progress,
      await prepareResourceSourceProof({
        root,
        owner: prepared.resourceMove.from,
        files: prepared.resourceMove.snapshot.files,
        directories: [
          "",
          ...prepared.resourceMove.snapshot.directories.map(
            (directory) => directory.path
          )
        ]
      })
    );

  const guards = await renameOriginalGuards(root, prepared);
  const writes = await renamedSourceWrites(context);
  const index =
    prepared.nextIndexText === null
      ? null
      : await investigationFileWrite(
          root,
          prepared.indexPath,
          prepared.oldIndexText,
          prepared.nextIndexText,
          {
            writer: hooks.writeExisting,
            mode: 0o600,
            captured:
              prepared.oldIndexText === null
                ? undefined
                : prepared.preparation?.captured(
                    prepared.indexPath,
                    prepared.oldIndexText
                  )
          }
        );
  const plan = normalizeRecordTransactionPlan({
    value: prepared,
    root,
    writes,
    guards,
    index
  });
  changedPaths.push(...plan.writes.map((write) => write.path));
  return plan;
}
async function renameOriginalGuards(root: string, prepared: PreparedRename) {
  const guards = [];
  for (const source of prepared.originalSources) {
    const unchanged = await investigationFileWrite(
      root,
      source.filePath,
      source.text,
      source.text,
      { captured: prepared.preparation?.captured(source.filePath, source.text) }
    );
    guards.push({ path: unchanged.path, before: unchanged.before });
  }
  if (prepared.noChange)
    guards.push({
      path: prepared.indexPath,
      before: await readRecordFileSnapshot(root, prepared.indexPath)
    });
  if (!prepared.noChange && prepared.nextIndexText === null) {
    const unchangedIndex = await investigationFileWrite(
      root,
      prepared.indexPath,
      prepared.oldIndexText,
      prepared.oldIndexText,
      {
        captured:
          prepared.oldIndexText === null
            ? undefined
            : prepared.preparation?.captured(
                prepared.indexPath,
                prepared.oldIndexText
              )
      }
    );
    guards.push({
      path: unchangedIndex.path,
      before: unchangedIndex.before
    });
  }
  return guards;
}
async function renamedSourceWrites(
  context: RenameTransactionContext
): Promise<RecordFileWrite[]> {
  const { root, prepared } = context;
  const originals = new Map(
    prepared.originalSources.map((source) => [source.filePath, source])
  );
  const writes: RecordFileWrite[] = [];
  if (prepared.noChange) return writes;
  const sources = prepared.sources.filter(
    (source) => source !== prepared.targetSource
  );
  sources.push(prepared.targetSource);
  for (const source of sources) {
    const target = path.join(root, source.sourcePath);
    const originalPath =
      source.id === prepared.plan.newId
        ? prepared.sourceBefore.filePath
        : source.filePath;
    const original = originals.get(originalPath)!;
    writes.push(
      ...(await renamedSourceWrite(context, source, original, target))
    );
  }
  return writes;
}

async function renamedSourceWrite(
  context: RenameTransactionContext,
  source: import("./rename-contract.ts").RenameSource,
  original: import("./rename-contract.ts").RenameSource,
  target: string
): Promise<RecordFileWrite[]> {
  const { root, prepared, hooks } = context;
  const originalPath = original.filePath;
  if (originalPath !== target) {
    const removal = await investigationFileWrite(
      root,
      originalPath,
      original.text,
      null,
      {
        captured: prepared.preparation?.captured(originalPath, original.text)
      }
    );
    const addition = await investigationFileWrite(
      root,
      target,
      null,
      source.text,
      { writer: hooks.writeNew, mode: removal.before!.mode }
    );
    return [addition, removal];
  } else
    return [
      await investigationFileWrite(root, target, original.text, source.text, {
        writer: hooks.writeExisting,
        captured: prepared.preparation?.captured(originalPath, original.text)
      })
    ];
}
