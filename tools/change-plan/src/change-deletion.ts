import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { constants as fileSystemConstants, type Stats } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { parseGitTreeEntries } from "../../shared/src/version-control/git-tree-entry.ts";
import {
  openVersionControl,
  repositoryRelativePathFromFileSystemPath
} from "../../shared/src/version-control/index.ts";

const tombstoneDirectoryName = ".change-plan-tombstones";
const supportedGitModes = new Set(["100644", "100755"]);

type DirectoryIdentity = Readonly<{ dev: number; ino: number }>;
type FileExpectation = Readonly<{
  bytes: Buffer;
  identity: DirectoryIdentity;
  mode: "100644" | "100755";
  relativePath: string;
}>;
type DirectoryExpectation = Readonly<{
  identity: DirectoryIdentity;
  mode: number;
  relativePath: string;
}>;

type DeletionTree = Readonly<{
  directories: readonly DirectoryExpectation[];
  files: readonly FileExpectation[];
  rootIdentity: DirectoryIdentity;
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

export async function prepareChangeDeletion(
  sourceDirectoryInput: string,
  changeRootInput: string
): Promise<ChangeDeletionPreparation> {
  const sourceDirectory = path.resolve(sourceDirectoryInput);
  const changeRoot = path.resolve(changeRootInput);
  const sourceName = path.basename(sourceDirectory);
  if (path.dirname(sourceDirectory) !== changeRoot) {
    throw new Error(
      "change deletion source is not a direct member of its collection"
    );
  }
  if (sourceName === tombstoneDirectoryName) {
    throw new Error("the tombstone root is not a change deletion source");
  }

  const [sourceStat, rootStat] = await Promise.all([
    requireDirectory(sourceDirectory, "change directory"),
    requireDirectory(changeRoot, "change root")
  ]);
  if (sourceStat.dev !== rootStat.dev) {
    throw new Error("change directory must share a filesystem with its root");
  }

  const repository = await openVersionControl(sourceDirectory);
  const headCommit = await repository.getCurrentRevision();
  if (headCommit === null) {
    throw new Error("change deletion requires a current Git HEAD revision");
  }
  const sourceRepositoryPath = repositoryRelativePathFromFileSystemPath(
    repository.rootDirectory,
    sourceDirectory
  );
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
  const files = validateTreeEntries(
    sourceRepositoryPath,
    gitEntries,
    revisionFiles,
    physical
  );
  const tombstoneRoot = path.join(changeRoot, tombstoneDirectoryName);
  const tombstoneRootStat = await lstatOrNull(tombstoneRoot);
  if (
    tombstoneRootStat !== null &&
    (tombstoneRootStat.isSymbolicLink() || !tombstoneRootStat.isDirectory())
  ) {
    throw new Error("change tombstone root must be a regular directory");
  }
  if (tombstoneRootStat !== null && tombstoneRootStat.dev !== sourceStat.dev) {
    throw new Error(
      "change tombstone root must share a filesystem with source"
    );
  }
  const tombstoneDirectory = path.join(
    tombstoneRoot,
    `${sourceName}-${randomUUID()}`
  );
  if ((await lstatOrNull(tombstoneDirectory)) !== null) {
    throw new Error("change tombstone target already exists");
  }
  return {
    changeRoot,
    changeRootIdentity: identity(rootStat),
    directories: physical.directories,
    files,
    headCommit,
    memberCount: files.length + physical.directories.length,
    sourceDirectory,
    sourceIdentity: identity(sourceStat),
    tombstoneDirectory,
    tombstoneRoot,
    tombstoneRootIdentity:
      tombstoneRootStat === null ? null : identity(tombstoneRootStat)
  };
}

/** Creates the private cleanup root only after all public gates have passed. */
export async function ensureChangeTombstoneRoot(
  preparation: ChangeDeletionPreparation
): Promise<void> {
  if (preparation.tombstoneRootIdentity !== null) return;
  const [root, source, tombstone] = await Promise.all([
    fs.lstat(preparation.changeRoot),
    fs.lstat(preparation.sourceDirectory),
    lstatOrNull(preparation.tombstoneRoot)
  ]);
  if (!hasDirectoryIdentity(root, preparation.changeRootIdentity)) {
    throw new Error("change root changed before tombstone creation");
  }
  if (!hasDirectoryIdentity(source, preparation.sourceIdentity)) {
    throw new Error("change directory changed before tombstone creation");
  }
  if (tombstone !== null) {
    throw new Error("change tombstone root appeared before creation");
  }
  await fs.mkdir(preparation.tombstoneRoot, { mode: 0o700 });
}

export async function executePreparedChangeDeletion(
  preparation: ChangeDeletionPreparation
): Promise<ChangeDeletionExecution> {
  const revalidationError = await revalidatePreparation(preparation);
  if (revalidationError !== null) {
    return {
      changed: false,
      error: revalidationError,
      outcome: "no-change",
      tombstoneDirectory: null
    };
  }
  const claimed = await claimAndCopyTombstone(preparation);
  if (typeof claimed === "string") {
    return {
      changed: false,
      error: claimed,
      outcome: "no-change",
      tombstoneDirectory: preparation.tombstoneDirectory
    };
  }

  const sourceCleanupError = await removePreparedTree(
    preparation.sourceDirectory,
    {
      directories: preparation.directories,
      files: preparation.files,
      rootIdentity: preparation.sourceIdentity
    },
    "source"
  );
  if (sourceCleanupError !== null) {
    return {
      changed: true,
      error: `source cleanup is pending: ${sourceCleanupError}`,
      outcome: "committed-cleanup-pending",
      tombstoneDirectory: preparation.tombstoneDirectory
    };
  }

  const cleanupError = await removePreparedTree(
    preparation.tombstoneDirectory,
    claimed,
    "tombstone"
  );
  return cleanupError === null
    ? {
        changed: true,
        error: null,
        outcome: "completed",
        tombstoneDirectory: null
      }
    : {
        changed: true,
        error: cleanupError,
        outcome: "committed-cleanup-pending",
        tombstoneDirectory: preparation.tombstoneDirectory
      };
}

/**
 * Claims a new tombstone directory before copying. A POSIX directory rename
 * may replace an empty target, so it is not a no-overwrite primitive here.
 */
async function claimAndCopyTombstone(
  preparation: ChangeDeletionPreparation
): Promise<DeletionTree | string> {
  try {
    await fs.mkdir(preparation.tombstoneDirectory, { mode: 0o700 });
  } catch (error) {
    return `cannot claim change tombstone target without overwrite: ${errorMessage(error)}`;
  }
  try {
    for (const directory of preparation.directories) {
      const target = path.join(
        preparation.tombstoneDirectory,
        directory.relativePath
      );
      await fs.mkdir(target, { mode: directory.mode });
      await fs.chmod(target, directory.mode);
    }
    for (const file of preparation.files) {
      const target = path.join(
        preparation.tombstoneDirectory,
        file.relativePath
      );
      await fs.copyFile(
        path.join(preparation.sourceDirectory, file.relativePath),
        target,
        fileSystemConstants.COPYFILE_EXCL
      );
      await fs.chmod(target, file.mode === "100755" ? 0o755 : 0o644);
    }
    return await captureCopiedTree(preparation);
  } catch (error) {
    return `claimed tombstone copy is pending inspection: ${errorMessage(error)}`;
  }
}

async function captureCopiedTree(
  preparation: ChangeDeletionPreparation
): Promise<DeletionTree> {
  const root = await requireDirectory(
    preparation.tombstoneDirectory,
    "claimed tombstone"
  );
  const copied = await scanPhysicalTree(preparation.tombstoneDirectory);
  if (
    copied.directories.length !== preparation.directories.length ||
    copied.files.length !== preparation.files.length
  ) {
    throw new Error("claimed tombstone members differ from preparation");
  }
  const directories = copied.directories.map((directory, index) => {
    const expected = preparation.directories[index];
    if (
      expected === undefined ||
      directory.relativePath !== expected.relativePath
    ) {
      throw new Error("claimed tombstone members differ from preparation");
    }
    return directory;
  });
  const files = copied.files.map((file, index) => {
    const expected = preparation.files[index];
    if (
      expected === undefined ||
      file.relativePath !== expected.relativePath ||
      !file.bytes.equals(expected.bytes) ||
      executableMode(file.mode) !== (expected.mode === "100755")
    ) {
      throw new Error("claimed tombstone members differ from preparation");
    }
    return {
      bytes: expected.bytes,
      identity: file.identity,
      mode: expected.mode,
      relativePath: file.relativePath
    };
  });
  return { directories, files, rootIdentity: identity(root) };
}

async function revalidatePreparation(
  preparation: ChangeDeletionPreparation
): Promise<string | null> {
  try {
    const [root, source, tombstoneRoot, target] = await Promise.all([
      fs.lstat(preparation.changeRoot),
      fs.lstat(preparation.sourceDirectory),
      fs.lstat(preparation.tombstoneRoot),
      lstatOrNull(preparation.tombstoneDirectory)
    ]);
    if (!hasDirectoryIdentity(root, preparation.changeRootIdentity)) {
      return "change root changed before completion";
    }
    if (!hasDirectoryIdentity(source, preparation.sourceIdentity)) {
      return "change directory changed before completion";
    }
    if (
      preparation.tombstoneRootIdentity === null ||
      !hasDirectoryIdentity(tombstoneRoot, preparation.tombstoneRootIdentity)
    ) {
      return "change tombstone root changed before completion";
    }
    if (target !== null)
      return "change tombstone target appeared before completion";

    const repository = await openVersionControl(preparation.sourceDirectory);
    if ((await repository.getCurrentRevision()) !== preparation.headCommit) {
      return "Git HEAD changed before completion";
    }
    await verifyPhysicalTree(
      preparation.sourceDirectory,
      preparation.directories,
      preparation.files
    );
    return null;
  } catch (error) {
    return `cannot revalidate change deletion: ${errorMessage(error)}`;
  }
}

async function removePreparedTree(
  root: string,
  expected: DeletionTree,
  label: "source" | "tombstone"
): Promise<string | null> {
  try {
    const rootStat = await fs.lstat(root);
    if (!hasDirectoryIdentity(rootStat, expected.rootIdentity)) {
      throw new Error(`${label} root changed before cleanup`);
    }
    await verifyPhysicalTree(root, expected.directories, expected.files);
    for (const file of expected.files) {
      const target = path.join(root, file.relativePath);
      await verifyFile(target, file);
      await fs.unlink(target);
    }
    for (const directory of [...expected.directories].sort(compareDeepest)) {
      const target = path.join(root, directory.relativePath);
      const stat = await fs.lstat(target);
      if (!hasDirectoryIdentity(stat, directory.identity)) {
        throw new Error(
          `${label} directory changed: ${directory.relativePath}`
        );
      }
      await fs.rmdir(target);
    }
    const after = await fs.lstat(root);
    if (!hasDirectoryIdentity(after, expected.rootIdentity)) {
      throw new Error(`${label} root changed before cleanup`);
    }
    await fs.rmdir(root);
    return null;
  } catch (error) {
    return `${label} cleanup failed: ${errorMessage(error)}`;
  }
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

function validateSupportedGitTreeEntries(
  sourceRepositoryPath: string,
  gitEntries: readonly ReturnType<typeof parseGitTreeEntries>[number][]
): void {
  const sourcePrefix = `${sourceRepositoryPath}/`;
  if (gitEntries.length === 0) {
    throw new Error("change deletion requires a non-empty Git file tree");
  }
  for (const entry of gitEntries) {
    if (
      entry.objectType !== "blob" ||
      !supportedGitModes.has(entry.mode) ||
      !entry.path.startsWith(sourcePrefix)
    ) {
      throw new Error(
        "Git tree contains an unsupported change deletion member"
      );
    }
    const relativePath = entry.path.slice(sourcePrefix.length);
    if (relativePath.length === 0 || relativePath.includes("\\")) {
      throw new Error("Git tree contains an invalid change deletion path");
    }
  }
}

function validateTreeEntries(
  sourceRepositoryPath: string,
  gitEntries: readonly ReturnType<typeof parseGitTreeEntries>[number][],
  revisionFiles: readonly Readonly<{ data: Uint8Array; path: string }>[],
  physical: PhysicalTree
): FileExpectation[] {
  validateSupportedGitTreeEntries(sourceRepositoryPath, gitEntries);
  const sourcePrefix = `${sourceRepositoryPath}/`;
  const revisionByPath = new Map(
    revisionFiles.map((file) => [file.path, Buffer.from(file.data)])
  );
  const physicalByPath = new Map(
    physical.files.map((file) => [file.relativePath, file])
  );
  const expectedDirectories = new Set<string>();
  const expectedFiles: FileExpectation[] = [];
  for (const entry of gitEntries) {
    const relativePath = entry.path.slice(sourcePrefix.length);
    const revisionBytes = revisionByPath.get(entry.path);
    const workspaceFile = physicalByPath.get(relativePath);
    if (revisionBytes === undefined || workspaceFile === undefined) {
      throw new Error(`Git and workspace members differ: ${relativePath}`);
    }
    const mode = entry.mode as "100644" | "100755";
    if (
      !revisionBytes.equals(workspaceFile.bytes) ||
      executableMode(workspaceFile.mode) !== (mode === "100755")
    ) {
      throw new Error(`workspace file differs from Git HEAD: ${relativePath}`);
    }
    expectedFiles.push({
      bytes: revisionBytes,
      identity: workspaceFile.identity,
      mode,
      relativePath
    });
    addParentDirectories(relativePath, expectedDirectories);
  }
  if (
    revisionByPath.size !== gitEntries.length ||
    physicalByPath.size !== gitEntries.length ||
    physical.directories.length !== expectedDirectories.size ||
    physical.directories.some(
      (directory) => !expectedDirectories.has(directory.relativePath)
    )
  ) {
    throw new Error("change deletion tree contains unknown or empty members");
  }
  return expectedFiles.sort(compareRelativePath);
}

type PhysicalTree = Readonly<{
  directories: readonly DirectoryExpectation[];
  files: readonly Readonly<{
    bytes: Buffer;
    identity: DirectoryIdentity;
    mode: number;
    relativePath: string;
  }>[];
}>;

async function scanPhysicalTree(root: string): Promise<PhysicalTree> {
  const directories: DirectoryExpectation[] = [];
  const files: PhysicalTree["files"][number][] = [];
  async function scan(
    directory: string,
    relativeDirectory: string
  ): Promise<void> {
    for (const entry of (
      await fs.readdir(directory, { withFileTypes: true })
    ).sort((left, right) => left.name.localeCompare(right.name))) {
      const relativePath =
        relativeDirectory.length === 0
          ? entry.name
          : `${relativeDirectory}/${entry.name}`;
      const target = path.join(directory, entry.name);
      const stat = await fs.lstat(target);
      if (stat.isSymbolicLink()) {
        throw new Error(
          `change deletion tree contains a symbolic link: ${relativePath}`
        );
      }
      if (stat.isDirectory()) {
        directories.push({
          identity: identity(stat),
          mode: stat.mode,
          relativePath
        });
        await scan(target, relativePath);
        continue;
      }
      if (!stat.isFile()) {
        throw new Error(
          `change deletion tree contains a non-regular file: ${relativePath}`
        );
      }
      const bytes = await fs.readFile(target);
      const after = await fs.lstat(target);
      if (
        !hasFileIdentity(after, identity(stat)) ||
        after.size !== bytes.byteLength
      ) {
        throw new Error(
          `change deletion file changed while being read: ${relativePath}`
        );
      }
      files.push({
        bytes,
        identity: identity(after),
        mode: after.mode,
        relativePath
      });
    }
  }
  await scan(root, "");
  return {
    directories: directories.sort(compareRelativePath),
    files: files.sort(compareRelativePath)
  };
}

async function verifyPhysicalTree(
  root: string,
  directories: readonly DirectoryExpectation[],
  files: readonly FileExpectation[]
): Promise<void> {
  const current = await scanPhysicalTree(root);
  if (
    current.directories.length !== directories.length ||
    current.files.length !== files.length ||
    current.directories.some(
      (directory, index) =>
        directory.relativePath !== directories[index]?.relativePath ||
        !sameIdentity(directory.identity, directories[index]!.identity)
    )
  ) {
    throw new Error("change deletion members changed");
  }
  for (const file of files) {
    await verifyFile(path.join(root, file.relativePath), file);
  }
}

async function verifyFile(
  target: string,
  expected: FileExpectation
): Promise<void> {
  const stat = await fs.lstat(target);
  if (
    stat.isSymbolicLink() ||
    !stat.isFile() ||
    !hasFileIdentity(stat, expected.identity) ||
    executableMode(stat.mode) !== (expected.mode === "100755")
  ) {
    throw new Error(`change deletion file changed: ${expected.relativePath}`);
  }
  const bytes = await fs.readFile(target);
  const after = await fs.lstat(target);
  if (
    !hasFileIdentity(after, expected.identity) ||
    !expected.bytes.equals(bytes) ||
    after.size !== expected.bytes.byteLength
  ) {
    throw new Error(`change deletion file changed: ${expected.relativePath}`);
  }
}

function addParentDirectories(
  relativePath: string,
  directories: Set<string>
): void {
  let parent = path.posix.dirname(relativePath);
  while (parent !== ".") {
    directories.add(parent);
    parent = path.posix.dirname(parent);
  }
}

function compareRelativePath(
  left: Readonly<{ relativePath: string }>,
  right: Readonly<{ relativePath: string }>
): number {
  return left.relativePath.localeCompare(right.relativePath);
}

function compareDeepest(
  left: DirectoryExpectation,
  right: DirectoryExpectation
): number {
  return (
    right.relativePath.split("/").length -
      left.relativePath.split("/").length ||
    right.relativePath.localeCompare(left.relativePath)
  );
}

function executableMode(mode: number): boolean {
  return (mode & 0o100) !== 0;
}

function identity(stat: Stats): DirectoryIdentity {
  return { dev: stat.dev, ino: stat.ino };
}

function sameIdentity(
  left: DirectoryIdentity,
  right: DirectoryIdentity
): boolean {
  return left.dev === right.dev && left.ino === right.ino;
}

function hasDirectoryIdentity(
  stat: Stats,
  expected: DirectoryIdentity
): boolean {
  return (
    !stat.isSymbolicLink() &&
    stat.isDirectory() &&
    sameIdentity(identity(stat), expected)
  );
}

function hasFileIdentity(stat: Stats, expected: DirectoryIdentity): boolean {
  return (
    !stat.isSymbolicLink() &&
    stat.isFile() &&
    sameIdentity(identity(stat), expected)
  );
}

async function requireDirectory(target: string, label: string): Promise<Stats> {
  const stat = await fs.lstat(target);
  if (stat.isSymbolicLink() || !stat.isDirectory()) {
    throw new Error(`${label} must be a regular directory`);
  }
  return stat;
}

async function lstatOrNull(target: string): Promise<Stats | null> {
  try {
    return await fs.lstat(target);
  } catch (error) {
    if (isNotFound(error)) return null;
    throw error;
  }
}

function isNotFound(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "ENOENT"
  );
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function runGit(root: string, args: readonly string[]): Promise<Buffer> {
  return new Promise((resolve, reject) => {
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
    );
  });
}
