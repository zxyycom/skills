import { investigationTimestampMilliseconds } from "./timestamp.ts";
import type {
  InvestigationIndexState,
  InvestigationListFacets,
  InvestigationListMonthFacet,
  InvestigationListTagFacet
} from "./types.ts";

type InvestigationFacetEntry = Readonly<{
  state: Readonly<{
    formedAt: InvestigationIndexState["formedAt"];
    tags: readonly string[];
  }>;
}>;

export function buildInvestigationListFacets(
  entries: readonly InvestigationFacetEntry[]
): InvestigationListFacets {
  const tags = new Map<string, number>();
  const months = new Map<string, number>();
  let earliestMilliseconds: number | null = null;
  let latestMilliseconds: number | null = null;

  for (const { state } of entries) {
    for (const tag of new Set(state.tags)) increment(tags, tag);
    const milliseconds = investigationTimestampMilliseconds(state.formedAt);
    if (milliseconds === null) {
      throw new TypeError(
        "Investigation list facets require a valid formedAt timestamp"
      );
    }
    const canonical = new Date(milliseconds).toISOString();
    increment(months, canonical.slice(0, 7));
    earliestMilliseconds =
      earliestMilliseconds === null
        ? milliseconds
        : Math.min(earliestMilliseconds, milliseconds);
    latestMilliseconds =
      latestMilliseconds === null
        ? milliseconds
        : Math.max(latestMilliseconds, milliseconds);
  }

  return {
    formedAt: {
      earliest: canonicalInstant(earliestMilliseconds),
      latest: canonicalInstant(latestMilliseconds),
      months: monthFacets(months)
    },
    recordCount: entries.length,
    tags: tagFacets(tags)
  };
}

function canonicalInstant(milliseconds: number | null): string | null {
  return milliseconds === null ? null : new Date(milliseconds).toISOString();
}

function monthFacets(
  counts: ReadonlyMap<string, number>
): InvestigationListMonthFacet[] {
  return [...counts]
    .sort(([left], [right]) => compareText(left, right))
    .map(([month, count]) => ({ count, month }));
}

function tagFacets(
  counts: ReadonlyMap<string, number>
): InvestigationListTagFacet[] {
  return [...counts]
    .sort(([left], [right]) => compareText(left, right))
    .map(([tag, count]) => ({ count, tag }));
}

function increment<Value extends string>(
  counts: Map<Value, number>,
  value: Value
): void {
  counts.set(value, (counts.get(value) ?? 0) + 1);
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
