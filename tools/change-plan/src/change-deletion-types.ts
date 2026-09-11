import type { Stats } from "node:fs";

export const tombstoneDirectoryName = ".change-plan-tombstones";
export const supportedGitModes = new Set(["100644", "100755"]);

export type DirectoryIdentity = Readonly<{ dev: number; ino: number }>;
export type FileExpectation = Readonly<{
  bytes: Buffer;
  identity: DirectoryIdentity;
  mode: "100644" | "100755";
  relativePath: string;
}>;
export type DirectoryExpectation = Readonly<{
  identity: DirectoryIdentity;
  mode: number;
  relativePath: string;
}>;
export type DeletionTree = Readonly<{
  directories: readonly DirectoryExpectation[];
  files: readonly FileExpectation[];
  rootIdentity: DirectoryIdentity;
}>;
export type PhysicalTree = Readonly<{
  directories: readonly DirectoryExpectation[];
  files: readonly Readonly<{
    bytes: Buffer;
    identity: DirectoryIdentity;
    mode: number;
    relativePath: string;
  }>[];
}>;

export type ChangeDeletionPreparation = Readonly<{
  changeRoot: string;
  changeRootIdentity: DirectoryIdentity;
  directories: readonly DirectoryExpectation[];
  files: readonly FileExpectation[];
  headCommit: string;
  memberCount: number;
  sourceDirectory: string;
  sourceIdentity: DirectoryIdentity;
  tombstoneDirectory: string;
  tombstoneRoot: string;
  tombstoneRootIdentity: DirectoryIdentity | null;
}>;

export type ChangeDeletionOutcome =
  | "completed"
  | "committed-cleanup-pending"
  | "no-change";
export type ChangeDeletionExecution = Readonly<{
  changed: boolean;
  error: string | null;
  outcome: ChangeDeletionOutcome;
  tombstoneDirectory: string | null;
}>;

export function identity(stat: Stats): DirectoryIdentity {
  return { dev: stat.dev, ino: stat.ino };
}
export function sameIdentity(
  left: DirectoryIdentity,
  right: DirectoryIdentity
): boolean {
  return left.dev === right.dev && left.ino === right.ino;
}
export function executableMode(mode: number): boolean {
  return (mode & 0o100) !== 0;
}
export function hasDirectoryIdentity(
  stat: Stats,
  expected: DirectoryIdentity
): boolean {
  return (
    !stat.isSymbolicLink() &&
    stat.isDirectory() &&
    sameIdentity(identity(stat), expected)
  );
}
export function hasFileIdentity(
  stat: Stats,
  expected: DirectoryIdentity
): boolean {
  return (
    !stat.isSymbolicLink() &&
    stat.isFile() &&
    sameIdentity(identity(stat), expected)
  );
}
export function compareRelativePath(
  left: Readonly<{ relativePath: string }>,
  right: Readonly<{ relativePath: string }>
): number {
  return left.relativePath.localeCompare(right.relativePath);
}
export function compareDeepest(
  left: DirectoryExpectation,
  right: DirectoryExpectation
): number {
  return (
    right.relativePath.split("/").length -
      left.relativePath.split("/").length ||
    right.relativePath.localeCompare(left.relativePath)
  );
}
