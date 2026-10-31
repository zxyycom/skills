import { mkdir, stat } from "node:fs/promises";
import path from "node:path";
import * as v from "valibot";
import { boundaryFailure, failure, parseJson, validate } from "../failure.ts";
import { processOutput } from "./media-process.ts";
import {
  ocrPreflight,
  type OcrProvenance,
  type OcrTool
} from "./ocr-preflight.ts";
export { ocrPreflight, type OcrProvenance } from "./ocr-preflight.ts";
import type { VideoResources } from "../resources.ts";

export type Region = { x: number; y: number; width: number; height: number };
const PositiveInteger = v.pipe(v.number(), v.integer(), v.minValue(1));
const NonnegativeInteger = v.pipe(v.number(), v.integer(), v.minValue(0));
const RegionSchema = v.object({
  x: NonnegativeInteger,
  y: NonnegativeInteger,
  width: PositiveInteger,
  height: PositiveInteger
});
const CoordinateSchema = v.pipe(v.number(), v.finite(), v.minValue(0));
const FrameResultSchema = v.object({
  width: PositiveInteger,
  height: PositiveInteger,
  region: RegionSchema,
  transform: v.object({
    offsetX: NonnegativeInteger,
    offsetY: NonnegativeInteger,
    scaleX: v.literal(1),
    scaleY: v.literal(1)
  }),
  boxes: v.array(
    v.tuple([
      v.tuple([CoordinateSchema, CoordinateSchema]),
      v.tuple([CoordinateSchema, CoordinateSchema]),
      v.tuple([CoordinateSchema, CoordinateSchema]),
      v.tuple([CoordinateSchema, CoordinateSchema])
    ])
  ),
  texts: v.array(v.pipe(v.string(), v.minLength(1))),
  scores: v.array(v.pipe(v.number(), v.finite(), v.minValue(0), v.maxValue(1)))
});
export type FrameOcrResult = v.InferOutput<typeof FrameResultSchema> & {
  provenance: OcrProvenance;
};
type OcrRequest = {
  appRoot: string;
  output: string;
  source: string;
  timeout: number;
  resources: VideoResources;
};

export function validateRegion(
  region: Region,
  dimensions: { width: number; height: number }
): Region {
  const parsed = validate(RegionSchema, region, {
    stage: "arguments",
    target: "region"
  });
  if (
    parsed.x + parsed.width > dimensions.width ||
    parsed.y + parsed.height > dimensions.height
  ) {
    throw failure({
      kind: "input",
      stage: "arguments",
      target: "region",
      reason: "region must lie wholly inside the input pixels"
    });
  }
  return parsed;
}
export function parseFrameOcr(
  value: unknown
): v.InferOutput<typeof FrameResultSchema> {
  const result = validate(FrameResultSchema, value, {
    stage: "ocr",
    target: "RapidOCR API result"
  });
  validateRegion(result.region, result);
  if (
    result.boxes.length !== result.texts.length ||
    result.texts.length !== result.scores.length ||
    result.transform.offsetX !== result.region.x ||
    result.transform.offsetY !== result.region.y ||
    result.boxes.some((box) =>
      box.some(
        ([x, y]) =>
          x < result.region.x ||
          y < result.region.y ||
          x > result.region.x + result.region.width ||
          y > result.region.y + result.region.height
      )
    )
  ) {
    throw failure({
      kind: "protocol",
      stage: "ocr",
      target: "RapidOCR API result",
      reason: "inconsistent arrays or coordinate mapping"
    });
  }
  return result;
}
export function ocrEnvironment({
  work,
  parent
}: {
  work: string;
  parent: NodeJS.ProcessEnv;
}): NodeJS.ProcessEnv {
  const system = parent.SystemRoot ?? parent.SYSTEMROOT;
  if (!system)
    throw failure({
      kind: "environment",
      stage: "runtime",
      target: "Windows OCR runtime",
      reason: "SystemRoot missing"
    });
  return {
    SystemRoot: system,
    WINDIR: system,
    PATH: path.join(system, "System32"),
    HOME: work,
    USERPROFILE: work,
    APPDATA: work,
    LOCALAPPDATA: work,
    TEMP: work,
    TMP: work,
    TMPDIR: work,
    PATHEXT: ".COM;.EXE;.BAT;.CMD",
    PYTHONIOENCODING: "utf-8",
    PYTHONUNBUFFERED: "1",
    OMP_NUM_THREADS: "2"
  };
}
export function videocrArguments({
  source,
  file,
  region
}: {
  source: string;
  file: string;
  region: Region;
}): string[] {
  return [
    "--video_path",
    source,
    "--output",
    file,
    "--ocr_engine",
    "paddleocr",
    "--lang",
    "ch",
    "--use_fullframe",
    "false",
    "--use_gpu",
    "false",
    "--use_server_model",
    "false",
    "--use_angle_cls",
    "false",
    "--normalize_to_simplified_chinese",
    "false",
    "--frames_to_skip",
    "0",
    "--save_ocr_images",
    "false",
    "--allow_system_sleep",
    "true",
    "--post_processing",
    "false",
    "--crop_x",
    String(region.x),
    "--crop_y",
    String(region.y),
    "--crop_width",
    String(region.width),
    "--crop_height",
    String(region.height)
  ];
}
/** OCR owns its workspace; the media inspector separately owns operation/.process. */
export async function ocrWorkspace(
  output: string,
  tool: OcrTool
): Promise<string> {
  const work = path.join(output, `.${tool}-process`);
  await mkdir(work);
  return work;
}
export async function hardOcr(request: OcrRequest & { region: Region }) {
  const { appRoot, output, source, timeout, region, resources } = request;
  const installed = await ocrPreflight(appRoot, "videocr", resources);
  const file = path.join(output, "subtitle.srt");
  const work = await ocrWorkspace(output, "videocr");
  await processOutput({
    command: {
      program: installed.program,
      args: videocrArguments({ source, file, region })
    },
    env: ocrEnvironment({ work, parent: process.env }),
    cwd: work,
    stage: "hard-ocr",
    timeout,
    diagnostic: path.join(output, "videocr-diagnostic.log"),
    capture: false
  });
  // Missing output is a failed process protocol, not a successful empty subtitle file.
  try {
    if (!(await stat(file)).isFile()) throw new Error("output not a file");
  } catch (error) {
    throw boundaryFailure(error, { stage: "hard-ocr", target: file });
  }
  return { file, provenance: installed.provenance };
}
export async function frameOcr(
  request: OcrRequest & { region?: Region }
): Promise<FrameOcrResult> {
  const { appRoot, output, source, timeout, region, resources } = request;
  const installed = await ocrPreflight(appRoot, "rapidocr", resources);
  const work = await ocrWorkspace(output, "rapidocr");
  const helper = resources.rapidocrHelper;
  const args = [
    "-I",
    helper,
    "--input",
    source,
    "--models",
    path.join(installed.root, "models")
  ];
  if (region) args.push("--region", JSON.stringify(region));
  const stdout = await processOutput({
    command: { program: installed.program, args },
    env: ocrEnvironment({ work, parent: process.env }),
    cwd: work,
    stage: "ocr",
    timeout,
    diagnostic: path.join(output, "rapidocr-diagnostic.log")
  });
  const result = parseFrameOcr(
    parseJson(stdout, { stage: "ocr", target: "RapidOCR stdout" })
  );
  if (region && JSON.stringify(result.region) !== JSON.stringify(region)) {
    throw failure({
      kind: "protocol",
      stage: "ocr",
      target: "RapidOCR region",
      reason: "result does not match requested region"
    });
  }
  return { ...result, provenance: installed.provenance };
}
