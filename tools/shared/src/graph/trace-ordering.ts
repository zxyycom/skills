import type {
  RelationGraphTraceAdmissionUnit,
  RelationGraphTraceEventKind,
  RelationGraphTraceExpansionDirection,
  RelationGraphTraceFrontier
} from "./trace-contract.ts";

const standardArrayIterator = Array.prototype[Symbol.iterator];

export type NormalizedTraceAdmissionUnit<Id extends string> = Readonly<{
  identity: string;
  unit: RelationGraphTraceAdmissionUnit<Id>;
}>;

export function normalizeAdmissionUnits<Id extends string>(
  units: readonly RelationGraphTraceAdmissionUnit<Id>[],
  normalizedByUnit: WeakMap<
    RelationGraphTraceAdmissionUnit<Id>,
    NormalizedTraceAdmissionUnit<Id>
  >
): RelationGraphTraceAdmissionUnit<Id>[] {
  const byIdentity = new Map<string, RelationGraphTraceAdmissionUnit<Id>>();
  for (const unit of units) {
    const normalized = normalizeAdmissionUnit(unit, normalizedByUnit);
    const { identity, unit: current } = normalized;
    const previous = byIdentity.get(identity);
    if (previous === undefined) {
      byIdentity.set(identity, current);
      continue;
    }
    byIdentity.set(identity, {
      kind: current.kind,
      recordIds: current.recordIds,
      traceIds: [...new Set([...previous.traceIds, ...current.traceIds])].sort(
        compareStrings
      ) as Id[]
    });
  }
  return [...byIdentity.values()].sort(compareAdmissionUnits);
}

function normalizeAdmissionUnit<Id extends string>(
  unit: RelationGraphTraceAdmissionUnit<Id>,
  normalizedByUnit: WeakMap<
    RelationGraphTraceAdmissionUnit<Id>,
    NormalizedTraceAdmissionUnit<Id>
  >
): NormalizedTraceAdmissionUnit<Id> {
  // 单位与数组的 own data 已在首次准入时证明；继承的 iterator 仍可改变。
  const cached = normalizedByUnit.get(unit);
  if (cached !== undefined && hasStandardArrayIterator()) return cached;
  const reusable = hasStableAdmissionData(unit);
  const recordMembers = new Set(unit.recordIds);
  const recordIds = [...recordMembers].sort(compareStrings) as Id[];
  const traceIds = [...new Set(unit.traceIds)]
    .filter((id) => recordMembers.has(id))
    .sort(compareStrings) as Id[];
  const normalized = {
    identity: `${unit.kind}\u0000${recordIds.join("\u0000")}`,
    unit: { kind: unit.kind, recordIds, traceIds }
  };
  if (reusable) normalizedByUnit.set(unit, normalized);
  return normalized;
}

function hasStableAdmissionData<Id extends string>(
  unit: RelationGraphTraceAdmissionUnit<Id>
): boolean {
  if (!Object.isFrozen(unit)) return false;
  const kind = Object.getOwnPropertyDescriptor(unit, "kind");
  const recordIds = Object.getOwnPropertyDescriptor(unit, "recordIds");
  const traceIds = Object.getOwnPropertyDescriptor(unit, "traceIds");
  if (
    ![kind, recordIds, traceIds].every(
      (property) => property !== undefined && Object.hasOwn(property, "value")
    )
  )
    return false;
  return (
    hasStableIdArray(recordIds?.value) && hasStableIdArray(traceIds?.value)
  );
}

function hasStableIdArray(ids: unknown): boolean {
  if (!Array.isArray(ids)) {
    return false;
  }
  if (!Object.isFrozen(ids)) {
    return false;
  }
  if (Object.getPrototypeOf(ids) !== Array.prototype) {
    return false;
  }
  if (Object.hasOwn(ids, Symbol.iterator)) {
    return false;
  }
  if (!hasStandardArrayIterator()) {
    return false;
  }
  for (let index = 0; index < ids.length; index += 1) {
    const item = Object.getOwnPropertyDescriptor(ids, index);
    if (item === undefined) {
      return false;
    }
    if (!Object.hasOwn(item, "value")) {
      return false;
    }
    if (typeof item.value !== "string") {
      return false;
    }
  }
  return true;
}

function hasStandardArrayIterator(): boolean {
  return (
    Object.getOwnPropertyDescriptor(Array.prototype, Symbol.iterator)?.value ===
    standardArrayIterator
  );
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
