/*
 * Synced TypeScript runtime; repository maintenance edits tools/investigation-report/src/rename/resources/rename-resource-proof.ts.
 * Installed skill copies may be edited directly; updates overwrite matching files.
 * Repository: https://github.com/zxyycom/skills
 * Source path: tools/investigation-report/src/rename/resources/rename-resource-proof.ts
 * Maintained source: https://github.com/zxyycom/skills/blob/main/tools/investigation-report/src/rename/resources/rename-resource-proof.ts
 * Skill source directory: https://github.com/zxyycom/skills/tree/main/skills/investigation-report
 * Rebuild: bun run sync:investigation-report-check
 */
import type { RecordVerificationPhase } from "../../../../record-operations/src/transactions/transaction-verification.ts";
import fs from "node:fs/promises";
import path from "node:path";
import { verifyRecordFile } from "../../../../record-operations/src/transactions/transaction-files.ts";
import { forEachRecordFileSnapshot } from "../../../../record-operations/src/reader/reader-batch.ts";
import type {
  ResourceMoveProgress,
  ResourceDirectoryIdentity,
  ResourceOwnerSnapshot
} from "../rename-contract.ts";
import {
  resourceMode,
  sameResourceOwnerSnapshot,
  scanResourceOwner
} from "./rename-resource-snapshot.ts";
/** Every move starts with explicit empty ownership facts, including empty resource trees. */
export function createResourceMoveProgress(): ResourceMoveProgress {
  return {
    targetClaimed: false,
    sourceFiles: new Map(),
    writtenFiles: new Map(),
    removedFiles: new Set(),
    sourceDirectories: new Map(),
    targetDirectories: new Map(),
    removedDirectories: new Set(),
    uncertainWrite: false
  };
}

/** Acquire exactly the resource source members whose later move/recovery must be protected. */
export async function prepareResourceSourceProof(
  options: Readonly<{
    root: string;
    owner: string;
    files: readonly Readonly<{ path: string; mode?: number }>[];
    directories: readonly string[];
  }>
): Promise<ResourceMoveProgress> {
  const progress = createResourceMoveProgress();
  await forEachRecordFileSnapshot(
    options.root,
    options.files.map((file) => path.join(options.owner, file.path)),
    (result, index) => {
      if (!result.ok) throw result.error;
      const file = options.files[index]!;
      const snapshot = result.value;
      if (
        snapshot === null ||
        (file.mode !== undefined && snapshot.mode !== file.mode)
      )
        throw new Error(
          "Prepared resource file disappeared or changed mode: " + file.path
        );
      progress.sourceFiles.set(file.path, snapshot);
    }
  );
  for (const relative of options.directories)
    progress.sourceDirectories.set(
      relative,
      await directoryIdentity(path.join(options.owner, relative))
    );
  return progress;
}

export async function verifyResourceOwnerSnapshot(
  ownerPath: string,
  ownerId: string,
  expected: ResourceOwnerSnapshot
): Promise<void> {
  const current = await scanResourceOwner(ownerPath, ownerId);
  if (
    current.errors.length > 0 ||
    !sameResourceOwnerSnapshot(expected, current.value)
  )
    throw new Error("Investigation resource owner changed while being moved");
}

export async function verifyResourceSourceProof(
  root: string,
  owner: string,
  progress: ResourceMoveProgress,
  phase?: RecordVerificationPhase
): Promise<void> {
  if (phase === undefined) {
    for (const [relative, snapshot] of progress.sourceFiles)
      await verifyRecordFile(root, path.join(owner, relative), snapshot);
  } else {
    phase.assertRoot(root);
    await phase.verifyMany(
      [...progress.sourceFiles].map(([relative, before]) => ({
        path: path.join(owner, relative),
        before
      }))
    );
  }
  for (const [relative, identity] of progress.sourceDirectories)
    await verifyDirectory(path.join(owner, relative), identity);
}

export async function directoryIdentity(
  target: string
): Promise<ResourceDirectoryIdentity> {
  const stats = await fs.lstat(target);
  if (!stats.isDirectory() || stats.isSymbolicLink())
    throw new Error(
      "Resource owner member must be a safe directory: " + target
    );
  return { dev: stats.dev, ino: stats.ino, mode: resourceMode(stats.mode) };
}

export async function verifyDirectory(
  target: string,
  expected: ResourceDirectoryIdentity
): Promise<void> {
  const current = await directoryIdentity(target);
  if (JSON.stringify(current) !== JSON.stringify(expected))
    throw new Error("Resource directory identity/mode changed: " + target);
}
