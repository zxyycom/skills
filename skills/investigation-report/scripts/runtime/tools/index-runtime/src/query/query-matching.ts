/*
 * Synced TypeScript runtime; repository maintenance edits tools/index-runtime/src/query/query-matching.ts.
 * Installed skill copies may be edited directly; updates overwrite matching files.
 * Repository: https://github.com/zxyycom/skills
 * Source path: tools/index-runtime/src/query/query-matching.ts
 * Maintained source: https://github.com/zxyycom/skills/blob/main/tools/index-runtime/src/query/query-matching.ts
 * Skill source directory: https://github.com/zxyycom/skills/tree/main/skills/investigation-report
 * Rebuild: bun run sync:investigation-report-check
 */
import { compareIndexText } from "../protocol/ordering.ts";
import { scalarIdentity } from "../protocol/key-values.ts";
import type { StateIndexFilter, StateIndexKeyScalar } from "../types.ts";
import type { MaterializedStateIndexEntry } from "./query-fields.ts";

export function compileFilter(
  filter: StateIndexFilter
): (entry: MaterializedStateIndexEntry<object>) => boolean {
  if (filter.kind === "exact") {
    const requested = new Set(filter.values.map(scalarIdentity));
    return (entry) =>
      matchesExact(filterValues(entry, filter), filter.operator, requested);
  }
  return (entry) => {
    const actual = filterValues(entry, filter);
    if (filter.kind === "exists") return actual.length > 0 === filter.value;
    if (filter.kind === "range")
      return actual.some((value) =>
        matchesRange(value, filter.operator, filter.value)
      );
    return matchesText(actual, filter);
  };
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
  operator: "all" | "any" | "none",
  requested: ReadonlySet<string>
): boolean {
  if (operator !== "all") {
    const overlaps = actual.some((value) =>
      requested.has(scalarIdentity(value))
    );
    return operator === "any" ? overlaps : !overlaps;
  }
  const matching = new Set<string>();
  for (const value of actual) {
    const identity = scalarIdentity(value);
    if (requested.has(identity)) matching.add(identity);
  }
  return matching.size === requested.size;
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
