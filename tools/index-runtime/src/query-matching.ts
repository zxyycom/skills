import { compareIndexText } from "./ordering.ts";
import { scalarIdentity } from "./key-values.ts";
import type { StateIndexFilter, StateIndexKeyScalar } from "./types.ts";
import type { MaterializedStateIndexEntry } from "./query-fields.ts";

export function matchesFilter(
  entry: MaterializedStateIndexEntry<object>,
  filter: StateIndexFilter
): boolean {
  const actual = filterValues(entry, filter);
  if (filter.kind === "exists") return actual.length > 0 === filter.value;
  if (filter.kind === "exact") return matchesExact(actual, filter);
  if (filter.kind === "range")
    return actual.some((value) =>
      matchesRange(value, filter.operator, filter.value)
    );
  return matchesText(actual, filter);
}

function filterValues(
  entry: MaterializedStateIndexEntry<object>,
  filter: StateIndexFilter
): readonly StateIndexKeyScalar[] {
  if (filter.key === "id") return [entry.id];
  return entry.queryValues[filter.key] ?? [];
}

function matchesExact(
  actual: readonly StateIndexKeyScalar[],
  filter: Extract<StateIndexFilter, { kind: "exact" }>
): boolean {
  const identities = new Set(actual.map(scalarIdentity));
  const has = (value: StateIndexKeyScalar) =>
    identities.has(scalarIdentity(value));
  if (filter.operator === "all") return filter.values.every(has);
  if (filter.operator === "any") return filter.values.some(has);
  return filter.values.every((value) => !has(value));
}

function matchesText(
  actual: readonly StateIndexKeyScalar[],
  filter: Extract<StateIndexFilter, { kind: "text" }>
): boolean {
  const terms = unique(
    normalizeText(filter.text).split(/\s+/u).filter(Boolean)
  );
  const candidates = actual
    .filter((value): value is string => typeof value === "string")
    .map(normalizeText);
  const contains = (term: string) =>
    candidates.some((candidate) => candidate.includes(term));
  return filter.operator === "all"
    ? terms.every(contains)
    : terms.some(contains);
}

function matchesRange(
  actual: StateIndexKeyScalar,
  operator: "eq" | "gt" | "gte" | "lt" | "lte",
  expected: number | string
): boolean {
  const comparison = compareRangeScalar(actual, expected);
  if (comparison === null) return false;
  return rangeOperatorMatches(comparison, operator);
}

function rangeOperatorMatches(
  comparison: number,
  operator: "eq" | "gt" | "gte" | "lt" | "lte"
): boolean {
  const predicates = {
    eq: (value: number) => value === 0,
    gt: (value: number) => value > 0,
    gte: (value: number) => value >= 0,
    lt: (value: number) => value < 0,
    lte: (value: number) => value <= 0
  };
  return predicates[operator](comparison);
}

function compareRangeScalar(
  actual: StateIndexKeyScalar,
  expected: number | string
): number | null {
  if (typeof actual !== typeof expected || typeof actual === "boolean")
    return null;
  return typeof actual === "number" && typeof expected === "number"
    ? actual - expected
    : compareIndexText(String(actual), String(expected));
}
function normalizeText(value: string): string {
  return value.normalize("NFKC").toLowerCase();
}
function unique<Value>(values: readonly Value[]): Value[] {
  return [...new Set(values)];
}
