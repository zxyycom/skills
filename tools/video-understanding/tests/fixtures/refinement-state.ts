import { resources } from "./public-cli.ts";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { readyText } from "./evidence-state.ts";
import {
  readFileDigest,
  type Evidence,
  type Material,
  type Provenance
} from "../../src/evidence.ts";
import { materialFields } from "../../src/material.ts";
import {
  loadEvidence,
  loadSnapshot,
  operationDirectory,
  publishEvidence
} from "../../src/store.ts";
import { queryEvidence } from "../../src/query.ts";
import { parseOptions } from "../../src/arguments.ts";
import { locateEvidence } from "../../src/location.ts";
import { readEvidence, refine } from "../../src/video.ts";

export const verification = {
  reason: "fixture rationale",
  verified: { refs: [], note: "fixture only; no media inspected" }
};
export async function submit(directory: string, value: unknown) {
  const file = path.join(directory, "draft.json");
  await writeFile(file, JSON.stringify(value));
  const options = parseOptions([
    "refine",
    "--output",
    directory,
    "--file",
    file,
    "--format",
    "json"
  ]);
  if (options?.command !== "refine") throw new Error("expected refine");
  return JSON.parse(await refine(options, resources));
}
export async function query(directory: string, args: string[] = []) {
  const options = parseOptions(["read", "--output", directory, ...args]);
  if (options?.command !== "read") throw new Error("expected read");
  return queryEvidence(
    await loadSnapshot(directory),
    await locateEvidence(options, resources)
  );
}
export async function textQuery(directory: string, args: string[] = []) {
  const options = parseOptions([
    "read",
    "--output",
    directory,
    ...args,
    "--format",
    "text"
  ]);
  if (options?.command !== "read") throw new Error("expected read");
  return readEvidence(options, resources);
}
export const replacementSegments = [
  { start: 1, end: 2, text: "one" },
  { start: 2, end: 3, text: "two" },
  { start: 3, end: 4, text: "three" }
];
export function correction(
  scopeId: string,
  targets = ["T0001", "T0002"],
  segments = replacementSegments
) {
  return {
    scopeId,
    action: "create",
    kind: "correction",
    targets,
    replacement: { segments },
    ...verification
  };
}
export async function second(directory: string) {
  const index = await loadEvidence(directory);
  const operation = await operationDirectory(directory);
  const transcripts = [
    { id: "T0003", start: 0, end: 1, text: "second source" }
  ];
  await writeFile(
    path.join(operation.directory, "segments.json"),
    JSON.stringify(transcripts)
  );
  const material: Material = {
    ...materialFields(index, {
      kind: "subtitle",
      origin: "external",
      parameters: {},
      duration: 4
    }),
    status: "complete",
    cues: [{ id: "T0003", start: 0, end: 1 }],
    processedCoverage: [{ start: 0, end: 4 }],
    payload: await readFileDigest(
      directory,
      `${operation.relative}/segments.json`
    ),
    files: [],
    warnings: [],
    provenance: readyText(index).provenance
  };
  index.materials.push(material);
  await publishEvidence(directory, index);
  return material;
}
export async function frames(directory: string) {
  const index = await loadEvidence(directory);
  const imageFile = "artifacts/fixture/frame.png";
  await writeFile(path.join(directory, imageFile), "synthetic image bytes");
  const image = await readFileDigest(directory, imageFile);
  index.frames = {
    entries: [
      {
        id: "F0001",
        requested: 1,
        actual: 1,
        pts: 10,
        timeBase: "1/10",
        streamIndex: 0,
        width: 960,
        image
      }
    ],
    attempt: { status: "complete" }
  };
  await publishEvidence(directory, index);
}
export async function observationMaterial(
  directory: string,
  index: Evidence,
  text: string,
  provenance: Provenance
): Promise<void> {
  const observation = {
    id: "O0001",
    frame: "F0001",
    text,
    imageHash: index.frames.entries[0]!.image.sha256,
    width: 100,
    height: 40,
    region: { x: 0, y: 0, w: 100, h: 40 },
    transform: { offsetX: 0, offsetY: 0, scaleX: 1, scaleY: 1 }
  };
  await writeFile(
    path.join(directory, "artifacts/fixture/ocr.json"),
    JSON.stringify([observation])
  );
  index.materials.push({
    ...materialFields(index, {
      kind: "frame-ocr",
      origin: "frame-ocr",
      parameters: {}
    }),
    status: "complete",
    observations: [{ id: "O0001", frame: "F0001" }],
    processedCoverage: [{ start: 1, end: 1 }],
    payload: await readFileDigest(directory, "artifacts/fixture/ocr.json"),
    files: [],
    warnings: [],
    provenance
  });
  await publishEvidence(directory, index);
}
export async function select(
  directory: string,
  scopeId: string,
  material = "M0001"
) {
  return submit(directory, {
    scopeId,
    action: "create",
    kind: "selection",
    mode: "source",
    material,
    purpose: "transcript",
    ...verification
  });
}
