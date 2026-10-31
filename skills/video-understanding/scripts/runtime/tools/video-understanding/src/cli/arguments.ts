/*
 * Synced TypeScript runtime; repository maintenance edits tools/video-understanding/src/cli/arguments.ts.
 * Installed skill copies may be edited directly; updates overwrite matching files.
 * Repository: https://github.com/zxyycom/skills
 * Source path: tools/video-understanding/src/cli/arguments.ts
 * Maintained source: https://github.com/zxyycom/skills/blob/main/tools/video-understanding/src/cli/arguments.ts
 * Skill source directory: https://github.com/zxyycom/skills/tree/main/skills/video-understanding
 * Rebuild: bun run sync:video-understanding-cli
 */
import { parseArgs } from "node:util";
import type { Region } from "../evidence/evidence.ts";
import {
  frameOptions,
  logOptions,
  mediaOptions,
  ocrOptions,
  prepareOptions,
  readOptions
} from "./argument-commands.ts";
import {
  invalid,
  localPath,
  numberOption,
  optionalLocalPath
} from "./argument-values.ts";

type Format = "text" | "json";
export interface CommonOptions {
  readonly output?: string;
  readonly evidenceRoot?: string;
  readonly format: Format;
  readonly input?: string;
}
export interface MediaOptions extends CommonOptions {
  readonly input: string;
  readonly appRoot?: string;
  readonly timeout: number;
}
export type SubtitleSelection =
  | { readonly mode: "explicit"; readonly file: string }
  | { readonly mode: "embedded"; readonly index: number }
  | { readonly mode: "sibling" };
export type PrepareSelection =
  | {
      readonly source: "external";
      readonly subtitle: Extract<SubtitleSelection, { mode: "explicit" }>;
      readonly region?: never;
    }
  | {
      readonly source: "embedded";
      readonly subtitle: Extract<SubtitleSelection, { mode: "embedded" }>;
      readonly region?: never;
    }
  | {
      readonly source: "auto" | "asr";
      readonly subtitle: Extract<SubtitleSelection, { mode: "sibling" }>;
      readonly region?: never;
    }
  | {
      readonly source: "hard-ocr";
      readonly subtitle: Extract<SubtitleSelection, { mode: "sibling" }>;
      readonly region: Readonly<Region>;
    };
export interface PreparationParameters {
  readonly audioStream?: number;
  readonly language?: string;
  readonly model: string;
  readonly initialPrompt?: string;
  readonly fresh: boolean;
}
export type PrepareOptions = MediaOptions &
  PreparationParameters &
  PrepareSelection & {
    readonly command: "prepare";
  };
export interface OcrOptions extends CommonOptions {
  readonly command: "ocr";
  readonly appRoot?: string;
  readonly timeout: number;
  readonly frames: readonly string[];
  readonly region?: Readonly<Region>;
  readonly fresh: boolean;
}
export interface FrameOptions extends MediaOptions {
  readonly command: "frames";
  readonly times: readonly number[];
  readonly width: number;
}
export interface ReadOptions extends CommonOptions {
  readonly command: "read";
  readonly start: number;
  readonly end?: number;
  readonly limit: number;
  readonly offset: number;
  readonly view: "effective" | "raw" | "calibrations" | "materials";
  readonly id?: string;
  readonly material?: string;
  readonly revision?: number;
}
export interface LogOptions extends CommonOptions {
  readonly command: "logs";
  readonly id?: string;
  readonly limit: number;
  readonly offset: number;
}
export interface RefineOptions extends CommonOptions {
  readonly command: "refine";
  readonly file: string;
}
export type Options =
  | PrepareOptions
  | FrameOptions
  | OcrOptions
  | ReadOptions
  | RefineOptions
  | LogOptions;
export type LocatedOptions<T extends Options> = T & {
  readonly output: string;
  readonly derivedOutput: boolean;
};
export type RawOptions = Partial<
  Record<
    | "config"
    | "input"
    | "output"
    | "evidence-root"
    | "app-root"
    | "subtitle"
    | "subtitle-stream"
    | "audio-stream"
    | "language"
    | "model"
    | "initial-prompt"
    | "timeout"
    | "start"
    | "end"
    | "limit"
    | "offset"
    | "times"
    | "width"
    | "format"
    | "view"
    | "file"
    | "id"
    | "source"
    | "region"
    | "frames"
    | "material"
    | "revision",
    string
  >
> & { fresh?: boolean };
const commandOptions = {
  read: [
    "input",
    "output",
    "format",
    "start",
    "end",
    "limit",
    "offset",
    "view",
    "id",
    "material",
    "revision"
  ],
  logs: ["input", "output", "format", "limit", "offset", "id"],
  frames: [
    "input",
    "output",
    "format",
    "app-root",
    "times",
    "width",
    "timeout"
  ],
  prepare: [
    "input",
    "output",
    "format",
    "app-root",
    "subtitle",
    "subtitle-stream",
    "audio-stream",
    "language",
    "model",
    "initial-prompt",
    "timeout",
    "source",
    "region",
    "fresh"
  ],
  ocr: [
    "input",
    "output",
    "format",
    "app-root",
    "frames",
    "region",
    "fresh",
    "timeout"
  ],
  refine: ["input", "output", "format", "file"]
};
function commandOf(positionals: string[]): Options["command"] {
  const command = positionals[0];
  if (
    positionals.length === 1 &&
    (command === "prepare" ||
      command === "read" ||
      command === "frames" ||
      command === "refine" ||
      command === "logs" ||
      command === "ocr")
  )
    return command;
  return invalid("expected prepare/read/frames/ocr/refine/logs");
}
function rawArguments(argv: string[]) {
  try {
    return parseArgs({
      args: argv,
      allowPositionals: true,
      options: {
        config: { type: "string" },
        input: { type: "string" },
        output: { type: "string" },
        "evidence-root": { type: "string" },
        "app-root": { type: "string" },
        subtitle: { type: "string" },
        "subtitle-stream": { type: "string" },
        "audio-stream": { type: "string" },
        language: { type: "string" },
        model: { type: "string" },
        "initial-prompt": { type: "string" },
        timeout: { type: "string" },
        start: { type: "string" },
        end: { type: "string" },
        limit: { type: "string" },
        offset: { type: "string" },
        times: { type: "string" },
        width: { type: "string" },
        format: { type: "string" },
        view: { type: "string" },
        file: { type: "string" },
        id: { type: "string" },
        help: { type: "boolean" },
        source: { type: "string" },
        region: { type: "string" },
        fresh: { type: "boolean" },
        frames: { type: "string" },
        material: { type: "string" },
        revision: { type: "string" }
      }
    });
  } catch {
    return invalid("invalid flag syntax or unknown option; use --help");
  }
}
function commonOptions(
  values: RawOptions,
  defaults: LocationDefaults
): CommonOptions {
  const format = values.format ?? "text";
  if (format !== "text" && format !== "json") {
    return invalid("--format requires text or json");
  }
  const evidenceRoot = values["evidence-root"] ?? defaults.evidenceRoot;
  const hasEvidenceLocation =
    values.output !== undefined ||
    (values.input !== undefined && evidenceRoot !== undefined);
  if (!hasEvidenceLocation) {
    return invalid(
      "provide --output or --input with --evidence-root or config.json dataRoot to select evidence"
    );
  }
  return {
    output: optionalLocalPath(values.output, "output"),
    evidenceRoot: optionalLocalPath(evidenceRoot, "evidence-root"),
    input: optionalLocalPath(values.input, "input"),
    format
  };
}
export interface LocationDefaults {
  readonly evidenceRoot?: string;
  readonly appRoot?: string;
}
export function parseOptions(
  argv: string[],
  defaults: LocationDefaults = {}
): Options | null {
  return optionsFromArguments(rawArguments(argv), defaults);
}
/** Help is parsed before loading persistent locations; normal arguments are interpreted once. */
export async function parseConfiguredOptions(
  argv: string[],
  defaults: (projectConfigPath?: string) => Promise<LocationDefaults>
): Promise<Options | null> {
  const parsed = rawArguments(argv);
  return parsed.values.help
    ? null
    : optionsFromArguments(
        parsed,
        await defaults(optionalLocalPath(parsed.values.config, "config"))
      );
}
function optionsFromArguments(
  { values, positionals }: ReturnType<typeof rawArguments>,
  defaults: LocationDefaults
): Options | null {
  if (values.help) return null;
  const command = commandOf(positionals);
  validateCommandOptions(values, command);
  const common = commonOptions(values, defaults);
  switch (command) {
    case "read":
      return { command, ...common, ...readOptions(values) };
    case "logs":
      return { command, ...common, ...logOptions(values) };
    case "refine":
      return { command, ...common, file: localPath(values.file, "file") };
    case "frames":
      return {
        command,
        ...mediaOptions(common, values, defaults),
        ...frameOptions(values)
      };
    case "prepare":
      return {
        command,
        ...mediaOptions(common, values, defaults),
        ...prepareOptions(values)
      };
    case "ocr":
      return {
        command,
        ...common,
        appRoot: optionalLocalPath(
          values["app-root"] ?? defaults.appRoot,
          "app-root"
        ),
        timeout: numberOption(values.timeout, 0, "timeout"),
        ...ocrOptions(values)
      };
  }
  const unreachable: never = command;
  return invalid(`unsupported command ${String(unreachable)}`);
}
function validateCommandOptions(
  values: RawOptions,
  command: Options["command"]
): void {
  for (const key of Object.keys(values)) {
    if (
      key !== "evidence-root" &&
      key !== "config" &&
      !commandOptions[command].includes(key)
    )
      return invalid(`--${key} does not apply to ${command}`);
  }
}
