/*
 * Synced TypeScript runtime; repository maintenance edits tools/video-understanding/src/runs/run-parameters.ts.
 * Installed skill copies may be edited directly; updates overwrite matching files.
 * Repository: https://github.com/zxyycom/skills
 * Source path: tools/video-understanding/src/runs/run-parameters.ts
 * Maintained source: https://github.com/zxyycom/skills/blob/main/tools/video-understanding/src/runs/run-parameters.ts
 * Skill source directory: https://github.com/zxyycom/skills/tree/main/skills/video-understanding
 * Rebuild: bun run sync:video-understanding-cli
 */
import type {
  FrameOptions,
  LocatedOptions,
  OcrOptions,
  PrepareOptions,
  RefineOptions
} from "../cli/arguments.ts";
import { targetRefs, type Draft } from "../refinement/refinement.ts";
import { safeDiagnostic } from "../failure.ts";

export type WriteOptions = LocatedOptions<
  PrepareOptions | FrameOptions | OcrOptions | RefineOptions
>;
type MediaParameters = { input: string; timeout: number; appRoot?: string };
type PrepareParameters = MediaParameters &
  (
    | { subtitleMode: "explicit"; subtitle: string }
    | { subtitleMode: "embedded"; subtitleStream: number }
    | { subtitleMode: "sibling" }
  ) & {
    audioStream?: number;
    language?: string;
    model: string;
    initialPromptProvided: boolean;
  };
type FrameParameters = MediaParameters & { times: number[]; width: number };
type RefinementDraftParameters = { file: string } & (
  | {
      action: "create";
      kind: "selection" | "correction" | "description";
      refs: string[];
      support: string[];
    }
  | {
      action: "update";
      id: string;
      expectedRevision: number;
      kind: "selection" | "correction" | "description";
      refs: string[];
      support: string[];
    }
  | { action: "revoke"; id: string; expectedRevision: number }
);
type WriteParameters =
  | PrepareParameters
  | FrameParameters
  | { file: string }
  | RefinementDraftParameters
  | { frames: string[]; timeout: number };
export function parameters(options: WriteOptions): WriteParameters {
  if (options.command === "refine") return { file: options.file };
  if (options.command === "ocr")
    return { frames: [...options.frames], timeout: options.timeout };
  const common = {
    input: options.input,
    timeout: options.timeout,
    ...(options.appRoot ? { appRoot: options.appRoot } : {})
  };
  if (options.command === "frames")
    return {
      ...common,
      times: [...options.times],
      width: options.width
    } satisfies FrameParameters;
  const subtitle =
    options.subtitle.mode === "explicit"
      ? { subtitleMode: "explicit" as const, subtitle: options.subtitle.file }
      : options.subtitle.mode === "embedded"
        ? {
            subtitleMode: "embedded" as const,
            subtitleStream: options.subtitle.index
          }
        : { subtitleMode: "sibling" as const };
  return {
    ...common,
    ...subtitle,
    ...(options.audioStream !== undefined
      ? { audioStream: options.audioStream }
      : {}),
    ...(options.language !== undefined
      ? { language: safeDiagnostic(options.language) }
      : {}),
    model: safeDiagnostic(options.model),
    initialPromptProvided: options.initialPrompt !== undefined
  } satisfies PrepareParameters;
}
export function draftParameters(
  file: string,
  draft: Draft
): RefinementDraftParameters {
  switch (draft.action) {
    case "create":
      return {
        file,
        action: draft.action,
        kind: draft.kind,
        refs: targetRefs(draft),
        support: draft.support
      };
    case "update":
      return {
        file,
        action: draft.action,
        id: draft.id,
        expectedRevision: draft.expectedRevision,
        kind: draft.kind,
        refs: targetRefs(draft),
        support: draft.support
      };
    case "revoke":
      return {
        file,
        action: draft.action,
        id: draft.id,
        expectedRevision: draft.expectedRevision
      };
  }
  const unreachable: never = draft;
  throw new Error(`unreachable refinement ${String(unreachable)}`);
}
