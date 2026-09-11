import { createHash, randomBytes } from "node:crypto";
import fs from "node:fs/promises";
import { createReadStream } from "node:fs";
import path from "node:path";
import {
  BridgeError,
  textPayloadLimit,
  validateRelativePath
} from "./shared.ts";

const metadataPrefix = "MCPSHELL_META ";

export function textInput(value: string | undefined, label: string): string {
  if (value === undefined || value.length === 0) {
    throw new BridgeError(
      "invalid_input",
      `${label} must be a non-empty string`
    );
  }
  if (Buffer.byteLength(value, "utf8") > textPayloadLimit) {
    throw new BridgeError(
      "text_too_large",
      `${label} exceeds the ${textPayloadLimit} byte limit`
    );
  }
  return value;
}

function patchPath(pathValue: string): void {
  if (pathValue === "/dev/null") {
    return;
  }
  if (pathValue.startsWith('"') || pathValue.includes("\t")) {
    throw new BridgeError(
      "path_rejected",
      "quoted or timestamped patch paths are unsupported"
    );
  }
  const withoutPrefix = /^(?:a|b)\/(.+)$/u.exec(pathValue)?.[1] ?? pathValue;
  validateRelativePath(withoutPrefix, "patch path");
}

export function validatePatchPaths(patch: string): void {
  const pathPrefixes = [
    "--- ",
    "+++ ",
    "rename from ",
    "rename to ",
    "copy from ",
    "copy to "
  ];
  for (const line of patch.split(/\r?\n/u)) {
    for (const prefix of pathPrefixes) {
      if (line.startsWith(prefix)) {
        patchPath(line.slice(prefix.length));
      }
    }
    if (line.startsWith("diff --git ")) {
      const match = /^diff --git a\/(.+) b\/(.+)$/u.exec(line);
      if (match === null) {
        throw new BridgeError(
          "path_rejected",
          "patch diff header is unsupported"
        );
      }
      patchPath(match[1]);
      patchPath(match[2]);
    }
  }
}

export async function fileMetadata(
  filePath: string
): Promise<Readonly<{ bytes: number; sha256: string }>> {
  const hash = createHash("sha256");
  let bytes = 0;
  for await (const chunk of createReadStream(filePath)) {
    const bytesChunk = Buffer.from(chunk);
    bytes += bytesChunk.length;
    hash.update(bytesChunk);
  }
  return { bytes, sha256: hash.digest("hex") };
}

export function metadataFromStderr(stderr: Buffer): Readonly<{
  metadata: Readonly<{ bytes: number; sha256: string }> | null;
  remainder: string;
}> {
  const lines = stderr.toString("utf8").split(/\r?\n/u);
  let metadata: Readonly<{ bytes: number; sha256: string }> | null = null;
  const remaining: string[] = [];
  for (const line of lines) {
    if (!line.startsWith(metadataPrefix)) {
      remaining.push(line);
      continue;
    }
    const match = /^MCPSHELL_META ([0-9]+) ([a-f0-9]{64})$/u.exec(line);
    if (match === null || metadata !== null) {
      return { metadata: null, remainder: stderr.toString("utf8") };
    }
    metadata = { bytes: Number(match[1]), sha256: match[2] };
  }
  return { metadata, remainder: remaining.join("\n").replace(/\n+$/u, "") };
}

async function resolveLocalPath(
  root: string,
  relativePath: string,
  label: string
): Promise<string> {
  const normalized = validateRelativePath(relativePath, label);
  const rootReal = await fs.realpath(root);
  const resolved = path.resolve(root, normalized);
  const parentReal = await fs.realpath(path.dirname(resolved));
  const inRoot =
    parentReal === rootReal || parentReal.startsWith(`${rootReal}${path.sep}`);
  if (!inRoot) {
    throw new BridgeError(
      "path_rejected",
      `${label} escaped its configured root`
    );
  }
  return resolved;
}

export async function sourceFile(
  root: string,
  relativePath: string,
  label: string
): Promise<string> {
  const source = await resolveLocalPath(root, relativePath, label);
  const status = await fs.lstat(source);
  if (!status.isFile() || status.isSymbolicLink()) {
    throw new BridgeError(
      "path_rejected",
      `${label} must be a regular non-symlink file`
    );
  }
  const real = await fs.realpath(source);
  const rootReal = await fs.realpath(root);
  if (!real.startsWith(`${rootReal}${path.sep}`)) {
    throw new BridgeError(
      "path_rejected",
      `${label} escaped its configured root`
    );
  }
  return source;
}

export async function resolveLocalDestination(
  root: string,
  relativePath: string,
  label: string
): Promise<string> {
  const normalized = validateRelativePath(relativePath, label);
  const rootReal = await fs.realpath(root);
  const lexicalDestination = path.resolve(root, normalized);
  const parentReal = await fs.realpath(path.dirname(lexicalDestination));
  const inRoot =
    parentReal === rootReal || parentReal.startsWith(`${rootReal}${path.sep}`);
  if (!inRoot) {
    throw new BridgeError(
      "path_rejected",
      `${label} escaped its configured root`
    );
  }
  return path.join(parentReal, path.basename(lexicalDestination));
}

export async function temporaryPath(
  parent: string,
  basename: string
): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const candidate = path.join(
      parent,
      `.${basename}.mcpshell-${randomBytes(8).toString("hex")}`
    );
    try {
      const handle = await fs.open(candidate, "wx");
      await handle.close();
      return candidate;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") {
        throw error;
      }
    }
  }
  throw new BridgeError(
    "protocol_error",
    "could not allocate a transfer temporary file"
  );
}

export async function atomicLocalReceive(
  temporary: string,
  destination: string,
  replace: boolean
): Promise<void> {
  try {
    if (replace) {
      await fs.rename(temporary, destination);
      return;
    }
    await fs.link(temporary, destination);
    await fs.unlink(temporary);
  } catch (error) {
    await fs.rm(temporary, { force: true });
    if ((error as NodeJS.ErrnoException).code === "EEXIST") {
      throw new BridgeError("destination_exists", "destination already exists");
    }
    throw error;
  }
}
