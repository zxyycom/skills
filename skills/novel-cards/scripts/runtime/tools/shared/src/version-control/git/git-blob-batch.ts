/*
 * Synced TypeScript runtime; repository maintenance edits tools/shared/src/version-control/git/git-blob-batch.ts.
 * Installed skill copies may be edited directly; updates overwrite matching files.
 * Repository: https://github.com/zxyycom/skills
 * Source path: tools/shared/src/version-control/git/git-blob-batch.ts
 * Maintained source: https://github.com/zxyycom/skills/blob/main/tools/shared/src/version-control/git/git-blob-batch.ts
 * Skill source directory: https://github.com/zxyycom/skills/tree/main/skills/novel-cards
 * Rebuild: bun run sync:novel-cards-cli
 */
import { createHash, type Hash } from "node:crypto";
import { spawn } from "node:child_process";

const gitBatchOutputMaxBuffer = 256 * 1024 * 1024;

export type GitBlobContent = Readonly<{
  data: Buffer;
  size: number;
}>;
export type GitBlobSelection = GitBlobContent &
  Readonly<{ fingerprint: string }>;
type GitBlobFingerprintMode = "none" | "sha256";
type GitBlobBatchResult =
  | Readonly<{ mode: "none"; blobs: Map<string, GitBlobContent> }>
  | Readonly<{ mode: "sha256"; blobs: Map<string, GitBlobSelection> }>;
type GitBlobPayload = Readonly<{
  data: Buffer;
  objectId: string;
  size: number;
  hash: Hash | null;
}>;

/** Validate every requested payload; retain only the requested byte prefix. */
export function readGitBlobSelections(
  rootDirectory: string,
  selections: ReadonlyMap<string, number | null>,
  fingerprint?: "sha256"
): Promise<ReadonlyMap<string, GitBlobSelection>>;
export function readGitBlobSelections(
  rootDirectory: string,
  selections: ReadonlyMap<string, number | null>,
  fingerprint: "none"
): Promise<ReadonlyMap<string, GitBlobContent>>;
export async function readGitBlobSelections(
  rootDirectory: string,
  selections: ReadonlyMap<string, number | null>,
  fingerprint: GitBlobFingerprintMode = "sha256"
): Promise<ReadonlyMap<string, GitBlobContent>> {
  if (selections.size === 0) return new Map();
  const child = spawn("git", ["-C", rootDirectory, "cat-file", "--batch"], {
    windowsHide: true,
    stdio: ["pipe", "pipe", "pipe"]
  });
  const completion = new Promise<
    Readonly<{ code: number | null; error: Error | null }>
  >((resolve) => {
    child.once("error", (error) => resolve({ code: null, error }));
    child.once("close", (code) => resolve({ code, error: null }));
  });
  let inputError: Error | null = null;
  child.stdin.on("error", (error) => {
    inputError = error;
  });
  let stderr = "";
  let stderrBytes = 0;
  child.stderr.on("data", (chunk: Buffer) => {
    stderrBytes += chunk.length;
    if (stderrBytes > gitBatchOutputMaxBuffer) child.kill();
    if (stderr.length < 65536) stderr += chunk.toString("utf8");
  });
  child.stdin.end([...selections.keys()].join("\n") + "\n");
  const reader = new GitBlobBatchReader(selections, fingerprint);
  try {
    for await (const chunk of child.stdout) {
      if (!Buffer.isBuffer(chunk))
        throw new Error("Git did not return binary output");
      reader.consume(chunk);
    }
    const result = await completion;
    if (result.error !== null) throw result.error;
    if (stderrBytes > gitBatchOutputMaxBuffer)
      throw new Error("Git blob batch stderr exceeded the read budget");
    if (result.code !== 0)
      throw new Error(stderr || "Git blob batch read failed");
    if (inputError !== null) throw inputError;
    return reader.finish();
  } catch (error) {
    child.kill();
    await completion;
    throw error;
  }
}

export async function readGitBlobs(
  rootDirectory: string,
  objectIds: readonly string[]
): Promise<ReadonlyMap<string, Buffer>> {
  const selections = await readGitBlobSelections(
    rootDirectory,
    new Map([...new Set(objectIds)].map((id) => [id, null])),
    "none"
  );
  return new Map([...selections].map(([id, blob]) => [id, blob.data]));
}

/** Incremental framing owns the batch protocol, output budget and retained bytes. */
export class GitBlobBatchReader {
  readonly #selections: ReadonlyMap<string, number | null>;
  readonly #objectIds: readonly string[];
  readonly #result: GitBlobBatchResult;
  #index = 0;
  #header = Buffer.alloc(0);
  #content: GitBlobPayload | null = null;
  #consumed = 0;
  #outputBytes = 0;

  constructor(
    selections: ReadonlyMap<string, number | null>,
    fingerprint: GitBlobFingerprintMode = "sha256"
  ) {
    this.#selections = selections;
    this.#objectIds = [...selections.keys()];
    this.#result =
      fingerprint === "sha256"
        ? { mode: "sha256", blobs: new Map() }
        : { mode: "none", blobs: new Map() };
  }

  consume(chunk: Buffer): void {
    this.#outputBytes += chunk.length;
    if (this.#outputBytes > gitBatchOutputMaxBuffer)
      throw new Error("Git blob batch output exceeded the read budget");
    let offset = 0;
    while (offset < chunk.length) {
      if (this.#content === null) {
        const next = this.#consumeHeader(chunk, offset);
        if (next === null) return;
        offset = next;
      }
      offset = this.#consumeContent(chunk, offset);
    }
  }

  #consumeHeader(chunk: Buffer, offset: number): number | null {
    const end = chunk.indexOf(10, offset);
    const fragment = chunk.subarray(offset, end === -1 ? chunk.length : end);
    this.#header = Buffer.concat([this.#header, fragment]);
    if (this.#header.length > 256)
      throw new Error("Unexpected Git blob header");
    if (end === -1) return null;
    const parsed = parsedBlobHeader(this.#header, this.#objectIds[this.#index]);
    this.#content = {
      ...parsed,
      hash: this.#result.mode === "sha256" ? createHash("sha256") : null,
      data: Buffer.alloc(
        retainedSize(parsed.size, this.#selections.get(parsed.objectId)!)
      )
    };
    this.#header = Buffer.alloc(0);
    this.#consumed = 0;
    return end + 1;
  }

  #consumeContent(chunk: Buffer, offset: number): number {
    const content = this.#content!;
    const count = Math.min(
      content.size - this.#consumed,
      chunk.length - offset
    );
    const retained = Math.min(
      count,
      Math.max(0, content.data.length - this.#consumed)
    );
    if (retained > 0)
      chunk.copy(content.data, this.#consumed, offset, offset + retained);
    content.hash?.update(chunk.subarray(offset, offset + count));
    this.#consumed += count;
    offset += count;
    if (this.#consumed !== content.size || offset === chunk.length)
      return offset;
    if (chunk[offset] !== 10) throw new Error("Truncated Git blob content");
    this.#completeBlob(content);
    this.#content = null;
    this.#index += 1;
    return offset + 1;
  }

  #completeBlob(content: GitBlobPayload): void {
    const blob = { data: content.data, size: content.size };
    if (this.#result.mode === "sha256") {
      if (content.hash === null)
        throw new Error("Git blob fingerprint was not computed");
      this.#result.blobs.set(content.objectId, {
        ...blob,
        fingerprint: content.hash.digest("hex")
      });
    } else this.#result.blobs.set(content.objectId, blob);
  }

  finish(): ReadonlyMap<string, GitBlobContent> {
    if (
      this.#index !== this.#objectIds.length ||
      this.#content !== null ||
      this.#header.length > 0
    )
      throw new Error("Truncated Git blob batch output");
    return this.#result.blobs;
  }

  finishFingerprinted(): ReadonlyMap<string, GitBlobSelection> {
    this.finish();
    if (this.#result.mode !== "sha256")
      throw new Error("Git blob fingerprints were not requested");
    return this.#result.blobs;
  }
}

function parsedBlobHeader(
  header: Buffer,
  expectedObjectId: string | undefined
): Readonly<{ objectId: string; size: number }> {
  const fields = header.toString("utf8").split(" ");
  if (fields.length !== 3) throw new Error("Unexpected Git blob header");
  const [objectId, objectType, sizeText] = fields;
  const size = Number(sizeText);
  if (
    objectId !== expectedObjectId ||
    objectType !== "blob" ||
    !/^(?:0|[1-9][0-9]*)$/u.test(sizeText!) ||
    !Number.isSafeInteger(size) ||
    size < 0 ||
    size > gitBatchOutputMaxBuffer
  )
    throw new Error("Unexpected Git blob header");
  return { objectId: objectId!, size };
}
function retainedSize(size: number, limit: number | null): number {
  if (limit === null) return size;
  if (!Number.isSafeInteger(limit) || limit < 0)
    throw new Error("Invalid Git blob retention limit");
  return Math.min(size, limit);
}
