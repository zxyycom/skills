import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { LocatedOptions, OcrOptions } from "../cli/arguments.ts";
import {
  readFileDigest,
  stableId,
  type Material,
  type FrameEntry,
  type Observation
} from "../evidence/evidence.ts";
import { boundaryFailure, failure } from "../failure.ts";
import { locateEvidence } from "../location.ts";
import {
  materialFields,
  nextId,
  type MaterialFields
} from "../evidence/material.ts";
import {
  applicationRoot,
  interrupted,
  type ApplicationRootResolver
} from "./media-runtime.ts";
import { frameOcr, type OcrProvenance } from "./ocr-runtime.ts";
import type { Snapshot } from "../refinement/refinement.ts";
import { recordedOperation, type OperationRun } from "../runs/runs.ts";
import {
  operationDirectory,
  publishEvidence,
  publishFailureStatus,
  withWriter
} from "../store/store.ts";
import type { VideoResources } from "../resources.ts";

function result(
  options: LocatedOptions<OcrOptions>,
  snapshot: Snapshot,
  material: Material,
  reused: boolean,
  runId: string
): string {
  const value = {
    command: "ocr",
    output: options.output,
    scopeId: snapshot.index.scopeId,
    version: 5,
    runId,
    material: material.id,
    status: material.status,
    reused,
    observationCount: material.observations.length
  };
  return options.format === "json"
    ? JSON.stringify(value)
    : JSON.stringify(value, null, 2);
}
function selectedFrames(snapshot: Snapshot, options: OcrOptions): FrameEntry[] {
  return options.frames.map((id) => {
    const frame = snapshot.index.frames.entries.find(
      (entry) => entry.id === id
    );
    if (!frame || snapshot.unavailable.has(frame.id)) {
      throw failure({
        kind: "input",
        stage: "ocr",
        target: options.frames.join(","),
        reason: "OCR requires saved current frames; use frames first"
      });
    }
    return frame;
  });
}
function reusableOcr(snapshot: Snapshot, options: OcrOptions, key: string) {
  return options.fresh
    ? undefined
    : snapshot.materials.findLast(
        (entry) =>
          entry.status === "valid" &&
          entry.material.requestKey === key &&
          entry.material.observations.every(
            (o) => !snapshot.unavailable.has(o.id)
          )
      );
}
async function recognizeFrame(
  frame: FrameEntry,
  i: number,
  context: {
    appRoot: string;
    directory: string;
    options: LocatedOptions<OcrOptions>;
    resources: VideoResources;
  }
) {
  const { appRoot, directory, options, resources } = context;
  const output = path.join(directory, `frame-${i + 1}`);
  await mkdir(output);
  const recognized = await frameOcr({
    appRoot,
    output,
    source: path.join(options.output, frame.image.file),
    timeout: options.timeout,
    resources,
    ...(options.region
      ? {
          region: {
            x: options.region.x,
            y: options.region.y,
            width: options.region.w,
            height: options.region.h
          }
        }
      : {})
  });
  const current = await readFileDigest(options.output, frame.image.file);
  if (current.sha256 !== frame.image.sha256) {
    throw failure({
      kind: "inconsistent",
      stage: "ocr",
      target: frame.id,
      reason: "input image changed during OCR"
    });
  }
  return recognized;
}
async function acquireObservations(
  snapshot: Snapshot,
  frames: FrameEntry[],
  context: {
    appRoot: string;
    directory: string;
    options: LocatedOptions<OcrOptions>;
    resources: VideoResources;
  }
) {
  const observations: Observation[] = [];
  const first = Number(nextId(snapshot.index, "O").slice(1));
  let provenance: OcrProvenance | undefined;
  for (const [i, frame] of frames.entries()) {
    const recognized = await recognizeFrame(frame, i, context);
    provenance = recognized.provenance;
    observations.push({
      id: stableId("O", first + i),
      frame: frame.id,
      text: recognized.texts.join("\n"),
      imageHash: frame.image.sha256,
      width: recognized.width,
      height: recognized.height,
      region: {
        x: recognized.region.x,
        y: recognized.region.y,
        w: recognized.region.width,
        h: recognized.region.height
      },
      transform: recognized.transform,
      boxes: recognized.boxes,
      scores: recognized.scores
    });
  }
  return { observations, provenance: provenance! };
}
function frameOcrFields(
  snapshot: Snapshot,
  options: OcrOptions,
  frames: FrameEntry[]
): MaterialFields {
  const fields = materialFields(snapshot.index, {
    kind: "frame-ocr",
    origin: "frame-ocr",
    parameters: {
      frames: frames.map((frame) => `${frame.id}:${frame.image.sha256}`),
      ...(options.region ? { region: options.region } : {})
    }
  });
  fields.requestedCoverage = frames.map((frame) => ({
    start: frame.actual,
    end: frame.actual
  }));
  return fields;
}
async function publishObservations(
  snapshot: Snapshot,
  options: LocatedOptions<OcrOptions>,
  fields: MaterialFields,
  operation: Awaited<ReturnType<typeof operationDirectory>>,
  recognized: Awaited<ReturnType<typeof acquireObservations>>
): Promise<Material> {
  const { observations, provenance } = recognized;
  await writeFile(
    path.join(operation.directory, "observations.json"),
    JSON.stringify(observations),
    { flag: "wx" }
  );
  const material: Material = {
    ...fields,
    status: observations.some((o) => o.text.trim()) ? "complete" : "empty",
    observations: observations.map(({ id, frame }) => ({ id, frame })),
    processedCoverage: fields.requestedCoverage,
    provenance,
    payload: await readFileDigest(
      options.output,
      `${operation.relative}/observations.json`
    ),
    files: [],
    warnings: []
  };
  await publishEvidence(options.output, {
    ...snapshot.index,
    materials: [...snapshot.index.materials, material]
  });
  return material;
}
async function acquire(
  snapshot: Snapshot,
  options: LocatedOptions<OcrOptions>,
  run: OperationRun,
  resources: VideoResources,
  defaultAppRoot?: ApplicationRootResolver
): Promise<string> {
  const frames = selectedFrames(snapshot, options);
  const fields = frameOcrFields(snapshot, options, frames);
  const reusable = reusableOcr(snapshot, options, fields.requestKey);
  if (reusable) {
    run.markReused();
    return result(options, snapshot, reusable.material, true, run.id);
  }
  const operation = await operationDirectory(options.output, run.id);
  try {
    const appRoot = await applicationRoot(
      resources,
      options.appRoot,
      defaultAppRoot
    );
    const recognized = await acquireObservations(snapshot, frames, {
      appRoot,
      directory: operation.directory,
      options,
      resources
    });
    const material = await publishObservations(
      snapshot,
      options,
      fields,
      operation,
      recognized
    );
    return result(options, snapshot, material, false, run.id);
  } catch (error) {
    const mapped = boundaryFailure(error, {
      stage: "ocr",
      target: operation.directory
    });
    const material: Material = {
      ...fields,
      status: interrupted(mapped) ? "interrupted" : "failed",
      failure: mapped.failure,
      processedCoverage: []
    };
    await publishFailureStatus(options.output, {
      ...snapshot.index,
      materials: [...snapshot.index.materials, material]
    });
    throw mapped;
  }
}
export async function recognizeFrames(
  requested: OcrOptions,
  resources: VideoResources,
  defaultAppRoot?: ApplicationRootResolver
): Promise<string> {
  const options = await locateEvidence(requested, resources);
  return recordedOperation(options, (run) =>
    withWriter({
      output: options.output,
      onLocked: (index) => run.begin(index),
      work: async (snapshot) => {
        if (
          options.input !== undefined &&
          options.input !== snapshot.index.source.file
        ) {
          throw failure({
            kind: "inconsistent",
            stage: "verification",
            target: options.input,
            reason: "selected input differs from evidence source"
          });
        }
        return acquire(snapshot, options, run, resources, defaultAppRoot);
      }
    })
  );
}
