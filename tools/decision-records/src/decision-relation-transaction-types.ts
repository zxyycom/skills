import type {
  DecisionApplicationAttention,
  DecisionApplicationFailure
} from "./application-result.ts";
import type { DiscardableDecisionRecord } from "./decision-discard.ts";
import type { DecisionFileChange } from "./decision-transaction.ts";
import type {
  DecisionAlignment,
  DecisionCandidateRecord,
  DecisionId,
  DecisionRelation,
  DecisionRelationOverride,
  DecisionSuccessor,
  EstablishedDecisionRecord
} from "./types.ts";

export type PreparedSuccessorFields = {
  alignment: DecisionAlignment;
  finalRelations: DecisionRelation[];
  sourceRelations: DecisionRelation[];
};

export type PreparedSuccessor =
  | (PreparedSuccessorFields & {
      candidate: true;
      record: DecisionCandidateRecord;
    })
  | (PreparedSuccessorFields & {
      candidate: false;
      record: EstablishedDecisionRecord;
    });

export type DecisionRelationGraphPlan = {
  archivedPredecessors: EstablishedDecisionRecord[];
  discardedRecord: DiscardableDecisionRecord | null;
  successors: PreparedSuccessor[];
};

export type DecisionRelationTransactionPreparation =
  | DecisionApplicationAttention
  | DecisionApplicationFailure
  | {
      archivedPredecessors: EstablishedDecisionRecord[];
      changes: DecisionFileChange[];
      discardedRecord: DiscardableDecisionRecord | null;
      status: "ok";
      successors: PreparedSuccessor[];
    };

export type DecisionRelationTransactionRequest =
  | {
      discardId: DecisionId | null;
      deleteRecordedDecision: boolean;
      kind: "evolve";
      keepUnrecordedHistory: boolean;
      relationOverride: DecisionRelationOverride;
      successors: readonly DecisionSuccessor[];
    }
  | {
      discardId: DecisionId;
      deleteRecordedDecision: boolean;
      kind: "discard";
      keepUnrecordedHistory: false;
      relationOverride: { kind: "source" };
      successors: readonly [];
    };
