/*
 * Synced TypeScript runtime; repository maintenance edits tools/decision-records/src/decision-lifecycle-service.ts.
 * Installed skill copies may be edited directly; updates overwrite matching files.
 * Repository: https://github.com/zxyycom/skills
 * Source path: tools/decision-records/src/decision-lifecycle-service.ts
 * Maintained source: https://github.com/zxyycom/skills/blob/main/tools/decision-records/src/decision-lifecycle-service.ts
 * Skill source directory: https://github.com/zxyycom/skills/tree/main/skills/decision-records
 * Rebuild: bun run sync:decision-records-cli
 */
import {
  createDecisionRecordLookup,
  type DecisionRecordLookup
} from "./decision-record-lookup.ts";
import {
  type DecisionApplicationAttention,
  type DecisionApplicationFailure
} from "./application-result.ts";
import { type DecisionHistoryBaseline } from "./decision-history-baseline.ts";
import {
  evolutionRelationTransactionRequest,
  prepareEvolution,
  prepareMarkAligned,
  preparePublication,
  prepareReactivation,
  publicationRelationTransactionRequest
} from "./decision-lifecycle-transition.ts";
import {
  discardRelationTransactionRequest,
  prepareArchive,
  prepareDiscard
} from "./decision-lifecycle-archive.ts";
import {
  prepareDecisionSetRelations,
  type DecisionSetRelationsRequest
} from "./decision-relation-maintenance.ts";
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
      action: "publish";
      alignment: DecisionAlignment;
      keepUnrecordedHistory: boolean;
      decisionId: DecisionId;
    }
  | {
      action: "reactivate";
      alignment: DecisionAlignment;
      decisionId: DecisionId;
    }
  | {
      action: "evolve";
      deleteRecorded: boolean;
      discardId: DecisionId | null;
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
      deleteRecorded: boolean;
    }
  | {
      action: "mark-aligned";
      decisionId: DecisionId;
    }
  | DecisionSetRelationsRequest;

export function requiresDecisionHistoryBaseline(
  scan: DecisionScan,
  request: DecisionLifecycleRequest,
  records: DecisionRecordLookup = createDecisionRecordLookup(scan.records)
): boolean {
  if (keepsUnrecordedLifecycleHistory(request)) return false;
  switch (request.action) {
    case "archive":
      return true;
    case "discard":
      return decisionRelationTransactionRequiresHistoryBaseline(
        scan,
        discardRelationTransactionRequest(request),
        records
      );
    case "publish": {
      const transaction = publicationRelationTransactionRequest(
        scan,
        request,
        records
      );
      return (
        transaction !== null &&
        decisionRelationTransactionRequiresHistoryBaseline(
          scan,
          transaction,
          records
        )
      );
    }
    case "evolve":
      return decisionRelationTransactionRequiresHistoryBaseline(
        scan,
        evolutionRelationTransactionRequest(request),
        records
      );
    default:
      return false;
  }
}

function keepsUnrecordedLifecycleHistory(
  request: DecisionLifecycleRequest
): boolean {
  if (request.action === "publish" || request.action === "archive") {
    return request.keepUnrecordedHistory;
  }
  if (request.action !== "evolve") return false;
  return (
    request.keepUnrecordedHistory &&
    (request.discardId === null || request.deleteRecorded)
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
    records?: DecisionRecordLookup;
  }
): DecisionLifecyclePreparation {
  const records = options.records ?? createDecisionRecordLookup(scan.records);
  if (
    requiresDecisionHistoryBaseline(scan, request, records) &&
    options.historyBaseline === null
  ) {
    return plainFailure(
      "Decision history baseline was not loaded before " + request.action + "."
    );
  }
  switch (request.action) {
    case "publish":
      return preparePublication(
        scan,
        request,
        options.currentTimestamp ?? currentDecisionTimestamp,
        options.historyBaseline,
        records
      );
    case "reactivate":
      return prepareReactivation(scan, request);
    case "evolve":
      return prepareEvolution(
        scan,
        request,
        options.currentTimestamp ?? currentDecisionTimestamp,
        options.historyBaseline,
        records
      );
    case "archive":
      return prepareArchive(
        records,
        request.decisionIds,
        request.keepUnrecordedHistory,
        options.historyBaseline
      );
    case "discard":
      return prepareDiscard(
        scan,
        request.decisionId,
        request.deleteRecorded,
        options.historyBaseline,
        records
      );
    case "mark-aligned":
      return prepareMarkAligned(scan, request.decisionId);
    case "set-relations":
      return prepareDecisionSetRelations(scan, request, records);
  }
}
