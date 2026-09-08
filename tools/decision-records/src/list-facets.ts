import { decisionTimestampMilliseconds } from "./decision-timestamp.ts";
import type {
  DecisionAlignment,
  DecisionIndexState,
  DecisionListFacets,
  DecisionListMonthFacet,
  DecisionListTagFacet,
  DecisionTag,
  EstablishedDecisionStatus
} from "./types.ts";

type DecisionFacetEntry = Readonly<{
  state: Readonly<{
    alignment: DecisionAlignment;
    createdAt: DecisionIndexState["createdAt"];
    status: EstablishedDecisionStatus;
    tags: readonly DecisionTag[];
  }>;
}>;

export function buildDecisionListFacets(
  entries: readonly DecisionFacetEntry[]
): DecisionListFacets {
  const alignments = { aligned: 0, unaligned: 0 };
  const statuses = { active: 0, archived: 0 };
  const tags = new Map<DecisionTag, number>();
  const months = new Map<string, number>();
  let earliestMilliseconds: number | null = null;
  let latestMilliseconds: number | null = null;

  for (const { state } of entries) {
    statuses[state.status] += 1;
    alignments[state.alignment] += 1;
    for (const tag of new Set(state.tags)) increment(tags, tag);

    const milliseconds = decisionTimestampMilliseconds(state.createdAt);
    if (milliseconds === null) {
      throw new TypeError(
        "Decision list facets require a valid createdAt timestamp"
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
    alignments,
    createdAt: {
      earliest: canonicalInstant(earliestMilliseconds),
      latest: canonicalInstant(latestMilliseconds),
      months: monthFacets(months)
    },
    recordCount: entries.length,
    statuses,
    tags: tagFacets(tags)
  };
}

function canonicalInstant(milliseconds: number | null): string | null {
  return milliseconds === null ? null : new Date(milliseconds).toISOString();
}

function monthFacets(
  counts: ReadonlyMap<string, number>
): DecisionListMonthFacet[] {
  return [...counts]
    .sort(([left], [right]) => compareText(left, right))
    .map(([month, count]) => ({ count, month }));
}

function tagFacets(
  counts: ReadonlyMap<DecisionTag, number>
): DecisionListTagFacet[] {
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
