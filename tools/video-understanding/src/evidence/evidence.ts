import { createHash } from "node:crypto";
import { readFile, realpath, stat } from "node:fs/promises";
import path from "node:path";
import * as v from "valibot";
import {
  boundaryFailure,
  errorCode,
  failure,
  FailureSchema,
  validate,
  type Failure
} from "../failure.ts";

export const SecondsSchema = v.pipe(v.number(), v.finite(), v.minValue(0));
export const IndexSchema = v.pipe(SecondsSchema, v.safeInteger());
const LocalPathSchema = v.pipe(
  v.string(),
  v.check(
    (file) =>
      path.isAbsolute(file) &&
      !file.startsWith("\\\\") &&
      !file.startsWith("//"),
    "absolute local path"
  )
);
export const HashSchema = v.pipe(v.string(), v.regex(/^[a-f0-9]{64}$/));
export const SegmentSchema = v.pipe(
  v.object({ start: SecondsSchema, end: SecondsSchema, text: v.string() }),
  v.check((segment) => segment.end >= segment.start, "end >= start")
);
export const SegmentsSchema = v.pipe(
  v.array(SegmentSchema),
  v.transform((segments) =>
    segments.sort((a, b) => a.start - b.start || a.end - b.end)
  )
);
export type Segment = v.InferOutput<typeof SegmentSchema>;
export const SourceSchema = v.strictObject({
  file: LocalPathSchema,
  size: IndexSchema,
  mtimeMs: SecondsSchema
});
export type SourceStamp = v.InferOutput<typeof SourceSchema>;
const InputSubtitleSchema = v.strictObject({
  file: LocalPathSchema,
  sha256: HashSchema
});
type InputSubtitleReference = v.InferOutput<typeof InputSubtitleSchema>;
export const SavedFileSchema = v.strictObject({
  file: v.pipe(
    v.string(),
    // oxlint-disable-next-line eslint/no-control-regex -- Artifact paths deliberately reject every ASCII control character in the same forbidden-character grammar.
    v.regex(/^[^\\:<>"|?*\u0000-\u001f]+$/),
    v.check(
      (file) =>
        !path.isAbsolute(file) &&
        file
          .split("/")
          .every((part) => part !== ".." && part !== "." && part !== "")
    )
  ),
  sha256: HashSchema
});
export type SavedFile = v.InferOutput<typeof SavedFileSchema>;
export const ScopeSchema = v.pipe(v.string(), v.uuid());
export const TranscriptIdSchema = v.pipe(v.string(), v.regex(/^T\d{4,}$/));
export const FrameIdSchema = v.pipe(v.string(), v.regex(/^F\d{4,}$/));
export const MaterialIdSchema = v.pipe(v.string(), v.regex(/^M\d{4,}$/));
export const ObservationIdSchema = v.pipe(v.string(), v.regex(/^O\d{4,}$/));
export const RawIdSchema = v.pipe(v.string(), v.regex(/^[TFO]\d{4,}$/));
export const RefinementIdSchema = v.pipe(v.string(), v.regex(/^[SCD]\d{4,}$/));
export const TranscriptSchema = v.pipe(
  v.strictObject({
    id: TranscriptIdSchema,
    start: SecondsSchema,
    end: SecondsSchema,
    text: v.string()
  }),
  v.check((cue) => cue.end >= cue.start)
);
export const TranscriptsSchema = v.array(TranscriptSchema);
export type Transcript = v.InferOutput<typeof TranscriptSchema>;
const FailureStates = [
  v.strictObject({
    status: v.literal("failed"),
    failure: v.pipe(
      FailureSchema,
      v.check(
        (detail) => detail.kind !== "timeout" && detail.kind !== "cancelled"
      )
    )
  }),
  v.strictObject({
    status: v.literal("interrupted"),
    failure: v.pipe(
      FailureSchema,
      v.check(
        (detail) => detail.kind === "timeout" || detail.kind === "cancelled"
      )
    )
  })
];
export const AttemptSchema = v.variant("status", [
  v.strictObject({ status: v.literal("unprepared") }),
  v.strictObject({ status: v.literal("complete") }),
  ...FailureStates
]);
export type Attempt = v.InferOutput<typeof AttemptSchema>;
export type FailedAttempt = Extract<
  Attempt,
  { status: "failed" | "interrupted" }
>;
export const FrameTimingSchema = v.object({
  requested: SecondsSchema,
  actual: SecondsSchema,
  pts: v.pipe(v.number(), v.safeInteger()),
  timeBase: v.pipe(v.string(), v.regex(/^[1-9]\d*\/[1-9]\d*$/)),
  streamIndex: IndexSchema
});
type FrameTiming = v.InferOutput<typeof FrameTimingSchema>;

export function validFrameTiming(frame: FrameTiming): boolean {
  const [numerator, denominator] = frame.timeBase.split("/").map(Number);
  const actual = (frame.pts * (numerator ?? NaN)) / (denominator ?? NaN);
  return (
    frame.actual >= frame.requested &&
    Number.isFinite(actual) &&
    Math.abs(actual - frame.actual) <= 1e-9
  );
}

const FrameEntrySchema = v.pipe(
  v.strictObject({
    id: FrameIdSchema,
    ...FrameTimingSchema.entries,
    width: v.pipe(IndexSchema, v.maxValue(3840)),
    image: SavedFileSchema
  }),
  v.check(
    (frame) => validFrameTiming(frame),
    "actual must equal PTS times timeBase and be at or after requested"
  )
);
export type FrameEntry = v.InferOutput<typeof FrameEntrySchema>;
export const RevisionSchema = v.pipe(IndexSchema, v.minValue(1));
const RefinementPointerFields = {
  id: RefinementIdSchema,
  revision: RevisionSchema,
  state: v.picklist(["active", "revoked"]),
  payload: SavedFileSchema,
  refs: v.array(v.pipe(v.string(), v.regex(/^[MTFO]\d{4,}$/))),
  support: v.array(RawIdSchema)
};
export const RefinementPointerSchema = v.strictObject({
  ...RefinementPointerFields,
  kind: v.picklist(["selection", "correction", "description"])
});
export const RegionSchema = v.strictObject({
  x: IndexSchema,
  y: IndexSchema,
  w: v.pipe(IndexSchema, v.minValue(1)),
  h: v.pipe(IndexSchema, v.minValue(1))
});
export type Region = v.InferOutput<typeof RegionSchema>;
const IntervalSchema = v.pipe(
  v.strictObject({ start: SecondsSchema, end: SecondsSchema }),
  v.check((range) => range.end >= range.start)
);
export const ProvenanceSchema = v.strictObject({
  tool: v.string(),
  version: v.string(),
  profile: v.string(),
  models: v.array(v.strictObject({ path: v.string(), sha256: HashSchema }))
});
export type Provenance = v.InferOutput<typeof ProvenanceSchema>;
const MaterialFields = {
  id: MaterialIdSchema,
  kind: v.picklist(["subtitle", "frame-ocr"]),
  requestKey: HashSchema,
  origin: v.picklist(["external", "embedded", "asr", "hard-ocr", "frame-ocr"]),
  parameters: v.record(
    v.string(),
    v.union([v.string(), v.number(), v.array(v.string()), RegionSchema])
  ),
  inputs: v.array(InputSubtitleSchema),
  requestedCoverage: v.array(IntervalSchema),
  language: v.string(),
  timeMeaning: v.picklist([
    "file-given",
    "estimated-speech",
    "estimated-on-screen",
    "frame-pts"
  ]),
  cues: v.array(
    v.pipe(
      v.strictObject({
        id: TranscriptIdSchema,
        start: SecondsSchema,
        end: SecondsSchema
      }),
      v.check((cue) => cue.end >= cue.start)
    )
  ),
  observations: v.array(
    v.strictObject({ id: ObservationIdSchema, frame: FrameIdSchema })
  )
};
export const MaterialSchema = v.variant("status", [
  v.strictObject({
    ...MaterialFields,
    status: v.picklist(["complete", "empty"]),
    processedCoverage: v.array(IntervalSchema),
    provenance: ProvenanceSchema,
    payload: SavedFileSchema,
    files: v.array(SavedFileSchema),
    warnings: v.array(v.string())
  }),
  ...FailureStates.map((schema) =>
    v.strictObject({
      ...MaterialFields,
      ...schema.entries,
      processedCoverage: v.pipe(v.array(IntervalSchema), v.length(0))
    })
  )
]);
export type Material = v.InferOutput<typeof MaterialSchema>;
export const ObservationSchema = v.pipe(
  v.strictObject({
    id: ObservationIdSchema,
    frame: FrameIdSchema,
    text: v.string(),
    imageHash: HashSchema,
    width: v.pipe(IndexSchema, v.minValue(1)),
    height: v.pipe(IndexSchema, v.minValue(1)),
    region: RegionSchema,
    transform: v.strictObject({
      scaleX: v.pipe(v.number(), v.finite(), v.minValue(Number.MIN_VALUE)),
      scaleY: v.pipe(v.number(), v.finite(), v.minValue(Number.MIN_VALUE)),
      offsetX: SecondsSchema,
      offsetY: SecondsSchema
    }),
    boxes: v.optional(
      v.array(
        v.pipe(
          v.array(
            v.pipe(
              v.array(v.pipe(v.number(), v.finite(), v.minValue(0))),
              v.length(2)
            )
          ),
          v.length(4)
        )
      )
    ),
    scores: v.optional(v.array(v.pipe(v.number(), v.finite())))
  }),
  v.check(
    (o) =>
      o.region.x + o.region.w <= o.width &&
      o.region.y + o.region.h <= o.height &&
      o.transform.offsetX === o.region.x &&
      o.transform.offsetY === o.region.y &&
      (!o.boxes ||
        o.boxes.every((box) =>
          box.every(
            ([x, y]) =>
              x! >= o.region.x &&
              x! <= o.region.x + o.region.w &&
              y! >= o.region.y &&
              y! <= o.region.y + o.region.h
          )
        )) &&
      (!o.boxes || !o.scores || o.boxes.length === o.scores.length),
    "consistent original PNG coordinates and observations"
  )
);
export type Observation = v.InferOutput<typeof ObservationSchema>;
export const EvidenceSchema = v.strictObject({
  version: v.literal(5),
  scopeId: ScopeSchema,
  source: SourceSchema,
  duration: v.nullable(v.pipe(SecondsSchema, v.minValue(Number.MIN_VALUE))),
  materials: v.array(MaterialSchema),
  frames: v.strictObject({
    entries: v.array(FrameEntrySchema),
    attempt: AttemptSchema
  }),
  refinements: v.array(RefinementPointerSchema),
  history: v.array(RefinementPointerSchema)
});
export type Evidence = v.InferOutput<typeof EvidenceSchema>;
export function stableId(
  prefix: "M" | "T" | "F" | "O" | "S" | "C" | "D",
  number: number
): string {
  return prefix + String(number).padStart(4, "0");
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
export function seconds(value: unknown): value is number {
  return v.is(SecondsSchema, value);
}
export function parseSegments(
  value: unknown,
  context: Pick<Failure, "stage" | "target"> = {
    stage: "subtitle-decoding",
    target: "segments.start/end/text"
  }
): Segment[] {
  return validate(SegmentsSchema, value, context);
}
export function digest(data: Uint8Array | string): string {
  return createHash("sha256").update(data).digest("hex");
}
export async function readSourceStamp(file: string): Promise<SourceStamp> {
  try {
    const info = await stat(file);
    if (!info.isFile())
      throw failure({
        kind: "input",
        stage: "input",
        target: file,
        reason: "not a regular file"
      });
    return { file, size: info.size, mtimeMs: info.mtimeMs };
  } catch (error) {
    throw boundaryFailure(error, { stage: "input", target: file });
  }
}
export function sameSource(left: SourceStamp, right: SourceStamp): boolean {
  return (
    left.file === right.file &&
    left.size === right.size &&
    left.mtimeMs === right.mtimeMs
  );
}
export async function readFileDigest(
  directory: string,
  file: string
): Promise<SavedFile> {
  return { file, sha256: digest(await readFile(path.join(directory, file))) };
}
export async function siblingSubtitles(video: string): Promise<string[]> {
  const stem = video.slice(0, video.length - path.extname(video).length);
  const files: string[] = [];
  for (const extension of [".srt", ".vtt"]) {
    try {
      const file = await realpath(stem + extension);
      if (file.startsWith("\\\\") || file.startsWith("//"))
        throw failure({
          kind: "input",
          stage: "input",
          target: file,
          reason: "subtitle source must remain local"
        });
      files.push(file);
    } catch (error) {
      if (errorCode(error) !== "ENOENT")
        throw boundaryFailure(error, {
          stage: "input",
          target: stem + extension
        });
    }
  }
  return files;
}
export async function readSubtitleReferences(
  files: string[]
): Promise<InputSubtitleReference[]> {
  return Promise.all(
    files.map(async (file) => {
      try {
        return { file, sha256: digest(await readFile(file)) };
      } catch (error) {
        throw boundaryFailure(error, { stage: "input", target: file });
      }
    })
  );
}
