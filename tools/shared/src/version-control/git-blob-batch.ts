import { createHash, type Hash } from "node:crypto";
import { spawn } from "node:child_process";

const gitBatchOutputMaxBuffer = 256 * 1024 * 1024;

export type GitBlobSelection = Readonly<{
  data: Buffer;
  size: number;
  fingerprint: string;
}>;

/** Validate every requested payload; retain only the requested byte prefix. */
export async function readGitBlobSelections(
  rootDirectory: string,
  selections: ReadonlyMap<string, number | null>
): Promise<ReadonlyMap<string, GitBlobSelection>> {
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
  const reader = new GitBlobBatchReader(selections);
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
    new Map([...new Set(objectIds)].map((id) => [id, null]))
  );
  return new Map([...selections].map(([id, blob]) => [id, blob.data]));
}

/** Incremental framing owns the batch protocol, output budget and retained bytes. */
export class GitBlobBatchReader {
  readonly #selections: ReadonlyMap<string, number | null>;
  readonly #objectIds: readonly string[];
  readonly #blobs = new Map<string, GitBlobSelection>();
  #index = 0;
  #header = Buffer.alloc(0);
  #content: Readonly<{
    data: Buffer;
    objectId: string;
    size: number;
    hash: Hash;
  }> | null = null;
  #consumed = 0;
  #outputBytes = 0;

  constructor(selections: ReadonlyMap<string, number | null>) {
    this.#selections = selections;
    this.#objectIds = [...selections.keys()];
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
      hash: createHash("sha256"),
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
    content.hash.update(chunk.subarray(offset, offset + count));
    this.#consumed += count;
    offset += count;
    if (this.#consumed !== content.size || offset === chunk.length)
      return offset;
    if (chunk[offset] !== 10) throw new Error("Truncated Git blob content");
    this.#blobs.set(content.objectId, {
      data: content.data,
      size: content.size,
      fingerprint: content.hash.digest("hex")
    });
    this.#content = null;
    this.#index += 1;
    return offset + 1;
  }

  finish(): ReadonlyMap<string, GitBlobSelection> {
    if (
      this.#index !== this.#objectIds.length ||
      this.#content !== null ||
      this.#header.length > 0
    )
      throw new Error("Truncated Git blob batch output");
    return this.#blobs;
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
