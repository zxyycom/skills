import { constants } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import fastGlob from "fast-glob";
import { isPathWithinDirectory, toPosix } from "../node/filesystem.ts";
import type {
  FileTextSearchResourceLimits,
  FileTextSearchSelection,
  ValidatedRequest
} from "./contracts.ts";
import {
  FileTextSearchError,
  invalidFile,
  resourceLimit,
  throwIfAborted
} from "./contracts.ts";
import { parseSourcePath } from "./request.ts";

const utf8Decoder = new TextDecoder("utf-8", { fatal: true });

export async function openRoot(
  requestedRoot: string,
  signal: AbortSignal | undefined
): Promise<string> {
  const root = path.resolve(requestedRoot);
  throwIfAborted(signal);
  let entry: Awaited<ReturnType<typeof fs.lstat>>;
  try {
    entry = await fs.lstat(root);
  } catch {
    throw new FileTextSearchError({
      code: "invalid-root",
      message: "File text search root is unavailable."
    });
  }
  if (entry.isSymbolicLink() || !entry.isDirectory()) {
    throw new FileTextSearchError({
      code: "invalid-root",
      message: "File text search root must be a non-symbolic-link directory."
    });
  }
  let canonicalRoot: string;
  try {
    canonicalRoot = await fs.realpath(root);
  } catch {
    throw new FileTextSearchError({
      code: "invalid-root",
      message: "File text search root cannot be verified."
    });
  }
  throwIfAborted(signal);
  return canonicalRoot;
}

export async function selectSourcePaths(
  root: string,
  request: ValidatedRequest
): Promise<readonly string[]> {
  const selected =
    request.selection.kind === "files"
      ? request.selection.sourcePaths
      : await selectPatternSourcePaths(
          root,
          request.selection,
          request.limits.maxCandidateFiles,
          request.signal
        );
  const sourcePaths = [...new Set(selected.map(parseSourcePath))].sort(
    compareText
  );
  for (const sourcePath of sourcePaths) {
    await verifySelectedFile(root, sourcePath, request.signal);
  }
  return sourcePaths;
}

async function selectPatternSourcePaths(
  root: string,
  selection: Extract<FileTextSearchSelection, { kind: "patterns" }>,
  maxCandidateFiles: number,
  signal: AbortSignal | undefined
): Promise<readonly string[]> {
  throwIfAborted(signal);
  try {
    const stream = fastGlob.stream([...selection.include], {
      absolute: false,
      cwd: root,
      dot: true,
      followSymbolicLinks: false,
      ignore: selection.exclude === undefined ? [] : [...selection.exclude],
      objectMode: false,
      onlyFiles: true,
      unique: true
    });
    const paths: string[] = [];
    for await (const entry of stream) {
      throwIfAborted(signal);
      if (paths.length >= maxCandidateFiles) {
        throw resourceLimit(
          "File text search candidate file limit was exceeded."
        );
      }
      if (typeof entry !== "string") {
        throw new FileTextSearchError({
          code: "read-failed",
          message: "File text search enumerator returned an invalid path."
        });
      }
      paths.push(toPosix(entry));
    }
    throwIfAborted(signal);
    return paths;
  } catch (error) {
    if (error instanceof FileTextSearchError) throw error;
    throw new FileTextSearchError({
      code: "read-failed",
      message: "File text search could not enumerate selected files."
    });
  }
}

export async function verifySelectedFile(
  root: string,
  sourcePath: string,
  signal: AbortSignal | undefined
): Promise<void> {
  const segments = sourcePath.split("/");
  let current = root;
  for (const segment of segments) {
    throwIfAborted(signal);
    current = path.join(current, segment);
    const entry = await lstatSelectedPath(current, sourcePath);
    if (entry.isSymbolicLink()) {
      throw invalidFile(
        sourcePath,
        "File text search does not search symbolic links."
      );
    }
  }

  const entry = await lstatSelectedPath(current, sourcePath);
  if (!entry.isFile()) {
    throw invalidFile(
      sourcePath,
      "File text search only accepts ordinary files."
    );
  }
  try {
    const [canonicalRoot, canonicalFile] = await Promise.all([
      fs.realpath(root),
      fs.realpath(current)
    ]);
    if (!isPathWithinDirectory(canonicalFile, canonicalRoot)) {
      throw invalidFile(
        sourcePath,
        "File text search selected file escapes the collection root."
      );
    }
  } catch (error) {
    if (error instanceof FileTextSearchError) throw error;
    throw invalidFile(
      sourcePath,
      "File text search selected file cannot be verified."
    );
  }
}

async function lstatSelectedPath(
  target: string,
  sourcePath: string
): Promise<Awaited<ReturnType<typeof fs.lstat>>> {
  try {
    return await fs.lstat(target);
  } catch {
    throw invalidFile(
      sourcePath,
      "File text search selected file is unavailable."
    );
  }
}

export async function readSelectedFile(
  root: string,
  sourcePath: string,
  limits: FileTextSearchResourceLimits,
  scannedBytes: number,
  signal: AbortSignal | undefined
): Promise<Readonly<{ byteLength: number; content: string }>> {
  await verifySelectedFile(root, sourcePath, signal);
  throwIfAborted(signal);
  const target = path.join(root, ...sourcePath.split("/"));
  let handle: Awaited<ReturnType<typeof fs.open>>;
  try {
    handle = await fs.open(target, constants.O_RDONLY | constants.O_NOFOLLOW);
  } catch {
    throw invalidFile(
      sourcePath,
      "File text search could not safely open a selected file."
    );
  }
  try {
    const opened = await handle.stat();
    validateOpenedSize(opened, sourcePath, limits, scannedBytes);
    await verifyOpenedFile(root, sourcePath, opened, signal);
    const data = await readHandleBytes(
      handle,
      Math.min(limits.maxFileBytes, limits.maxTotalBytes - scannedBytes),
      signal
    );
    if (scannedBytes + data.length > limits.maxTotalBytes) {
      throw resourceLimit(
        "File text search total scanned byte limit was exceeded."
      );
    }
    throwIfAborted(signal);
    return decodeSelectedFile(data, sourcePath);
  } finally {
    await handle.close();
  }
}

function validateOpenedSize(
  opened: Readonly<{ isFile(): boolean; size: number }>,
  sourcePath: string,
  limits: FileTextSearchResourceLimits,
  scannedBytes: number
): void {
  if (!opened.isFile()) {
    throw invalidFile(
      sourcePath,
      "File text search only accepts ordinary files."
    );
  }
  if (opened.size > limits.maxFileBytes) {
    throw resourceLimit(
      "File text search single-file byte limit was exceeded."
    );
  }
  if (scannedBytes + opened.size > limits.maxTotalBytes) {
    throw resourceLimit(
      "File text search total scanned byte limit was exceeded."
    );
  }
}

function decodeSelectedFile(
  data: Uint8Array,
  sourcePath: string
): Readonly<{ byteLength: number; content: string }> {
  try {
    return { byteLength: data.length, content: utf8Decoder.decode(data) };
  } catch {
    throw new FileTextSearchError({
      code: "invalid-utf8",
      message: "File text search selected file is not valid UTF-8.",
      sourcePath
    });
  }
}

async function verifyOpenedFile(
  root: string,
  sourcePath: string,
  opened: Awaited<ReturnType<Awaited<ReturnType<typeof fs.open>>["stat"]>>,
  signal: AbortSignal | undefined
): Promise<void> {
  await verifySelectedFile(root, sourcePath, signal);
  const target = path.join(root, ...sourcePath.split("/"));
  let current: Awaited<ReturnType<typeof fs.lstat>>;
  try {
    current = await fs.lstat(target);
  } catch {
    throw invalidFile(
      sourcePath,
      "File text search selected file changed while it was opened."
    );
  }
  if (
    current.isSymbolicLink() ||
    !current.isFile() ||
    current.dev !== opened.dev ||
    current.ino !== opened.ino
  ) {
    throw invalidFile(
      sourcePath,
      "File text search selected file changed while it was opened."
    );
  }
}

async function readHandleBytes(
  handle: Awaited<ReturnType<typeof fs.open>>,
  maximumBytes: number,
  signal: AbortSignal | undefined
): Promise<Uint8Array> {
  const chunks: Uint8Array[] = [];
  let byteLength = 0;
  while (true) {
    throwIfAborted(signal);
    const buffer = new Uint8Array(
      Math.min(64 * 1024, maximumBytes - byteLength + 1)
    );
    const { bytesRead } = await handle.read(buffer, 0, buffer.length, null);
    if (bytesRead === 0) break;
    byteLength += bytesRead;
    if (byteLength > maximumBytes) {
      throw resourceLimit("File text search byte limit was exceeded.");
    }
    chunks.push(buffer.slice(0, bytesRead));
  }
  const content = new Uint8Array(byteLength);
  let offset = 0;
  for (const chunk of chunks) {
    content.set(chunk, offset);
    offset += chunk.length;
  }
  return content;
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
