import type {
  InvestigationIndexState,
  InvestigationRelation,
  InvestigationRelationReview,
  InvestigationRelationReviewSource,
  InvestigationRelationReviewPhase,
  InvestigationRelationReviewAction,
  InvestigationSource
} from "./types.ts";

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
