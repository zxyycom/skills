/*
 * Synced TypeScript runtime; repository maintenance edits tools/video-understanding/src/run-record.ts.
 * Installed skill copies may be edited directly; updates overwrite matching files.
 * Repository: https://github.com/zxyycom/skills
 * Source path: tools/video-understanding/src/run-record.ts
 * Maintained source: https://github.com/zxyycom/skills/blob/main/tools/video-understanding/src/run-record.ts
 * Skill source directory: https://github.com/zxyycom/skills/tree/main/skills/video-understanding
 * Rebuild: bun run sync:video-understanding-cli
 */
import * as v from "valibot";
import { SavedFileSchema, ScopeSchema } from "./evidence.ts";
import { FailureSchema, safeDiagnostic, type Failure } from "./failure.ts";

// Saved logs are a display-only external protocol; generation keeps the command's concrete shape.
const ParametersSchema = v.record(
  v.string(),
  v.union([
    v.string(),
    v.number(),
    v.boolean(),
    v.array(v.number()),
    v.array(v.string())
  ])
);
const RunFields = {
  version: v.literal(1),
  runId: ScopeSchema,
  scopeId: ScopeSchema,
  command: v.picklist(["prepare", "frames", "ocr", "refine"]),
  parameters: ParametersSchema,
  startedAt: v.pipe(v.string(), v.isoTimestamp()),
  artifacts: v.array(SavedFileSchema.entries.file),
  diagnostics: v.array(SavedFileSchema.entries.file)
};
export const RunSchema = v.variant("status", [
  v.strictObject({
    ...RunFields,
    status: v.literal("running"),
    endedAt: v.null(),
    failure: v.null()
  }),
  v.strictObject({
    ...RunFields,
    status: v.picklist(["complete", "reused"]),
    endedAt: v.pipe(v.string(), v.isoTimestamp()),
    failure: v.null()
  }),
  v.pipe(
    v.strictObject({
      ...RunFields,
      status: v.picklist(["failed", "interrupted"]),
      endedAt: v.pipe(v.string(), v.isoTimestamp()),
      failure: FailureSchema
    }),
    v.check(
      (record) =>
        (record.status === "interrupted") ===
        (record.failure.kind === "timeout" ||
          record.failure.kind === "cancelled"),
      "interrupted requires timeout/cancelled; failed requires another failure kind"
    )
  )
]);
export type RunRecord = v.InferOutput<typeof RunSchema>;
export type RunningRecord = Extract<RunRecord, { status: "running" }>;
export function safeFailure(detail: Failure): Failure {
  return {
    ...detail,
    target: safeDiagnostic(detail.target),
    reason: safeDiagnostic(detail.reason),
    action: safeDiagnostic(detail.action)
  };
}
export const RunFilename = /^\d{8}T\d{9}Z-([a-f0-9-]{36})\.json$/;
export function filenameFor(startedAt: string, id: string): string {
  return `${startedAt.replace(/[-:.]/g, "")}-${id}.json`;
}
