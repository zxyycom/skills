/*
 * Synced TypeScript runtime; repository maintenance edits tools/shared/src/graph/trace-ordering.ts.
 * Installed skill copies may be edited directly; updates overwrite matching files.
 * Repository: https://github.com/zxyycom/skills
 * Source path: tools/shared/src/graph/trace-ordering.ts
 * Maintained source: https://github.com/zxyycom/skills/blob/main/tools/shared/src/graph/trace-ordering.ts
 * Skill source directory: https://github.com/zxyycom/skills/tree/main/skills/decision-records
 * Rebuild: bun run sync:decision-records-cli
 */
import { types } from "node:util";
import type {
  RelationGraphTraceAdmissionUnit,
  RelationGraphTraceEventKind,
  RelationGraphTraceExpansionDirection,
  RelationGraphTraceFrontier
} from "./trace-contract.ts";

const standardArrayIterator = Array.prototype[Symbol.iterator];

type RecordMemberFacts<Id extends string> = Readonly<{
  identity: string;
  members: ReadonlySet<Id>;
  recordIds: readonly Id[];
}>;
export type NormalizedTraceAdmissionUnit<Id extends string> = Readonly<{
  identityKind: RelationGraphTraceEventKind;
  recordIdentity: string;
  unit: RelationGraphTraceAdmissionUnit<Id>;
}>;
/** Facts proved and retained only for one trace selection. */
export type TraceAdmissionNormalization<Id extends string> = Readonly<{
  normalizedByUnit: WeakMap<
    RelationGraphTraceAdmissionUnit<Id>,
    NormalizedTraceAdmissionUnit<Id>
  >;
  stableArrays: WeakSet<readonly Id[]>;
  recordMembersByArray: WeakMap<readonly Id[], RecordMemberFacts<Id>>;
}>;
export function createTraceAdmissionNormalization<
  Id extends string
>(): TraceAdmissionNormalization<Id> {
  return {
    normalizedByUnit: new WeakMap(),
    stableArrays: new WeakSet(),
    recordMembersByArray: new WeakMap()
  };
}
export function normalizeAdmissionUnits<Id extends string>(
  units: readonly RelationGraphTraceAdmissionUnit<Id>[],
  context: TraceAdmissionNormalization<Id>
): RelationGraphTraceAdmissionUnit<Id>[] {
  const positions = new Map<RelationGraphTraceEventKind, Map<string, number>>();
  const ordered: RelationGraphTraceAdmissionUnit<Id>[] = [];
  for (const unit of units) {
    const normalized = normalizeAdmissionUnit(unit, context);
    const current = normalized.unit;
    let members = positions.get(normalized.identityKind);
    if (members === undefined) {
      members = new Map();
      positions.set(normalized.identityKind, members);
    }
    const position = members.get(normalized.recordIdentity);
    if (position === undefined) {
      members.set(normalized.recordIdentity, ordered.length);
      ordered.push(current);
      continue;
    }
    const previous = ordered[position]!;
    ordered[position] = {
      kind: current.kind,
      recordIds: current.recordIds,
      traceIds: [...new Set([...previous.traceIds, ...current.traceIds])].sort(
        compareStrings
      ) as Id[]
    };
  }
  return ordered.sort(compareAdmissionUnits);
}
function normalizeAdmissionUnit<Id extends string>(
  unit: RelationGraphTraceAdmissionUnit<Id>,
  context: TraceAdmissionNormalization<Id>
): NormalizedTraceAdmissionUnit<Id> {
  // Frozen own data remains stable; inherited Array iteration must still match.
  const cached = context.normalizedByUnit.get(unit);
  if (cached !== undefined && hasStandardArrayIterator()) return cached;
  const reusable = hasStableAdmissionData(unit, context.stableArrays);
  if (!reusable) return normalizeDynamicAdmissionUnit(unit);
  const facts = stableRecordMembers(unit.recordIds, context);
  const traceIds = [...new Set(unit.traceIds)]
    .filter((id) => facts.members.has(id))
    .sort(compareStrings) as Id[];
  // Keep the dynamic fallback's two kind reads, and its original value identity.
  const normalized = {
    identityKind: unit.kind,
    recordIdentity: facts.identity,
    unit: { kind: unit.kind, recordIds: facts.recordIds, traceIds }
  };
  context.normalizedByUnit.set(unit, normalized);
  return normalized;
}
/** Preserve dynamic getters and iterator evaluation in the original order. */
function normalizeDynamicAdmissionUnit<Id extends string>(
  unit: RelationGraphTraceAdmissionUnit<Id>
): NormalizedTraceAdmissionUnit<Id> {
  const recordMembers = new Set(unit.recordIds);
  const recordIds = [...recordMembers].sort(compareStrings) as Id[];
  const traceIds = [...new Set(unit.traceIds)]
    .filter((id) => recordMembers.has(id))
    .sort(compareStrings) as Id[];
  return {
    identityKind: unit.kind,
    recordIdentity: recordIds.join("\u0000"),
    unit: { kind: unit.kind, recordIds, traceIds }
  };
}

function stableRecordMembers<Id extends string>(
  ids: readonly Id[],
  context: TraceAdmissionNormalization<Id>
): RecordMemberFacts<Id> {
  let facts = context.recordMembersByArray.get(ids);
  if (facts === undefined) {
    facts = recordMemberFacts(ids);
    context.recordMembersByArray.set(ids, facts);
  }
  return facts;
}
function recordMemberFacts<Id extends string>(
  ids: readonly Id[]
): RecordMemberFacts<Id> {
  const members = new Set(ids);
  const recordIds = [...members].sort(compareStrings) as Id[];
  return { identity: recordIds.join("\u0000"), members, recordIds };
}
function hasStableAdmissionData<Id extends string>(
  unit: RelationGraphTraceAdmissionUnit<Id>,
  stableArrays: WeakSet<readonly Id[]>
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
    hasStableIdArray(recordIds?.value, stableArrays) &&
    hasStableIdArray(traceIds?.value, stableArrays)
  );
}
function hasStableIdArray<Id extends string>(
  ids: unknown,
  stableArrays: WeakSet<readonly Id[]>
): boolean {
  if (!Array.isArray(ids) || types.isProxy(ids) || !hasStandardArrayIterator())
    return false;
  if (stableArrays.has(ids)) return true;
  if (
    !Object.isFrozen(ids) ||
    Object.getPrototypeOf(ids) !== Array.prototype ||
    Object.hasOwn(ids, Symbol.iterator)
  )
    return false;
  for (let index = 0; index < ids.length; index += 1) {
    const item = Object.getOwnPropertyDescriptor(ids, index);
    if (
      item === undefined ||
      !Object.hasOwn(item, "value") ||
      typeof item.value !== "string"
    )
      return false;
  }
  stableArrays.add(ids);
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
  if (left === right) return 0;
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
