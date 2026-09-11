import { createHash } from "node:crypto";
import { type Dirent, type Stats } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import {
  investigationResourcesDirectoryName,
  isInvestigationResourceId
} from "./resource-reference.ts";
import type {
  ResourceDirectorySnapshot,
  ResourceFileSnapshot,
  ResourceMove,
  ResourceOwnerSnapshot
} from "./rename-contract.ts";
import {
  compareText,
  errorText,
  lstatOrNull,
  renameStepFailure,
  type RenameStep,
  uniqueSorted
} from "./rename-support.ts";

export async function prepareResourceMove(
  root: string,
  oldId: string,
  nextId: string,
  indexPath: string
): Promise<RenameStep<ResourceMove | null>> {
  if (oldId === nextId) return { value: null };
  const from = path.join(root, investigationResourcesDirectoryName, oldId);
  const to = path.join(root, investigationResourcesDirectoryName, nextId);
  try {
    const source = await lstatOrNull(from);
    if (source === null) return { value: null };
    if (source.isSymbolicLink() || !source.isDirectory()) {
      return renameStepFailure(indexPath, [
        "Investigation resource owner path must be a non-symbolic-link directory"
      ]);
    }
    if ((await lstatOrNull(to)) !== null) {
      return renameStepFailure(indexPath, [
        `Investigation resource owner target already exists: ${nextId}`
      ]);
    }
    const scanned = await scanResourceOwner(from, oldId);
    if (scanned.errors.length > 0)
      return renameStepFailure(indexPath, scanned.errors);
    return { value: { from, snapshot: scanned.value, to } };
  } catch (error) {
    return renameStepFailure(indexPath, [
      "Investigation resource owner could not be inspected: " + errorText(error)
    ]);
  }
}

type ResourceOwnerScan = Readonly<{
  errors: readonly string[];
  value: ResourceOwnerSnapshot;
}>;

/**
 * Capture every owner member's type-adjacent metadata and bytes so recovery
 * can distinguish this transaction's copy from a concurrent same-name write.
 */
export async function scanResourceOwner(
  ownerPath: string,
  ownerId: string
): Promise<ResourceOwnerScan> {
  const collector: ResourceOwnerCollector = {
    directories: [],
    errors: [],
    files: [],
    ownerId
  };
  const ownerMode = await ownerModeForSnapshot(ownerPath, collector.errors);
  if (ownerMode === null)
    return {
      errors: uniqueSorted(collector.errors),
      value: emptyResourceOwnerSnapshot()
    };
  const context: ResourceWalkContext = {
    collector,
    walk: async () => undefined
  };
  context.walk = async (directory, relativePath) => {
    const entries = await resourceDirectoryEntries(directory, collector.errors);
    for (const entry of entries)
      await scanResourceEntry(directory, relativePath, entry, context);
  };
  await context.walk(ownerPath, "");
  return {
    errors: uniqueSorted(collector.errors),
    value: {
      directories: uniqueResourceDirectories(collector.directories),
      files: uniqueResourceFiles(collector.files),
      mode: ownerMode
    }
  };
}

type ResourceOwnerCollector = {
  directories: ResourceDirectorySnapshot[];
  errors: string[];
  files: ResourceFileSnapshot[];
  ownerId: string;
};
type ResourceWalkContext = {
  collector: ResourceOwnerCollector;
  walk: (directory: string, relativePath: string) => Promise<void>;
};

async function ownerModeForSnapshot(
  ownerPath: string,
  errors: string[]
): Promise<number | null> {
  try {
    const owner = await fs.lstat(ownerPath);
    if (!owner.isSymbolicLink() && owner.isDirectory())
      return resourceMode(owner.mode);
    errors.push(
      "Investigation resource owner path must be a non-symbolic-link directory"
    );
  } catch (error) {
    errors.push(
      "Investigation resource owner could not be inspected: " + errorText(error)
    );
  }
  return null;
}

async function resourceDirectoryEntries(
  directory: string,
  errors: string[]
): Promise<Dirent[]> {
  try {
    return (await fs.readdir(directory, { withFileTypes: true })).sort(
      (left, right) => compareText(left.name, right.name)
    );
  } catch (error) {
    errors.push(
      "Investigation resource owner could not be read: " + errorText(error)
    );
    return [];
  }
}

async function scanResourceEntry(
  directory: string,
  relativePath: string,
  entry: Dirent,
  context: ResourceWalkContext
): Promise<void> {
  const { collector } = context;
  const next =
    relativePath.length === 0 ? entry.name : `${relativePath}/${entry.name}`;
  const absolute = path.join(directory, entry.name);
  let stat: Stats;
  try {
    stat = await fs.lstat(absolute);
  } catch (error) {
    collector.errors.push(
      `Investigation resource ${collector.ownerId}/${next} could not be inspected: ${errorText(error)}`
    );
    return;
  }
  if (stat.isSymbolicLink()) {
    collector.errors.push(
      `Investigation resource ${collector.ownerId}/${next} must not be a symbolic link`
    );
    return;
  }
  if (stat.isDirectory())
    return await scanResourceDirectory(absolute, next, stat, context);
  if (stat.isFile())
    return await scanResourceFile(absolute, next, stat, collector);
  collector.errors.push(
    `Investigation resource ${collector.ownerId}/${next} must be a regular file or directory`
  );
}

async function scanResourceDirectory(
  absolute: string,
  relativePath: string,
  stat: Stats,
  context: ResourceWalkContext
): Promise<void> {
  const { collector } = context;
  if (
    !isInvestigationResourceId(`${collector.ownerId}/${relativePath}/directory`)
  ) {
    collector.errors.push(
      `Investigation resource directory ${collector.ownerId}/${relativePath} must use a safe path`
    );
    return;
  }
  collector.directories.push({
    mode: resourceMode(stat.mode),
    path: relativePath
  });
  await context.walk(absolute, relativePath);
}

async function scanResourceFile(
  absolute: string,
  relativePath: string,
  stat: Stats,
  collector: ResourceOwnerCollector
): Promise<void> {
  if (!isInvestigationResourceId(`${collector.ownerId}/${relativePath}`)) {
    collector.errors.push(
      `Investigation resource ${collector.ownerId}/${relativePath} must use a safe resource ID`
    );
    return;
  }
  try {
    collector.files.push(
      await resourceFileSnapshot(absolute, relativePath, stat)
    );
  } catch (error) {
    collector.errors.push(
      `Investigation resource ${collector.ownerId}/${relativePath} could not be read: ${errorText(error)}`
    );
  }
}

export function sameResourceOwnerSnapshot(
  left: ResourceOwnerSnapshot,
  right: ResourceOwnerSnapshot
): boolean {
  return (
    left.mode === right.mode &&
    sameResourceDirectories(left.directories, right.directories) &&
    sameResourceFiles(left.files, right.files)
  );
}

function emptyResourceOwnerSnapshot(): ResourceOwnerSnapshot {
  return { directories: [], files: [], mode: 0 };
}

async function resourceFileSnapshot(
  filePath: string,
  relativePath: string,
  initial: Stats
): Promise<ResourceFileSnapshot> {
  const contents = await fs.readFile(filePath);
  const current = await fs.lstat(filePath);
  if (
    current.isSymbolicLink() ||
    !current.isFile() ||
    current.size !== initial.size ||
    resourceMode(current.mode) !== resourceMode(initial.mode)
  ) {
    throw new Error("resource changed while its snapshot was being read");
  }
  return {
    contentHash: createHash("sha256").update(contents).digest("hex"),
    mode: resourceMode(current.mode),
    path: relativePath,
    size: current.size
  };
}

export function resourceMode(mode: number): number {
  return mode & 0o7777;
}

function uniqueResourceDirectories(
  directories: readonly ResourceDirectorySnapshot[]
): ResourceDirectorySnapshot[] {
  return [...directories]
    .sort((left, right) => compareText(left.path, right.path))
    .filter(
      (directory, index, values) =>
        index === 0 || directory.path !== values[index - 1]!.path
    );
}

function uniqueResourceFiles(
  files: readonly ResourceFileSnapshot[]
): ResourceFileSnapshot[] {
  return [...files]
    .sort((left, right) => compareText(left.path, right.path))
    .filter(
      (file, index, values) =>
        index === 0 || file.path !== values[index - 1]!.path
    );
}

function sameResourceDirectories(
  left: readonly ResourceDirectorySnapshot[],
  right: readonly ResourceDirectorySnapshot[]
): boolean {
  return (
    left.length === right.length &&
    left.every(
      (directory, index) =>
        directory.path === right[index]?.path &&
        directory.mode === right[index]?.mode
    )
  );
}

function sameResourceFiles(
  left: readonly ResourceFileSnapshot[],
  right: readonly ResourceFileSnapshot[]
): boolean {
  if (left.length !== right.length) return false;
  return left.every((file, index) => sameResourceFile(file, right[index]));
}

function sameResourceFile(
  file: ResourceFileSnapshot,
  candidate: ResourceFileSnapshot | undefined
): boolean {
  return (
    candidate !== undefined &&
    file.path === candidate.path &&
    file.mode === candidate.mode &&
    file.size === candidate.size &&
    file.contentHash === candidate.contentHash
  );
}
