/*
 * Synced TypeScript runtime; repository maintenance edits tools/investigation-report/src/relations/relation-review.ts.
 * Installed skill copies may be edited directly; updates overwrite matching files.
 * Repository: https://github.com/zxyycom/skills
 * Source path: tools/investigation-report/src/relations/relation-review.ts
 * Maintained source: https://github.com/zxyycom/skills/blob/main/tools/investigation-report/src/relations/relation-review.ts
 * Skill source directory: https://github.com/zxyycom/skills/tree/main/skills/investigation-report
 * Rebuild: bun run sync:investigation-report-check
 */
import type {
  InvestigationIndexState,
  InvestigationRelation,
  InvestigationRelationReview,
  InvestigationRelationReviewSource,
  InvestigationRelationReviewPhase,
  InvestigationRelationReviewAction,
  InvestigationSource
} from "../types.ts";

export function relationReview(
  phase: InvestigationRelationReviewPhase,
  sources: readonly Readonly<{
    sourceId: string;
    action: InvestigationRelationReviewAction;
    before: readonly InvestigationRelation[];
    after: readonly InvestigationRelation[];
  }>[]
): InvestigationRelationReview {
  return {
    phase,
    sources: sources
      .map((source): InvestigationRelationReviewSource => ({
        action: source.action,
        after: source.after.map(copyRelation),
        before: source.before.map(copyRelation),
        sourceId: source.sourceId
      }))
      .sort((left, right) => compareText(left.sourceId, right.sourceId))
  };
}

/** Classifies complete replacement sets before copying them into the review. */
export function replacementRelationReview(
  phase: InvestigationRelationReviewPhase,
  sources: readonly Readonly<{
    sourceId: string;
    before: readonly InvestigationRelation[];
    after: readonly InvestigationRelation[];
  }>[]
): InvestigationRelationReview {
  return relationReview(
    phase,
    sources.map((source) => ({
      ...source,
      action: relationSetsEqual(source.before, source.after)
        ? "unchanged"
        : "replace"
    }))
  );
}

export function relationSetsEqual(
  left: readonly InvestigationRelation[],
  right: readonly InvestigationRelation[]
): boolean {
  return (
    left.length === right.length &&
    left.every(
      (relation, index) =>
        relation.type === right[index]?.type &&
        relation.target === right[index]?.target &&
        relation.summary === right[index]?.summary
    )
  );
}

/** Reviews publication's selected candidate relations as newly established sources. */
export function establishedRelationReview(
  phase: InvestigationRelationReviewPhase,
  sources: readonly InvestigationSource[],
  states: ReadonlyMap<string, InvestigationIndexState>
): InvestigationRelationReview {
  return relationReview(
    phase,
    sources.map((source) => {
      const relations = states.get(source.id)?.relations ?? [];
      return {
        sourceId: source.id,
        action: "establish" as const,
        before: relations,
        after: relations
      };
    })
  );
}

function copyRelation(relation: InvestigationRelation): InvestigationRelation {
  return { ...relation };
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
