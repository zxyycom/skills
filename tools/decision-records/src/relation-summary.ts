import { unicodeCodePointLength } from "./projection.ts";
import type { DecisionRelation, DecisionRelationSummary } from "./types.ts";

export const relationSummaryMaximumLength = 40;

/** Returns the canonical optional summary, or its validation issue. */
export function normalizeRelationSummary(
  value: unknown
): { summary?: string } | { issue: string } {
  if (typeof value !== "string") {
    return { issue: "must be a string" };
  }
  const summary = value.trim();
  if (summary.length === 0) return {};

  const length = unicodeCodePointLength(summary);
  if (/[\r\n]/.test(summary)) {
    return {
      issue:
        "must be single-line text (actual length " +
        length +
        " Unicode code points)"
    };
  }
  if (length > relationSummaryMaximumLength) {
    return {
      issue:
        "must contain at most " +
        relationSummaryMaximumLength +
        " Unicode code points (actual " +
        length +
        ")"
    };
  }
  return { summary };
}

/** Attaches each CLI summary to exactly one relation in a complete set. */
export function bindRelationSummaries(
  relations: readonly DecisionRelation[],
  summaries: readonly DecisionRelationSummary[]
): { relations: DecisionRelation[] } | { error: string } {
  const summariesByTarget = summariesByTargetMap(summaries);
  if (typeof summariesByTarget === "string")
    return { error: summariesByTarget };
  const targetIssue = relationSummaryTargetIssue(
    summariesByTarget,
    relationTargetCounts(relations)
  );
  if (targetIssue !== null) return { error: targetIssue };
  return {
    relations: relations.map((relation) => {
      const summary = summariesByTarget.get(relation.target);
      return summary === undefined
        ? { ...relation }
        : { ...relation, ...summary };
    })
  };
}

function summariesByTargetMap(
  summaries: readonly DecisionRelationSummary[]
): Map<string, DecisionRelationSummary> | string {
  const byTarget = new Map<string, DecisionRelationSummary>();
  for (const summary of summaries) {
    if (byTarget.has(summary.target)) {
      return "must not repeat a relation-summary target: " + summary.target;
    }
    byTarget.set(summary.target, summary);
  }
  return byTarget;
}

function relationTargetCounts(
  relations: readonly DecisionRelation[]
): ReadonlyMap<string, number> {
  const counts = new Map<string, number>();
  for (const relation of relations) {
    counts.set(relation.target, (counts.get(relation.target) ?? 0) + 1);
  }
  return counts;
}

function relationSummaryTargetIssue(
  summariesByTarget: ReadonlyMap<string, DecisionRelationSummary>,
  counts: ReadonlyMap<string, number>
): string | null {
  for (const target of summariesByTarget.keys()) {
    const count = counts.get(target) ?? 0;
    if (count === 1) continue;
    return count === 0
      ? "relation-summary target is not in the complete relation set: " + target
      : "relation-summary target is not unique in the complete relation set: " +
          target;
  }
  return null;
}
