import * as v from "valibot";
import type {
  RecordFileSnapshot,
  RecordTextSnapshot
} from "../transactions/transaction-snapshot.ts";

export const readerChunkPaths = 64;
export const readerChunkBytes = 8 * 1024 * 1024;
const identity = v.strictObject({ dev: v.number(), ino: v.number() });
const snapshot = v.strictObject({
  bytes: v.instance(Uint8Array),
  dev: v.number(),
  ino: v.number(),
  mode: v.number(),
  parents: v.array(identity)
});
const failure = v.strictObject({
  ok: v.literal(false),
  error: v.strictObject({
    name: v.string(),
    message: v.string(),
    stack: v.optional(v.string()),
    code: v.optional(v.string()),
    errno: v.optional(v.number()),
    syscall: v.optional(v.string()),
    path: v.optional(v.string()),
    dest: v.optional(v.string())
  })
});
export const readerRequestSchema = v.strictObject({
  root: v.string(),
  kind: v.picklist(["text", "snapshot", "text-snapshot"]),
  paths: v.pipe(
    v.array(v.string()),
    v.minLength(1),
    v.maxLength(readerChunkPaths)
  )
});
export const readerReplySchema = v.pipe(
  v.array(
    v.variant("ok", [
      failure,
      v.strictObject({
        ok: v.literal(true),
        result: v.variant("kind", [
          v.strictObject({ kind: v.literal("text"), value: v.string() }),
          v.strictObject({
            kind: v.literal("snapshot"),
            value: v.nullable(snapshot)
          }),
          v.strictObject({
            kind: v.literal("text-snapshot"),
            value: v.strictObject({
              root: v.string(),
              path: v.string(),
              text: v.string(),
              snapshot
            })
          })
        ])
      })
    ])
  ),
  v.minLength(1),
  v.maxLength(readerChunkPaths)
);
export type ReaderRequest = v.InferOutput<typeof readerRequestSchema>;
export type ReaderReply = readonly (
  | v.InferOutput<typeof failure>
  | Readonly<{
      ok: true;
      result:
        | Readonly<{ kind: "text"; value: string }>
        | Readonly<{ kind: "snapshot"; value: RecordFileSnapshot | null }>
        | Readonly<{ kind: "text-snapshot"; value: RecordTextSnapshot }>;
    }>
)[];

export function readerFailure(
  error: unknown
): Extract<ReaderReply[number], { ok: false }> {
  if (!(error instanceof Error)) {
    throw new Error("Record reader threw a non-Error failure", {
      cause: error
    });
  }
  const detail: Extract<ReaderReply[number], { ok: false }>["error"] = {
    name: error.name,
    message: error.message,
    stack: error.stack
  };
  detail.code = systemErrorText(error, "code");
  detail.syscall = systemErrorText(error, "syscall");
  detail.path = systemErrorText(error, "path");
  detail.dest = systemErrorText(error, "dest");
  if ("errno" in error && typeof error.errno === "number") {
    detail.errno = error.errno;
  }
  return { ok: false, error: detail };
}

/** Project only the native textual system metadata; do not coerce unknown fields. */
function systemErrorText(
  error: Error,
  field: "code" | "syscall" | "path" | "dest"
): string | undefined {
  const value: unknown = Reflect.get(error, field);
  return typeof value === "string" ? value : undefined;
}

export function restoreReaderError(
  detail: Extract<ReaderReply[number], { ok: false }>["error"]
): Error {
  const error =
    detail.name === "TypeError"
      ? new TypeError(detail.message)
      : detail.name === "RangeError"
        ? new RangeError(detail.message)
        : new Error(detail.message);
  return Object.assign(error, detail);
}
