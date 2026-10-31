import type { LocatedOptions, ReadOptions } from "../cli/arguments.ts";
import { failure } from "../failure.ts";
import type { Snapshot } from "../refinement/refinement.ts";
import {
  ownItem,
  type Interval,
  type ReadItem,
  type RelatedEvidence
} from "./query-items.ts";
import { evidenceItems } from "./query-views.ts";
export { formatQuery } from "./query-format.ts";
export type { ReadItem, RelatedEvidence } from "./query-items.ts";

// Half a centisecond accepts a duration rounded to two decimal places, not arbitrary overshoot.
const readEndRoundingTolerance = 0.005;
function intersects(range: Interval, start: number, end: number): boolean {
  return (
    (range.end > start ||
      (range.end === range.start && range.start >= start)) &&
    range.start < end
  );
}
function queryWindow(
  snapshot: Snapshot,
  options: LocatedOptions<ReadOptions>
): Interval | null {
  if (
    options.id ||
    options.view === "calibrations" ||
    options.view === "materials"
  )
    return null;
  const duration = snapshot.index.duration;
  if (duration === null) {
    const hasRawEntries =
      snapshot.index.frames.entries.length ||
      snapshot.index.materials.some(
        (material) => material.cues.length || material.observations.length
      );
    if (!hasRawEntries) return null;
    throw failure({
      kind: "inconsistent",
      stage: "read",
      target: options.output,
      reason: "no published media duration"
    });
  }
  return readWindowWithinDuration(duration, options);
}
function readWindowWithinDuration(
  duration: number,
  options: LocatedOptions<ReadOptions>
): Interval {
  const requestedEnd = options.end ?? duration;
  const end =
    requestedEnd > duration &&
    requestedEnd <= duration + readEndRoundingTolerance
      ? duration
      : requestedEnd;
  if (end <= options.start || end > duration) {
    throw failure(
      {
        kind: "input",
        stage: "read",
        target: options.output,
        reason: `window must be within duration with end > start: start=${options.start} end=${requestedEnd} duration=${duration}; read end tolerance=${readEndRoundingTolerance} seconds`
      },
      `use 0 <= --start < --end <= ${duration}; omit --end to read to the exact duration (start must remain below ${duration})`
    );
  }
  return { start: options.start, end };
}
function compact(item: ReadItem): RelatedEvidence {
  return {
    id: item.id,
    kind: item.kind,
    availability: item.availability,
    start: item.start,
    end: item.end,
    reason: item.reason,
    ...(item.material ? { material: item.material } : {}),
    ...(item.revision ? { revision: item.revision, state: item.state } : {})
  };
}
function compareIds(left: string, right: string): number {
  return (
    left[0]!.localeCompare(right[0]!) ||
    Number(left.slice(1)) - Number(right.slice(1))
  );
}
function relatedEvidence(items: ReadItem[], snapshot: Snapshot): string[] {
  const relatedIds = new Set(
    items.flatMap((item) => [
      ...item.refs,
      ...item.support,
      ...item.frames,
      ...(item.material ? [item.material] : [])
    ])
  );
  for (const item of items) {
    for (const id of referringCalibrations(item, snapshot)) relatedIds.add(id);
  }
  return [...relatedIds]
    .filter((id) => !items.some((item) => item.id === id))
    .sort(compareIds);
}
function referringCalibrations(item: ReadItem, snapshot: Snapshot): string[] {
  if (!["transcript", "frame", "observation"].includes(item.kind ?? ""))
    return [];
  return snapshot.records
    .filter(
      ({ pointer }) =>
        pointer.refs.includes(item.id) || pointer.support.includes(item.id)
    )
    .map(({ pointer }) => pointer.id);
}
function selectionSummary(
  snapshot: Snapshot,
  options: LocatedOptions<ReadOptions>
) {
  if (options.view !== "effective" || options.id) return null;
  const selection = snapshot.records.find(
    (entry) =>
      entry.pointer.kind === "selection" && entry.pointer.state === "active"
  );
  if (!selection) return null;
  const identity = {
    id: selection.pointer.id,
    revision: selection.pointer.revision,
    availability: selection.status === "valid" ? "effective" : "unavailable"
  };
  if (selection.status !== "valid" || selection.record.kind !== "selection")
    return identity;
  const record = selection.record;
  return {
    ...identity,
    mode: record.mode,
    purpose: record.purpose,
    reason: record.reason,
    verified: {
      refs: record.verified.refs.slice(0, 80),
      remaining: Math.max(0, record.verified.refs.length - 80),
      note: record.verified.note
    }
  };
}
function windowItems(items: ReadItem[], window: Interval | null): ReadItem[] {
  return items
    .filter(
      (i) =>
        !window ||
        !i.ranges.length ||
        i.ranges.some((r) => intersects(r, window.start, window.end))
    )
    .sort((a, b) =>
      window
        ? (a.start ?? 0) - (b.start ?? 0) || compareIds(a.id, b.id)
        : compareIds(a.id, b.id)
    );
}
function queryWarnings(
  items: ReadItem[],
  snapshot: Snapshot,
  options: LocatedOptions<ReadOptions>,
  window: Interval | null
): string[] {
  const materialIds = new Set(items.flatMap((item) => materialIdentity(item)));
  const warnings = snapshot.index.materials
    .filter((material) => materialIds.has(material.id))
    .flatMap((material) => materialWarnings(material));
  return [
    ...(window && options.end !== undefined && options.end !== window.end
      ? [
          `read window end normalized: requestedEnd=${options.end} end=${window.end} duration=${snapshot.index.duration} tolerance=${readEndRoundingTolerance} seconds; evidence unchanged`
        ]
      : []),
    ...warnings,
    ...snapshot.records
      .filter((e) => e.pointer.state === "active" && e.status === "invalid")
      .map(
        (e) =>
          `${e.pointer.id} unavailable; ${e.pointer.kind === "selection" ? "no automatic adoption fallback" : "original fallback where valid"}`
      )
  ];
}
function materialIdentity(item: ReadItem): string[] {
  if (item.kind === "material") return [item.id];
  return item.material ? [item.material] : [];
}
function materialWarnings(
  material: Snapshot["index"]["materials"][number]
): string[] {
  return "warnings" in material
    ? material.warnings.map((warning) => `${material.id}: ${warning}`)
    : [];
}
export function queryEvidence(
  snapshot: Snapshot,
  options: LocatedOptions<ReadOptions>
) {
  const window = queryWindow(snapshot, options);
  const projection = options.id
    ? {
        items: [
          ownItem(options.id, snapshot, options.output, options.revision)
        ],
        adoption: "id"
      }
    : evidenceItems(snapshot, options);
  const selected = windowItems(projection.items, window);
  const offset = options.id ? 0 : options.offset;
  const items = selected.slice(offset, offset + options.limit);
  const remaining = Math.max(0, selected.length - offset - items.length);
  const related = relatedEvidence(items, snapshot);
  return {
    version: 5,
    output: options.output,
    scopeId: snapshot.index.scopeId,
    view: options.id ? "id" : options.view,
    requestedId: options.id ?? null,
    duration: snapshot.index.duration,
    adoption: projection.adoption,
    frameStatus: snapshot.index.frames.attempt.status,
    selection: selectionSummary(snapshot, options),
    warnings: queryWarnings(items, snapshot, options, window),
    window,
    offset,
    total: selected.length,
    remaining,
    nextOffset: remaining ? offset + items.length : null,
    items,
    related: related
      .slice(0, 80)
      .map((id) => compact(ownItem(id, snapshot, options.output))),
    relatedRemaining: Math.max(0, related.length - 80)
  };
}
export type QueryResult = ReturnType<typeof queryEvidence>;
