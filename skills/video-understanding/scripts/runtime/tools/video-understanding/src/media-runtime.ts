/*
 * Synced TypeScript runtime; repository maintenance edits tools/video-understanding/src/media-runtime.ts.
 * Installed skill copies may be edited directly; updates overwrite matching files.
 * Repository: https://github.com/zxyycom/skills
 * Source path: tools/video-understanding/src/media-runtime.ts
 * Maintained source: https://github.com/zxyycom/skills/blob/main/tools/video-understanding/src/media-runtime.ts
 * Skill source directory: https://github.com/zxyycom/skills/tree/main/skills/video-understanding
 * Rebuild: bun run sync:video-understanding-cli
 */
import { mkdir, readFile, realpath } from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import { parseEnv } from "node:util";
import * as v from "valibot";
import {
  FrameTimingSchema,
  IndexSchema,
  parseSegments,
  ProvenanceSchema,
  SegmentsSchema,
  validFrameTiming
} from "./evidence.ts";
import {
  boundaryFailure,
  failure,
  parseJson,
  validate,
  VideoFailure,
  type Stage
} from "./failure.ts";
import { processOutput } from "./media-process.ts";
export { processOutput } from "./media-process.ts";
import { assertOutsideSkill, type VideoResources } from "./resources.ts";

const StreamSchema = v.object({
  index: IndexSchema,
  type: v.string(),
  codec: v.string(),
  start: v.nullable(v.pipe(v.number(), v.finite())),
  width: v.optional(IndexSchema),
  height: v.optional(IndexSchema),
  rotation: v.optional(v.pipe(v.number(), v.finite()))
});
const MediaSchema = v.object({
  duration: v.nullable(v.pipe(v.number(), v.finite())),
  start: v.nullable(v.pipe(v.number(), v.finite())),
  streams: v.array(StreamSchema)
});
export type MediaStream = v.InferOutput<typeof StreamSchema>;
export type MediaInfo = { duration: number; start: 0; streams: MediaStream[] };
const FrameSchema = v.pipe(
  v.object({
    file: v.pipe(v.string(), v.regex(/^frame-\d+\.png$/)),
    ...FrameTimingSchema.entries
  }),
  v.check(
    (frame) => validFrameTiming(frame),
    "actual must equal PTS times timeBase and be at or after requested"
  )
);
export type Frame = v.InferOutput<typeof FrameSchema>;
const AsrSchema = v.object({
  segments: SegmentsSchema,
  language: v.pipe(v.string(), v.minLength(1))
});
export interface AsrRequest {
  audio: string;
  model: string;
  language?: string;
  initialPrompt?: string;
}
const OfflinePolicySchema = v.object({
  HF_HUB_OFFLINE: v.literal("1"),
  HF_HUB_DISABLE_IMPLICIT_TOKEN: v.literal("true"),
  HF_HUB_DISABLE_TELEMETRY: v.literal("1"),
  DO_NOT_TRACK: v.literal("1")
});

export function mediaEnvironment({
  appRoot,
  output,
  parent,
  defaults
}: {
  appRoot: string;
  output: string;
  parent: NodeJS.ProcessEnv;
  defaults: NodeJS.ProcessEnv;
}): NodeJS.ProcessEnv {
  const system = parent.SystemRoot ?? parent.SYSTEMROOT;
  if (!system)
    throw failure({
      kind: "environment",
      stage: "runtime",
      target: "Windows",
      reason: "SystemRoot missing"
    });
  const offlinePolicy = validate(OfflinePolicySchema, defaults, {
    stage: "runtime",
    target: "runtime.env"
  });
  const local = path.join(output, ".process");
  const env: NodeJS.ProcessEnv = {
    SystemRoot: system,
    WINDIR: system,
    PATH: path.join(system, "System32"),
    HOME: local,
    USERPROFILE: local,
    APPDATA: local,
    LOCALAPPDATA: local,
    TEMP: local,
    TMP: local,
    TMPDIR: local,
    PATHEXT: ".COM;.EXE;.BAT;.CMD",
    HF_HOME: path.join(appRoot, "cache", "huggingface")
  };
  return { ...env, ...offlinePolicy };
}
export async function localInput(file: string): Promise<string> {
  return resolveLocalPath(file, "input");
}
/** Windows drive-relative rooted paths are not stable across working drives. */
export function isAbsoluteLocalPath(file: string): boolean {
  return (
    path.isAbsolute(file) &&
    !file.startsWith("\\\\") &&
    !file.startsWith("//") &&
    (path.sep !== "\\" || /^[a-z]:[\\/]/i.test(file))
  );
}
export type ApplicationRootResolver = () => Promise<string>;
export async function applicationRoot(
  resources: VideoResources,
  explicit?: string,
  defaultRoot?: ApplicationRootResolver
): Promise<string> {
  const root = explicit ?? (await defaultRoot?.());
  if (root === undefined) {
    throw failure({
      kind: "environment",
      stage: "runtime",
      target: "Windows media runtime",
      reason:
        "provide --app-root or config.json appRoot for the preinstalled offline media runtime"
    });
  }
  const resolved = await resolveLocalPath(root, "runtime");
  await assertOutsideSkill(resources, {
    directory: resolved,
    stage: "runtime"
  });
  return resolved;
}
async function resolveLocalPath(
  file: string,
  stage: "input" | "runtime"
): Promise<string> {
  if (!isAbsoluteLocalPath(file)) {
    throw failure({
      kind: "input",
      stage,
      target: "local path",
      reason: "requires an absolute local path (no URL or UNC)"
    });
  }
  try {
    const resolved = await realpath(file);
    if (resolved.startsWith("\\\\") || resolved.startsWith("//"))
      throw failure({
        kind: "input",
        stage,
        target: file,
        reason: "resolved path must remain local"
      });
    return resolved;
  } catch (error) {
    throw boundaryFailure(error, { stage, target: file });
  }
}

export async function runtime({
  appRoot,
  output,
  timeout,
  resources
}: {
  appRoot: string;
  output: string;
  timeout: number;
  resources: VideoResources;
}) {
  try {
    const defaults = parseEnv(
      await readFile(resources.runtimeEnvironment, "utf8")
    );
    const env = mediaEnvironment({
      appRoot,
      output,
      parent: process.env,
      defaults
    });
    await mkdir(path.join(output, ".process"));
    const python = path.join(appRoot, "venv", "Scripts", "python.exe");
    const helper = resources.mediaHelper;
    const require = createRequire(
      await realpath(
        path.join(appRoot, "node_modules", "mcp-video-analyzer", "package.json")
      )
    );
    const ffmpeg: unknown = require("ffmpeg-static");
    if (typeof ffmpeg !== "string")
      throw failure({
        kind: "environment",
        stage: "runtime",
        target: appRoot,
        reason: "FFmpeg package unavailable"
      });
    let sequence = 0;
    const run = (
      program: string,
      args: string[],
      stage: Stage,
      capture = true
    ) =>
      processOutput({
        command: { program, args },
        env,
        stage,
        diagnostic: path.join(output, `diagnostic-${++sequence}.log`),
        timeout,
        capture
      });
    const json = async (args: string[], stage: Stage) =>
      parseJson(await run(python, ["-I", helper, ...args], stage), {
        stage,
        target: "PyAV stdout"
      });
    return {
      inspect: async (source: string) =>
        parseMediaInfo(await json(["inspect", source], "inspection")),
      provenance: async (model?: string) =>
        validate(
          ProvenanceSchema,
          await json(
            [
              "provenance",
              model ?? "none",
              "--cache",
              path.join(appRoot, "cache", "huggingface", "hub")
            ],
            "runtime"
          ),
          { stage: "runtime", target: "media provenance" }
        ),
      subtitles: async (source: string) =>
        parseSegments(await json(["subtitles", source], "subtitle-decoding")),
      frames: async ({
        source,
        times,
        width
      }: {
        source: string;
        times: number[];
        width: number;
      }) =>
        parseFrames(
          await json(
            [
              "frames",
              source,
              "--output",
              output,
              "--times",
              JSON.stringify(times),
              "--width",
              String(width)
            ],
            "frames"
          )
        ),
      asr: async ({ audio, model, language, initialPrompt }: AsrRequest) => {
        const args = [
          "asr",
          audio,
          "--model",
          model,
          "--model_dir",
          path.join(appRoot, "cache", "huggingface", "hub"),
          "--local_files_only",
          "True",
          "--device",
          "cpu",
          "--compute_type",
          "int8",
          "--vad_filter",
          "True",
          "--output_dir",
          path.join(output, "raw"),
          "--output_format",
          "all",
          "--verbose",
          "False"
        ];
        if (language) args.push("--language", language);
        if (initialPrompt) args.push("--initial_prompt", initialPrompt);
        await run(python, ["-I", helper, ...args], "asr", false);
        const target = path.join(output, "raw", "audio.json");
        try {
          return validate(
            AsrSchema,
            parseJson(await readFile(target, "utf8"), { stage: "asr", target }),
            { stage: "asr", target }
          );
        } catch (error) {
          throw boundaryFailure(error, { stage: "asr", target });
        }
      },
      ffmpeg: (
        args: string[],
        stage: "subtitle-conversion" | "audio-extraction"
      ) => run(ffmpeg, ["-nostdin", "-v", "error", "-n", ...args], stage, false)
    };
  } catch (error) {
    throw boundaryFailure(error, { stage: "runtime", target: appRoot });
  }
}
export function parseMediaInfo(value: unknown): MediaInfo {
  const media = validate(MediaSchema, value, {
    stage: "inspection",
    target: "media metadata"
  });
  const violations: string[] = [];
  if (media.duration === null || media.duration <= 0)
    violations.push(
      `duration=${media.duration}; required known duration > 0 seconds`
    );
  if (media.start !== 0)
    violations.push(`container.start=${media.start}; required 0 seconds`);
  for (const stream of media.streams) {
    if (["video", "audio"].includes(stream.type) && stream.start !== 0) {
      violations.push(
        `streams[index=${stream.index},type=${stream.type}].start=${stream.start}; required 0 seconds`
      );
    }
  }
  if (violations.length || media.duration === null) {
    throw failure(
      {
        kind: "input",
        stage: "inspection",
        target: "media timeline",
        reason: `unsupported media timeline: ${violations.join("; ")}`
      },
      "inspect the reported fields; this CLI does not normalize timelines; preserve the input and use a separately authorized derived input if needed"
    );
  }
  return { duration: media.duration, start: 0, streams: media.streams };
}
export function parseFrames(value: unknown): Frame[] {
  return validate(v.array(FrameSchema), value, {
    stage: "frames",
    target: "frame mapping"
  });
}
export function interrupted(error: unknown): boolean {
  return (
    error instanceof VideoFailure &&
    (error.failure.kind === "timeout" || error.failure.kind === "cancelled")
  );
}
