/*
 * Synced TypeScript runtime; repository maintenance edits tools/video-understanding/src/query/query-items.ts.
 * Installed skill copies may be edited directly; updates overwrite matching files.
 * Repository: https://github.com/zxyycom/skills
 * Source path: tools/video-understanding/src/query/query-items.ts
 * Maintained source: https://github.com/zxyycom/skills/blob/main/tools/video-understanding/src/query/query-items.ts
 * Skill source directory: https://github.com/zxyycom/skills/tree/main/skills/video-understanding
 * Rebuild: bun run sync:video-understanding-cli
 */
import path from "node:path";
import type { Material, Segment } from "../evidence/evidence.ts";
import { asrLanguageMode } from "../evidence/material.ts";
import type { IndexedRefinement, Snapshot } from "../refinement/refinement.ts";

export interface Interval {
  start: number;
  end: number;
}
export interface ReadItem {
  id: string;
  kind:
    | "material"
    | "transcript"
    | "frame"
    | "observation"
    | "selection"
    | "correction"
    | "description"
    | null;
  availability:
    | "raw"
    | "unadopted"
    | "effective"
    | "revoked"
    | "unavailable"
    | "missing";
  text: string | null;
  refs: string[];
  support: string[];
  ranges: Interval[];
  frames: string[];
  start: number | null;
  end: number | null;
  suppressed: boolean;
  reason: string | null;
  material?: string;
  revision?: number;
  state?: "active" | "revoked";
  segments?: Segment[];
  originalRanges?: Interval[];
  detail?: unknown;
  historical?: boolean;
  applied?: boolean;
}
export type RelatedEvidence = Pick<
  ReadItem,
  | "id"
  | "kind"
  | "availability"
  | "start"
  | "end"
  | "reason"
  | "revision"
  | "state"
  | "material"
>;
function base(
  id: string,
  kind: ReadItem["kind"],
  ranges: Interval[] = []
): ReadItem {
  return {
    id,
    kind,
    availability: "raw",
    text: null,
    refs: [],
    support: [],
    ranges,
    frames: [],
    suppressed: false,
    reason: null,
    start: ranges.length ? Math.min(...ranges.map((r) => r.start)) : null,
    end: ranges.length ? Math.max(...ranges.map((r) => r.end)) : null
  };
}
function unavailable(item: ReadItem, snapshot: Snapshot): ReadItem {
  const reason = snapshot.unavailable.get(item.id);
  return reason
    ? {
        ...item,
        availability: "unavailable",
        text: null,
        reason,
        ...(item.kind === "observation" ? { detail: null } : {})
      }
    : item;
}
export function materialItem(material: Material, snapshot: Snapshot): ReadItem {
  const item = base(material.id, "material");
  const { id: _id, cues, observations, ...detail } = material;
  // No child IDs or raw text in the paged material catalog.
  const unavailableCount = [...cues, ...observations].filter((entry) =>
    snapshot.unavailable.has(entry.id)
  ).length;
  return unavailable(
    {
      ...item,
      detail: {
        ...detail,
        cueCount: cues.length,
        observationCount: observations.length,
        unavailableCount,
        current: !snapshot.unavailable.has(material.id) && !unavailableCount,
        languageMode: asrLanguageMode(material)
      }
    },
    snapshot
  );
}
function rawItem(
  id: string,
  snapshot: Snapshot,
  output: string
): ReadItem | undefined {
  const material = snapshot.index.materials.find((m) => m.id === id);
  if (material) return materialItem(material, snapshot);
  const owner = snapshot.index.materials.find((m) =>
    [...m.cues, ...m.observations].some((c) => c.id === id)
  );
  const cue = owner?.cues.find((c) => c.id === id);
  if (cue) return transcriptItem(cue, owner!.id, snapshot);
  const frame = snapshot.index.frames.entries.find((f) => f.id === id);
  if (frame)
    return unavailable(
      {
        ...base(id, "frame", [{ start: frame.actual, end: frame.actual }]),
        refs: [id],
        detail: { ...frame, path: path.join(output, frame.image.file) }
      },
      snapshot
    );
  const locator = owner?.observations.find((o) => o.id === id);
  if (locator) return observationItem(locator, owner!.id, snapshot);
}
function transcriptItem(
  cue: Material["cues"][number],
  material: string,
  snapshot: Snapshot
): ReadItem {
  return unavailable(
    {
      ...base(cue.id, "transcript", [{ start: cue.start, end: cue.end }]),
      material,
      refs: [cue.id],
      text: snapshot.transcripts.find((c) => c.id === cue.id)?.text ?? null
    },
    snapshot
  );
}
function observationItem(
  locator: Material["observations"][number],
  material: string,
  snapshot: Snapshot
): ReadItem {
  const time = snapshot.index.frames.entries.find(
    (frame) => frame.id === locator.frame
  )!.actual;
  const observation = snapshot.observations.find(
    (item) => item.id === locator.id
  );
  return unavailable(
    {
      ...base(locator.id, "observation", [{ start: time, end: time }]),
      refs: [locator.id],
      frames: [locator.frame],
      material,
      text: observation?.text ?? null,
      detail: observation ?? null
    },
    snapshot
  );
}
function rangesFor(
  ids: string[],
  snapshot: Snapshot,
  output: string
): Interval[] {
  return ids.flatMap((id) => rawItem(id, snapshot, output)?.ranges ?? []);
}
export function calibrationItem(
  entry: IndexedRefinement,
  snapshot: Snapshot,
  output: string
): ReadItem {
  const { pointer, record } = entry;
  const originalRanges = rangesFor(pointer.refs, snapshot, output);
  const segments =
    record?.kind === "correction" ? record.replacement.segments : undefined;
  const ranges = segments?.length
    ? segments.map(({ start, end }) => ({ start, end }))
    : originalRanges;
  const item = {
    ...base(pointer.id, pointer.kind, ranges),
    revision: pointer.revision,
    state: pointer.state,
    refs: pointer.refs,
    support: pointer.support,
    originalRanges
  };
  if (entry.status === "invalid")
    return {
      ...item,
      availability: "unavailable" as const,
      reason: entry.reason,
      text: null
    };
  const valid = entry.record;
  const text =
    valid.kind === "correction"
      ? valid.replacement.segments.map((s) => s.text).join("\n")
      : valid.kind === "selection" && valid.mode === "source"
        ? null
        : valid.text;
  return {
    ...item,
    ...(segments ? { segments } : {}),
    availability: valid.state === "revoked" ? "revoked" : "effective",
    text,
    suppressed:
      valid.kind === "correction" && !valid.replacement.segments.length,
    detail: valid,
    reason: valid.state === "revoked" ? "explicitly revoked; not applied" : null
  };
}
export function ownItem(
  id: string,
  snapshot: Snapshot,
  output: string,
  revision?: number
): ReadItem {
  if (revision === undefined) {
    const raw = rawItem(id, snapshot, output);
    if (raw) return raw;
  }
  const entry = (
    revision === undefined
      ? snapshot.records
      : [...snapshot.history, ...snapshot.records]
  ).find(
    (e) =>
      e.pointer.id === id &&
      (revision === undefined || e.pointer.revision === revision)
  );
  if (entry) {
    const item = calibrationItem(entry, snapshot, output);
    const historical =
      revision !== undefined &&
      snapshot.records.find((e) => e.pointer.id === id)?.pointer.revision !==
        revision;
    return { ...item, historical, applied: false };
  }
  return {
    ...base(id, null),
    availability: "missing",
    reason: "ID/revision not registered in this evidence scope"
  };
}
