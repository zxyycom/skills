/*
 * Synced TypeScript runtime; repository maintenance edits tools/video-understanding/src/argument-commands.ts.
 * Installed skill copies may be edited directly; updates overwrite matching files.
 * Repository: https://github.com/zxyycom/skills
 * Source path: tools/video-understanding/src/argument-commands.ts
 * Maintained source: https://github.com/zxyycom/skills/blob/main/tools/video-understanding/src/argument-commands.ts
 * Skill source directory: https://github.com/zxyycom/skills/tree/main/skills/video-understanding
 * Rebuild: bun run sync:video-understanding-cli
 */
import * as v from "valibot";
import { ScopeSchema, type Region } from "./evidence.ts";
import type {
  CommonOptions,
  FrameOptions,
  LocationDefaults,
  LogOptions,
  MediaOptions,
  OcrOptions,
  PrepareOptions,
  PreparationParameters,
  PrepareSelection,
  RawOptions,
  ReadOptions,
  SubtitleSelection
} from "./arguments.ts";
import {
  invalid,
  localPath,
  numberOption,
  optionalLocalPath
} from "./argument-values.ts";

const ReadViewSchema = v.picklist([
  "effective",
  "raw",
  "calibrations",
  "materials"
]);
const SubtitleSourceSchema = v.picklist([
  "auto",
  "external",
  "embedded",
  "asr",
  "hard-ocr"
]);
export function frameOptions(
  values: RawOptions
): Pick<FrameOptions, "times" | "width"> {
  const times =
    values.times?.split(",").map((value) => numberOption(value, 0, "times")) ??
    [];
  if (!times.length || times.length > 8)
    return invalid("--times requires 1..8 seconds values");
  const width = numberOption(values.width, 960, "width", true);
  if (width > 3840)
    return invalid("--width requires 0..3840 (0 preserves source size)");
  return { times, width };
}
export function readOptions(
  values: RawOptions
): Omit<ReadOptions, keyof CommonOptions | "command"> {
  const paging = pageOptions(values);
  const view = readView(values);
  const revision = readRevision(values);
  validateIdSelection(values);
  return {
    start: numberOption(values.start, 0, "start"),
    end: numberOption(values.end, undefined, "end"),
    ...paging,
    view,
    id: values.id,
    material: values.material,
    revision
  };
}
function readView(values: RawOptions): ReadOptions["view"] {
  const view = values.view ?? "effective";
  if (!v.is(ReadViewSchema, view)) {
    return invalid("--view requires effective, raw, materials or calibrations");
  }
  const catalogWindow =
    ["calibrations", "materials"].includes(view) &&
    [values.start, values.end].some((value) => value !== undefined);
  if (catalogWindow) {
    return invalid(`${view} view has no time window`);
  }
  if (
    values.material !== undefined &&
    (view !== "raw" || !/^M\d{4,}$/.test(values.material))
  ) {
    return invalid("--material requires raw view and an M ID");
  }
  return view;
}
function readRevision(values: RawOptions): number | undefined {
  if (
    values.revision !== undefined &&
    (!values.id || !/^[SCD]/.test(values.id))
  )
    return invalid("--revision requires an S/C/D ID");
  const revision = numberOption(values.revision, undefined, "revision", true);
  if (revision === 0) return invalid("--revision requires a positive integer");
  return revision;
}
function validateIdSelection(values: RawOptions): void {
  if (values.id === undefined) return;
  if (!/^[MTFOSCD]\d{4,}$/.test(values.id))
    return invalid("--id requires an M/T/F/O/S/C/D evidence ID");
  const conflicting = [
    values.start,
    values.end,
    values.limit,
    values.offset,
    values.view,
    values.material
  ];
  if (conflicting.some((value) => value !== undefined))
    return invalid(
      "--id selects itself and cannot combine with window, pagination or view"
    );
}
function pageOptions(
  values: RawOptions
): Pick<ReadOptions, "limit" | "offset"> {
  const limit = numberOption(values.limit, 80, "limit", true);
  if (!limit || limit > 500) return invalid("--limit requires 1..500 items");
  return { limit, offset: numberOption(values.offset, 0, "offset", true) };
}
export function logOptions(
  values: RawOptions
): Omit<LogOptions, keyof CommonOptions | "command"> {
  if (values.id !== undefined && !v.is(ScopeSchema, values.id))
    return invalid("--id requires a run UUID");
  if (
    values.id !== undefined &&
    (values.limit !== undefined || values.offset !== undefined)
  )
    return invalid("logs --id cannot combine with pagination");
  return { ...pageOptions(values), id: values.id };
}
function subtitleSelection(values: RawOptions): SubtitleSelection {
  if (values.subtitle !== undefined && values["subtitle-stream"] !== undefined)
    return invalid("choose --subtitle or --subtitle-stream, not both");
  const index = numberOption(
    values["subtitle-stream"],
    undefined,
    "subtitle-stream",
    true
  );
  if (values.subtitle !== undefined)
    return { mode: "explicit", file: localPath(values.subtitle, "subtitle") };
  if (index !== undefined) return { mode: "embedded", index };
  return { mode: "sibling" };
}
function subtitleSource(
  values: RawOptions,
  subtitle: SubtitleSelection
):
  | Exclude<PrepareSelection, { source: "hard-ocr" }>
  | {
      readonly source: "hard-ocr";
      readonly subtitle: Extract<SubtitleSelection, { mode: "sibling" }>;
    } {
  const defaults = {
    explicit: "external",
    embedded: "embedded",
    sibling: "auto"
  } as const;
  const source = values.source ?? defaults[subtitle.mode];
  if (!v.is(SubtitleSourceSchema, source)) {
    return invalid("invalid --source");
  }
  if (source === "external") {
    if (subtitle.mode !== "explicit")
      return invalid(
        "external/embedded source requires explicit subtitle/stream"
      );
    return { source, subtitle };
  }
  if (source === "embedded") {
    if (subtitle.mode !== "embedded")
      return invalid(
        "external/embedded source requires explicit subtitle/stream"
      );
    return { source, subtitle };
  }
  if (subtitle.mode !== "sibling")
    return invalid("source conflicts with subtitle selection");
  return { source, subtitle };
}
function asrOptions(
  values: RawOptions,
  source: PrepareOptions["source"]
): Pick<
  PrepareOptions,
  "audioStream" | "language" | "model" | "initialPrompt"
> {
  const hasAsrParameters = [
    values["audio-stream"],
    values.language,
    values.model,
    values["initial-prompt"]
  ].some((value) => value !== undefined);
  if (!["auto", "asr"].includes(source) && hasAsrParameters) {
    return invalid("ASR parameters only apply to auto/asr");
  }
  if (values.language !== undefined && !values.language.trim()) {
    return invalid(
      "--language requires a nonempty spoken language code; omit it for automatic detection"
    );
  }
  return {
    audioStream: numberOption(
      values["audio-stream"],
      undefined,
      "audio-stream",
      true
    ),
    language: values.language,
    model: values.model ?? "small",
    initialPrompt: values["initial-prompt"]
  };
}
export function prepareOptions(
  values: RawOptions
): PrepareSelection & PreparationParameters {
  const subtitle = subtitleSelection(values);
  const selection = subtitleSource(values, subtitle);
  const asr = asrOptions(values, selection.source);
  const region = regionOption(values.region);
  if (selection.source === "hard-ocr") {
    if (!region)
      return invalid(
        "hard-ocr requires --region; other subtitle sources do not accept it"
      );
    return { ...selection, region, fresh: values.fresh ?? false, ...asr };
  }
  if (region) {
    return invalid(
      "hard-ocr requires --region; other subtitle sources do not accept it"
    );
  }
  return {
    ...selection,
    fresh: values.fresh ?? false,
    region,
    ...asr
  };
}
function regionOption(value?: string): Region | undefined {
  if (value === undefined) return undefined;
  const parts = value.split(",").map((x) => Number(x));
  if (
    parts.length !== 4 ||
    value.split(",").some((x) => !/^\d+$/.test(x)) ||
    parts.some((x) => !Number.isSafeInteger(x)) ||
    !parts[2] ||
    !parts[3]
  )
    return invalid(
      "--region requires integer x,y,w,h with nonnegative origin and positive size"
    );
  return { x: parts[0]!, y: parts[1]!, w: parts[2]!, h: parts[3]! };
}
export function ocrOptions(
  values: RawOptions
): Pick<OcrOptions, "frames" | "region" | "fresh"> {
  const frames = values.frames?.split(",") ?? [];
  if (
    !frames.length ||
    frames.length > 8 ||
    new Set(frames).size !== frames.length ||
    frames.some((id) => !/^F\d{4,}$/.test(id))
  )
    return invalid("--frames requires 1..8 unique F IDs");
  return {
    frames,
    region: regionOption(values.region),
    fresh: values.fresh ?? false
  };
}
export function mediaOptions(
  common: CommonOptions,
  values: RawOptions,
  defaults: LocationDefaults
): MediaOptions {
  if (common.input === undefined)
    return invalid("--input requires an absolute local path");
  return {
    ...common,
    input: common.input,
    appRoot: optionalLocalPath(
      values["app-root"] ?? defaults.appRoot,
      "app-root"
    ),
    timeout: numberOption(values.timeout, 0, "timeout")
  };
}
