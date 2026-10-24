import { readFile } from "node:fs/promises";
import path from "node:path";
import * as v from "valibot";
import {
  digest,
  ObservationSchema,
  TranscriptsSchema,
  type Evidence,
  type Material,
  type SavedFile,
  type Transcript,
  type Observation
} from "./evidence.ts";
import { failure, parseJson, validate } from "./failure.ts";
import type { IndexedMaterial } from "./refinement.ts";

export async function verifiedBytes(
  output: string,
  file: SavedFile
): Promise<Buffer> {
  try {
    if (!file.file.startsWith("artifacts/"))
      throw new Error("outside artifact namespace");
    const bytes = await readFile(path.join(output, file.file));
    if (digest(bytes) === file.sha256) return bytes;
  } catch {
    /* A missing or invalid pointer cannot authorize evidence. */
  }
  throw failure({
    kind: "inconsistent",
    stage: "verification",
    target: file.file,
    reason: "damaged evidence: missing or hash mismatch"
  });
}
export async function materialSnapshot(
  output: string,
  material: Material
): Promise<IndexedMaterial> {
  try {
    if (material.status !== "complete" && material.status !== "empty")
      return {
        material,
        status: "invalid",
        reason: `attempt ${material.status}; no successful coverage`,
        transcripts: [],
        observations: []
      };
    const { transcripts, observations } = await materialPayload(
      output,
      material
    );
    return { material, status: "valid", transcripts, observations };
  } catch {
    return {
      material,
      status: "invalid",
      reason: "source or material artifact missing, changed or inconsistent",
      transcripts: [],
      observations: []
    };
  }
}
async function materialPayload(
  output: string,
  material: Extract<Material, { status: "complete" | "empty" }>
): Promise<{ transcripts: Transcript[]; observations: Observation[] }> {
  for (const input of material.inputs)
    if (digest(await readFile(input.file)) !== input.sha256)
      throw new Error("input changed");
  const context = { stage: "verification" as const, target: material.id };
  const raw = parseJson(
    (await verifiedBytes(output, material.payload)).toString("utf8"),
    context
  );
  for (const file of material.files) await verifiedBytes(output, file);
  const transcripts =
    material.kind === "subtitle"
      ? validate(TranscriptsSchema, raw, context)
      : [];
  const observations =
    material.kind === "frame-ocr"
      ? validate(v.array(ObservationSchema), raw, context)
      : [];
  checkPayloadLocators(material, transcripts, observations);
  return { transcripts, observations };
}
function checkPayloadLocators(
  material: Material,
  transcripts: Transcript[],
  observations: Observation[]
): void {
  const cues = transcripts.map(({ id, start, end }) => ({ id, start, end }));
  const frames = observations.map(({ id, frame }) => ({ id, frame }));
  const empty = ![...transcripts, ...observations].some((item) =>
    item.text.trim()
  );
  if (
    JSON.stringify(cues) !== JSON.stringify(material.cues) ||
    JSON.stringify(frames) !== JSON.stringify(material.observations) ||
    (material.status === "empty") !== empty
  )
    throw new Error("payload/index mismatch");
}
function materialAvailability(
  materials: IndexedMaterial[]
): Map<string, string> {
  const unavailable = new Map<string, string>();
  for (const entry of materials) {
    if (entry.status !== "invalid") continue;
    const ids = [
      entry.material.id,
      ...entry.material.cues.map((cue) => cue.id),
      ...entry.material.observations.map((item) => item.id)
    ];
    for (const id of ids) unavailable.set(id, entry.reason);
  }
  return unavailable;
}
export async function rawAvailability(
  output: string,
  evidence: Evidence,
  materials: IndexedMaterial[]
): Promise<Map<string, string>> {
  const unavailable = materialAvailability(materials);
  for (const frame of evidence.frames.entries) {
    try {
      await verifiedBytes(output, frame.image);
    } catch {
      unavailable.set(frame.id, "frame artifact missing or hash mismatch");
    }
  }
  for (const item of materials.flatMap((material) => material.observations)) {
    const frame = evidence.frames.entries.find(
      (entry) => entry.id === item.frame
    );
    if (unavailable.has(item.frame) || frame?.image.sha256 !== item.imageHash)
      unavailable.set(
        item.id,
        "input frame unavailable or fingerprint mismatch"
      );
  }
  return unavailable;
}
