/// <reference types="bun" />
import { resources } from "./public-cli.ts";
import { spyOn } from "bun:test";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import * as mediaRuntime from "../../src/media/media-runtime.ts";
import { parseOptions, type PrepareOptions } from "../../src/cli/arguments.ts";
import { parseSegments, type Segment } from "../../src/evidence/evidence.ts";
import { execute } from "../../src/video.ts";
import { failure } from "../../src/failure.ts";

export const provenance = {
  tool: "fixture",
  version: "1",
  profile: "fixture",
  models: []
};
export function prepared(
  input: string,
  output: string,
  appRoot: string,
  args: string[] = []
): PrepareOptions {
  const options = parseOptions([
    "prepare",
    "--input",
    input,
    "--output",
    output,
    "--app-root",
    appRoot,
    "--format",
    "json",
    ...args
  ]);
  if (options?.command !== "prepare") throw new Error("expected prepare");
  return options;
}
export function fixtureRuntime(
  config: {
    duration?: number;
    segments?: Segment[];
    subtitles?: Segment[];
  } = {}
) {
  let starts = 0;
  let asrCalls = 0;
  let asrText = "ASR source";
  let failAsr = false;
  let rotation = 0;
  let hasAudio = true;
  let asrSegments = config.segments;
  const asrRequests: mediaRuntime.AsrRequest[] = [];
  const runtime = spyOn(mediaRuntime, "runtime").mockImplementation(
    async ({ output }) => {
      starts++;
      await mkdir(path.join(output, ".process"));
      return {
        inspect: async () => ({
          duration: config.duration ?? 4,
          start: 0 as const,
          streams: [
            {
              index: 0,
              type: "video",
              codec: "fixture",
              start: 0,
              width: 100,
              height: 40,
              rotation
            },
            ...(config.subtitles
              ? [{ index: 2, type: "subtitle", codec: "subrip", start: 0 }]
              : []),
            ...(hasAudio
              ? [{ index: 1, type: "audio", codec: "fixture", start: 0 }]
              : [])
          ]
        }),
        provenance: async (model?: string) =>
          model
            ? {
                ...provenance,
                models: [{ path: "fixture-model", sha256: "0".repeat(64) }]
              }
            : provenance,
        subtitles: async (file: string) => {
          const text = await readFile(file, "utf8");
          if (text.includes("corrupt"))
            throw failure({
              kind: "protocol",
              stage: "subtitle-decoding",
              target: file,
              reason: "corrupt fixture subtitle"
            });
          return (
            config.subtitles ??
            (text.trim() ? [{ start: 0, end: 1, text }] : [])
          );
        },
        ffmpeg: async (args: string[]) => {
          const target = args.at(-1)!;
          await writeFile(
            target,
            target.endsWith(".srt") ? await readFile(args[1]!) : "wav fixture"
          );
          return "";
        },
        asr: async (request: mediaRuntime.AsrRequest) => {
          asrCalls++;
          asrRequests.push(request);
          if (failAsr)
            throw failure({
              kind: "timeout",
              stage: "asr",
              target: "fixture",
              reason: "fixture interrupted"
            });
          const result = {
            segments:
              asrSegments ??
              (asrText ? [{ start: 0, end: 1, text: asrText }] : []),
            language: "en"
          };
          await writeFile(
            path.join(output, "raw", "audio.json"),
            JSON.stringify(result)
          );
          return { ...result, segments: parseSegments(result.segments) };
        },
        frames: async () => []
      };
    }
  );
  return {
    runtime,
    starts: () => starts,
    asrCalls: () => asrCalls,
    asrRequests,
    noAudio: () => {
      hasAudio = false;
    },
    transcribe: (segments: Segment[]) => {
      asrSegments = segments;
    },
    empty: () => {
      asrText = "";
    },
    fail: () => {
      failAsr = true;
    },
    rotate: () => {
      rotation = 90;
    }
  };
}

export async function readResult(output: string, args: string[] = []) {
  const options = parseOptions(["read", "--output", output, ...args]);
  if (options?.command !== "read") throw new Error("expected read");
  return execute(options, resources);
}
