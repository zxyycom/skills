/*
 * Synced TypeScript runtime; repository maintenance edits tools/decision-records/src/lifecycle/decision-lifecycle-transition.ts.
 * Installed skill copies may be edited directly; updates overwrite matching files.
 * Repository: https://github.com/zxyycom/skills
 * Source path: tools/decision-records/src/lifecycle/decision-lifecycle-transition.ts
 * Maintained source: https://github.com/zxyycom/skills/blob/main/tools/decision-records/src/lifecycle/decision-lifecycle-transition.ts
 * Skill source directory: https://github.com/zxyycom/skills/tree/main/skills/decision-records
 * Rebuild: bun run sync:decision-records-cli
 */
import {
  createDecisionRecordLookup,
  findDecisionRecord,
  type DecisionRecordLookup
} from "../records/decision-record-lookup.ts";
import path from "node:path";
import {
  decisionRelationTransactionMessage,
  prepareDecisionRelationTransaction,
  type DecisionRelationTransactionRequest
} from "../relations/transactions/decision-relation-transaction.ts";
import { sourcePathForDecisionStatus } from "../collection/decision-path.ts";
import { serializeDecisionFrontmatter } from "../records/decision-metadata.ts";
import {
  findEstablishedRecord,
  findRecord,
  plainFailure
} from "./decision-lifecycle-support.ts";
import type { DecisionHistoryBaseline } from "../records/history/decision-history-baseline.ts";
import type {
  DecisionLifecyclePreparation,
  DecisionLifecycleRequest
} from "./decision-lifecycle-service.ts";
import {
  isActivationCandidateRecord,
  type DecisionId,
  type DecisionRecord,
  type DecisionPreparationContext,
  type EstablishedDecisionRecord
} from "../types.ts";

export function publicationRelationTransactionRequest(
  scan: DecisionPreparationContext,
  request: Extract<DecisionLifecycleRequest, { action: "publish" }>,
  records: DecisionRecordLookup = createDecisionRecordLookup(scan.records)
): DecisionRelationTransactionRequest | null {
  const record = findDecisionRecord(records, request.decisionId);
  if (record === null || !isActivationCandidateRecord(record)) {
    return null;
  }
  return {
    discardId: null,
    deleteRecorded: false,
    kind: "evolve",
    keepUnrecordedHistory: request.keepUnrecordedHistory,
    relationOverride: { kind: "source" },
    successors: [
      {
        alignment: request.alignment,
        decisionId: record.decisionId
      }
    ]
  };
}

export function preparePublication(
  scan: DecisionPreparationContext,
  request: Extract<DecisionLifecycleRequest, { action: "publish" }>,
  currentTimestamp: () => string,
  historyBaseline: DecisionHistoryBaseline | null,
  records: DecisionRecordLookup
): DecisionLifecyclePreparation {
  const record = findDecisionRecord(records, request.decisionId);
  if (record === null) {
    return plainFailure("Decision does not exist: " + request.decisionId);
  }
  if (!record.markdownExists) {
    return plainFailure("Decision body does not exist: " + record.sourcePath);
  }
  if (record.source.kind === "established") {
    return plainFailure(
      record.source.document.status === "archived"
        ? "publish establishes a decision candidate; use reactivate for an archived decision: " +
            record.sourcePath
        : "publish establishes a decision candidate; this decision is already an active formal record: " +
            record.sourcePath
    );
  }
  if (record.source.kind !== "candidate") {
    return plainFailure(
      "Validated decision source is unavailable: " + record.sourcePath
    );
  }
  const transactionRequest = publicationRelationTransactionRequest(
    scan,
    request,
    records
  );
  if (transactionRequest === null) {
    return plainFailure(
      "Validated decision candidate is unavailable: " + record.sourcePath
    );
  }
  const prepared = prepareDecisionRelationTransaction(
    scan,
    transactionRequest,
    currentTimestamp,
    historyBaseline,
    records
  );
  if (prepared.status !== "ok") {
    return prepared;
  }
  return {
    changes: prepared.changes,
    message: decisionRelationTransactionMessage(
      "Published new decision as " +
        request.alignment +
        " " +
        record.sourcePath,
      prepared
    ),
    relationReview: prepared.relationReview,
    status: "ok"
  };
}

export function prepareReactivation(
  scan: DecisionPreparationContext,
  request: Extract<DecisionLifecycleRequest, { action: "reactivate" }>
): DecisionLifecyclePreparation {
  const record = findRecord(scan, request.decisionId);
  if (record === null) {
    return plainFailure("Decision does not exist: " + request.decisionId);
  }
  if (!record.markdownExists) {
    return plainFailure("Decision body does not exist: " + record.sourcePath);
  }
  if (record.source.kind !== "established") {
    return plainFailure(
      "reactivate requires an archived established decision; use publish for a decision candidate: " +
        record.sourcePath
    );
  }
  const source = record.source;
  if (source.document.status !== "archived") {
    return plainFailure(
      "reactivate requires an archived decision: " + record.sourcePath
    );
  }
  const targetSourcePath = sourcePathForDecisionStatus(
    record.sourcePath,
    "active"
  );
  if (targetSourcePath === null) {
    return plainFailure(
      "Decision source path cannot move to active lifecycle location: " +
        record.sourcePath
    );
  }
  return reactivationResult(request, record, source, targetSourcePath);
}

function reactivationResult(
  request: Extract<DecisionLifecycleRequest, { action: "reactivate" }>,
  record: DecisionRecord,
  source: EstablishedDecisionRecord["source"],
  targetSourcePath: string
): DecisionLifecyclePreparation {
  const nextText =
    serializeDecisionFrontmatter(
      request.decisionId,
      source.document,
      source.document.tags,
      {
        alignment: request.alignment,
        createdAt: source.document.createdAt,
        status: "active"
      }
    ) + source.body;
  return {
    changes: [
      {
        decisionPath: record.decisionPath,
        expectedText: source.text,
        nextText,
        targetPath: path.resolve(
          path.dirname(record.decisionPath),
          "..",
          ...targetSourcePath.split("/")
        )
      }
    ],
    message:
      "Reactivated as " + request.alignment + " " + record.sourcePath + ".",
    status: "ok"
  };
}

export function prepareEvolution(
  scan: DecisionPreparationContext,
  request: Extract<DecisionLifecycleRequest, { action: "evolve" }>,
  currentTimestamp: () => string,
  historyBaseline: DecisionHistoryBaseline | null,
  records: DecisionRecordLookup
): DecisionLifecyclePreparation {
  const prepared = prepareDecisionRelationTransaction(
    scan,
    evolutionRelationTransactionRequest(request),
    currentTimestamp,
    historyBaseline,
    records
  );
  if (prepared.status !== "ok") {
    return prepared;
  }
  return {
    changes: prepared.changes,
    message: decisionRelationTransactionMessage(
      "Evolved successors " +
        prepared.successors
          .map(
            (successor) =>
              successor.alignment + " " + successor.record.sourcePath
          )
          .join(", "),
      prepared
    ),
    relationReview: prepared.relationReview,
    status: "ok"
  };
}

export function evolutionRelationTransactionRequest(
  request: Extract<DecisionLifecycleRequest, { action: "evolve" }>
): DecisionRelationTransactionRequest {
  const { relationOverrideGroups: _, ...transactionRequest } = request;
  return { ...transactionRequest, kind: "evolve" };
}

export function prepareMarkAligned(
  scan: DecisionPreparationContext,
  decisionId: DecisionId
): DecisionLifecyclePreparation {
  const record = findEstablishedRecord(scan, decisionId);
  if (record === null) {
    return plainFailure("Established decision does not exist: " + decisionId);
  }
  const source = record.source;
  if (
    source.document.status !== "active" ||
    source.document.alignment !== "unaligned"
  ) {
    return plainFailure(
      "mark-aligned requires an active unaligned decision: " + record.sourcePath
    );
  }
  const nextText =
    serializeDecisionFrontmatter(
      record.decisionId,
      source.document,
      source.document.tags,
      {
        alignment: "aligned",
        createdAt: source.document.createdAt,
        status: "active"
      }
    ) + source.body;
  return {
    changes: [
      {
        decisionPath: record.decisionPath,
        expectedText: source.text,
        nextText
      }
    ],
    message: "Marked aligned " + record.sourcePath + ".",
    status: "ok"
  };
}
