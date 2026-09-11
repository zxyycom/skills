import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import type { Stats } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { parseGitTreeEntries } from "../../shared/src/version-control/git-tree-entry.ts";
import {
  openVersionControl,
  repositoryRelativePathFromFileSystemPath
} from "../../shared/src/version-control/index.ts";
import {
  identity,
  tombstoneDirectoryName,
  type ChangeDeletionPreparation
} from "./change-deletion-types.ts";
import {
  scanPhysicalTree,
  validateSupportedGitTreeEntries,
  validateTreeEntries
} from "./change-deletion-tree.ts";

export async function prepareChangeDeletion(
  sourceDirectoryInput: string,
  changeRootInput: string
): Promise<ChangeDeletionPreparation> {
  const sourceDirectory = path.resolve(sourceDirectoryInput);
  const changeRoot = path.resolve(changeRootInput);
  validateSourceLocation(sourceDirectory, changeRoot);
  const [sourceStat, rootStat] = await Promise.all([
    requireDirectory(sourceDirectory, "change directory"),
    requireDirectory(changeRoot, "change root")
  ]);
  if (sourceStat.dev !== rootStat.dev)
    throw new Error("change directory must share a filesystem with its root");
  const repository = await openVersionControl(sourceDirectory);
  const headCommit = await repository.getCurrentRevision();
  if (headCommit === null)
    throw new Error("change deletion requires a current Git HEAD revision");
  const sourceRepositoryPath = repositoryRelativePathFromFileSystemPath(
    repository.rootDirectory,
    sourceDirectory
  );
  const physical = await scanAndValidateRepositoryTree(
    repository,
    sourceDirectory,
    sourceRepositoryPath,
    headCommit
  );
  const tombstone = await prepareTombstone(
    changeRoot,
    sourceDirectory,
    sourceStat
  );
  return {
    changeRoot,
    changeRootIdentity: identity(rootStat),
    directories: physical.directories,
    files: physical.files,
    headCommit,
    memberCount: physical.files.length + physical.directories.length,
    sourceDirectory,
    sourceIdentity: identity(sourceStat),
    ...tombstone
  };
}

function validateSourceLocation(
  sourceDirectory: string,
  changeRoot: string
): void {
  if (path.dirname(sourceDirectory) !== changeRoot)
    throw new Error(
      "change deletion source is not a direct member of its collection"
    );
  if (path.basename(sourceDirectory) === tombstoneDirectoryName)
    throw new Error("the tombstone root is not a change deletion source");
}

async function scanAndValidateRepositoryTree(
  repository: Awaited<ReturnType<typeof openVersionControl>>,
  sourceDirectory: string,
  sourceRepositoryPath: string,
  headCommit: string
) {
  const [gitEntries, physical] = await Promise.all([
    readGitTreeEntries(
      repository.rootDirectory,
      headCommit,
      sourceRepositoryPath
    ),
    scanPhysicalTree(sourceDirectory)
  ]);
  validateSupportedGitTreeEntries(sourceRepositoryPath, gitEntries);
  const revisionFiles = await repository.readRevisionFiles(headCommit, {
    pathScopes: [sourceRepositoryPath]
  });
  return {
    directories: physical.directories,
    files: validateTreeEntries(
      sourceRepositoryPath,
      gitEntries,
      revisionFiles,
      physical
    )
  };
}

async function prepareTombstone(
  changeRoot: string,
  sourceDirectory: string,
  sourceStat: Stats
) {
  const tombstoneRoot = path.join(changeRoot, tombstoneDirectoryName);
  const tombstoneRootStat = await lstatOrNull(tombstoneRoot);
  if (
    tombstoneRootStat !== null &&
    (tombstoneRootStat.isSymbolicLink() || !tombstoneRootStat.isDirectory())
  )
    throw new Error("change tombstone root must be a regular directory");
  if (tombstoneRootStat !== null && tombstoneRootStat.dev !== sourceStat.dev)
    throw new Error(
      "change tombstone root must share a filesystem with source"
    );
  const tombstoneDirectory = path.join(
    tombstoneRoot,
    `${path.basename(sourceDirectory)}-${randomUUID()}`
  );
  if ((await lstatOrNull(tombstoneDirectory)) !== null)
    throw new Error("change tombstone target already exists");
  return {
    tombstoneDirectory,
    tombstoneRoot,
    tombstoneRootIdentity:
      tombstoneRootStat === null ? null : identity(tombstoneRootStat)
  };
}

async function readGitTreeEntries(
  repositoryRoot: string,
  revision: string,
  sourceRepositoryPath: string
) {
  const output = await runGit(repositoryRoot, [
    "ls-tree",
    "-r",
    "-z",
    revision,
    "--",
    `:(literal)${sourceRepositoryPath}`
  ]);
  return parseGitTreeEntries(output.toString("utf8"));
}

async function requireDirectory(target: string, label: string): Promise<Stats> {
  const stat = await fs.lstat(target);
  if (stat.isSymbolicLink() || !stat.isDirectory())
    throw new Error(`${label} must be a regular directory`);
  return stat;
}
async function lstatOrNull(target: string): Promise<Stats | null> {
  try {
    return await fs.lstat(target);
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "ENOENT"
    )
      return null;
    throw error;
  }
}
function runGit(root: string, args: readonly string[]): Promise<Buffer> {
  return new Promise((resolve, reject) =>
    execFile(
      "git",
      ["-C", root, ...args],
      { encoding: "buffer", maxBuffer: 16 * 1024 * 1024, windowsHide: true },
      (error, stdout, stderr) => {
        if (error !== null) {
          reject(
            new Error(
              Buffer.from(stderr).toString("utf8").trim() || error.message
            )
          );
          return;
        }
        resolve(Buffer.from(stdout));
      }
    )
  );
}
