import path from "node:path";
import {
  decisionRelationTransactionMessage,
  prepareDecisionRelationTransaction,
  type DecisionRelationTransactionRequest
} from "./decision-relation-transaction.ts";
import { sourcePathForDecisionStatus } from "./decision-path.ts";
import { serializeDecisionFrontmatter } from "./decision-metadata.ts";
import {
  findEstablishedRecord,
  findRecord,
  plainFailure
} from "./decision-lifecycle-support.ts";
import type { DecisionHistoryBaseline } from "./decision-history-baseline.ts";
import type {
  DecisionLifecyclePreparation,
  DecisionLifecycleRequest
} from "./decision-lifecycle-service.ts";
import {
  isActivationCandidateRecord,
  type DecisionId,
  type DecisionScan
} from "./types.ts";

export function activationRelationTransactionRequest(
  scan: DecisionScan,
  request: Extract<DecisionLifecycleRequest, { action: "activate" }>
): DecisionRelationTransactionRequest | null {
  const record = findRecord(scan, request.decisionId);
  if (record === null || !isActivationCandidateRecord(record)) {
    return null;
  }
  return {
    discardId: null,
    deleteRecordedDecision: false,
    kind: "evolve",
    keepUnrecordedHistory: request.keepUnrecordedHistory,
    relationOverride: request.relationOverride,
    successors: [
      {
        alignment: request.alignment,
        decisionId: record.decisionId
      }
    ]
  };
}

export function prepareActivation(
  scan: DecisionScan,
  request: Extract<DecisionLifecycleRequest, { action: "activate" }>,
  currentTimestamp: () => string,
  historyBaseline: DecisionHistoryBaseline | null
): DecisionLifecyclePreparation {
  const record = findRecord(scan, request.decisionId);
  if (record === null) {
    return plainFailure("Decision does not exist: " + request.decisionId);
  }
  if (!record.markdownExists) {
    return plainFailure("Decision body does not exist: " + record.sourcePath);
  }

  if (record.source.kind === "candidate") {
    const transactionRequest = activationRelationTransactionRequest(
      scan,
      request
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
      historyBaseline
    );
    if (prepared.status !== "ok") {
      return prepared;
    }
    return {
      changes: prepared.changes,
      message: decisionRelationTransactionMessage(
        "Activated new decision as " +
          request.alignment +
          " " +
          record.sourcePath,
        prepared
      ),
      relationReview: prepared.relationReview,
      status: "ok"
    };
  }

  if (record.source.kind !== "established") {
    return plainFailure(
      "Validated decision source is unavailable: " + record.sourcePath
    );
  }
  const source = record.source;

  if (request.relationOverride.kind === "replace") {
    return plainFailure(
      "--relation and --clear-relations apply only when activate establishes " +
        "a new decision candidate: " +
        record.sourcePath
    );
  }
  if (source.document.status === "active") {
    if (source.document.alignment !== request.alignment) {
      return plainFailure(
        source.document.alignment === "unaligned"
          ? "Use mark-aligned to change an active decision from unaligned to aligned."
          : "An aligned active decision cannot be changed back to unaligned."
      );
    }
    return {
      changes: [],
      message:
        "Decision is already active and " +
        request.alignment +
        ": " +
        record.sourcePath +
        ".",
      status: "ok"
    };
  }
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
      "Activated as " + request.alignment + " " + record.sourcePath + ".",
    status: "ok"
  };
}

export function prepareEvolution(
  scan: DecisionScan,
  request: Extract<DecisionLifecycleRequest, { action: "evolve" }>,
  currentTimestamp: () => string,
  historyBaseline: DecisionHistoryBaseline | null
): DecisionLifecyclePreparation {
  const prepared = prepareDecisionRelationTransaction(
    scan,
    { ...request, kind: "evolve" },
    currentTimestamp,
    historyBaseline
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

export function prepareMarkAligned(
  scan: DecisionScan,
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
