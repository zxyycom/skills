import {
  type DecisionApplicationAttention,
  type DecisionApplicationFailure
} from "./application-result.ts";
import { type DecisionHistoryBaseline } from "./decision-history-baseline.ts";
import {
  activationRelationTransactionRequest,
  evolutionRelationTransactionRequest,
  prepareActivation,
  prepareEvolution,
  prepareMarkAligned
} from "./decision-lifecycle-transition.ts";
import {
  discardRelationTransactionRequest,
  prepareArchive,
  prepareDiscard
} from "./decision-lifecycle-archive.ts";
import {
  currentDecisionTimestamp,
  plainFailure
} from "./decision-lifecycle-support.ts";
import { decisionRelationTransactionRequiresHistoryBaseline } from "./decision-relation-transaction.ts";
import type { DecisionFileChange } from "./decision-transaction.ts";
import {
  type DecisionAlignment,
  type DecisionId,
  type DecisionRelationOverride,
  type DecisionRelationOverrideGroup,
  type DecisionScan,
  type DecisionSuccessor
} from "./types.ts";
import type { DecisionRelationReview } from "./decision-relation-transaction-types.ts";

export type DecisionLifecycleRequest =
  | {
      action: "activate";
      alignment: DecisionAlignment;
      keepUnrecordedHistory: boolean;
      decisionId: DecisionId;
      relationOverride: DecisionRelationOverride;
    }
  | {
      action: "evolve";
      discardId: DecisionId | null;
      deleteRecordedDecision: boolean;
      keepUnrecordedHistory: boolean;
      relationOverride: DecisionRelationOverride;
      relationOverrideGroups: readonly DecisionRelationOverrideGroup[];
      successors: readonly DecisionSuccessor[];
    }
  | {
      action: "archive";
      keepUnrecordedHistory: boolean;
      decisionIds: readonly DecisionId[];
    }
  | {
      action: "discard";
      decisionId: DecisionId;
      deleteRecordedDecision: boolean;
    }
  | {
      action: "mark-aligned";
      decisionId: DecisionId;
    };

export function requiresDecisionHistoryBaseline(
  scan: DecisionScan,
  request: DecisionLifecycleRequest
): boolean {
  if (keepsUnrecordedLifecycleHistory(request)) return false;
  switch (request.action) {
    case "archive":
      return true;
    case "discard":
      return decisionRelationTransactionRequiresHistoryBaseline(
        scan,
        discardRelationTransactionRequest(request)
      );
    case "activate": {
      const transaction = activationRelationTransactionRequest(scan, request);
      return (
        transaction !== null &&
        decisionRelationTransactionRequiresHistoryBaseline(scan, transaction)
      );
    }
    case "evolve":
      return decisionRelationTransactionRequiresHistoryBaseline(
        scan,
        evolutionRelationTransactionRequest(request)
      );
    default:
      return false;
  }
}

function keepsUnrecordedLifecycleHistory(
  request: DecisionLifecycleRequest
): boolean {
  if (request.action === "activate" || request.action === "archive") {
    return request.keepUnrecordedHistory;
  }
  if (request.action !== "evolve") return false;
  return (
    request.keepUnrecordedHistory &&
    (request.discardId === null || request.deleteRecordedDecision)
  );
}

export type DecisionLifecyclePreparation =
  | DecisionApplicationFailure
  | DecisionApplicationAttention
  | {
      changes: DecisionFileChange[];
      message: string;
      relationReview?: DecisionRelationReview;
      status: "ok";
    };

export function prepareDecisionLifecycle(
  scan: DecisionScan,
  request: DecisionLifecycleRequest,
  options: {
    currentTimestamp?: () => string;
    historyBaseline: DecisionHistoryBaseline | null;
  }
): DecisionLifecyclePreparation {
  if (
    requiresDecisionHistoryBaseline(scan, request) &&
    options.historyBaseline === null
  ) {
    return plainFailure(
      "Decision history baseline was not loaded before " + request.action + "."
    );
  }
  switch (request.action) {
    case "activate":
      return prepareActivation(
        scan,
        request,
        options.currentTimestamp ?? currentDecisionTimestamp,
        options.historyBaseline
      );
    case "evolve":
      return prepareEvolution(
        scan,
        request,
        options.currentTimestamp ?? currentDecisionTimestamp,
        options.historyBaseline
      );
    case "archive":
      return prepareArchive(
        scan,
        request.decisionIds,
        request.keepUnrecordedHistory,
        options.historyBaseline
      );
    case "discard":
      return prepareDiscard(
        scan,
        request.decisionId,
        request.deleteRecordedDecision,
        options.historyBaseline
      );
    case "mark-aligned":
      return prepareMarkAligned(scan, request.decisionId);
  }
}
