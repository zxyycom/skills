import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import {
  isFileSystemError,
  isPathWithinDirectory
} from "../../shared/src/node/filesystem.ts";
import { filesystemFailure, failure } from "./diagnostics.ts";
import { isStateIndexText } from "./schemas.ts";
import type { StateIndexResult } from "./types.ts";

export type ResolvedIndexPath = Readonly<{
  canonicalRoot: string;
  targetPath: string;
}>;

export async function resolveIndexPath(
  indexPath: string,
  root: string
): Promise<StateIndexResult<ResolvedIndexPath>> {
  if (!isNormalizedRelativePosixPath(indexPath)) {
    return failure(
      "state-index.index-path-invalid",
      `${indexPath} must be a normalized relative POSIX path`,
      { path: indexPath }
    );
  }
  let canonicalRoot: string;
  try {
    canonicalRoot = await fs.realpath(path.resolve(root));
    if (!(await fs.stat(canonicalRoot)).isDirectory()) {
      throw new Error("the index root is not a directory");
    }
  } catch (error) {
    return filesystemFailure(
      "state-index.index-path-invalid",
      "failed to resolve the index root; verify that context.root exists, is a directory, and is accessible, then retry",
      {
        error,
        operation: "resolve a state-index root",
        path: indexPath,
        target: "configured root"
      }
    );
  }

  return await resolveIndexPathFromCanonicalRoot(indexPath, canonicalRoot);
}

async function resolveIndexPathFromCanonicalRoot(
  indexPath: string,
  canonicalRoot: string
): Promise<StateIndexResult<ResolvedIndexPath>> {
  let currentPath = canonicalRoot;
  const segments = indexPath.split("/");
  for (const [index, segment] of segments.entries()) {
    const resolved = await resolveExistingPathSegment({
      canonicalRoot,
      currentPath,
      indexPath,
      segment
    });
    if (resolved.status === "error") return resolved;
    if (resolved.value === null)
      return unresolvedTarget(canonicalRoot, currentPath, segments, index);
    currentPath = resolved.value;
  }
  return resolvedIndexPath(canonicalRoot, currentPath);
}

async function resolveExistingPathSegment(options: {
  canonicalRoot: string;
  currentPath: string;
  indexPath: string;
  segment: string;
}): Promise<StateIndexResult<string | null>> {
  const candidatePath = path.join(options.currentPath, options.segment);
  try {
    await fs.lstat(candidatePath);
  } catch (error) {
    return isFileSystemError(error, "ENOENT")
      ? { diagnostics: [], status: "ok", value: null }
      : pathSegmentFailure(invalidCanonicalIndexPath(options.indexPath, error));
  }
  let canonicalPath: string;
  try {
    canonicalPath = await fs.realpath(candidatePath);
  } catch (error) {
    return pathSegmentFailure(
      invalidCanonicalIndexPath(options.indexPath, error)
    );
  }
  if (!isPathWithinDirectory(canonicalPath, options.canonicalRoot)) {
    return failure(
      "state-index.index-path-invalid",
      `${options.indexPath} passes through a symbolic link outside the index root; choose a target contained by context.root`,
      { path: options.indexPath }
    );
  }
  return { diagnostics: [], status: "ok", value: canonicalPath };
}

function pathSegmentFailure(
  result: StateIndexResult<ResolvedIndexPath>
): StateIndexResult<string | null> {
  return { diagnostics: result.diagnostics, status: "error", value: null };
}

function unresolvedTarget(
  canonicalRoot: string,
  currentPath: string,
  segments: readonly string[],
  index: number
): StateIndexResult<ResolvedIndexPath> {
  return resolvedIndexPath(
    canonicalRoot,
    path.join(currentPath, ...segments.slice(index))
  );
}
function resolvedIndexPath(
  canonicalRoot: string,
  targetPath: string
): StateIndexResult<ResolvedIndexPath> {
  return {
    diagnostics: [],
    status: "ok",
    value: { canonicalRoot, targetPath }
  };
}
function isNormalizedRelativePosixPath(value: string): boolean {
  if (
    !isStateIndexText(value) ||
    value.includes("\\") ||
    path.posix.isAbsolute(value)
  ) {
    return false;
  }
  return value
    .split("/")
    .every(
      (segment) => segment.length > 0 && segment !== "." && segment !== ".."
    );
}

export async function writeTextAtomically(
  resolved: ResolvedIndexPath,
  text: string
): Promise<string> {
  const targetPath = await resolveWritableIndexPath(resolved);
  const canonicalParent = path.dirname(targetPath);
  const temporaryPath = path.join(
    canonicalParent,
    `.${path.basename(targetPath)}.${process.pid}.${randomUUID()}.tmp`
  );
  try {
    await fs.writeFile(temporaryPath, text, { encoding: "utf8", flag: "wx" });
    await fs.rename(temporaryPath, targetPath);
    return targetPath;
  } catch (error) {
    await fs.rm(temporaryPath, { force: true });
    throw error;
  }
}

async function resolveWritableIndexPath(
  resolved: ResolvedIndexPath
): Promise<string> {
  const relativeParent = path.relative(
    resolved.canonicalRoot,
    path.dirname(resolved.targetPath)
  );
  if (
    relativeParent === ".." ||
    relativeParent.startsWith(".." + path.sep) ||
    path.isAbsolute(relativeParent)
  ) {
    throw new Error("the index parent resolved outside the configured root");
  }

  let currentPath = resolved.canonicalRoot;
  const segments = relativeParent === "" ? [] : relativeParent.split(path.sep);
  for (const segment of segments) {
    const candidatePath = path.join(currentPath, segment);
    try {
      await fs.mkdir(candidatePath);
    } catch (error) {
      if (!isFileSystemError(error, "EEXIST")) {
        throw error;
      }
    }
    const canonicalPath = await fs.realpath(candidatePath);
    if (
      !isPathWithinDirectory(canonicalPath, resolved.canonicalRoot) ||
      !(await fs.stat(canonicalPath)).isDirectory()
    ) {
      throw new Error("the index parent resolved outside the configured root");
    }
    currentPath = canonicalPath;
  }
  return path.join(currentPath, path.basename(resolved.targetPath));
}

function invalidCanonicalIndexPath(
  indexPath: string,
  error: unknown
): StateIndexResult<ResolvedIndexPath> {
  return filesystemFailure(
    "state-index.index-path-invalid",
    "failed to resolve the state-index path inside the configured root; inspect symbolic links and permissions, then retry",
    {
      error,
      operation: "resolve a state-index path",
      path: indexPath,
      target: indexPath
    }
  );
}

export async function verifyWrittenText(
  targetPath: string,
  expected: string
): Promise<void> {
  const written = decodeUtf8Text(await fs.readFile(targetPath));
  if (written !== expected) {
    throw new Error(
      "written index does not match the generated state projection"
    );
  }
}

export function decodeUtf8Text(data: Uint8Array): string {
  return new TextDecoder("utf-8", { fatal: true }).decode(data);
}
