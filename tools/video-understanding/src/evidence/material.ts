import {
  digest,
  stableId,
  type Evidence,
  type Material,
  type SourceStamp
} from "./evidence.ts";
import type { PrepareOptions } from "../cli/arguments.ts";
import type { Snapshot } from "../refinement/refinement.ts";
import type { TextSource } from "./text.ts";

export type MaterialFields = Pick<
  Material,
  | "id"
  | "kind"
  | "requestKey"
  | "origin"
  | "parameters"
  | "inputs"
  | "requestedCoverage"
  | "language"
  | "timeMeaning"
  | "cues"
  | "observations"
>;
export function requestKey(
  source: SourceStamp,
  origin: Material["origin"],
  parameters: Material["parameters"],
  inputs: Material["inputs"]
): string {
  return digest(JSON.stringify({ source, origin, parameters, inputs }));
}
export function preparationParameters(
  options: PrepareOptions
): Material["parameters"] {
  if (options.source === "hard-ocr") return { region: options.region };
  if (options.source === "external") return {};
  if (options.source === "embedded")
    return {
      subtitleStream: options.subtitle.index
    };
  return {
    model: options.model,
    language: options.language ?? "unknown",
    ...(options.initialPrompt === undefined
      ? {}
      : { initialPrompt: options.initialPrompt }),
    ...(options.audioStream === undefined
      ? {}
      : { audioStream: options.audioStream })
  };
}
export function subtitleParameters(
  source: TextSource | { readonly origin: "asr" },
  options: PrepareOptions
): Material["parameters"] {
  if (source.origin === "external") return {};
  if (source.origin === "embedded") return { subtitleStream: source.stream };
  return preparationParameters(options);
}
export function nextId(index: Evidence, prefix: "M" | "T" | "O"): string {
  const ids =
    prefix === "M"
      ? index.materials.map((m) => m.id)
      : index.materials.flatMap((m) =>
          prefix === "T"
            ? m.cues.map((c) => c.id)
            : m.observations.map((o) => o.id)
        );
  return stableId(
    prefix,
    Math.max(0, ...ids.map((id) => Number(id.slice(1)))) + 1
  );
}
export function materialFields(
  index: Evidence,
  options: {
    origin: Material["origin"];
    kind: Material["kind"];
    parameters: Material["parameters"];
    inputs?: Material["inputs"];
    duration?: number;
    language?: string;
  }
): MaterialFields {
  const inputs = options.inputs ?? [];
  return {
    id: nextId(index, "M"),
    kind: options.kind,
    origin: options.origin,
    parameters: options.parameters,
    inputs,
    requestKey: requestKey(
      index.source,
      options.origin,
      options.parameters,
      inputs
    ),
    requestedCoverage: options.duration
      ? [{ start: 0, end: options.duration }]
      : [],
    language: options.language ?? "unknown",
    timeMeaning:
      options.origin === "asr"
        ? "estimated-speech"
        : options.origin === "hard-ocr"
          ? "estimated-on-screen"
          : options.origin === "frame-ocr"
            ? "frame-pts"
            : "file-given",
    cues: [],
    observations: []
  };
}
function modelFreeAsrEmpty(material: Material): boolean {
  return (
    material.origin === "asr" &&
    material.status === "empty" &&
    material.provenance.models.length === 0
  );
}
export function reusablePreparation(
  snapshot: Snapshot,
  options: PrepareOptions,
  inputs: Material["inputs"]
): Material | undefined {
  const eligible = snapshot.materials
    .filter((m) => m.status === "valid" && m.material.kind === "subtitle")
    .map((m) => m.material)
    // ASR empty is reusable only with actual model provenance, never a subtitle-conversion/no-audio placeholder.
    .filter((m) => !modelFreeAsrEmpty(m))
    .toReversed();
  if (options.source !== "auto") {
    const parameters = preparationParameters(options);
    const key = requestKey(
      snapshot.index.source,
      options.source,
      parameters,
      inputs
    );
    return eligible.find((m) => m.requestKey === key);
  }
  return reusableAutomaticPreparation(eligible, options, inputs);
}
/** A missing earlier candidate blocks reuse; empty candidates allow the next source. */
function reusableAutomaticPreparation(
  eligible: Material[],
  options: PrepareOptions,
  inputs: Material["inputs"]
): Material | undefined {
  // Auto discovers candidates each time, but a saved material depends only on the source actually used.
  for (const input of inputs) {
    const material = eligible.find((m) => matchesExternalInput(m, input));
    if (!material) return undefined;
    if (material.status === "complete") return material;
  }
  const embedded = eligible.find(
    (m) => m.origin === "embedded" && m.status === "complete"
  );
  if (embedded) return embedded;
  return eligible.find(
    (m) =>
      m.origin === "asr" &&
      JSON.stringify(m.parameters) ===
        JSON.stringify(preparationParameters(options))
  );
}
function matchesExternalInput(
  material: Material,
  input: Material["inputs"][number]
): boolean {
  return (
    material.origin === "external" &&
    material.inputs.length === 1 &&
    material.inputs[0]?.file === input.file &&
    material.inputs[0]?.sha256 === input.sha256
  );
}
/** Request language and tool result are separate; historical unknown results stay unknown. */
export function asrLanguageMode(
  material: Material
): "forced" | "detected" | "unknown" {
  if (
    material.origin !== "asr" ||
    material.language === "unknown" ||
    material.status === "failed" ||
    material.status === "interrupted"
  )
    return "unknown";
  if (modelFreeAsrEmpty(material)) return "unknown";
  if (material.parameters.language === "unknown") return "detected";
  return typeof material.parameters.language === "string"
    ? "forced"
    : "unknown";
}
