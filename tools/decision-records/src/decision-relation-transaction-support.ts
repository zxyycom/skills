import {
  decisionDiagnostic,
  decisionFailure,
  type DecisionApplicationFailure
} from "./application-result.ts";
import { prepareDiscardDecisionEligibility } from "./decision-discard.ts";
import type { DecisionRelationTransactionRequest } from "./decision-relation-transaction-types.ts";
import {
  isDecisionCandidateRecord,
  isEstablishedDecisionRecord,
  type DecisionId,
  type DecisionRecord,
  type DecisionRelation,
  type DecisionRelationOverride,
  type DecisionScan,
  type EstablishedDecisionRecord
} from "./types.ts";

export function findRecord(
  scan: DecisionScan,
  value: DecisionId
): DecisionRecord | null {
  return scan.records.find((record) => record.decisionId === value) ?? null;
}

export function findEstablishedRecord(
  scan: DecisionScan,
  value: DecisionId
): EstablishedDecisionRecord | null {
  const record = findRecord(scan, value);
  return record !== null && isEstablishedDecisionRecord(record) ? record : null;
}

export function cloneRelations(
  relations: readonly DecisionRelation[]
): DecisionRelation[] {
  return relations.map((relation) => ({ ...relation }));
}

export function resolveEffectiveRelations(
  sourceRelations: readonly DecisionRelation[],
  relationOverride: DecisionRelationOverride
): DecisionRelation[] {
  return cloneRelations(
    relationOverride.kind === "source"
      ? sourceRelations
      : relationOverride.relations
  );
}

export function relationsEqual(
  left: readonly DecisionRelation[],
  right: readonly DecisionRelation[]
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

export function plainRelationFailure(
  error: string
): DecisionApplicationFailure {
  return decisionFailure(
    [
      decisionDiagnostic({
        code: "decision-records.relation-invalid",
        reason: error,
        recovery:
          "Correct the selected successors and complete relation set, then retry the command.",
        target: "Decision relation transaction"
      })
    ],
    { presentation: "plain" }
  );
}

export function decisionRelationTransactionRequiresHistoryBaseline(
  scan: DecisionScan,
  request: DecisionRelationTransactionRequest
): boolean {
  const successors = request.successors.flatMap((successor) => {
    const record = findRecord(scan, successor.decisionId);
    if (
      record === null ||
      (!isDecisionCandidateRecord(record) &&
        !isEstablishedDecisionRecord(record))
    ) {
      return [];
    }
    return [
      {
        decisionId: record.decisionId,
        finalRelations: resolveEffectiveRelations(
          record.source.document.relations,
          request.relationOverride
        )
      }
    ];
  });
  if (successors.length !== request.successors.length) return false;
  const relations = successors.flatMap((successor) => successor.finalRelations);
  if (
    relations.some(
      (relation) => findEstablishedRecord(scan, relation.target) !== null
    )
  ) {
    return true;
  }
  if (request.deleteRecordedDecision) return false;
  const discarded = prepareDiscardDecisionEligibility(scan, request.discardId);
  return discarded.status === "ok" && discarded.record !== null;
}
