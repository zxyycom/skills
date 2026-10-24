/*
 * Synced TypeScript runtime; repository maintenance edits tools/video-understanding/src/text.ts.
 * Installed skill copies may be edited directly; updates overwrite matching files.
 * Repository: https://github.com/zxyycom/skills
 * Source path: tools/video-understanding/src/text.ts
 * Maintained source: https://github.com/zxyycom/skills/blob/main/tools/video-understanding/src/text.ts
 * Skill source directory: https://github.com/zxyycom/skills/tree/main/skills/video-understanding
 * Rebuild: bun run sync:video-understanding-cli
 */
import { copyFile, mkdir, readFile, readdir, rm } from "node:fs/promises";
import path from "node:path";
import type { PrepareOptions } from "./arguments.ts";
import { siblingSubtitles, type Segment } from "./evidence.ts";
import { failure } from "./failure.ts";
import type { MediaInfo, MediaRuntime } from "./media-runtime.ts";
import { localInput } from "./location.ts";
export async function subtitleInputs(
  options: PrepareOptions,
  input: string
): Promise<string[]> {
  if (options.source === "asr" || options.source === "hard-ocr") return [];
  switch (options.subtitle.mode) {
    case "explicit":
      return [await localInput(options.subtitle.file)];
    case "embedded":
      return [];
    case "sibling":
      return siblingSubtitles(input);
  }
}
type SubtitleChoice =
  | { origin: "external"; input: string }
  | { origin: "embedded"; stream: number };
export type TextSource =
  | SubtitleChoice
  | { origin: "asr"; stream: number; language: string }
  | { origin: "hard-ocr" };
export type TextResult = TextSource & {
  readonly segments: readonly Segment[];
  readonly files: readonly string[];
};
type SubtitleResult = Extract<TextResult, { origin: "external" | "embedded" }>;
type TextOptions = Exclude<PrepareOptions, { source: "hard-ocr" }>;
interface SubtitleContext {
  media: MediaInfo;
  selected: number | undefined;
}
interface SubtitleSelection {
  choices: SubtitleChoice[];
  warnings: string[];
}
function invalid(reason: string): never {
  throw failure({
    kind: "input",
    stage: "subtitle-decoding",
    target: "stream selection",
    reason
  });
}
function subtitleChoices(
  candidates: string[],
  context: SubtitleContext
): SubtitleSelection {
  const { media, selected } = context;
  const warnings: string[] = [];
  const embedded = media.streams.filter((stream) => stream.type === "subtitle");
  if (
    selected !== undefined &&
    !embedded.some((stream) => stream.index === selected)
  )
    return invalid("--subtitle-stream is not a subtitle stream");
  const choices = [
    ...candidates.map((file) => ({ input: file, origin: "external" as const })),
    ...embedded
      .filter((stream) => selected === undefined || stream.index === selected)
      .filter((stream) =>
        ["subrip", "webvtt", "ass", "ssa", "mov_text", "text"].includes(
          stream.codec
        )
      )
      .map((stream) => ({ stream: stream.index, origin: "embedded" as const }))
  ];
  if (
    embedded.length >
      choices.filter((choice) => choice.origin === "embedded").length &&
    selected === undefined
  )
    warnings.push(
      "bitmap/unsupported embedded subtitle streams skipped; no OCR performed"
    );
  if (selected !== undefined && !choices.length)
    return invalid("selected subtitle stream is not text-convertible");
  return { choices, warnings };
}
async function decodeSubtitle(
  tools: MediaRuntime,
  directory: string,
  input: string,
  choice: SubtitleChoice,
  index: number
): Promise<SubtitleResult> {
  const converted = path.join(directory, "raw", `subtitle-${index}.srt`);
  const files: string[] = [];
  const source = choice.origin === "external" ? choice.input : input;
  if (choice.origin === "external") {
    const sourceFile = `raw/source-${index}${path.extname(source).toLowerCase()}`;
    await copyFile(source, path.join(directory, sourceFile));
    files.push(sourceFile);
    if (!(await readFile(source, "utf8")).trim())
      return { ...choice, segments: [], files };
  }
  await tools.ffmpeg(
    [
      "-i",
      source,
      "-map",
      choice.origin === "external" ? "0:s:0" : `0:${choice.stream}`,
      "-c:s",
      "srt",
      converted
    ],
    "subtitle-conversion"
  );
  files.push(`raw/subtitle-${index}.srt`);
  return {
    ...choice,
    segments: (await readFile(converted, "utf8")).trim()
      ? await tools.subtitles(converted)
      : [],
    files
  };
}
interface AcquisitionCallbacks {
  onAttempt?: (choice: SubtitleChoice | { origin: "asr" }) => void;
  onEmpty?: (result: SubtitleResult & { warnings: string[] }) => Promise<void>;
}
type SubtitleSearch =
  | { status: "found"; result: SubtitleResult; warnings: string[] }
  | { status: "not-found"; warnings: string[] };
async function subtitleEvidence(
  request: {
    tools: MediaRuntime;
    input: string;
    directory: string;
    candidates: string[];
    context: SubtitleContext;
  } & AcquisitionCallbacks
): Promise<SubtitleSearch> {
  const { tools, input, directory, candidates, context, onAttempt, onEmpty } =
    request;
  const { choices, warnings } = subtitleChoices(candidates, context);
  for (const [index, choice] of choices.entries()) {
    onAttempt?.(choice);
    const decoded = await decodeSubtitle(
      tools,
      directory,
      input,
      choice,
      index
    );
    const { segments } = decoded;
    if (segments.some((segment) => segment.text.trim())) {
      if (choice.origin === "embedded")
        warnings.push(
          `selected embedded subtitle stream ${choice.stream}; use --subtitle-stream to choose another language/track`
        );
      return { status: "found", result: decoded, warnings };
    }
    warnings.push(`${choice.origin} subtitle candidate ${index} empty`);
    await onEmpty?.({ ...decoded, warnings: [...warnings] });
  }
  return { status: "not-found", warnings };
}
function selectAudioStream(
  media: MediaInfo,
  input: string,
  requested: number | undefined
): number {
  const audio = media.streams.filter((stream) => stream.type === "audio");
  const firstAudio = audio[0];
  const context = {
    kind: "input" as const,
    stage: "audio-extraction" as const,
    target: input
  };
  if (!firstAudio)
    throw failure(
      {
        ...context,
        reason:
          "ASR requires an audio stream; found none (not silence or an empty transcription)"
      },
      "select an input with the intended audio track, or use subtitles/frames; keep the original input unchanged"
    );
  if (requested === undefined && audio.length > 1)
    throw failure({
      ...context,
      reason: `multiple audio tracks (${audio.map((stream) => stream.index).join(",")}): pass --audio-stream`
    });
  const selected = requested ?? firstAudio.index;
  if (!audio.some((stream) => stream.index === selected))
    throw failure({
      ...context,
      reason: "--audio-stream is not an audio stream"
    });
  return selected;
}
async function asrEvidence({
  tools,
  input,
  directory,
  media,
  options
}: {
  tools: MediaRuntime;
  input: string;
  directory: string;
  media: MediaInfo;
  options: TextOptions;
}): Promise<Extract<TextResult, { origin: "asr" }>> {
  const selected = selectAudioStream(media, input, options.audioStream);
  const wav = path.join(directory, ".process", "audio.wav");
  await tools.ffmpeg(
    [
      "-i",
      input,
      "-map",
      `0:${selected}`,
      "-vn",
      "-ac",
      "1",
      "-ar",
      "16000",
      "-c:a",
      "pcm_s16le",
      wav
    ],
    "audio-extraction"
  );
  const result = await tools.asr({
    audio: wav,
    model: options.model,
    language: options.language,
    initialPrompt: options.initialPrompt
  });
  await rm(wav);
  return {
    ...result,
    origin: "asr",
    stream: selected,
    files: (await readdir(path.join(directory, "raw")))
      .filter((file) => file.startsWith("audio."))
      .map((file) => `raw/${file}`)
  };
}
export async function prepareText(
  request: {
    tools: MediaRuntime;
    source: { input: string; candidates: string[] };
    directory: string;
    media: MediaInfo;
    options: TextOptions;
  } & AcquisitionCallbacks
): Promise<TextResult & { warnings: string[] }> {
  const { tools, source, directory, media, options, onAttempt, onEmpty } =
    request;
  const { input, candidates } = source;
  await mkdir(path.join(directory, "raw"));
  if (options.source === "asr") {
    onAttempt?.({ origin: "asr" });
    return {
      ...(await asrEvidence({ tools, input, directory, media, options })),
      warnings: []
    };
  }
  if (options.source === "external" || options.source === "embedded") {
    const choice: SubtitleChoice =
      options.source === "external"
        ? { input: candidates[0]!, origin: "external" }
        : {
            origin: "embedded",
            stream: options.subtitle.index
          };
    if (choice.origin === "embedded")
      subtitleChoices([], { media, selected: choice.stream });
    onAttempt?.(choice);
    return {
      ...(await decodeSubtitle(tools, directory, input, choice, 0)),
      warnings: []
    };
  }
  const subtitle = await subtitleEvidence({
    tools,
    input,
    directory,
    candidates,
    context: { media, selected: undefined },
    onAttempt,
    onEmpty
  });
  const warnings = subtitle.warnings;
  if (subtitle.status === "not-found") onAttempt?.({ origin: "asr" });
  const result =
    subtitle.status === "not-found"
      ? await asrEvidence({ tools, input, directory, media, options })
      : subtitle.result;
  if (!result.segments.some((segment) => segment.text.trim()))
    warnings.push(
      "no usable text obtained; this is not proof of no speech or no visual information"
    );
  return { ...result, warnings };
}
