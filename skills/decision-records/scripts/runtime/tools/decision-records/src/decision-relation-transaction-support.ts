/*
 * Synced TypeScript runtime; repository maintenance edits tools/decision-records/src/decision-relation-transaction-support.ts.
 * Installed skill copies may be edited directly; updates overwrite matching files.
 * Repository: https://github.com/zxyycom/skills
 * Source path: tools/decision-records/src/decision-relation-transaction-support.ts
 * Maintained source: https://github.com/zxyycom/skills/blob/main/tools/decision-records/src/decision-relation-transaction-support.ts
 * Skill source directory: https://github.com/zxyycom/skills/tree/main/skills/decision-records
 * Rebuild: bun run sync:decision-records-cli
 */
import {
  createDecisionRecordLookup,
  findDecisionRecord,
  findEstablishedDecisionRecord,
  type DecisionRecordLookup
} from "./decision-record-lookup.ts";
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
  type DecisionRelation,
  type DecisionRelationOverride,
  type DecisionPreparationContext
} from "./types.ts";

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
  scan: DecisionPreparationContext,
  request: DecisionRelationTransactionRequest,
  records: DecisionRecordLookup = createDecisionRecordLookup(scan.records)
): boolean {
  const successors = request.successors.flatMap((successor) => {
    const record = findDecisionRecord(records, successor.decisionId);
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
          successor.relationOverride ?? request.relationOverride
        )
      }
    ];
  });
  if (successors.length !== request.successors.length) return false;
  const relations = successors.flatMap((successor) => successor.finalRelations);
  if (
    relations.some(
      (relation) =>
        findEstablishedDecisionRecord(records, relation.target) !== null ||
        scan.publishedBaseline?.entries[relation.target] !== undefined
    )
  ) {
    return true;
  }
  if (request.deleteRecorded) return false;
  const discarded = prepareDiscardDecisionEligibility(
    scan,
    request.discardId,
    records
  );
  return discarded.status === "ok" && discarded.record !== null;
}
