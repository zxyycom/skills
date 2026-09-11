import type {
  RelationGraphTraceAdmissionUnit,
  RelationGraphTraceEventKind,
  RelationGraphTraceExpansionDirection,
  RelationGraphTraceFrontier
} from "./trace-contract.ts";

export function normalizeAdmissionUnits<Id extends string>(
  units: readonly RelationGraphTraceAdmissionUnit<Id>[]
): RelationGraphTraceAdmissionUnit<Id>[] {
  const byIdentity = new Map<string, RelationGraphTraceAdmissionUnit<Id>>();
  for (const unit of units) {
    const recordIds = [...new Set(unit.recordIds)].sort(compareStrings) as Id[];
    const traceIds = [...new Set(unit.traceIds)]
      .filter((id) => recordIds.includes(id))
      .sort(compareStrings) as Id[];
    const identity = `${unit.kind}\u0000${recordIds.join("\u0000")}`;
    const previous = byIdentity.get(identity);
    if (previous === undefined) {
      byIdentity.set(identity, { kind: unit.kind, recordIds, traceIds });
      continue;
    }
    byIdentity.set(identity, {
      kind: unit.kind,
      recordIds,
      traceIds: [...new Set([...previous.traceIds, ...traceIds])].sort(
        compareStrings
      ) as Id[]
    });
  }
  return [...byIdentity.values()].sort(compareAdmissionUnits);
}

function compareAdmissionUnits<Id extends string>(
  left: RelationGraphTraceAdmissionUnit<Id>,
  right: RelationGraphTraceAdmissionUnit<Id>
): number {
  return (
    compareIdSequences(left.traceIds, right.traceIds) ||
    traceEventKindRank(left.kind) - traceEventKindRank(right.kind) ||
    compareIdSequences(left.recordIds, right.recordIds)
  );
}

function compareIdSequences<Id extends string>(
  left: readonly Id[],
  right: readonly Id[]
): number {
  const length = Math.min(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    const compared = compareStrings(left[index] ?? "", right[index] ?? "");
    if (compared !== 0) {
      return compared;
    }
  }
  return left.length - right.length;
}

function traceEventKindRank(kind: RelationGraphTraceEventKind): number {
  switch (kind) {
    case "ordinary":
      return 0;
    case "split":
      return 1;
    case "merge":
      return 2;
    case "reallocation":
      return 3;
  }
}

export function compareTraceFrontier<Id extends string>(
  left: RelationGraphTraceFrontier<Id>,
  right: RelationGraphTraceFrontier<Id>
): number {
  return (
    compareStrings(left.fromId, right.fromId) ||
    traceDirectionRank(left.direction) - traceDirectionRank(right.direction) ||
    traceFrontierReasonRank(left.reason) - traceFrontierReasonRank(right.reason)
  );
}

function traceDirectionRank(
  direction: RelationGraphTraceExpansionDirection
): number {
  return direction === "predecessors" ? 0 : 1;
}

function traceFrontierReasonRank(reason: "depth" | "max-records"): number {
  return reason === "depth" ? 0 : 1;
}

/** Compares text by locale-independent UTF-16 code-unit order. */
export function compareStrings(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
