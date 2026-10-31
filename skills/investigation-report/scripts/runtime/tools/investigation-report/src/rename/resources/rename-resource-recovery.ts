/*
 * Synced TypeScript runtime; repository maintenance edits tools/investigation-report/src/rename/resources/rename-resource-recovery.ts.
 * Installed skill copies may be edited directly; updates overwrite matching files.
 * Repository: https://github.com/zxyycom/skills
 * Source path: tools/investigation-report/src/rename/resources/rename-resource-recovery.ts
 * Maintained source: https://github.com/zxyycom/skills/blob/main/tools/investigation-report/src/rename/resources/rename-resource-recovery.ts
 * Skill source directory: https://github.com/zxyycom/skills/tree/main/skills/investigation-report
 * Rebuild: bun run sync:investigation-report-check
 */
import fs from "node:fs/promises";
import path from "node:path";
import {
  readRecordFileSnapshot,
  sameRecordFile,
  verifyRecordFile,
  writeRecordFile
} from "../../../../record-operations/src/transactions/transaction-files.ts";
import type { ResourceMove, ResourceMoveProgress } from "../rename-contract.ts";
import {
  verifyDirectory,
  verifyResourceOwnerSnapshot
} from "./rename-resource-proof.ts";
import { errorText, lstatOrNull } from "../rename-support.ts";

/** Restore only actual removals and never overwrite an old-path winner. */
export async function restoreResourceOwnerMove(
  move: ResourceMove,
  oldId: string,
  progress: ResourceMoveProgress
): Promise<string[]> {
  if (!progress.targetClaimed) return [];
  const errors: string[] = [];
  if (!progress.targetDirectories.has("")) progress.uncertainWrite = true;
  if (progress.uncertainWrite)
    errors.push(
      "resource copy ownership is unknown; retain the target owner for reconciliation"
    );
  try {
    await verifyResourceOwnerCopy(move, progress);
  } catch (error) {
    return [
      ...errors,
      "renamed resource owner changed after publication: " + errorText(error)
    ];
  }
  try {
    await restoreResourceSource(move, oldId, progress);
  } catch (error) {
    return [
      ...errors,
      "failed to restore original resource owner: " + errorText(error)
    ];
  }
  if (progress.uncertainWrite) return errors;
  try {
    await removeResourceOwnerCopy(move, progress);
  } catch (error) {
    errors.push(
      "failed to remove this transaction's resource copy: " + errorText(error)
    );
  }
  return errors;
}
async function restoreResourceSource(
  move: ResourceMove,
  oldId: string,
  progress: ResourceMoveProgress
): Promise<void> {
  await restoreRemovedResourceDirectories(move, progress);
  await restoreResourceSourceFiles(move, progress);
  const directories = progress.sourceDirectories;
  for (const [relative, identity] of directories)
    if (!progress.removedDirectories.has(relative))
      await verifyDirectory(path.join(move.from, relative), identity);
  await verifyResourceOwnerSnapshot(move.from, oldId, move.snapshot);
}
async function restoreRemovedResourceDirectories(
  move: ResourceMove,
  progress: ResourceMoveProgress
): Promise<void> {
  const removed = progress.removedDirectories;
  const directories = [...removed].sort((left, right) =>
    directoryDepthDescending(right, left)
  );
  for (const relative of directories) {
    const target = path.join(move.from, relative);
    if ((await lstatOrNull(target)) !== null)
      throw new Error("Original resource directory reappeared: " + target);
    const mode = progress.sourceDirectories.get(relative)!.mode;
    await fs.mkdir(target, { mode });
    await fs.chmod(target, mode);
  }
}
async function restoreResourceSourceFiles(
  move: ResourceMove,
  progress: ResourceMoveProgress
): Promise<void> {
  const root = move.root ?? path.dirname(path.dirname(move.from));
  const files = progress.sourceFiles;
  for (const [relative, original] of files) {
    const target = path.join(move.from, relative);
    if (!progress.removedFiles.has(relative)) {
      await verifyRecordFile(root, target, original);
      continue;
    }
    await writeRecordFile(root, {
      path: target,
      before: null,
      next: original.bytes,
      mode: original.mode
    });
    const restored = await readRecordFileSnapshot(root, target);
    if (!sameRecordFile(restored, original, false))
      throw new Error("Restored resource differs: " + relative);
  }
}
export async function removeResourceOwnerCopy(
  move: ResourceMove,
  progress: ResourceMoveProgress
): Promise<void> {
  if (!progress.targetClaimed) {
    return;
  }
  const rootIdentityKnown = progress.targetDirectories.has("");
  if (progress.uncertainWrite || !rootIdentityKnown) {
    throw new Error(
      "Resource target contains an unknown write; retain it for reconciliation"
    );
  }
  const parent = path.dirname(move.from);
  const root = move.root ?? path.dirname(parent);
  const files = progress.writtenFiles;
  for (const [relative, written] of files) {
    const target = path.join(move.to, relative);
    await verifyRecordFile(root, target, written);
    await fs.unlink(target);
  }
  await removeOwnedResourceDirectories(move.to, progress);
}
async function removeOwnedResourceDirectories(
  owner: string,
  progress: ResourceMoveProgress
): Promise<void> {
  const directories = progress.targetDirectories;
  const ordered = [...directories].sort(([left], [right]) =>
    directoryDepthDescending(left, right)
  );
  for (const [relative, identity] of ordered) {
    const target = path.join(owner, relative);
    await verifyDirectory(target, identity);
    await fs.rmdir(target);
  }
}
export async function verifyResourceOwnerCopy(
  move: ResourceMove,
  progress: ResourceMoveProgress
): Promise<void> {
  const root = move.root ?? path.dirname(path.dirname(move.from));
  const files = progress.writtenFiles;
  for (const [relative, written] of files)
    await verifyRecordFile(root, path.join(move.to, relative), written);
  const directories = progress.targetDirectories;
  for (const [relative, identity] of directories)
    await verifyDirectory(path.join(move.to, relative), identity);
}
function directoryDepthDescending(left: string, right: string): number {
  return (
    right.split("/").length - left.split("/").length ||
    right.length - left.length
  );
}
