/*
 * Synced TypeScript runtime; repository maintenance edits tools/record-operations/src/reader/reader-worker.ts.
 * Installed skill copies may be edited directly; updates overwrite matching files.
 * Repository: https://github.com/zxyycom/skills
 * Source path: tools/record-operations/src/reader/reader-worker.ts
 * Maintained source: https://github.com/zxyycom/skills/blob/main/tools/record-operations/src/reader/reader-worker.ts
 * Skill source directory: https://github.com/zxyycom/skills/tree/main/skills/investigation-report
 * Rebuild: bun run sync:investigation-report-check
 */
import { parentPort } from "node:worker_threads";
import path from "node:path";
import * as v from "valibot";
import {
  readRecordFileSnapshotSync,
  readRecordTextSync
} from "./reader-sync.ts";
import {
  readerChunkBytes,
  readerRequestSchema,
  readerFailure,
  type ReaderReply,
  type ReaderRequest
} from "./reader-protocol.ts";
export type { ReaderReply } from "./reader-protocol.ts";

function readRequestedRecord(
  root: string,
  target: string,
  kind: ReaderRequest["kind"]
): Readonly<{ reply: ReaderReply[number]; byteLength: number }> {
  if (kind === "text") {
    const value = readRecordTextSync(root, target);
    return {
      reply: { ok: true, result: { kind, value } },
      byteLength: Buffer.byteLength(value)
    };
  }
  const snapshot = readRecordFileSnapshotSync(root, target);
  const byteLength = snapshot?.bytes.byteLength ?? 0;
  if (kind === "snapshot")
    return {
      reply: { ok: true, result: { kind, value: snapshot } },
      byteLength
    };
  if (snapshot === null)
    throw Object.assign(new Error("Record source is missing: " + target), {
      code: "ENOENT"
    });
  const text = new TextDecoder("utf-8", {
    fatal: true,
    ignoreBOM: true
  }).decode(snapshot.bytes);
  return {
    reply: {
      ok: true,
      result: {
        kind,
        value: {
          root: path.resolve(root),
          path: path.resolve(target),
          text,
          snapshot
        }
      }
    },
    byteLength
  };
}

/** Backpressure is not a source budget; the first failure is delivered before later reads. */
function readWorkerChunk(request: ReaderRequest): ReaderReply {
  const results: ReaderReply[number][] = [];
  let byteLength = 0;
  for (const target of request.paths) {
    try {
      const result = readRequestedRecord(request.root, target, request.kind);
      byteLength += result.byteLength;
      results.push(result.reply);
    } catch (error) {
      results.push(readerFailure(error));
    }
    if (!results[results.length - 1]!.ok || byteLength >= readerChunkBytes)
      break;
  }
  return results;
}

// The entry does not start a worker or perform I/O before receiving a request.
if (parentPort !== null) {
  const port = parentPort;
  port.on("message", (raw: unknown) => {
    if (raw === null) {
      port.close();
      return;
    }
    port.postMessage(readWorkerChunk(v.parse(readerRequestSchema, raw)));
  });
}
