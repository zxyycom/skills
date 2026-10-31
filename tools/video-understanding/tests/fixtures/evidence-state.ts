import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  readFileDigest,
  readSourceStamp,
  type Evidence
} from "../../src/evidence/evidence.ts";
import { freshEvidence, publishEvidence } from "../../src/store/store.ts";
import { materialFields } from "../../src/evidence/material.ts";

export function readyText(index: Evidence) {
  const material = index.materials[0];
  if (
    !material ||
    (material.status !== "complete" && material.status !== "empty")
  )
    throw new Error("fixture text must be ready");
  return material;
}
export async function complete(directory: string): Promise<Evidence> {
  const source = path.join(directory, "source.mp4");
  await writeFile(source, "synthetic source");
  await mkdir(path.join(directory, "artifacts", "fixture"), {
    recursive: true
  });
  await writeFile(
    path.join(directory, "artifacts", "fixture", "segments.json"),
    JSON.stringify([
      { id: "T0001", start: 0, end: 2.125, text: "原始文本" },
      { id: "T0002", start: 2.5, end: 3.5, text: "第二段" }
    ])
  );
  const index = freshEvidence(await readSourceStamp(source));
  index.duration = 4;
  index.materials = [
    {
      ...materialFields(index, {
        kind: "subtitle",
        origin: "asr",
        parameters: { model: "small", language: "unknown" },
        duration: 4
      }),
      cues: [
        { id: "T0001", start: 0, end: 2.125 },
        { id: "T0002", start: 2.5, end: 3.5 }
      ],
      status: "complete",
      processedCoverage: [{ start: 0, end: 4 }],
      provenance: {
        tool: "fixture",
        version: "1",
        profile: "fixture",
        models: [{ path: "fixture-model", sha256: "0".repeat(64) }]
      },
      warnings: [],
      payload: await readFileDigest(
        directory,
        "artifacts/fixture/segments.json"
      ),
      files: []
    }
  ];
  await publishEvidence(directory, index);
  return index;
}
