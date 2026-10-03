import assert from "node:assert/strict";
import * as v from "valibot";
import { record } from "../src/json.ts";

// Fixture decoding checks the native JSON output independently of the tool parser.
const objectSchema = v.custom<Readonly<Record<string, unknown>>>(record);

const metaSchema = v.strictObject({
  attempts: v.number(),
  elapsedMs: v.number(),
  requestModel: v.optional(v.string()),
  persistence: v.optional(
    v.strictObject({
      callId: v.optional(v.string()),
      status: v.picklist(["recorded", "failed"])
    })
  )
});

const envelopeSchema = v.variant("ok", [
  v.strictObject({
    ok: v.literal(true),
    result: objectSchema,
    meta: metaSchema,
    error: v.null()
  }),
  v.strictObject({
    ok: v.literal(false),
    result: v.null(),
    meta: metaSchema,
    error: v.strictObject({
      kind: v.string(),
      message: v.string(),
      httpStatus: v.nullable(v.number()),
      retryAfterMs: v.optional(v.number())
    })
  })
]);

export function object(value: unknown): Readonly<Record<string, unknown>> {
  assert.ok(record(value), "expected an object");
  return value;
}

export function parseObject(source: string): Readonly<Record<string, unknown>> {
  const raw: unknown = JSON.parse(source);
  return object(raw);
}

export function decodeEnvelope(source: string) {
  const raw: unknown = JSON.parse(source);
  const parsed = v.safeParse(envelopeSchema, raw);
  assert.ok(parsed.success, "expected a CLI JSON envelope");
  return parsed.output;
}

export function decodeSuccess(source: string) {
  const envelope = decodeEnvelope(source);
  assert.ok(envelope.ok, "expected CLI success");
  return envelope;
}

export function decodeFailure(source: string) {
  const envelope = decodeEnvelope(source);
  assert.ok(!envelope.ok, "expected CLI failure");
  return envelope;
}
