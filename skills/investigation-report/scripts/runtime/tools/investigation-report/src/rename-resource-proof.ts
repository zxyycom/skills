/*
 * Synced TypeScript runtime; repository maintenance edits tools/investigation-report/src/rename-resource-proof.ts.
 * Installed skill copies may be edited directly; updates overwrite matching files.
 * Repository: https://github.com/zxyycom/skills
 * Source path: tools/investigation-report/src/rename-resource-proof.ts
 * Maintained source: https://github.com/zxyycom/skills/blob/main/tools/investigation-report/src/rename-resource-proof.ts
 * Skill source directory: https://github.com/zxyycom/skills/tree/main/skills/investigation-report
 * Rebuild: bun run sync:investigation-report-check
 */
import fs from "node:fs/promises";
import path from "node:path";
import {
  readRecordFileSnapshot,
  verifyRecordFile
} from "../../record-operations/src/transaction-files.ts";
import type { RecordFileSnapshot } from "../../record-operations/src/transaction-files.ts";
import type {
  ResourceMoveProgress,
  ResourceOwnerSnapshot
} from "./rename-contract.ts";
import {
  resourceMode,
  sameResourceOwnerSnapshot,
  scanResourceOwner
} from "./rename-resource-snapshot.ts";
export type DirectoryIdentity = Readonly<{
  dev: number;
  ino: number;
  mode: number;
}>;

/** Acquire exactly the resource source members whose later move/recovery must be protected. */
export async function prepareResourceSourceProof(
  options: Readonly<{
    root: string;
    owner: string;
    files: readonly Readonly<{ path: string; mode?: number }>[];
    directories: readonly string[];
  }>
): Promise<ResourceMoveProgress> {
  const sourceFiles = new Map<string, RecordFileSnapshot>();
  const sourceDirectories = new Map<string, DirectoryIdentity>();
  for (const file of options.files) {
    const snapshot = await readRecordFileSnapshot(
      options.root,
      path.join(options.owner, file.path)
    );
    if (
      snapshot === null ||
      (file.mode !== undefined && snapshot.mode !== file.mode)
    )
      throw new Error(
        "Prepared resource file disappeared or changed mode: " + file.path
      );
    sourceFiles.set(file.path, snapshot);
  }
  for (const relative of options.directories)
    sourceDirectories.set(
      relative,
      await directoryIdentity(path.join(options.owner, relative))
    );
  return {
    sourceRemovalStarted: false,
    sourceRemoved: false,
    targetClaimed: false,
    sourceFiles,
    sourceDirectories
  };
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
  progress: ResourceMoveProgress
): Promise<void> {
  for (const [relative, snapshot] of progress.sourceFiles ?? [])
    await verifyRecordFile(root, path.join(owner, relative), snapshot);
  for (const [relative, identity] of progress.sourceDirectories ?? [])
    await verifyDirectory(path.join(owner, relative), identity);
}

export async function directoryIdentity(
  target: string
): Promise<DirectoryIdentity> {
  const stats = await fs.lstat(target);
  if (!stats.isDirectory() || stats.isSymbolicLink())
    throw new Error(
      "Resource owner member must be a safe directory: " + target
    );
  return { dev: stats.dev, ino: stats.ino, mode: resourceMode(stats.mode) };
}

export async function verifyDirectory(
  target: string,
  expected: DirectoryIdentity
): Promise<void> {
  const current = await directoryIdentity(target);
  if (JSON.stringify(current) !== JSON.stringify(expected))
    throw new Error("Resource directory identity/mode changed: " + target);
}
