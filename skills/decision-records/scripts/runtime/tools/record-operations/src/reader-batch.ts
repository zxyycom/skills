/*
 * Synced TypeScript runtime; repository maintenance edits tools/record-operations/src/reader-batch.ts.
 * Installed skill copies may be edited directly; updates overwrite matching files.
 * Repository: https://github.com/zxyycom/skills
 * Source path: tools/record-operations/src/reader-batch.ts
 * Maintained source: https://github.com/zxyycom/skills/blob/main/tools/record-operations/src/reader-batch.ts
 * Skill source directory: https://github.com/zxyycom/skills/tree/main/skills/decision-records
 * Rebuild: bun run sync:decision-records-cli
 */
import { Worker } from "node:worker_threads";
import * as v from "valibot";
import { readRecordText } from "./source.ts";
import {
  readRecordFileSnapshot,
  readRecordTextSnapshot,
  type RecordFileSnapshot,
  type RecordTextSnapshot
} from "./transaction-snapshot.ts";
// This type dependency also makes the worker's source closure a distribution input.
import type { ReaderReply } from "./reader-worker.ts";
import {
  readerChunkPaths,
  readerReplySchema,
  restoreReaderError,
  type ReaderRequest
} from "./reader-protocol.ts";

// 1,000 is the smallest measured beneficial collection, not an optimized crossover.
export const recordReaderWorkerThreshold = 1000;
export type RecordReadResult<T> = Readonly<
  { ok: true; value: T } | { ok: false; error: Error }
>;
type Consume<T> = (
  result: RecordReadResult<T>,
  index: number
) => void | Promise<void>;

export async function forEachRecordText(
  root: string,
  paths: readonly string[],
  consume: Consume<string>,
  signal?: AbortSignal
): Promise<void> {
  await readBatch(
    root,
    paths,
    "text",
    async (reply, index) => {
      if (!reply.ok) return await consume(reply, index);
      if (reply.result.kind !== "text")
        throw new Error("Record reader returned the wrong contract");
      await consume({ ok: true, value: reply.result.value }, index);
    },
    signal
  );
}
export async function forEachRecordTextSnapshot(
  root: string,
  paths: readonly string[],
  consume: Consume<RecordTextSnapshot>,
  signal?: AbortSignal
): Promise<void> {
  await readBatch(
    root,
    paths,
    "text-snapshot",
    async (reply, index) => {
      if (!reply.ok) return await consume(reply, index);
      if (reply.result.kind !== "text-snapshot")
        throw new Error("Record reader returned the wrong contract");
      await consume({ ok: true, value: reply.result.value }, index);
    },
    signal
  );
}
export async function forEachRecordFileSnapshot(
  root: string,
  paths: readonly string[],
  consume: Consume<RecordFileSnapshot | null>,
  signal?: AbortSignal
): Promise<void> {
  await readBatch(
    root,
    paths,
    "snapshot",
    async (reply, index) => {
      if (!reply.ok) return await consume(reply, index);
      if (reply.result.kind !== "snapshot")
        throw new Error("Record reader returned the wrong contract");
      await consume({ ok: true, value: reply.result.value }, index);
    },
    signal
  );
}

type ConsumeReply = (reply: RecordReadReply, index: number) => Promise<void>;
type RecordReadReply =
  | Extract<ReaderReply[number], { ok: true }>
  | Readonly<{ ok: false; error: Error }>;

async function readAsyncRecord(
  root: string,
  target: string,
  kind: ReaderRequest["kind"]
): Promise<RecordReadReply> {
  try {
    if (kind === "text")
      return {
        ok: true,
        result: { kind, value: await readRecordText(root, target) }
      };
    if (kind === "snapshot")
      return {
        ok: true,
        result: { kind, value: await readRecordFileSnapshot(root, target) }
      };
    return {
      ok: true,
      result: { kind, value: await readRecordTextSnapshot(root, target) }
    };
  } catch (error) {
    if (!(error instanceof Error)) throw error;
    return { ok: false, error };
  }
}

async function readAsyncBatch(
  root: string,
  paths: readonly string[],
  kind: ReaderRequest["kind"],
  consume: ConsumeReply,
  signal?: AbortSignal
): Promise<void> {
  for (const [index, target] of paths.entries()) {
    signal?.throwIfAborted();
    const reply = await readAsyncRecord(root, target, kind);
    signal?.throwIfAborted();
    await consume(reply, index);
  }
}

async function readBatch(
  root: string,
  paths: readonly string[],
  kind: ReaderRequest["kind"],
  consume: ConsumeReply,
  signal?: AbortSignal
): Promise<void> {
  signal?.throwIfAborted();
  // Worker permissions are not inherited; --input-type is invalid for a file entry.
  const constrainedRuntime =
    process.permission !== undefined ||
    process.execArgv.some(
      (argument) =>
        argument === "--input-type" || argument.startsWith("--input-type=")
    );
  if (paths.length < recordReaderWorkerThreshold || constrainedRuntime) {
    return await readAsyncBatch(root, paths, kind, consume, signal);
  }
  const worker = new RecordReadWorker();
  try {
    for (let offset = 0; offset < paths.length;) {
      signal?.throwIfAborted();
      const replies = await worker.read({
        root,
        kind,
        paths: paths.slice(offset, offset + readerChunkPaths)
      });
      for (const [index, reply] of replies.entries()) {
        signal?.throwIfAborted();
        worker.assertHealthy();
        await consume(
          reply.ok
            ? reply
            : { ok: false, error: restoreReaderError(reply.error) },
          offset + index
        );
      }
      offset += replies.length;
    }
    await worker.close();
    worker.assertHealthy();
  } finally {
    await worker.close();
  }
}

/** Owns exactly one batch's protocol, pending reply, failures and graceful exit. */
class RecordReadWorker {
  private readonly worker: Worker;
  private readonly closed: Promise<void>;
  private failure: Error | undefined;
  private exited = false;
  private closing = false;
  private pending:
    | { resolve: (value: unknown) => void; reject: (error: Error) => void }
    | undefined;

  constructor() {
    // Native inheritance keeps parent constraints and filters process-only flags.
    this.worker = new Worker(new URL("./reader-worker.ts", import.meta.url));
    this.worker.on("error", (error: Error) => {
      this.failure = error;
      this.pending?.reject(error);
    });
    this.closed = new Promise<void>((resolve) =>
      this.worker.once("exit", (code) => {
        this.exited = true;
        if (this.pending !== undefined) {
          this.failure ??= new Error(
            "Record reader exited before replying (code " + code + ")"
          );
          this.pending.reject(this.failure);
        } else if (code !== 0 || !this.closing)
          this.failure ??= new Error("Record reader exited with code " + code);
        resolve();
      })
    );
    this.worker.on("message", (reply: unknown) => {
      if (this.pending === undefined) {
        this.failure ??= new Error("Record reader sent an unsolicited reply");
        return;
      }
      const receiver = this.pending;
      this.pending = undefined;
      receiver.resolve(reply);
    });
  }

  assertHealthy(): void {
    if (this.failure !== undefined) throw this.failure;
  }

  async read(request: ReaderRequest): Promise<ReaderReply> {
    this.assertHealthy();
    if (this.exited)
      throw new Error("Record reader closed before completing the batch");
    let raw: unknown;
    try {
      raw = await new Promise<unknown>((resolve, reject) => {
        this.pending = { resolve, reject };
        this.worker.postMessage(request);
      });
    } finally {
      this.pending = undefined;
    }
    const replies = v.parse(readerReplySchema, raw);
    if (replies.length > request.paths.length)
      throw new Error("Record reader returned too many results");
    return replies;
  }

  async close(): Promise<void> {
    // Queue close behind synchronous reads; every handle runs its finally first.
    if (!this.exited && !this.closing) {
      this.closing = true;
      this.worker.postMessage(null);
    }
    await this.closed;
  }
}
