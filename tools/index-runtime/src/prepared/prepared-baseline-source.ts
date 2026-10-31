import path from "node:path";
import fs from "node:fs/promises";
import { constants, type Stats } from "node:fs";
import { failure, filesystemFailure } from "../diagnostics.ts";
import {
  decodeUtf8Text,
  type ResolvedIndexPath
} from "../storage/index-path.ts";
import {
  isFileSystemError,
  isPathWithinDirectory
} from "../../../shared/src/node/filesystem.ts";
import type { StateIndexResult } from "../types.ts";

/** Reads one raw baseline with canonical containment, inode and byte-stability evidence. */
export async function readBaselineSource(
  options: Readonly<{
    indexPath: string;
    resolved: ResolvedIndexPath;
  }>
): Promise<StateIndexResult<Readonly<{ bytes: Uint8Array; text: string }>>> {
  try {
    const bytes = await readStableBaselineBytes(options.resolved);
    try {
      return {
        diagnostics: [],
        status: "ok",
        value: { bytes, text: decodeUtf8Text(bytes) }
      };
    } catch {
      return failure(
        "state-index.index-encoding-invalid",
        `${options.indexPath} must contain valid UTF-8 text`,
        { path: options.indexPath }
      );
    }
  } catch (error) {
    return filesystemFailure(
      isFileSystemError(error, "ENOENT")
        ? "state-index.index-missing"
        : "state-index.index-read-failed",
      isFileSystemError(error, "ENOENT")
        ? "the state-index file does not exist"
        : "failed to read the state-index file; inspect index availability and access, then retry",
      {
        error,
        operation: "read a state-index file",
        path: options.indexPath,
        target: options.indexPath
      }
    );
  }
}

async function readStableBaselineBytes(
  resolved: ResolvedIndexPath
): Promise<Buffer> {
  await assertCanonicalBoundary(
    resolved,
    "index path identity changed before reading"
  );
  const parents = await captureParentIdentities(resolved);
  const handle = await fs.open(
    resolved.targetPath,
    constants.O_RDONLY | constants.O_NOFOLLOW
  );
  try {
    const before = await handle.stat();
    if (!before.isFile())
      throw Object.assign(new Error("index must be a regular file"), {
        code: before.isDirectory() ? "EISDIR" : "EINVAL"
      });
    const bytes = await handle.readFile();
    const after = await handle.stat();
    const located = await fs.lstat(resolved.targetPath);
    if (!sameFileRevision(before, after) || !sameFileIdentity(after, located))
      throw new Error("index path or bytes changed while reading");
    await assertCanonicalBoundary(
      resolved,
      "index path or bytes changed while reading"
    );
    await assertParentIdentities(parents);
    return bytes;
  } finally {
    await handle.close();
  }
}

async function assertCanonicalBoundary(
  resolved: ResolvedIndexPath,
  message: string
): Promise<void> {
  const { targetPath, canonicalRoot } = resolved;
  if (
    (await fs.realpath(canonicalRoot)) !== canonicalRoot ||
    (await fs.realpath(targetPath)) !== targetPath ||
    !isPathWithinDirectory(targetPath, canonicalRoot)
  )
    throw new Error(message);
}

function sameFileIdentity(left: Stats, right: Stats): boolean {
  return left.dev === right.dev && left.ino === right.ino;
}

function sameFileRevision(left: Stats, right: Stats): boolean {
  return (
    sameFileIdentity(left, right) &&
    left.size === right.size &&
    left.mtimeMs === right.mtimeMs &&
    left.ctimeMs === right.ctimeMs
  );
}

type BaselineParentIdentity = Readonly<{ directory: string; identity: Stats }>;

async function captureParentIdentities(
  resolved: ResolvedIndexPath
): Promise<readonly BaselineParentIdentity[]> {
  const identities: BaselineParentIdentity[] = [];
  let directory = path.dirname(resolved.targetPath);
  while (isPathWithinDirectory(directory, resolved.canonicalRoot)) {
    const identity = await fs.lstat(directory);
    if (!identity.isDirectory())
      throw new Error("index parent must remain a directory");
    identities.push({ directory, identity });
    if (directory === resolved.canonicalRoot) return identities;
    directory = path.dirname(directory);
  }
  throw new Error("index parent resolved outside the configured root");
}

async function assertParentIdentities(
  parents: readonly BaselineParentIdentity[]
): Promise<void> {
  for (const parent of parents) {
    const current = await fs.lstat(parent.directory);
    if (!current.isDirectory() || !sameFileIdentity(parent.identity, current))
      throw new Error("index parent identity changed while reading");
  }
}
