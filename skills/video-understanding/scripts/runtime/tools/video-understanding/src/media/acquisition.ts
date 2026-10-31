/*
 * Synced TypeScript runtime; repository maintenance edits tools/video-understanding/src/media/acquisition.ts.
 * Installed skill copies may be edited directly; updates overwrite matching files.
 * Repository: https://github.com/zxyycom/skills
 * Source path: tools/video-understanding/src/media/acquisition.ts
 * Maintained source: https://github.com/zxyycom/skills/blob/main/tools/video-understanding/src/media/acquisition.ts
 * Skill source directory: https://github.com/zxyycom/skills/tree/main/skills/video-understanding
 * Rebuild: bun run sync:video-understanding-cli
 */
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { LocatedOptions, PrepareOptions } from "../cli/arguments.ts";
import { readSubtitleReferences, type Material } from "../evidence/evidence.ts";
import { boundaryFailure, failure } from "../failure.ts";
import {
  applicationRoot,
  interrupted,
  runtime,
  type ApplicationRootResolver,
  type MediaInfo,
  type MediaRuntime
} from "./media-runtime.ts";
import { hardOcr, validateRegion } from "./ocr-runtime.ts";
import {
  asrLanguageMode,
  materialFields,
  preparationParameters,
  subtitleParameters
} from "../evidence/material.ts";
import type { Snapshot } from "../refinement/refinement.ts";
import type { OperationRun } from "../runs/runs.ts";
import { operationDirectory, publishFailureStatus } from "../store/store.ts";
import { prepareText } from "../evidence/text.ts";
import type { VideoResources } from "../resources.ts";
import {
  registerSubtitle,
  type SubtitleRegistration,
  type TextAcquisitionState
} from "./acquisition-registration.ts";

export function prepareResult(
  snapshot: Snapshot,
  material: Material,
  reused: boolean,
  options: LocatedOptions<PrepareOptions>,
  runId: string
): string {
  const result = {
    command: "prepare",
    output: options.output,
    runId,
    scopeId: snapshot.index.scopeId,
    version: 5,
    reused,
    material: material.id,
    status: material.status,
    origin: material.origin,
    duration: snapshot.index.duration,
    language: material.language,
    languageMode: asrLanguageMode(material),
    cueCount: material.cues.length,
    frameCount: snapshot.index.frames.entries.length,
    warnings: "warnings" in material ? material.warnings : []
  };
  return options.format === "json"
    ? JSON.stringify(result)
    : JSON.stringify(result, null, 2);
}
export async function generateText(
  snapshot: Snapshot,
  options: LocatedOptions<PrepareOptions>,
  candidates: string[],
  run: OperationRun,
  environment: {
    resources: VideoResources;
    defaultAppRoot?: ApplicationRootResolver;
  }
): Promise<string> {
  const { resources, defaultAppRoot } = environment;
  const index = structuredClone(snapshot.index);
  const operation = await operationDirectory(options.output, run.id);
  const originalInputs = await readSubtitleReferences(candidates);
  const state = initialTextState(index, options, originalInputs);
  try {
    const appRoot = await applicationRoot(
      resources,
      options.appRoot,
      defaultAppRoot
    );
    const tools = await runtime({
      appRoot,
      output: operation.directory,
      timeout: options.timeout,
      resources
    });
    const media = await inspectSource({ index, operation, state }, tools);
    const context: SubtitleRegistration = {
      index,
      options,
      operation,
      originalInputs,
      state,
      duration: media.duration
    };
    const { result, provenance } = await obtainText(context, {
      appRoot,
      tools,
      media,
      candidates,
      resources
    });
    const material = await registerSubtitle(context, result, provenance);
    return prepareResult(
      { ...snapshot, index },
      material,
      false,
      options,
      run.id
    );
  } catch (error) {
    const mapped = boundaryFailure(error, {
      stage: state.stage,
      target: operation.directory
    });
    const material: Material = {
      ...state.fields,
      status: interrupted(mapped) ? "interrupted" : "failed",
      failure: mapped.failure,
      processedCoverage: []
    };
    await publishFailureStatus(options.output, {
      ...index,
      materials: [...index.materials, material]
    });
    throw mapped;
  }
}
function initialTextState(
  index: Snapshot["index"],
  options: PrepareOptions,
  originalInputs: Material["inputs"]
): TextAcquisitionState {
  return {
    stage: "runtime",
    fields: materialFields(index, {
      kind: "subtitle",
      origin: options.source === "auto" ? "asr" : options.source,
      parameters: preparationParameters(options),
      inputs: options.source === "external" ? originalInputs : [],
      duration: index.duration ?? undefined
    })
  };
}
async function inspectSource(
  context: Pick<SubtitleRegistration, "index" | "operation" | "state">,
  tools: MediaRuntime
): Promise<MediaInfo> {
  const { index, operation, state } = context;
  state.stage = "inspection";
  const media = await tools.inspect(index.source.file);
  if (index.duration !== null && index.duration !== media.duration) {
    throw failure({
      kind: "inconsistent",
      stage: state.stage,
      target: index.source.file,
      reason: "media duration changed"
    });
  }
  index.duration = media.duration;
  state.fields.requestedCoverage = [{ start: 0, end: media.duration }];
  await writeFile(
    path.join(operation.directory, "media.json"),
    JSON.stringify(media),
    { flag: "wx" }
  );
  return media;
}
async function obtainText(
  context: SubtitleRegistration,
  environment: {
    appRoot: string;
    tools: MediaRuntime;
    media: MediaInfo;
    candidates: string[];
    resources: VideoResources;
  }
) {
  const { index, options, operation, originalInputs, state } = context;
  const { appRoot, tools, media, candidates, resources } = environment;
  if (options.source === "hard-ocr") {
    state.stage = "hard-ocr";
    const ocr = await hardOcrText({
      appRoot,
      directory: operation.directory,
      source: index.source.file,
      options,
      media,
      tools,
      resources
    });
    return ocr;
  }
  state.stage = "subtitle-decoding";
  const result = await prepareText({
    tools,
    source: { input: index.source.file, candidates },
    directory: operation.directory,
    media,
    options,
    onAttempt: (choice) => {
      state.stage = choice.origin === "asr" ? "asr" : "subtitle-decoding";
      state.fields = materialFields(index, {
        kind: "subtitle",
        origin: choice.origin,
        duration: media.duration,
        parameters: subtitleParameters(choice, options),
        inputs:
          choice.origin === "external"
            ? originalInputs.filter((input) => input.file === choice.input)
            : []
      });
    },
    onEmpty: async (empty) => {
      await registerSubtitle(context, empty, await tools.provenance());
    }
  });
  const provenance = await tools.provenance(
    result.origin === "asr" ? options.model : undefined
  );
  return { result, provenance };
}
async function hardOcrText(context: {
  appRoot: string;
  directory: string;
  source: string;
  options: Extract<PrepareOptions, { source: "hard-ocr" }>;
  media: MediaInfo;
  tools: MediaRuntime;
  resources: VideoResources;
}) {
  const { appRoot, directory, source, options, media, tools, resources } =
    context;
  const video = media.streams.find((stream) => stream.type === "video");
  if (!video || !video.width || !video.height || video.rotation !== 0) {
    throw failure({
      kind: "input",
      stage: "hard-ocr",
      target: source,
      reason:
        "hard-ocr requires known encoded dimensions, zero rotation and zero timeline start"
    });
  }
  const roi = options.region;
  const region = validateRegion(
    { x: roi.x, y: roi.y, width: roi.w, height: roi.h },
    { width: video.width, height: video.height }
  );
  const ocr = await hardOcr({
    appRoot,
    output: directory,
    source,
    region,
    timeout: options.timeout,
    resources
  });
  const segments = (await readFile(ocr.file, "utf8")).trim()
    ? await tools.subtitles(ocr.file)
    : [];
  return {
    result: {
      segments,
      origin: "hard-ocr" as const,
      warnings: [],
      files: [path.relative(directory, ocr.file).split(path.sep).join("/")]
    },
    provenance: ocr.provenance
  };
}
