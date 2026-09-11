import { constants as fileSystemConstants, type Stats } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { parseGitTreeEntries } from "../../shared/src/version-control/git-tree-entry.ts";
import {
  compareRelativePath,
  executableMode,
  hasFileIdentity,
  identity,
  sameIdentity,
  supportedGitModes,
  type DirectoryExpectation,
  type FileExpectation,
  type PhysicalTree
} from "./change-deletion-types.ts";

export function validateSupportedGitTreeEntries(
  sourceRepositoryPath: string,
  gitEntries: readonly ReturnType<typeof parseGitTreeEntries>[number][]
): void {
  const sourcePrefix = `${sourceRepositoryPath}/`;
  if (gitEntries.length === 0)
    throw new Error("change deletion requires a non-empty Git file tree");
  for (const entry of gitEntries) {
    if (
      entry.objectType !== "blob" ||
      !supportedGitModes.has(entry.mode) ||
      !entry.path.startsWith(sourcePrefix)
    )
      throw new Error(
        "Git tree contains an unsupported change deletion member"
      );
    const relativePath = entry.path.slice(sourcePrefix.length);
    if (relativePath.length === 0 || relativePath.includes("\\"))
      throw new Error("Git tree contains an invalid change deletion path");
  }
}

export function validateTreeEntries(
  sourceRepositoryPath: string,
  gitEntries: readonly ReturnType<typeof parseGitTreeEntries>[number][],
  revisionFiles: readonly Readonly<{ data: Uint8Array; path: string }>[],
  physical: PhysicalTree
): FileExpectation[] {
  validateSupportedGitTreeEntries(sourceRepositoryPath, gitEntries);
  const entries = treeEntryMaps(sourceRepositoryPath, revisionFiles, physical);
  const expectedDirectories = new Set<string>();
  const expectedFiles = gitEntries.map((entry) =>
    expectedFile(entry, entries, expectedDirectories)
  );
  if (
    entries.revisionByPath.size !== gitEntries.length ||
    entries.physicalByPath.size !== gitEntries.length ||
    physical.directories.length !== expectedDirectories.size ||
    physical.directories.some(
      (directory) => !expectedDirectories.has(directory.relativePath)
    )
  )
    throw new Error("change deletion tree contains unknown or empty members");
  return expectedFiles.sort(compareRelativePath);
}

function treeEntryMaps(
  sourceRepositoryPath: string,
  revisionFiles: readonly Readonly<{ data: Uint8Array; path: string }>[],
  physical: PhysicalTree
) {
  return {
    physicalByPath: new Map(
      physical.files.map((file) => [file.relativePath, file])
    ),
    revisionByPath: new Map(
      revisionFiles.map((file) => [file.path, Buffer.from(file.data)])
    ),
    sourcePrefix: `${sourceRepositoryPath}/`
  };
}
function expectedFile(
  entry: ReturnType<typeof parseGitTreeEntries>[number],
  entries: ReturnType<typeof treeEntryMaps>,
  expectedDirectories: Set<string>
): FileExpectation {
  const relativePath = entry.path.slice(entries.sourcePrefix.length);
  const revisionBytes = entries.revisionByPath.get(entry.path);
  const workspaceFile = entries.physicalByPath.get(relativePath);
  if (revisionBytes === undefined || workspaceFile === undefined)
    throw new Error(`Git and workspace members differ: ${relativePath}`);
  const mode = entry.mode as "100644" | "100755";
  if (
    !revisionBytes.equals(workspaceFile.bytes) ||
    executableMode(workspaceFile.mode) !== (mode === "100755")
  )
    throw new Error(`workspace file differs from Git HEAD: ${relativePath}`);
  addParentDirectories(relativePath, expectedDirectories);
  return {
    bytes: revisionBytes,
    identity: workspaceFile.identity,
    mode,
    relativePath
  };
}

export async function scanPhysicalTree(root: string): Promise<PhysicalTree> {
  const directories: DirectoryExpectation[] = [];
  const files: PhysicalTree["files"][number][] = [];
  await scanDirectory(root, "", directories, files);
  return {
    directories: directories.sort(compareRelativePath),
    files: files.sort(compareRelativePath)
  };
}

async function scanDirectory(
  directory: string,
  relativeDirectory: string,
  directories: DirectoryExpectation[],
  files: PhysicalTree["files"][number][]
): Promise<void> {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  for (const entry of entries.sort((left, right) =>
    left.name.localeCompare(right.name)
  )) {
    const relativePath =
      relativeDirectory.length === 0
        ? entry.name
        : `${relativeDirectory}/${entry.name}`;
    const target = path.join(directory, entry.name);
    const stat = await fs.lstat(target);
    if (stat.isSymbolicLink())
      throw new Error(
        `change deletion tree contains a symbolic link: ${relativePath}`
      );
    if (stat.isDirectory()) {
      directories.push({
        identity: identity(stat),
        mode: stat.mode,
        relativePath
      });
      await scanDirectory(target, relativePath, directories, files);
    } else {
      if (!stat.isFile())
        throw new Error(
          `change deletion tree contains a non-regular file: ${relativePath}`
        );
      files.push(await readPhysicalFile(target, relativePath, stat));
    }
  }
}

async function readPhysicalFile(
  target: string,
  relativePath: string,
  before: Stats
): Promise<PhysicalTree["files"][number]> {
  const bytes = await fs.readFile(target);
  const after = await fs.lstat(target);
  if (
    !hasFileIdentity(after, identity(before)) ||
    after.size !== bytes.byteLength
  )
    throw new Error(
      `change deletion file changed while being read: ${relativePath}`
    );
  return { bytes, identity: identity(after), mode: after.mode, relativePath };
}

export async function verifyPhysicalTree(
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
  )
    throw new Error("change deletion members changed");
  for (const file of files)
    await verifyFile(path.join(root, file.relativePath), file);
}

export async function verifyFile(
  target: string,
  expected: FileExpectation
): Promise<void> {
  const stat = await fs.lstat(target);
  if (!matchesExpectedFileMetadata(stat, expected))
    throw new Error(`change deletion file changed: ${expected.relativePath}`);
  const bytes = await fs.readFile(target);
  const after = await fs.lstat(target);
  if (!matchesExpectedFileRead(after, expected, bytes))
    throw new Error(`change deletion file changed: ${expected.relativePath}`);
}

function matchesExpectedFileMetadata(
  stat: Stats,
  expected: FileExpectation
): boolean {
  return (
    !stat.isSymbolicLink() &&
    stat.isFile() &&
    hasFileIdentity(stat, expected.identity) &&
    executableMode(stat.mode) === (expected.mode === "100755")
  );
}
function matchesExpectedFileRead(
  stat: Stats,
  expected: FileExpectation,
  bytes: Buffer
): boolean {
  return (
    hasFileIdentity(stat, expected.identity) &&
    expected.bytes.equals(bytes) &&
    stat.size === expected.bytes.byteLength
  );
}

export async function copyPreparedTree(
  sourceDirectory: string,
  tombstoneDirectory: string,
  directories: readonly DirectoryExpectation[],
  files: readonly FileExpectation[]
): Promise<void> {
  for (const directory of directories) {
    const target = path.join(tombstoneDirectory, directory.relativePath);
    await fs.mkdir(target, { mode: directory.mode });
    await fs.chmod(target, directory.mode);
  }
  for (const file of files) {
    const target = path.join(tombstoneDirectory, file.relativePath);
    await fs.copyFile(
      path.join(sourceDirectory, file.relativePath),
      target,
      fileSystemConstants.COPYFILE_EXCL
    );
    await fs.chmod(target, file.mode === "100755" ? 0o755 : 0o644);
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
