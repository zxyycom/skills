import { writeFile } from "node:fs/promises";
import path from "node:path";
import type { LocatedOptions, PrepareOptions } from "../cli/arguments.ts";
import {
  readFileDigest,
  readSourceStamp,
  readSubtitleReferences,
  sameSource,
  stableId,
  type Evidence,
  type Material,
  type Provenance,
  type Transcript
} from "../evidence/evidence.ts";
import { failure, type Stage } from "../failure.ts";
import {
  materialFields,
  nextId,
  subtitleParameters,
  type MaterialFields
} from "../evidence/material.ts";
import { publishEvidence, type operationDirectory } from "../store/store.ts";
import type { TextResult } from "../evidence/text.ts";

export interface TextAcquisitionState {
  stage: Stage;
  fields: MaterialFields;
}
export interface SubtitleRegistration {
  index: Evidence;
  options: LocatedOptions<PrepareOptions>;
  operation: Awaited<ReturnType<typeof operationDirectory>>;
  originalInputs: Material["inputs"];
  state: TextAcquisitionState;
  duration: number;
}
type PreparedText = TextResult & { warnings: string[] };

function boundSubtitleIntervals({
  transcripts,
  origin,
  duration,
  material
}: {
  transcripts: readonly Readonly<Transcript>[];
  origin: TextResult["origin"];
  duration: number;
  material: string;
}): { transcripts: readonly Readonly<Transcript>[]; warnings: string[] } {
  const outside = transcripts.filter((cue) => cue.end > duration);
  const cue = outside[0];
  if (!cue) return { transcripts, warnings: [] };
  const detail = `cue=${cue.id} start=${cue.start} end=${cue.end} duration=${duration} delta=${cue.end - duration}`;
  // One 20 ms ASR timestamp step plus 5 ms mapping rounding; not an accuracy guarantee.
  const tolerance = 0.025;
  if (
    origin !== "asr" ||
    outside.length !== 1 ||
    cue !== transcripts.at(-1) ||
    cue.start >= duration ||
    cue.end > duration + tolerance
  ) {
    throw failure(
      {
        kind: "protocol",
        stage: "verification",
        target: material,
        reason: `subtitle interval exceeds media duration: ${detail} outsideCount=${outside.length}`
      },
      "preserve the failed material; inspect the reported cue, raw output and media duration before obtaining a corrected source"
    );
  }
  return {
    transcripts: transcripts.map((entry) =>
      entry === cue ? { ...entry, end: duration } : entry
    ),
    warnings: [
      `ASR tail end normalized: ${detail} normalizedEnd=${duration} adjustment=${duration - cue.end} tolerance=${tolerance}; raw=raw/audio.json payload=segments-${material}.json`
    ]
  };
}
async function verifySubtitleInputs(
  context: SubtitleRegistration,
  result: TextResult
): Promise<Material["inputs"]> {
  const { index, originalInputs } = context;
  if (!sameSource(index.source, await readSourceStamp(index.source.file))) {
    throw failure({
      kind: "inconsistent",
      stage: "verification",
      target: index.source.file,
      reason: "source changed during operation"
    });
  }
  const inputs =
    result.origin === "external"
      ? await readSubtitleReferences([result.input])
      : [];
  if (
    inputs.some(
      (input) =>
        !originalInputs.some(
          (old) => old.file === input.file && old.sha256 === input.sha256
        )
    )
  ) {
    throw failure({
      kind: "inconsistent",
      stage: "verification",
      target: inputs[0]!.file,
      reason: "input subtitle changed during preparation"
    });
  }
  return inputs;
}
async function subtitleFiles(
  context: SubtitleRegistration,
  result: TextResult
) {
  const { options, operation, state } = context;
  const files = [
    await readFileDigest(options.output, `${operation.relative}/media.json`),
    ...(await Promise.all(
      result.files.map((file) =>
        readFileDigest(options.output, `${operation.relative}/${file}`)
      )
    ))
  ];
  const { inputs, id } = state.fields;
  if (
    inputs.length &&
    !files.some(
      (file) =>
        path.basename(file.file).startsWith("source-") &&
        file.sha256 === inputs[0]!.sha256
    )
  ) {
    throw failure({
      kind: "inconsistent",
      stage: "verification",
      target: id,
      reason: "import copy no longer matches input fingerprint"
    });
  }
  return files;
}
async function publishSubtitleMaterial(
  context: SubtitleRegistration,
  result: PreparedText,
  bounded: ReturnType<typeof boundSubtitleIntervals>,
  provenance: Provenance
): Promise<Material> {
  const { options, operation, state, duration, index } = context;
  const { transcripts } = bounded;
  const payloadFile = `segments-${state.fields.id}.json`;
  await writeFile(
    path.join(operation.directory, payloadFile),
    JSON.stringify(transcripts),
    { flag: "wx" }
  );
  const files = await subtitleFiles(context, result);
  const material: Material = {
    ...state.fields,
    cues: transcripts.map(({ id, start, end }) => ({ id, start, end })),
    status: transcripts.some((cue) => cue.text.trim()) ? "complete" : "empty",
    processedCoverage: [{ start: 0, end: duration }],
    provenance,
    payload: await readFileDigest(
      options.output,
      `${operation.relative}/${payloadFile}`
    ),
    files,
    warnings: [...result.warnings, ...bounded.warnings]
  };
  await publishEvidence(options.output, {
    ...index,
    materials: [...index.materials, material]
  });
  index.materials.push(material);
  return material;
}
/** Verification advances failure fields before writing any immutable subtitle payload. */
export async function registerSubtitle(
  context: SubtitleRegistration,
  result: PreparedText,
  provenance: Provenance
): Promise<Material> {
  const { index, options, state, duration } = context;
  state.stage = "verification";
  const inputs = await verifySubtitleInputs(context, result);
  state.fields = materialFields(index, {
    kind: "subtitle",
    origin: result.origin,
    parameters: subtitleParameters(result, options),
    inputs,
    duration,
    language: result.origin === "asr" ? result.language : undefined
  });
  const first = Number(nextId(index, "T").slice(1));
  const bounded = boundSubtitleIntervals({
    transcripts: result.segments.map((cue, number) => ({
      id: stableId("T", first + number),
      ...cue
    })),
    origin: result.origin,
    duration,
    material: state.fields.id
  });
  return publishSubtitleMaterial(context, result, bounded, provenance);
}
