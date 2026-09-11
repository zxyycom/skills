import type { InvestigationRelation } from "./types.ts";

export const investigationRelationSummaryMaximumLength = 40;

export type InvestigationRelationSummaryInput = Readonly<{
  summary?: string;
  target: string;
}>;

export function normalizeInvestigationRelationSummary(
  value: string
): string | null {
  const summary = value.trim();
  if (/\r|\n/u.test(value)) {
    throw new TypeError("relation summary must be a single line");
  }
  if (Array.from(summary).length > investigationRelationSummaryMaximumLength) {
    throw new TypeError(
      `relation summary must contain at most ${investigationRelationSummaryMaximumLength} Unicode code points`
    );
  }
  return summary.length === 0 ? null : summary;
}

export function isInvestigationRelationSummary(value: string): boolean {
  try {
    return normalizeInvestigationRelationSummary(value) === value;
  } catch {
    return false;
  }
}

export function bindInvestigationRelationSummaries(
  relations: readonly InvestigationRelation[],
  summaries: readonly InvestigationRelationSummaryInput[]
): { relations: InvestigationRelation[] } | { error: string } {
  const summariesByTarget = uniqueSummaryInputs(summaries);
  if (typeof summariesByTarget === "string")
    return { error: summariesByTarget };
  const summaryTargetError = validateSummaryTargets(
    relations,
    summariesByTarget
  );
  if (summaryTargetError !== null) return { error: summaryTargetError };
  return { relations: applyRelationSummaries(relations, summariesByTarget) };
}

function uniqueSummaryInputs(
  summaries: readonly InvestigationRelationSummaryInput[]
): Map<string, InvestigationRelationSummaryInput> | string {
  const summariesByTarget = new Map<
    string,
    InvestigationRelationSummaryInput
  >();
  for (const summary of summaries) {
    if (summariesByTarget.has(summary.target))
      return `must not repeat a relation-summary target: ${summary.target}`;
    summariesByTarget.set(summary.target, summary);
  }
  return summariesByTarget;
}

function validateSummaryTargets(
  relations: readonly InvestigationRelation[],
  summariesByTarget: ReadonlyMap<string, InvestigationRelationSummaryInput>
): string | null {
  const counts = targetCounts(relations);
  for (const target of summariesByTarget.keys()) {
    const error = summaryTargetError(target, counts.get(target) ?? 0);
    if (error !== null) return error;
  }
  return null;
}

function targetCounts(
  relations: readonly InvestigationRelation[]
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const relation of relations)
    counts.set(relation.target, (counts.get(relation.target) ?? 0) + 1);
  return counts;
}

function summaryTargetError(target: string, count: number): string | null {
  if (count === 1) return null;
  return count === 0
    ? `relation-summary target is not in the complete relation set: ${target}`
    : `relation-summary target is not unique in the complete relation set: ${target}`;
}

function applyRelationSummaries(
  relations: readonly InvestigationRelation[],
  summariesByTarget: ReadonlyMap<string, InvestigationRelationSummaryInput>
): InvestigationRelation[] {
  return relations.map((relation) => {
    const input = summariesByTarget.get(relation.target);
    const summary = summariesByTarget.has(relation.target)
      ? input?.summary
      : relation.summary;
    return {
      type: relation.type,
      target: relation.target,
      ...(summary === undefined ? {} : { summary })
    };
  });
}
